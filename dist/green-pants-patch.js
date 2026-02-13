// АГРЕССИВНЫЙ патч для окрашивания штанов персонажа в зеленый цвет
// Перехватывает применение текстур и принудительно красит штаны в зеленый

(function() {
  'use strict';

  console.log('🎨 Green pants patch загружен (агрессивный режим)...');

  let THREE = null;
  let scene = null;
  let applied = false;

  // Функция для поиска THREE.js
  function findTHREE() {
    if (window.THREE) {
      THREE = window.THREE;
      return true;
    }
    
    // Ищем THREE в window
    for (const key in window) {
      if (key.includes('THREE') || key.includes('Three')) {
        const obj = window[key];
        if (obj && obj.Color && obj.MeshStandardMaterial && obj.Scene) {
          THREE = obj;
          window.THREE = obj;
          console.log('✅ THREE.js найден:', key);
          return true;
        }
      }
    }
    
    return false;
  }

  // АГРЕССИВНАЯ функция для применения зеленого цвета к штанам
  function applyGreenToPants() {
    if (!THREE) {
      if (!findTHREE()) {
        console.warn('⚠️ THREE.js не найден');
        return;
      }
    }

    if (!scene) {
      if (window.getScene && typeof window.getScene === 'function') {
        scene = window.getScene();
      } else if (window.__scene) {
        scene = window.__scene;
      } else {
        console.warn('⚠️ Сцена не найдена');
        return;
      }
    }

    if (!scene || !scene.traverse) {
      console.warn('⚠️ Сцена невалидна');
      return;
    }

    console.log('🎨 ПРИНУДИТЕЛЬНО применяем зеленый цвет к штанам...');

    const greenColor = new THREE.Color(0x00ff00);
    let changed = 0;

    // Проходим по ВСЕМ мешам в сцене
    scene.traverse((object) => {
      if (object.isMesh && object.material) {
        const name = (object.name || '').toLowerCase();
        const parentName = (object.parent && object.parent.name ? object.parent.name : '').toLowerCase();
        
        // Пропускаем ТОЛЬКО куртку
        const isJacket = name.includes('jacket') || 
                        name.includes('coat') ||
                        parentName.includes('jacket') ||
                        parentName.includes('coat');
        
        if (!isJacket) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          
          materials.forEach((material, index) => {
            if (material) {
              try {
                // СОЗДАЕМ НОВЫЙ материал с зеленым цветом
                const newMaterial = new THREE.MeshStandardMaterial({
                  color: 0x00ff00, // Яркий зеленый
                  emissive: 0x003300,
                  emissiveIntensity: 0.4,
                  roughness: material.roughness !== undefined ? material.roughness : 0.5,
                  metalness: material.metalness !== undefined ? material.metalness : 0,
                  // НЕ применяем текстуру map - только цвет!
                  normalMap: material.normalMap, // Сохраняем normal для деталей
                  aoMap: material.aoMap // Сохраняем AO
                });
                
                // Заменяем материал
                if (Array.isArray(object.material)) {
                  object.material[index] = newMaterial;
                } else {
                  object.material = newMaterial;
                }
                
                changed++;
                console.log(`  ✅ Меш "${object.name || 'unnamed'}" окрашен в зеленый`);
              } catch (e) {
                console.error(`  ❌ Ошибка для меша "${object.name}":`, e);
              }
            }
          });
        }
      }
    });

    if (changed > 0) {
      console.log(`✅ Успешно окрашено ${changed} мешей в зеленый цвет!`);
      applied = true;
    } else {
      console.warn('⚠️ Не найдено мешей для окрашивания');
    }
  }

  // АГРЕССИВНОЕ применение - каждые 500мс
  function startAggressiveApplication() {
    let attempts = 0;
    const maxAttempts = 200; // 100 секунд
    
    const interval = setInterval(() => {
      attempts++;
      
      // Ищем THREE если еще не нашли
      if (!THREE) {
        findTHREE();
      }
      
      // Ищем сцену если еще не нашли
      if (!scene) {
        if (window.getScene && typeof window.getScene === 'function') {
          scene = window.getScene();
        } else if (window.__scene) {
          scene = window.__scene;
        }
      }
      
      // Применяем патч
      if (THREE && scene) {
        if (!applied || attempts % 10 === 0) { // Применяем каждый раз или каждые 5 секунд
          applyGreenToPants();
        }
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 500); // Каждые 500мс
  }

  // Перехватываем addCoinsToScene
  if (window.addCoinsToScene) {
    const originalAddCoins = window.addCoinsToScene;
    window.addCoinsToScene = function(sceneParam, THREE) {
      const result = originalAddCoins.apply(this, arguments);
      
      if (sceneParam) {
        scene = sceneParam;
      }
      if (THREE) {
        window.THREE = THREE;
        findTHREE();
      }
      
      setTimeout(() => {
        console.log('🎨 Применяем зеленый цвет через addCoinsToScene...');
        applyGreenToPants();
      }, 1000);
      
      return result;
    };
  }

  // Перехватываем exportScene из auto-patch.js
  const checkForSceneExport = setInterval(() => {
    if (window.getScene && typeof window.getScene === 'function') {
      try {
        const foundScene = window.getScene();
        if (foundScene && foundScene.isScene) {
          scene = foundScene;
          console.log('✅ Сцена найдена через window.getScene');
          clearInterval(checkForSceneExport);
          
          setTimeout(() => {
            applyGreenToPants();
          }, 500);
        }
      } catch (e) {
        // Игнорируем
      }
    }
  }, 200);

  // Запускаем агрессивное применение
  setTimeout(() => {
    startAggressiveApplication();
  }, 1000);

  // Экспортируем функцию для ручного вызова
  window.applyGreenToPants = applyGreenToPants;

  console.log('✅ Green pants patch инициализирован, начинаем агрессивное применение...');

})();
