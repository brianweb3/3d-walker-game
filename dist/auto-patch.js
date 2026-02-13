// Auto-patch для автоматического добавления монет и экспорта позиции персонажа
// Этот скрипт перехватывает React Three Fiber и добавляет необходимый функционал

(function() {
  'use strict';

  console.log('🔧 Auto-patch загружен, ожидание React Three Fiber...');

  // Ждем загрузки React и React Three Fiber
  function waitForR3F() {
    // Проверяем наличие React
    if (typeof React === 'undefined' && typeof window.React === 'undefined') {
      setTimeout(waitForR3F, 100);
      return;
    }

    const React = window.React || window.ReactDOM?.React;
    if (!React) {
      setTimeout(waitForR3F, 100);
      return;
    }

    console.log('✅ React найден, патчим React Three Fiber...');

    // Патчим useThree hook если он доступен
    patchUseThree();

    // Патчим Canvas компонент
    patchCanvas();

    // Пытаемся найти сцену через различные методы
    findAndExportScene();
    
    // Также запускаем периодический поиск игрока
    startPlayerSearchLoop();
    
    // Запускаем агрессивный поиск через traverse каждые 2 секунды
    startAggressiveTraverseSearch();
  }
  
  // Агрессивный поиск через traverse сцены
  function startAggressiveTraverseSearch() {
    let attempts = 0;
    const maxAttempts = 30; // 60 секунд при интервале 2 секунды
    
    const searchInterval = setInterval(() => {
      attempts++;
      
      // Если игрок уже найден, останавливаем поиск
      if (window.__playerMesh && window.__playerMesh.position && window.getPlayerPosition) {
        console.log('✅ Игрок найден через агрессивный traverse поиск, останавливаем');
        clearInterval(searchInterval);
        return;
      }
      
      // Пытаемся найти сцену и игрока
      if (window.getScene && typeof window.getScene === 'function') {
        try {
          const scene = window.getScene();
          if (scene && scene.traverse) {
            const playerMesh = aggressiveFindPlayer(scene);
            if (playerMesh && playerMesh.position) {
              console.log('🎯 Игрок найден через периодический traverse поиск!');
              exportPlayerPosition(playerMesh);
              clearInterval(searchInterval);
              return;
            }
          }
        } catch (e) {
          console.warn('⚠️ Ошибка в агрессивном traverse поиске:', e);
        }
      }
      
      if (attempts >= maxAttempts) {
        console.warn('⚠️ Агрессивный traverse поиск завершен после', maxAttempts, 'попыток');
        clearInterval(searchInterval);
      }
    }, 2000); // Проверяем каждые 2 секунды
  }
  
  // Периодический поиск игрока, если он еще не найден
  function startPlayerSearchLoop() {
    let attempts = 0;
    const maxAttempts = 100; // 10 секунд при интервале 100ms
    
    const searchPlayer = setInterval(() => {
      attempts++;
      
      // Если игрок уже найден, останавливаем поиск
      if (window.__playerMesh && window.__playerMesh.position && window.getPlayerPosition) {
        console.log('✅ Игрок найден, останавливаем поиск');
        clearInterval(searchPlayer);
        return;
      }
      
      // Пытаемся найти игрока
      if (window.getScene && typeof window.getScene === 'function') {
        try {
          const scene = window.getScene();
          if (scene && scene.children) {
            // Рекурсивный поиск игрока
            const findPlayer = (obj) => {
              if (!obj) return null;
              
              const name = obj.name ? obj.name.toLowerCase() : '';
              if (obj.position && (
                name.includes('explorer') ||
                name.includes('player') ||
                name.includes('character') ||
                obj.userData?.isPlayer ||
                obj.userData?.isExplorer ||
                (obj.type === 'Group' && obj.children && obj.children.length > 0)
              )) {
                return obj;
              }
              
              if (obj.children) {
                for (const child of obj.children) {
                  const found = findPlayer(child);
                  if (found) return found;
                }
              }
              
              return null;
            };
            
            const playerMesh = findPlayer(scene);
            if (playerMesh && playerMesh.position) {
              console.log('🎯 Игрок найден через периодический поиск:', playerMesh.name || playerMesh.type);
              exportPlayerPosition(playerMesh);
              clearInterval(searchPlayer);
              return;
            }
          }
        } catch (e) {
          // Ignore
        }
      }
      
      if (attempts >= maxAttempts) {
        console.warn('⚠️ Игрок не найден после', maxAttempts, 'попыток');
        clearInterval(searchPlayer);
      }
    }, 100); // Проверяем каждые 100ms
  }

  function patchUseThree() {
    // Если useThree доступен глобально
    if (window.useThree) {
      const originalUseThree = window.useThree;
      window.useThree = function(...args) {
        const result = originalUseThree.apply(this, args);
        
        // Экспортируем scene и THREE
        if (result && result.scene) {
          window.setTHREE(window.THREE || result.gl?.domElement?.__THREE__);
          if (window.addCoinsToScene && !window.__coinsAdded) {
            setTimeout(() => {
              window.addCoinsToScene(result.scene, window.THREE);
              window.__coinsAdded = true;
            }, 500);
          }
        }
        
        return result;
      };
      console.log('✅ useThree hook запатчен');
    }

    // Пытаемся найти mr() функцию (минифицированный useThree)
    // Ищем все функции которые могут быть useThree
    for (const key in window) {
      if (key.length <= 3 && typeof window[key] === 'function') {
        try {
          // Проверяем если это может быть useThree
          const testResult = window[key]();
          if (testResult && (testResult.scene || testResult.camera || testResult.gl)) {
            console.log(`✅ Найдена функция ${key}, патчим как useThree...`);
            const original = window[key];
            window[key] = function(...args) {
              const result = original.apply(this, args);
              if (result && result.scene) {
                exportScene(result.scene);
              }
              return result;
            };
          }
        } catch (e) {
          // Ignore
        }
      }
    }
  }

  function patchCanvas() {
    // Пытаемся найти Canvas компонент через React DevTools hook
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      
      const originalOnCommitFiberRoot = hook.onCommitFiberRoot;
      hook.onCommitFiberRoot = function(id, root, ...args) {
        if (originalOnCommitFiberRoot) {
          originalOnCommitFiberRoot.apply(this, [id, root, ...args]);
        }
        
        // Ищем Canvas и Scene в fiber tree
        if (root && root.current) {
          setTimeout(() => {
            findSceneAndPlayerInFiber(root.current);
          }, 500);
        }
      };
      
      console.log('✅ React DevTools hook запатчен');
    }
  }

  function findSceneAndPlayerInFiber(fiber, depth = 0) {
    if (depth > 50) return; // Increased depth
    if (!fiber) return;

    // Ищем React refs которые могут содержать player mesh
    if (fiber.memoizedState) {
      let state = fiber.memoizedState;
      let stateDepth = 0;
      while (state && stateDepth < 20) {
        // Проверяем refs в memoizedState
        if (state.memoizedProps && state.memoizedProps.ref) {
          const ref = state.memoizedProps.ref;
          if (ref && ref.current && ref.current.position) {
            const mesh = ref.current;
            // Проверяем если это Group с персонажем (имеет getWorldPosition и children с костями)
            if (mesh.position && (
              mesh.type === 'Group' ||
              (mesh.children && mesh.children.some(child => 
                child.name && (
                  child.name.includes('mixamorig') ||
                  child.name.includes('LeftFoot') ||
                  child.name.includes('RightFoot') ||
                  child.name.toLowerCase().includes('explorer')
                )
              ))
            )) {
              console.log('✅ Player найден через React ref (Group)!');
              if (exportPlayerPosition(mesh)) {
                return; // Successfully exported, stop searching
              }
            }
          }
        }
        
        // Проверяем useRef hooks в memoizedState (useRef создает {current: value})
        if (state.memoizedState && typeof state.memoizedState === 'object') {
          // Проверяем если это ref объект с current
          if (state.memoizedState.current && state.memoizedState.current.position) {
            const mesh = state.memoizedState.current;
            // Проверяем если это Group с персонажем (имеет getWorldPosition)
            if (mesh.type === 'Group' && mesh.getWorldPosition) {
              // Проверяем children на наличие костей персонажа
              const hasPlayerBones = mesh.children && mesh.children.some(child => 
                child.name && (
                  child.name.includes('mixamorig') ||
                  child.name.includes('LeftFoot') ||
                  child.name.includes('RightFoot') ||
                  child.name.toLowerCase().includes('explorer')
                )
              );
              if (hasPlayerBones || mesh.children && mesh.children.length > 0) {
                console.log('✅ Player найден через useRef в memoizedState!');
                if (exportPlayerPosition(mesh)) {
                  return; // Successfully exported, stop searching
                }
              }
            }
          }
        }
        
        // Проверяем ref в stateNode
        if (state.stateNode && state.stateNode.refs) {
          for (const key in state.stateNode.refs) {
            const ref = state.stateNode.refs[key];
            if (ref && ref.current && ref.current.position) {
              const mesh = ref.current;
              // Проверяем если это Group с персонажем
              if (mesh.type === 'Group' && mesh.getWorldPosition) {
                console.log('✅ Player найден через stateNode.refs!');
                if (exportPlayerPosition(mesh)) {
                  return; // Successfully exported, stop searching
                }
              }
            }
          }
        }
        
        state = state.next;
        stateDepth++;
      }
    }

    // Ищем Scene в memoizedState
    if (fiber.memoizedState) {
      let state = fiber.memoizedState;
      let stateDepth = 0;
      while (state && stateDepth < 20) {
        // Проверяем memoizedState.scene
        if (state.memoizedState) {
          if (state.memoizedState.scene && state.memoizedState.scene.isScene) {
            const scene = state.memoizedState.scene;
            console.log('✅ Scene найдена через React Fiber memoizedState!');
            exportScene(scene);
          }
          // Также проверяем напрямую
          if (state.memoizedState.isScene) {
            console.log('✅ Scene найдена напрямую!');
            exportScene(state.memoizedState);
          }
        }
        // Проверяем scene в state напрямую
        if (state.scene && state.scene.isScene) {
          console.log('✅ Scene найдена в state!');
          exportScene(state.scene);
        }
        state = state.next;
        stateDepth++;
      }
    }

    // Ищем через stateNode (для компонентов)
    if (fiber.stateNode) {
      const node = fiber.stateNode;
      
      // Проверяем если это store с getState
      if (node && typeof node.getState === 'function') {
        try {
          const state = node.getState();
          if (state && state.scene && state.scene.isScene) {
            console.log('✅ Scene найдена через store.getState()!');
            exportScene(state.scene);
          }
        } catch (e) {
          // Ignore
        }
      }
      
      // Ищем player mesh - проверяем группы и меши
      const checkForPlayer = (obj) => {
        if (!obj || !obj.position) return null;
        
        const name = obj.name ? obj.name.toLowerCase() : '';
        const type = obj.type || '';
        
        // Проверяем если это группа с персонажем или сам персонаж
        if (type === 'Group' || type === 'Object3D') {
          // Проверяем children группы
          if (obj.children && obj.children.length > 0) {
            for (const child of obj.children) {
              const childName = child.name ? child.name.toLowerCase() : '';
              if (childName.includes('explorer') || childName.includes('mixamo') || childName.includes('armature')) {
                return obj; // Возвращаем группу, а не child
              }
            }
          }
        }
        
        // Проверяем по имени
        if (name.includes('explorer') || name.includes('player') || name.includes('character')) {
          return obj;
        }
        
        return null;
      };
      
      const playerMesh = checkForPlayer(node);
      if (playerMesh) {
        console.log('✅ Player mesh найден:', playerMesh.name || playerMesh.type);
        if (exportPlayerPosition(playerMesh)) {
          return; // Successfully exported, stop searching
        }
      }
      
      // Рекурсивно проверяем children для поиска player
      if (node && node.children) {
        const findPlayerRecursive = (obj) => {
          const found = checkForPlayer(obj);
          if (found) return found;
          
          if (obj.children) {
            for (const child of obj.children) {
              const result = findPlayerRecursive(child);
              if (result) return result;
            }
          }
          return null;
        };
        
        for (const child of node.children) {
          const found = findPlayerRecursive(child);
          if (found) {
            console.log('✅ Player mesh найден рекурсивно:', found.name || found.type);
            if (exportPlayerPosition(found)) {
              return; // Successfully exported, stop searching
            }
            break;
          }
        }
      }
    }

    // Ищем в props
    if (fiber.memoizedProps) {
      const props = fiber.memoizedProps;
      if (props.scene && props.scene.isScene) {
        console.log('✅ Scene найдена в props!');
        exportScene(props.scene);
      }
    }

    // Рекурсивно ищем в детях
    if (fiber.child) findSceneAndPlayerInFiber(fiber.child, depth + 1);
    if (fiber.sibling) findSceneAndPlayerInFiber(fiber.sibling, depth + 1);
    if (fiber.return) findSceneAndPlayerInFiber(fiber.return, depth + 1);
  }

  // Агрессивный поиск игрока через traverse всех объектов
  function aggressiveFindPlayer(scene) {
    if (!scene || !scene.traverse) return null;
    
    let candidate = null;
    let maxScore = 0;
    let maxChildren = 0;
    
    try {
      scene.traverse((obj) => {
        if (!obj || !obj.position || typeof obj.position.x !== 'number') return;
        
        let score = 0;
        const name = obj.name ? obj.name.toLowerCase() : '';
        
        // Очки за имя (высокий приоритет)
        if (name.includes('explorer')) score += 100;
        if (name.includes('player')) score += 80;
        if (name.includes('character')) score += 70;
        if (name.includes('walker')) score += 60;
        if (name.includes('person') || name.includes('human')) score += 50;
        
        // Очки за userData (высокий приоритет)
        if (obj.userData) {
          if (obj.userData.isPlayer) score += 90;
          if (obj.userData.isExplorer) score += 85;
          if (obj.userData.type === 'character') score += 75;
        }
        
        // Очки за количество детей (персонажи обычно сложные объекты)
        const childrenCount = obj.children ? obj.children.length : 0;
        if (childrenCount > maxChildren) {
          maxChildren = childrenCount;
        }
        if (childrenCount > 5) score += 40;
        if (childrenCount > 10) score += 60;
        if (childrenCount > 15) score += 80;
        
        // Очки за анимации (персонажи обычно анимированы)
        if (obj.animations && obj.animations.length > 0) {
          score += 50;
        }
        
        // Очки за тип Group (персонажи часто Group)
        if (obj.type === 'Group' && childrenCount > 3) {
          score += 30;
        }
        
        // Очки за наличие getWorldPosition (обычно есть у персонажей)
        if (obj.getWorldPosition && typeof obj.getWorldPosition === 'function') {
          score += 20;
        }
        
        // Проверяем наличие костей анимации в children
        if (obj.children) {
          const hasBones = obj.children.some(child => {
            const childName = child.name ? child.name.toLowerCase() : '';
            return childName.includes('mixamorig') || 
                   childName.includes('bone') || 
                   childName.includes('armature');
          });
          if (hasBones) score += 60;
        }
        
        // Выбираем лучшего кандидата
        if (score > maxScore) {
          maxScore = score;
          candidate = obj;
        }
      });
    } catch (e) {
      console.warn('⚠️ Ошибка при traverse сцены:', e);
      return null;
    }
    
    // Если нашли кандидата с достаточным количеством очков
    if (candidate && maxScore > 30) {
      // Валидация кандидата
      if (candidate.position && typeof candidate.position.x === 'number' && 
          !isNaN(candidate.position.x) && isFinite(candidate.position.x)) {
        console.log('🎯 Найден кандидат на игрока через traverse:', {
          name: candidate.name,
          type: candidate.type,
          score: maxScore,
          children: candidate.children?.length,
          hasAnimations: candidate.animations?.length > 0,
          position: {
            x: candidate.position.x,
            y: candidate.position.y,
            z: candidate.position.z
          }
        });
        return candidate;
      }
    }
    
    return null;
  }

  function exportScene(scene) {
    if (!scene || !scene.isScene) {
      console.warn('⚠️ Попытка экспортировать не-сцену:', scene);
      return;
    }

    if (window.__sceneExported) {
      console.log('ℹ️ Сцена уже экспортирована');
      return;
    }

    console.log('✅ Экспортируем сцену:', scene);

    // Экспортируем сцену через window.getScene
    window.getScene = () => scene;
    
    // Также сохраняем ссылку напрямую
    window.__scene = scene;

    // Экспортируем THREE если еще не экспортирован
    if (!window.THREE) {
      // Пытаемся найти THREE через scene
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
        if (gl) {
          // THREE обычно доступен через window или глобально
          for (const key in window) {
            if (key.includes('THREE') || key.includes('Three')) {
              const obj = window[key];
              if (obj && obj.Scene && obj.Mesh) {
                window.THREE = obj;
                if (window.setTHREE) window.setTHREE(obj);
                console.log('✅ THREE.js найден:', key);
                break;
              }
            }
          }
        }
      }

      // Если не нашли, пытаемся получить из scene
      if (!window.THREE && scene.constructor) {
        const SceneClass = scene.constructor;
        if (SceneClass.name === 'Scene') {
          // Пытаемся найти THREE через конструктор
          for (const key in window) {
            const obj = window[key];
            if (obj && obj.Scene === SceneClass) {
              window.THREE = obj;
              if (window.setTHREE) window.setTHREE(obj);
              console.log('✅ THREE.js найден через конструктор:', key);
              break;
            }
          }
        }
      }
    }

    window.__sceneExported = true;

    // Агрессивный поиск игрока сразу после экспорта сцены
    setTimeout(() => {
      // Метод 1: Агрессивный поиск через traverse
      const playerMesh = aggressiveFindPlayer(scene);
      if (playerMesh && playerMesh.position) {
        console.log('🎯 Игрок найден через агрессивный поиск в exportScene!');
        if (exportPlayerPosition(playerMesh)) {
          return; // Успешно экспортирован
        }
      }
      
      // Метод 2: Поиск через traverse всех объектов сцены
      if (scene.traverse) {
        let foundPlayer = false;
        scene.traverse((obj) => {
          if (foundPlayer) return;
          if (!obj || !obj.position) return;
          
          const name = obj.name ? obj.name.toLowerCase() : '';
          const hasPosition = obj.position && typeof obj.position.x === 'number';
          
          if (hasPosition && (
            name.includes('explorer') ||
            name.includes('player') ||
            name.includes('character') ||
            name.includes('walker') ||
            obj.userData?.isPlayer ||
            obj.userData?.isExplorer ||
            (obj.type === 'Group' && obj.children && obj.children.length > 5)
          )) {
            console.log('🎯 Игрок найден через traverse в exportScene!', obj.name || obj.type);
            if (exportPlayerPosition(obj)) {
              foundPlayer = true;
            }
          }
        });
      }
    }, 500);
    
    // Также патчим traverse для перехвата всех объектов
    if (scene.traverse && !scene.__traversePatched) {
      const originalTraverse = scene.traverse;
      scene.traverse = function(callback) {
        const result = originalTraverse.call(this, callback);
        
        // После каждого traverse пытаемся найти игрока
        setTimeout(() => {
          const playerMesh = aggressiveFindPlayer(scene);
          if (playerMesh && playerMesh.position && !window.__playerMesh) {
            console.log('🎯 Игрок найден через патченный traverse!');
            exportPlayerPosition(playerMesh);
          }
        }, 100);
        
        return result;
      };
      scene.__traversePatched = true;
      console.log('✅ Scene.traverse запатчен для поиска игрока');
    }

    // Добавляем монеты
    if (window.addCoinsToScene && window.THREE && !window.__coinsAdded) {
      console.log('🎯 Добавляем монеты в сцену...');
      setTimeout(() => {
        try {
          window.addCoinsToScene(scene, window.THREE);
          window.__coinsAdded = true;
          console.log('✅ Монеты добавлены в сцену!');
        } catch (e) {
          console.error('❌ Ошибка при добавлении монет:', e);
        }
      }, 1000);
    } else {
      console.warn('⚠️ Не могу добавить монеты:', {
        addCoinsToScene: !!window.addCoinsToScene,
        THREE: !!window.THREE,
        coinsAdded: window.__coinsAdded
      });
    }

    // Применяем зеленый цвет к штанам автоматически
    setTimeout(() => {
      if (window.applyGreenToPants && typeof window.applyGreenToPants === 'function') {
        try {
          console.log('🎨 Автоматически применяем зеленый цвет к штанам через auto-patch...');
          window.applyGreenToPants(scene);
        } catch (e) {
          console.warn('⚠️ Ошибка при применении зеленого цвета к штанам:', e);
        }
      } else {
        // Если функция еще не загружена, ждем и пробуем снова
        setTimeout(() => {
          if (window.applyGreenToPants && typeof window.applyGreenToPants === 'function') {
            try {
              console.log('🎨 Применяем зеленый цвет к штанам (повторная попытка)...');
              window.applyGreenToPants(scene);
            } catch (e) {
              console.warn('⚠️ Ошибка при применении зеленого цвета к штанам:', e);
            }
          }
        }, 2000);
      }
    }, 2000);
  }

  function exportPlayerPosition(mesh) {
    // Validate mesh before proceeding
    if (!mesh) {
      console.warn('⚠️ exportPlayerPosition: mesh отсутствует');
      return false;
    }
    
    if (!mesh.position || typeof mesh.position.x !== 'number') {
      console.warn('⚠️ exportPlayerPosition: mesh.position отсутствует или невалидна', {
        hasMesh: !!mesh,
        hasPosition: !!mesh.position,
        positionType: mesh.position ? typeof mesh.position.x : 'undefined'
      });
      return false;
    }

    console.log('🎯 Экспортируем позицию персонажа из:', mesh.name || mesh.type || 'unknown', 'position:', mesh.position.x, mesh.position.y, mesh.position.z);

    // Сохраняем ссылку на mesh для постоянного доступа
    window.__playerMesh = mesh;

    // Создаем функцию для получения позиции - читает каждый раз свежую позицию
    const getPosition = () => {
      // Всегда используем актуальную ссылку на mesh
      const currentMesh = window.__playerMesh || mesh;
      
      if (!currentMesh) {
        if (window.__positionGetterErrors < 5) {
          window.__positionGetterErrors = (window.__positionGetterErrors || 0) + 1;
          console.warn('⚠️ getPosition: mesh отсутствует');
        }
        return null;
      }
      
      if (!currentMesh.position || typeof currentMesh.position.x !== 'number') {
        if (window.__positionGetterErrors < 5) {
          window.__positionGetterErrors = (window.__positionGetterErrors || 0) + 1;
          console.warn('⚠️ getPosition: position отсутствует или невалидна');
        }
        return null;
      }
      
      // Если это Group, используем getWorldPosition для точной позиции
      if (currentMesh.getWorldPosition && typeof currentMesh.getWorldPosition === 'function' && window.THREE && window.THREE.Vector3) {
        try {
          // Создаем новый Vector3 для получения world position
          const worldPos = new window.THREE.Vector3();
          currentMesh.getWorldPosition(worldPos);
          
          // Validate world position
          if (typeof worldPos.x === 'number' && !isNaN(worldPos.x) && isFinite(worldPos.x) &&
              typeof worldPos.z === 'number' && !isNaN(worldPos.z) && isFinite(worldPos.z)) {
            return {
              x: worldPos.x,
              y: typeof worldPos.y === 'number' && !isNaN(worldPos.y) && isFinite(worldPos.y) ? worldPos.y : 0,
              z: worldPos.z
            };
          }
        } catch (e) {
          if (window.__positionGetterErrors < 5) {
            window.__positionGetterErrors = (window.__positionGetterErrors || 0) + 1;
            console.warn('⚠️ Ошибка при получении world position:', e);
          }
          // Fallback to local position
        }
      }
      
      // Используем локальную позицию (всегда читаем свежую)
      const pos = {
        x: currentMesh.position.x,
        y: typeof currentMesh.position.y === 'number' ? currentMesh.position.y : 0,
        z: currentMesh.position.z
      };
      
      // Validate position values
      if (typeof pos.x === 'number' && !isNaN(pos.x) && isFinite(pos.x) &&
          typeof pos.z === 'number' && !isNaN(pos.z) && isFinite(pos.z)) {
        return pos;
      }
      
      return null;
    };

    // Reset error counter
    window.__positionGetterErrors = 0;

    window.setPlayerPositionGetter(getPosition);
    window.__playerGetterSet = true;

    // Также обновляем позицию в minimapState напрямую через requestAnimationFrame
    let lastUpdate = 0;
    let updateCount = 0;
    let consecutiveFailures = 0;
    const updatePosition = (timestamp) => {
      if (timestamp - lastUpdate < 16) { // ~60fps
        requestAnimationFrame(updatePosition);
        return;
      }
      lastUpdate = timestamp;
      
      const currentMesh = window.__playerMesh || mesh;
      if (currentMesh && currentMesh.position) {
        try {
          const pos = getPosition();
          if (pos && typeof pos === 'object' && 
              typeof pos.x === 'number' && !isNaN(pos.x) && isFinite(pos.x) &&
              typeof pos.z === 'number' && !isNaN(pos.z) && isFinite(pos.z)) {
            window.setPlayerPosition(pos.x, pos.y, pos.z);
            
            // Также обновляем minimapState напрямую
            if (window.gameState && window.gameState.minimapState) {
              window.gameState.minimapState.playerPos = pos;
            }
            
            consecutiveFailures = 0;
            
            // Логируем каждые 60 кадров (~1 раз в секунду)
            updateCount++;
            if (updateCount % 60 === 0) {
              console.log('📍 Позиция игрока обновлена:', pos.x.toFixed(2), pos.y.toFixed(2), pos.z.toFixed(2));
            }
          } else {
            consecutiveFailures++;
            if (consecutiveFailures > 60 && updateCount % 300 === 0) {
              console.warn('⚠️ Не удалось получить валидную позицию игрока, попыток:', consecutiveFailures);
            }
          }
        } catch (e) {
          consecutiveFailures++;
          if (consecutiveFailures % 60 === 0) {
            console.warn('⚠️ Ошибка при обновлении позиции игрока:', e);
          }
        }
      } else {
        consecutiveFailures++;
        if (consecutiveFailures > 60 && updateCount % 300 === 0) {
          console.warn('⚠️ Mesh или position отсутствует, попыток:', consecutiveFailures);
        }
      }
      requestAnimationFrame(updatePosition);
    };
    requestAnimationFrame(updatePosition);

    window.__playerExported = true;
    console.log('✅ Позиция персонажа экспортирована и обновляется в реальном времени');
    return true;
  }

  // Экспортируем функцию для внешнего вызова
  window.findAndExportScene = function() {
    return findAndExportScene();
  };

  function findAndExportScene() {
    // Проверяем наличие THREE.js перед поиском сцены
    if (!window.THREE || !window.THREE.Scene) {
      console.warn('⚠️ THREE.js не найден, ожидание...');
      // Пытаемся найти THREE.js еще раз
      if (window.findTHREE) {
        const THREE = window.findTHREE();
        if (THREE) {
          window.THREE = THREE;
          if (window.setTHREE) {
            window.setTHREE(THREE);
          }
        } else {
          console.warn('⚠️ THREE.js все еще не найден. Попробуйте выполнить window.setTHREE(THREE) вручную.');
          return false;
        }
      } else {
        console.warn('⚠️ THREE.js не найден и findTHREE недоступен.');
        return false;
      }
    }

    console.log('🔍 Начинаем поиск сцены и персонажа...');

    // Метод 1: Через canvas и React internals
    const canvas = document.querySelector('canvas');
    if (canvas) {
      const root = document.getElementById('root');
      if (root) {
        // Пробуем разные способы доступа к React Fiber
        const reactRoot = root._reactRootContainer || 
                         root._reactInternalFiber ||
                         root._reactInternalInstance ||
                         (root.__reactContainer$ || root.__reactFiber$);
        
        if (reactRoot) {
          findSceneAndPlayerInFiber(reactRoot);
        }
      }
    }

    // Метод 2: Ищем через все React roots
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      if (hook.renderers) {
        hook.renderers.forEach(renderer => {
          if (renderer.findFiberByHostInstance) {
            const root = document.getElementById('root');
            if (root) {
              const fiber = renderer.findFiberByHostInstance(root);
              if (fiber) {
                findSceneAndPlayerInFiber(fiber);
              }
            }
          }
        });
      }
    }

    // Метод 3: Периодическая проверка через разные методы
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      
      // Проверяем через root
      const root = document.getElementById('root');
      if (root) {
        const reactRoot = root._reactRootContainer || 
                         root._reactInternalFiber ||
                         root._reactInternalInstance;
        if (reactRoot) {
          findSceneAndPlayerInFiber(reactRoot);
        }
      }

      // Проверяем через canvas
      const canvas = document.querySelector('canvas');
      if (canvas) {
        // Пытаемся найти THREE через WebGL context
        const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
        if (gl && gl.canvas && gl.canvas.__THREE__) {
          const THREE = gl.canvas.__THREE__;
          window.setTHREE(THREE);
        }
      }

      // Если нашли сцену и персонажа, останавливаемся
      if ((window.__coinsAdded && window.__playerExported) || attempts >= 60) {
        clearInterval(checkInterval);
        if (!window.__coinsAdded || !window.__playerExported) {
          console.warn('⚠️ Не удалось найти сцену или персонажа автоматически. Используй window.autoAddCoins() в консоли.');
        }
      }
    }, 500);
  }

  // Агрессивный патч: перехватываем все useRef и useMemo для поиска сцены и персонажа
  function aggressivePatch() {
    // Патчим React.useRef если доступен
    if (window.React && window.React.useRef) {
      const originalUseRef = window.React.useRef;
      window.React.useRef = function(initialValue) {
        const ref = originalUseRef.call(this, initialValue);
        
        // Если это ref для группы персонажа (e.current в O4 компоненте)
        if (ref && ref.current && ref.current.position && ref.current.type === 'Group') {
          setTimeout(() => {
            if (ref.current && ref.current.position) {
              console.log('🎯 Найден ref персонажа через useRef!');
              exportPlayerPosition(ref.current);
            }
          }, 1000);
        }
        
        return ref;
      };
      console.log('✅ React.useRef запатчен');
    }

    // Патчим useMemo для поиска сцены
    if (window.React && window.React.useMemo) {
      const originalUseMemo = window.React.useMemo;
      window.React.useMemo = function(factory, deps) {
        const result = originalUseMemo.call(this, factory, deps);
        
        // Проверяем если это сцена
        if (result && result.isScene) {
          console.log('🎯 Найдена сцена через useMemo!');
          exportScene(result);
        }
        
        return result;
      };
      console.log('✅ React.useMemo запатчен');
    }
  }

  // Запускаем патчинг
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      waitForR3F();
      setTimeout(aggressivePatch, 1000);
    });
  } else {
    setTimeout(() => {
      waitForR3F();
      setTimeout(aggressivePatch, 1000);
    }, 500);
  }

})();
