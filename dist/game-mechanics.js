// Game mechanics for The Walker
// Manages coins collection and token swapping

(function() {
  'use strict';

  // Game state
  const gameState = {
    coinsCollected: 0,
    totalBuyback: 0, // Total buybacks (1 buyback = 1 SOL from team)
    BUYBACK_PER_COIN: 1, // 1 coin = +1 buyback for 1 SOL
    coins: [],
    buybackTransactions: [], // Array of {tx: string, amount: number, timestamp: number}
    PICKUP_DISTANCE: 8,
    COIN_COUNT: 30,
    coinsAddedToScene: false
  };

  // DOM elements
  const coinsCollectedEl = document.getElementById('coins-collected');
  const totalBuybackEl = document.getElementById('total-buyback');
  const buybackTransactionsEl = document.getElementById('buyback-transactions');
  const minimapPlayerEl = document.getElementById('minimap-player');
  const minimapCoinsEl = document.getElementById('minimap-coins');
  const minimapCanvas = document.getElementById('minimap-canvas');
  // const coordXEl = document.getElementById('coord-x'); // Отключено - панель координат удалена
  // const coordYEl = document.getElementById('coord-y');
  // const coordZEl = document.getElementById('coord-z');
  
  // Minimap state
  const minimapState = {
    mapSize: 100, // World size in game units
    mapScale: 1, // Scale factor for minimap
    playerPos: { x: 0, y: 0, z: 0 },
    ctx: null
  };

  // Initialize game
  function initGame() {
    updateUI();
    updateBuybackTransactions();
    initMinimap();
    
    // Try to intercept THREE.js and Scene creation early
    interceptTHREEAndScene();
    
    // Wait for React app to mount, then initialize coins
    setTimeout(() => {
      initCoins();
      startCoinCollectionLoop();
      startMinimapUpdate();
      // startCoordinatesUpdate(); // Отключено - панель координат удалена
    }, 2000);
  }
  
  // Start coordinates update loop (independent from minimap)
  function startCoordinatesUpdate() {
    let updateCount = 0;
    let lastFoundPos = null;
    let consecutiveFailures = 0;
    let lastSuccessMethod = null;
    
    function updateCoords() {
      updateCount++;
      
      // Try to get player position from multiple sources
      let playerPos = null;
      let foundVia = null;
      
      // Method 1: Direct function call (most reliable if set)
      if (window.getPlayerPosition && typeof window.getPlayerPosition === 'function') {
        try {
          playerPos = window.getPlayerPosition();
          if (playerPos && typeof playerPos === 'object' && 
              typeof playerPos.x === 'number' && typeof playerPos.z === 'number' && 
              !isNaN(playerPos.x) && !isNaN(playerPos.z) && isFinite(playerPos.x) && isFinite(playerPos.z)) {
            // Accept position even if it's (0,0,0) - player might start there
            foundVia = 'getPlayerPosition';
            lastFoundPos = playerPos;
            lastSuccessMethod = 'getPlayerPosition';
            consecutiveFailures = 0;
            updateCoordinates(playerPos);
            requestAnimationFrame(updateCoords);
            return;
          }
        } catch (e) {
          if (updateCount % 60 === 0) { // Log every second
            console.warn('⚠️ Ошибка getPlayerPosition:', e);
          }
        }
      }
      
      // Method 2: Direct mesh access
      if (window.__playerMesh && window.__playerMesh.position) {
        try {
          const mesh = window.__playerMesh;
          // Validate mesh is still valid
          if (!mesh.position || typeof mesh.position.x !== 'number') {
            // Mesh reference might be stale, clear it
            if (updateCount % 300 === 0) {
              console.warn('⚠️ __playerMesh reference is stale, clearing...');
            }
            window.__playerMesh = null;
          } else {
            let pos = null;
            
            if (mesh.getWorldPosition && window.THREE && window.THREE.Vector3) {
              try {
                const worldPos = new window.THREE.Vector3();
                mesh.getWorldPosition(worldPos);
                pos = { x: worldPos.x, y: worldPos.y, z: worldPos.z };
              } catch (e) {
                // Fallback to local position if getWorldPosition fails
                pos = {
                  x: mesh.position.x,
                  y: mesh.position.y,
                  z: mesh.position.z
                };
              }
            } else {
              pos = {
                x: mesh.position.x,
                y: mesh.position.y,
                z: mesh.position.z
              };
            }
            
            if (pos && typeof pos.x === 'number' && !isNaN(pos.x) && isFinite(pos.x) &&
                typeof pos.z === 'number' && !isNaN(pos.z) && isFinite(pos.z)) {
              playerPos = pos;
              foundVia = '__playerMesh';
              lastFoundPos = playerPos;
              lastSuccessMethod = '__playerMesh';
              consecutiveFailures = 0;
              updateCoordinates(playerPos);
              requestAnimationFrame(updateCoords);
              return;
            }
          }
        } catch (e) {
          if (updateCount % 60 === 0) {
            console.warn('⚠️ Ошибка __playerMesh:', e);
          }
        }
      }
      
      // Method 3: From minimapState
      if (minimapState.playerPos && typeof minimapState.playerPos === 'object' &&
          typeof minimapState.playerPos.x === 'number' && 
          !isNaN(minimapState.playerPos.x) && isFinite(minimapState.playerPos.x) &&
          typeof minimapState.playerPos.z === 'number' &&
          !isNaN(minimapState.playerPos.z) && isFinite(minimapState.playerPos.z)) {
        playerPos = minimapState.playerPos;
        foundVia = 'minimapState';
        lastFoundPos = playerPos;
        lastSuccessMethod = 'minimapState';
        consecutiveFailures = 0;
        updateCoordinates(playerPos);
        requestAnimationFrame(updateCoords);
        return;
      }
      
      // Method 4: Try to find in scene (ULTRA aggressive search)
      if (window.getScene && typeof window.getScene === 'function') {
        try {
          const scene = window.getScene();
          if (scene && scene.traverse) {
            // Используем traverse для поиска всех объектов
            let bestCandidate = null;
            let maxScore = 0;
            
            scene.traverse((obj) => {
              if (!obj || !obj.position) return;
              
              let score = 0;
              const name = obj.name ? obj.name.toLowerCase() : '';
              
              // Очки за имя
              if (name.includes('explorer')) score += 100;
              if (name.includes('player')) score += 80;
              if (name.includes('character')) score += 70;
              if (name.includes('walker')) score += 60;
              if (name.includes('person')) score += 50;
              
              // Очки за userData
              if (obj.userData?.isPlayer) score += 90;
              if (obj.userData?.isExplorer) score += 85;
              
              // Очки за количество детей (персонажи обычно сложные объекты)
              if (obj.children && obj.children.length > 5) score += 40;
              if (obj.children && obj.children.length > 10) score += 60;
              
              // Очки за анимации
              if (obj.animations && obj.animations.length > 0) score += 50;
              
              // Очки за тип Group (персонажи часто Group)
              if (obj.type === 'Group' && obj.children && obj.children.length > 3) score += 30;
              
              // Очки за наличие getWorldPosition (обычно есть у персонажей)
              if (obj.getWorldPosition) score += 20;
              
              if (score > maxScore) {
                maxScore = score;
                bestCandidate = obj;
              }
            });
            
            if (bestCandidate && bestCandidate.position && maxScore > 30) {
              let pos = null;
              
              if (bestCandidate.getWorldPosition && window.THREE && window.THREE.Vector3) {
                const worldPos = new window.THREE.Vector3();
                bestCandidate.getWorldPosition(worldPos);
                pos = { x: worldPos.x, y: worldPos.y, z: worldPos.z };
              } else {
                pos = {
                  x: bestCandidate.position.x,
                  y: bestCandidate.position.y,
                  z: bestCandidate.position.z
                };
              }
              
              if (pos && typeof pos.x === 'number' && !isNaN(pos.x)) {
                playerPos = pos;
                foundVia = 'ultra aggressive scene search (score: ' + maxScore + ')';
                
                // Сохраняем для будущего использования
                window.__playerMesh = bestCandidate;
                minimapState.playerPos = playerPos;
                
                if (!window.getPlayerPosition) {
                  const mesh = bestCandidate;
                  window.setPlayerPositionGetter(() => {
                    if (mesh.getWorldPosition && window.THREE && window.THREE.Vector3) {
                      const wp = new window.THREE.Vector3();
                      mesh.getWorldPosition(wp);
                      return { x: wp.x, y: wp.y, z: wp.z };
                    }
                    return { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
                  });
                }
                
                if (updateCount % 60 === 0) {
                  console.log('✅ Игрок найден через ultra aggressive search!', {
                    name: bestCandidate.name,
                    type: bestCandidate.type,
                    score: maxScore,
                    position: pos
                  });
                }
                
                lastFoundPos = playerPos;
                updateCoordinates(playerPos);
                requestAnimationFrame(updateCoords);
                return;
              }
            }
          } else if (scene && scene.children) {
            // Fallback на старый метод если traverse недоступен
            const findPlayerMesh = (obj, depth = 0) => {
              if (depth > 15) return null;
              if (!obj) return null;
              
              const name = obj.name ? obj.name.toLowerCase() : '';
              const hasPosition = obj.position && typeof obj.position.x === 'number';
              
              if (hasPosition && (
                name.includes('explorer') ||
                name.includes('player') ||
                name.includes('character') ||
                name.includes('walker') ||
                name.includes('person') ||
                obj.userData?.isPlayer ||
                obj.userData?.isExplorer ||
                (obj.type === 'Group' && obj.children && obj.children.length > 3)
              )) {
                return obj;
              }
              
              if (obj.children && obj.children.length > 0) {
                for (const child of obj.children) {
                  const found = findPlayerMesh(child, depth + 1);
                  if (found) return found;
                }
              }
              
              return null;
            };
            
            const playerMesh = findPlayerMesh(scene);
            if (playerMesh && playerMesh.position) {
              let pos = null;
              
              if (playerMesh.getWorldPosition && window.THREE && window.THREE.Vector3) {
                const worldPos = new window.THREE.Vector3();
                playerMesh.getWorldPosition(worldPos);
                pos = { x: worldPos.x, y: worldPos.y, z: worldPos.z };
              } else {
                pos = {
                  x: playerMesh.position.x,
                  y: playerMesh.position.y,
                  z: playerMesh.position.z
                };
              }
              
              if (pos && typeof pos.x === 'number' && !isNaN(pos.x)) {
                playerPos = pos;
                foundVia = 'recursive scene search';
                window.__playerMesh = playerMesh;
                minimapState.playerPos = playerPos;
                
                if (!window.getPlayerPosition) {
                  const mesh = playerMesh;
                  window.setPlayerPositionGetter(() => {
                    if (mesh.getWorldPosition && window.THREE && window.THREE.Vector3) {
                      const wp = new window.THREE.Vector3();
                      mesh.getWorldPosition(wp);
                      return { x: wp.x, y: wp.y, z: wp.z };
                    }
                    return { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
                  });
                }
                
                lastFoundPos = playerPos;
                updateCoordinates(playerPos);
                requestAnimationFrame(updateCoords);
                return;
              }
            }
          }
        } catch (e) {
          console.warn('⚠️ Ошибка поиска в сцене:', e);
        }
      }
      
      // Method 5: Use last found position if available (fallback)
      if (lastFoundPos && typeof lastFoundPos === 'object' &&
          typeof lastFoundPos.x === 'number' && !isNaN(lastFoundPos.x) && isFinite(lastFoundPos.x)) {
        consecutiveFailures++;
        // Use last known position but log if we've been failing for a while
        if (consecutiveFailures > 60 && updateCount % 300 === 0) { // Log every 5 seconds after 1 second of failures
          console.warn('⚠️ Using last known position, unable to find current position. Last method:', lastSuccessMethod);
        }
        updateCoordinates(lastFoundPos);
        requestAnimationFrame(updateCoords);
        return;
      }
      
      // No position found at all
      consecutiveFailures++;
      
      // Log debug info every 60 frames (~1 second) when there are issues
      if (updateCount % 60 === 0) {
        const debugInfo = {
          updateCount: updateCount,
          consecutiveFailures: consecutiveFailures,
          lastSuccessMethod: lastSuccessMethod,
          hasGetter: !!window.getPlayerPosition,
          hasMesh: !!window.__playerMesh,
          meshPosition: window.__playerMesh ? {
            x: window.__playerMesh.position?.x,
            y: window.__playerMesh.position?.y,
            z: window.__playerMesh.position?.z
          } : null,
          minimapState: minimapState.playerPos,
          lastFoundPos: lastFoundPos,
          foundVia: foundVia,
          coordElements: {
            x: !!coordXEl,
            y: !!coordYEl,
            z: !!coordZEl
          },
          hasScene: !!window.getScene,
          sceneChildren: window.getScene ? window.getScene().children?.length : null
        };
        
        if (consecutiveFailures > 60) {
          console.warn('📍 Coordinates update DEBUG (FAILING):', debugInfo);
        } else {
          console.log('📍 Coordinates update DEBUG:', debugInfo);
        }
      }
      
      // Update with zero coordinates if no position found
      updateCoordinates(null);
      
      // Continue updating even if position not found
      requestAnimationFrame(updateCoords);
    }
    updateCoords();
  }

  // Intercept THREE.js and Scene creation
  function interceptTHREEAndScene() {
    // Watch for THREE.js being loaded
    const checkForTHREE = setInterval(() => {
      if (window.THREE || window.THREEjs) {
        const THREE = window.THREE || window.THREEjs;
        window.THREE = THREE;
        
        // Patch Scene constructor to intercept scene creation
        if (THREE.Scene && !THREE.Scene.__coinsPatched) {
          const OriginalScene = THREE.Scene;
          const sceneInstances = [];
          
          THREE.Scene = function(...args) {
            const scene = new OriginalScene(...args);
            sceneInstances.push(scene);
            
            // Try to add coins after a delay
            setTimeout(() => {
              if (window.addCoinsToScene && !gameState.coinsAddedToScene && gameState.coins.length > 0) {
                console.log('🎯 Intercepted Scene creation, attempting to add coins...');
                window.addCoinsToScene(scene, THREE);
              }
            }, 500);
            
            return scene;
          };
          
          // Copy prototype
          THREE.Scene.prototype = OriginalScene.prototype;
          THREE.Scene.__coinsPatched = true;
          
          // Also try to add coins to existing scenes
          setTimeout(() => {
            sceneInstances.forEach(scene => {
              if (window.addCoinsToScene && !gameState.coinsAddedToScene && gameState.coins.length > 0) {
                window.addCoinsToScene(scene, THREE);
              }
            });
          }, 2000);
          
          clearInterval(checkForTHREE);
        }
      }
    }, 100);
    
    // Stop after 10 seconds
    setTimeout(() => clearInterval(checkForTHREE), 10000);
  }

  // Initialize minimap
  function initMinimap() {
    if (!minimapCanvas || !minimapPlayerEl || !minimapCoinsEl) return;
    
    minimapState.ctx = minimapCanvas.getContext('2d');
    if (!minimapState.ctx) return;
    
    // Draw background grid
    drawMinimapBackground();
    
    // Update minimap scale based on coin spawn radius (increased to show larger area)
    minimapState.mapSize = 60; // Show area of 60 units radius
    minimapState.mapScale = minimapCanvas.width / minimapState.mapSize;
  }

  // Draw minimap background
  function drawMinimapBackground() {
    if (!minimapState.ctx) return;
    
    const ctx = minimapState.ctx;
    const width = minimapCanvas.width;
    const height = minimapCanvas.height;
    
    // Clear canvas - solid background only, no grid
    ctx.clearRect(0, 0, width, height);
  }

  // Update minimap
  function updateMinimap() {
    if (!minimapPlayerEl || !minimapCoinsEl) return;
    
    const canvas = minimapCanvas;
    if (!canvas) return;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Try multiple methods to get player position - ALWAYS try to get fresh position each frame
    let playerPos = null;
    
    // Method 1: Direct function call (PRIORITY - always try this first)
    if (window.getPlayerPosition && typeof window.getPlayerPosition === 'function') {
      try {
        playerPos = window.getPlayerPosition();
        // Update stored position if we got a valid one
        if (playerPos && typeof playerPos.x === 'number' && typeof playerPos.z === 'number' && 
            !isNaN(playerPos.x) && !isNaN(playerPos.z)) {
          minimapState.playerPos = playerPos;
        } else {
          // Если позиция невалидна, пробуем другие методы
          playerPos = null;
        }
      } catch (e) {
        console.warn('⚠️ Ошибка при получении позиции через getPlayerPosition:', e);
        // Ignore errors, try other methods
      }
    }
    
    // Также пробуем получить позицию напрямую из __playerMesh
    if (!playerPos && window.__playerMesh && window.__playerMesh.position) {
      try {
        const mesh = window.__playerMesh;
        if (mesh.getWorldPosition && window.THREE && window.THREE.Vector3) {
          const worldPos = new window.THREE.Vector3();
          mesh.getWorldPosition(worldPos);
          playerPos = { x: worldPos.x, y: worldPos.y, z: worldPos.z };
        } else {
          playerPos = {
            x: mesh.position.x,
            y: mesh.position.y,
            z: mesh.position.z
          };
        }
        if (playerPos && typeof playerPos.x === 'number' && typeof playerPos.z === 'number' && 
            !isNaN(playerPos.x) && !isNaN(playerPos.z)) {
          minimapState.playerPos = playerPos;
        } else {
          playerPos = null;
        }
      } catch (e) {
        console.warn('⚠️ Ошибка при получении позиции из __playerMesh:', e);
      }
    }
    
    // Method 2: Try to find player mesh directly in scene (every frame to get fresh position)
    if (!playerPos && window.getScene && typeof window.getScene === 'function') {
      try {
        const scene = window.getScene();
        if (scene && scene.children) {
          // Look for player mesh recursively (check groups too)
          const findPlayerMesh = (obj) => {
            if (!obj) return null;
            
            // Check if this is the player mesh
            const name = obj.name ? obj.name.toLowerCase() : '';
            if (obj.position && (
              name.includes('explorer') ||
              name.includes('player') ||
              name.includes('character') ||
              obj.userData?.isPlayer ||
              obj.userData?.isExplorer ||
              (obj.type === 'Group' && obj.children && obj.children.length > 0 && 
               obj.children.some(child => child.name && child.name.toLowerCase().includes('explorer')))
            )) {
              return obj;
            }
            
            // Recursively check children
            if (obj.children) {
              for (const child of obj.children) {
                const found = findPlayerMesh(child);
                if (found) return found;
              }
            }
            
            return null;
          };
          
          const playerMesh = findPlayerMesh(scene);
          
          if (playerMesh && playerMesh.position) {
            playerPos = {
              x: playerMesh.position.x,
              y: playerMesh.position.y,
              z: playerMesh.position.z
            };
            minimapState.playerPos = playerPos;
            
            // Also set/get world position if it's a group
            if (playerMesh.type === 'Group' && playerMesh.getWorldPosition) {
              const worldPos = new (window.THREE?.Vector3 || Object)(0, 0, 0);
              playerMesh.getWorldPosition(worldPos);
              playerPos = {
                x: worldPos.x,
                y: worldPos.y,
                z: worldPos.z
              };
              minimapState.playerPos = playerPos;
            }
            
            // Update getter if not set
            if (!window.getPlayerPosition || !window.__playerGetterSet) {
              const mesh = playerMesh;
              window.setPlayerPositionGetter(() => {
                if (mesh && mesh.position) {
                  if (mesh.getWorldPosition) {
                    const worldPos = new (window.THREE?.Vector3 || Object)(0, 0, 0);
                    mesh.getWorldPosition(worldPos);
                    return { x: worldPos.x, y: worldPos.y, z: worldPos.z };
                  }
                  return {
                    x: mesh.position.x,
                    y: mesh.position.y,
                    z: mesh.position.z
                  };
                }
                return { x: 0, y: 0, z: 0 };
              });
              window.__playerGetterSet = true;
            }
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Method 3: Try to find through React Three Fiber (fallback)
    if (!playerPos) {
      try {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          const root = document.getElementById('root');
          if (root) {
            const reactRoot = root._reactRootContainer || root._reactInternalFiber;
            if (reactRoot) {
              const playerMesh = findPlayerMeshInReactFiber(reactRoot);
              if (playerMesh && playerMesh.position) {
                playerPos = {
                  x: playerMesh.position.x,
                  y: playerMesh.position.y,
                  z: playerMesh.position.z
                };
                minimapState.playerPos = playerPos;
              }
            }
          }
        }
      } catch (e) {
        // Ignore errors
      }
    }
    
    // Method 4: Fallback to stored position (only if all else fails)
    if (!playerPos && minimapState.playerPos && 
        typeof minimapState.playerPos.x === 'number' && 
        typeof minimapState.playerPos.z === 'number') {
      playerPos = minimapState.playerPos;
    }
    
    // Update player marker position - карта привязана к игроку (игрок всегда в центре)
    if (playerPos && typeof playerPos.x === 'number' && typeof playerPos.z === 'number') {
      // Игрок всегда в центре карты
      minimapPlayerEl.style.left = centerX + 'px';
      minimapPlayerEl.style.top = centerY + 'px';
      minimapPlayerEl.style.display = 'block';
      
      // Сохраняем позицию игрока для обновления монет
      minimapState.playerPos = playerPos;
    } else {
      // Fallback: show player at center
      minimapPlayerEl.style.left = centerX + 'px';
      minimapPlayerEl.style.top = centerY + 'px';
      minimapPlayerEl.style.display = 'block';
    }
    
    // Update coins on minimap
    updateCoinsOnMinimap();
    
    // Update coordinates display - отключено, панель координат удалена
    // updateCoordinates(playerPos);
  }
  
  // Update coordinates display - отключено, панель координат удалена
  let coordinateUpdateCount = 0;
  let lastValidPosition = null;
  function updateCoordinates(playerPos) {
    // Функция отключена - панель координат удалена
    return;
    coordinateUpdateCount++;
    
    // Check if elements exist - try to re-find them if missing
    if (!coordXEl || !coordYEl || !coordZEl) {
      // Try to re-find elements
      const xEl = document.getElementById('coord-x');
      const yEl = document.getElementById('coord-y');
      const zEl = document.getElementById('coord-z');
      
      if (xEl && yEl && zEl) {
        // Update references
        coordXEl = xEl;
        coordYEl = yEl;
        coordZEl = zEl;
      } else {
        // Only warn if elements truly don't exist after retry
        if (coordinateUpdateCount % 300 === 0) { // Log every 5 seconds at 60fps
          console.warn('⚠️ Coordinate elements not found:', {
            x: !!xEl,
            y: !!yEl,
            z: !!zEl,
            'coord-x': !!document.getElementById('coord-x'),
            'coord-y': !!document.getElementById('coord-y'),
            'coord-z': !!document.getElementById('coord-z')
          });
        }
        return;
      }
    }
    
    // Validate playerPos
    const isValidPos = playerPos && typeof playerPos === 'object' &&
                       typeof playerPos.x === 'number' && !isNaN(playerPos.x) && isFinite(playerPos.x) &&
                       typeof playerPos.z === 'number' && !isNaN(playerPos.z) && isFinite(playerPos.z);
    
    if (!isValidPos) {
      // Use last valid position if available
      if (lastValidPosition) {
        playerPos = lastValidPosition;
        // Add visual indicator that we're using stale data
        if (coordXEl) {
          coordXEl.style.opacity = '0.6';
          coordXEl.title = 'Using last known position';
        }
        if (coordYEl) coordYEl.style.opacity = '0.6';
        if (coordZEl) coordZEl.style.opacity = '0.6';
      } else {
        // Set fallback values
        if (coordXEl) {
          coordXEl.textContent = '0.00';
          coordXEl.style.opacity = '0.4';
          coordXEl.title = 'Position not found';
        }
        if (coordYEl) {
          coordYEl.textContent = '0.00';
          coordYEl.style.opacity = '0.4';
        }
        if (coordZEl) {
          coordZEl.textContent = '0.00';
          coordZEl.style.opacity = '0.4';
        }
        return;
      }
    } else {
      // Valid position - update opacity and clear title
      lastValidPosition = playerPos;
      if (coordXEl) {
        coordXEl.style.opacity = '1';
        coordXEl.title = '';
      }
      if (coordYEl) coordYEl.style.opacity = '1';
      if (coordZEl) coordZEl.style.opacity = '1';
    }
    
    // Update X coordinate with validation
    try {
      if (typeof playerPos.x === 'number' && !isNaN(playerPos.x) && isFinite(playerPos.x)) {
        coordXEl.textContent = playerPos.x.toFixed(2);
      } else {
        coordXEl.textContent = '0.00';
      }
    } catch (e) {
      console.warn('⚠️ Error updating X coordinate:', e);
      coordXEl.textContent = '0.00';
    }
    
    // Update Y coordinate with validation
    try {
      if (typeof playerPos.y === 'number' && !isNaN(playerPos.y) && isFinite(playerPos.y)) {
        coordYEl.textContent = playerPos.y.toFixed(2);
      } else {
        coordYEl.textContent = '0.00';
      }
    } catch (e) {
      console.warn('⚠️ Error updating Y coordinate:', e);
      coordYEl.textContent = '0.00';
    }
    
    // Update Z coordinate with validation
    try {
      if (typeof playerPos.z === 'number' && !isNaN(playerPos.z) && isFinite(playerPos.z)) {
        coordZEl.textContent = playerPos.z.toFixed(2);
      } else {
        coordZEl.textContent = '0.00';
      }
    } catch (e) {
      console.warn('⚠️ Error updating Z coordinate:', e);
      coordZEl.textContent = '0.00';
    }
  }

  // Helper to find player mesh in React Fiber tree
  function findPlayerMeshInReactFiber(node, depth = 0) {
    if (depth > 20) return null;
    if (!node) return null;
    
    // Check stateNode for mesh
    if (node.stateNode) {
      const mesh = node.stateNode;
      if (mesh && mesh.position && (
        mesh.name && (
          mesh.name.toLowerCase().includes('explorer') ||
          mesh.name.toLowerCase().includes('player') ||
          mesh.name.toLowerCase().includes('character')
        ) || mesh.userData?.isPlayer
      )) {
        return mesh;
      }
    }
    
    // Check children
    if (node.child) {
      const childMesh = findPlayerMeshInReactFiber(node.child, depth + 1);
      if (childMesh) return childMesh;
    }
    
    // Check sibling
    if (node.sibling) {
      const siblingMesh = findPlayerMeshInReactFiber(node.sibling, depth + 1);
      if (siblingMesh) return siblingMesh;
    }
    
    return null;
  }

  // Update coins on minimap
  function updateCoinsOnMinimap() {
    if (!minimapCoinsEl) return;
    
    // Remove all existing coin markers
    const existingCoins = minimapCoinsEl.querySelectorAll('.minimap-coin');
    existingCoins.forEach(coin => coin.remove());
    
    const canvas = minimapCanvas;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Add markers for all non-collected coins
    // Координаты монет относительно позиции игрока (игрок в центре)
    const playerPos = minimapState.playerPos || { x: 0, y: 0, z: 0 };
    
    gameState.coins.forEach((coin) => {
      if (coin.collected) return;
      
      const coinEl = document.createElement('div');
      coinEl.className = 'minimap-coin';
      coinEl.dataset.coinId = coin.id;
      
      // Вычисляем относительную позицию монеты относительно игрока
      const relativeX = coin.x - playerPos.x;
      const relativeZ = coin.z - playerPos.z;
      
      // Convert relative coordinates to minimap coordinates (игрок в центре)
      const mapX = centerX + (relativeX * minimapState.mapScale);
      const mapY = centerY - (relativeZ * minimapState.mapScale); // Invert Z for screen coordinates
      
      // Показываем монету только если она в пределах видимой области карты
      const mapRadius = Math.min(canvas.width, canvas.height) / 2;
      const distanceFromCenter = Math.sqrt(relativeX * relativeX + relativeZ * relativeZ);
      
      if (distanceFromCenter <= minimapState.mapSize / 2) {
        coinEl.style.left = mapX + 'px';
        coinEl.style.top = mapY + 'px';
        coinEl.style.display = 'block';
      } else {
        coinEl.style.display = 'none';
      }
      
      minimapCoinsEl.appendChild(coinEl);
    });
  }

  // Start minimap update loop
  function startMinimapUpdate() {
    function update() {
      updateMinimap();
      requestAnimationFrame(update);
    }
    update();
  }

  // Update UI elements
  function updateUI() {
    // Обновляем количество собранных монет
    if (coinsCollectedEl) {
      coinsCollectedEl.textContent = gameState.coinsCollected.toLocaleString();
    }
    // Update total buyback count
    if (totalBuybackEl) {
      totalBuybackEl.textContent = gameState.totalBuyback.toLocaleString();
    }
  }

  // Format token amount with commas
  function formatTokenAmount(amount) {
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(2) + 'M';
    } else if (amount >= 1000) {
      return (amount / 1000).toFixed(2) + 'K';
    }
    return amount.toLocaleString();
  }

  // Generate a mock transaction hash (in real implementation, this would come from blockchain)
  function generateTransactionHash() {
    const chars = '0123456789abcdef';
    let hash = '';
    for (let i = 0; i < 64; i++) {
      hash += chars[Math.floor(Math.random() * chars.length)];
    }
    return hash;
  }

  // Add buyback transaction (1 coin = +1 buyback for 1 SOL)
  function addBuybackTransaction(amount) {
    const txHash = generateTransactionHash();
    const transaction = {
      tx: txHash,
      amount: amount,
      timestamp: Date.now()
    };
    gameState.buybackTransactions.unshift(transaction);
    gameState.totalBuyback += amount;
    
    if (gameState.buybackTransactions.length > 50) {
      gameState.buybackTransactions = gameState.buybackTransactions.slice(0, 50);
    }
    
    updateBuybackTransactions();
    updateUI();
    showBuybackNotification(amount);
  }

  // Update buyback transactions display
  function updateBuybackTransactions() {
    if (!buybackTransactionsEl) return;
    
    buybackTransactionsEl.innerHTML = '';
    
    if (gameState.buybackTransactions.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'buyback-transaction-empty';
      emptyMsg.textContent = 'No buybacks yet';
      emptyMsg.style.cssText = `
        padding: 20px;
        text-align: center;
        color: #666;
        font-size: 12px;
      `;
      buybackTransactionsEl.appendChild(emptyMsg);
      return;
    }
    
    gameState.buybackTransactions.forEach((tx) => {
      const txEl = document.createElement('div');
      txEl.className = 'buyback-transaction-item';
      
      const txLink = document.createElement('a');
      txLink.href = `https://solscan.io/tx/${tx.tx}`;
      txLink.target = '_blank';
      txLink.rel = 'noopener noreferrer';
      txLink.textContent = `${tx.tx.substring(0, 8)}...${tx.tx.substring(56)}`;
      txLink.style.cssText = `
        color: #0066cc;
        text-decoration: none;
        font-family: 'Courier New', monospace;
        font-size: 11px;
        word-break: break-all;
      `;
      
      const amountEl = document.createElement('span');
      amountEl.className = 'buyback-transaction-amount';
      amountEl.textContent = `+${tx.amount} buyback (1 SOL)`;
      amountEl.style.cssText = `
        color: #0a0;
        font-weight: 700;
        margin-left: 12px;
        font-size: 11px;
      `;
      
      txEl.appendChild(txLink);
      txEl.appendChild(amountEl);
      txEl.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        border-bottom: 1px solid rgba(0,0,0,0.1);
      `;
      
      buybackTransactionsEl.appendChild(txEl);
    });
  }

  // Show buyback notification
  function showBuybackNotification(amount) {
    const notification = document.createElement('div');
    notification.className = 'buyback-notification';
    notification.textContent = `+${amount} buyback from team (1 SOL)`;
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 140, 0, 0.95);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-family: 'Courier New', monospace;
      font-weight: 700;
      font-size: 20px;
      z-index: 10000;
      pointer-events: none;
      animation: buybackNotificationAnimation 2s ease-out forwards;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 2000);
  }

  // Add animation for buyback notification
  if (!document.getElementById('buyback-notification-styles')) {
    const style = document.createElement('style');
    style.id = 'buyback-notification-styles';
    style.textContent = `
      @keyframes buybackNotificationAnimation {
        0% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.8);
        }
        20% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1.1);
        }
        80% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1);
        }
        100% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.9);
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Initialize coins in 3D scene
  function initCoins() {
    // Try to access the React Three Fiber scene
    // This will be called after the scene is mounted
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      console.warn('Root element not found, retrying...');
      setTimeout(initCoins, 1000);
      return;
    }

    console.log('🎮 Initializing coins...');
    
    // Spawn coins first
    spawnCoinsInWorld();
    
    // Try aggressive scene finding
    aggressiveSceneFind();
    
    // Also set up periodic retry with more aggressive attempts
    let retryCount = 0;
    const maxRetries = 50; // Increased retries even more
    const retryInterval = setInterval(() => {
      retryCount++;
      const success = tryAddCoinsToScene() || aggressiveSceneFind();
      
      if (success || retryCount >= maxRetries) {
        clearInterval(retryInterval);
        if (!success && retryCount >= maxRetries) {
          console.warn('⚠️ Could not add coins to scene after', maxRetries, 'attempts');
          console.log('💡 Монеты созданы в памяти и видны на мини-карте, но не добавлены в 3D-сцену');
          console.log('');
          console.log('🔧 Попробуй выполнить в консоли:');
          console.log('   1. window.debugCheckCoins() - проверить статус');
          console.log('   2. Найди сцену через React DevTools и выполни:');
          console.log('      window.debugAddCoins(найденнаяСцена, THREE)');
          console.log('');
          console.log('💡 Или добавь в React компонент:');
          console.log('   useEffect(() => {');
          console.log('     const { scene } = useThree();');
          console.log('     window.setTHREE(THREE);');
          console.log('     if (window.addCoinsToScene) window.addCoinsToScene(scene, THREE);');
          console.log('   }, [scene]);');
        } else if (success) {
          console.log('✅ Coins successfully added to scene!');
        }
      }
    }, 300); // Check more frequently
  }

  // Aggressive scene finding - try multiple methods
  function aggressiveSceneFind() {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;

    // Method 1: Try to get THREE from global
    let THREE = window.THREE;
    if (!THREE) {
      // Try to find THREE in window object
      for (const key in window) {
        if (key.includes('THREE') || key.includes('Three')) {
          const obj = window[key];
          if (obj && obj.Scene && obj.Mesh) {
            THREE = obj;
            window.THREE = THREE;
            console.log('✅ Found THREE.js:', key);
            break;
          }
        }
      }
    }

    if (!THREE) {
      return false;
    }

    // Method 2: Try to find scene through canvas
    try {
      // Check if canvas has renderer attached
      const renderer = canvas.__renderer || canvas._renderer;
      if (renderer && renderer.scene) {
        console.log('✅ Found scene through renderer');
        window.addCoinsToScene(renderer.scene, THREE);
        return true;
      }
    } catch (e) {
      // Ignore
    }

    // Method 3: Try to traverse React tree more aggressively
    try {
      const root = document.getElementById('root');
      if (root) {
        // Try multiple React internal properties
        const reactRoot = root._reactRootContainer || 
                         root._reactInternalFiber || 
                         root._reactInternalInstance ||
                         root.__reactContainer$;
        
        if (reactRoot) {
          const scene = findSceneInReactFiber(reactRoot);
          if (scene && scene.isScene) {
            console.log('✅ Found scene through React tree');
            window.addCoinsToScene(scene, THREE);
            return true;
          }
        }
      }
    } catch (e) {
      // Ignore
    }

    // Method 4: Try to find scene through WebGL context
    try {
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
      if (gl) {
        // Try to find renderer through WebGL context
        // React Three Fiber stores renderer in canvas properties sometimes
        const renderer = canvas.__r3f || canvas._r3f || gl.canvas.__r3f;
        if (renderer && renderer.scene) {
          console.log('✅ Found scene through WebGL context');
          window.addCoinsToScene(renderer.scene, THREE);
          return true;
        }
      }
    } catch (e) {
      // Ignore errors
    }

    // Method 5: Use MutationObserver to watch for scene additions
    if (!window.__coinsObserverSet) {
      window.__coinsObserverSet = true;
      const observer = new MutationObserver(() => {
        // Check if scene was added to DOM or canvas
        if (THREE && !gameState.coinsAddedToScene && gameState.coins.length > 0) {
          setTimeout(() => {
            if (tryAddCoinsToScene()) {
              observer.disconnect();
            }
          }, 100);
        }
      });
      
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Stop observing after 30 seconds
      setTimeout(() => observer.disconnect(), 30000);
    }

    return false;
  }

  // Try to add coins to scene
  function tryAddCoinsToScene() {
    // Check if coins already added
    if (gameState.coinsAddedToScene) {
      return true;
    }
    
    // Method 1: Check if scene and THREE are available via window functions
    if (window.getScene && typeof window.getScene === 'function') {
      const scene = window.getScene();
      let THREE = window.THREE;
      
      if (scene && THREE) {
        console.log('✅ Scene and THREE.js found via window.getScene(), adding coins...');
        window.addCoinsToScene(scene, THREE);
        return true;
      }
    }
    
    // Method 2: Try to find scene through canvas
    const canvas = document.querySelector('canvas');
    if (canvas) {
      // Try to access THREE from global
      let THREE = window.THREE;
      
      if (THREE) {
        // Try to find scene in React Three Fiber
        const root = document.getElementById('root');
        if (root) {
          // Try to traverse React tree
          try {
            const reactRoot = root._reactRootContainer || root._reactInternalFiber;
            if (reactRoot) {
              const scene = findSceneInReactFiber(reactRoot);
              if (scene && scene.isScene) {
                console.log('✅ Scene found through React tree, adding coins...');
                window.addCoinsToScene(scene, THREE);
                return true;
              }
            }
          } catch (e) {
            // Ignore errors
          }
        }
      }
    }
    
    return false;
  }

  // Helper to find scene in React Fiber tree
  function findSceneInReactFiber(node, depth = 0) {
    if (depth > 20) return null; // Increased depth limit
    
    if (!node) return null;
    
    // Check if this is a Scene object directly
    if (node.isScene) {
      return node;
    }
    
    // Check memoizedState
    if (node.memoizedState) {
      let state = node.memoizedState;
      let stateDepth = 0;
      while (state && stateDepth < 10) {
        if (state.memoizedState) {
          if (state.memoizedState.scene && state.memoizedState.scene.isScene) {
            return state.memoizedState.scene;
          }
          if (state.memoizedState.isScene) {
            return state.memoizedState;
          }
        }
        if (state.scene && state.scene.isScene) {
          return state.scene;
        }
        state = state.next;
        stateDepth++;
      }
    }
    
    // Check stateNode
    if (node.stateNode) {
      const stateNode = node.stateNode;
      if (stateNode && stateNode.isScene) {
        return stateNode;
      }
      if (stateNode && stateNode.scene && stateNode.scene.isScene) {
        return stateNode.scene;
      }
      // Check if stateNode has a getState method (React Three Fiber store)
      if (stateNode && typeof stateNode.getState === 'function') {
        try {
          const state = stateNode.getState();
          if (state && state.scene && state.scene.isScene) {
            return state.scene;
          }
        } catch (e) {
          // Ignore errors
        }
      }
    }
    
    // Check props
    if (node.memoizedProps) {
      const props = node.memoizedProps;
      if (props.scene && props.scene.isScene) {
        return props.scene;
      }
    }
    
    // Check children
    if (node.child) {
      const childScene = findSceneInReactFiber(node.child, depth + 1);
      if (childScene) return childScene;
    }
    
    // Check sibling
    if (node.sibling) {
      const siblingScene = findSceneInReactFiber(node.sibling, depth + 1);
      if (siblingScene) return siblingScene;
    }
    
    // Check return (parent)
    if (node.return) {
      const returnScene = findSceneInReactFiber(node.return, depth + 1);
      if (returnScene) return returnScene;
    }
    
    return null;
  }

  // Spawn coins randomly in the world
  function spawnCoinsInWorld() {
    // Generate random positions for coins
    // These will be placed on the terrain surface
    gameState.coins = [];
    
    // Starting position (usually 0,0,0 or player start position)
    const startX = 0;
    const startZ = 0;
    const startRadius = 5; // Radius around start position for initial coins
    
    // Spawn first 5 coins near the starting position
    const initialCoinCount = 5;
    for (let i = 0; i < initialCoinCount; i++) {
      const angle = (Math.PI * 2 / initialCoinCount) * i + (Math.random() * 0.5); // Evenly spaced around circle
      const distance = 3 + Math.random() * startRadius; // 3-8 units from start
      const x = startX + Math.cos(angle) * distance;
      const z = startZ + Math.sin(angle) * distance;
      
      const coin = {
        id: i,
        x: x,
        z: z,
        y: 0, // Will be set to terrain height
        collected: false,
        mesh: null,
        rotation: Math.random() * Math.PI * 2 // Random initial rotation
      };
      gameState.coins.push(coin);
    }
    
    // Spawn remaining coins randomly across the map
    const spawnRadius = 30; // Reduced radius - coins spawn closer
    const minDistance = 5; // Minimum distance between coins (increased)
    
    for (let i = initialCoinCount; i < gameState.COIN_COUNT; i++) {
      let attempts = 0;
      let x, z;
      
      // Try to find a position that's not too close to other coins
      do {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * spawnRadius;
        x = Math.cos(angle) * distance;
        z = Math.sin(angle) * distance;
        attempts++;
      } while (
        attempts < 50 && 
        gameState.coins.some(c => {
          const dx = c.x - x;
          const dz = c.z - z;
          return Math.sqrt(dx * dx + dz * dz) < minDistance;
        })
      );
      
      const coin = {
        id: i,
        x: x,
        z: z,
        y: 0, // Will be set to terrain height
        collected: false,
        mesh: null,
        rotation: Math.random() * Math.PI * 2 // Random initial rotation
      };
      gameState.coins.push(coin);
    }

    console.log(`✅ Spawned ${initialCoinCount} coins near start position and ${gameState.COIN_COUNT - initialCoinCount} coins randomly`);
    console.log('📍 First coin positions:', gameState.coins.slice(0, 5).map(c => `(${c.x.toFixed(1)}, ${c.z.toFixed(1)})`).join(', '));

    // Update minimap with initial coin positions
    updateCoinsOnMinimap();
    
    // Log minimap update
    console.log('🗺️ Minimap updated with', gameState.coins.filter(c => !c.collected).length, 'coins');

    // Try to add coins to the scene
    addCoinsToScene();
  }

  // Add coins to Three.js scene
  function addCoinsToScene() {
    // Try to find the canvas and scene
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      console.warn('Canvas not found, retrying coin initialization...');
      setTimeout(addCoinsToScene, 1000);
      return;
    }

    // Try to access Three.js through the canvas
    const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
    if (!gl) {
      setTimeout(addCoinsToScene, 1000);
      return;
    }

    // Create a global function that can be called from the main app
    // This will be invoked when the scene is ready
    window.addCoinsToScene = function(scene, THREE) {
      console.log('🎯 addCoinsToScene called', { 
        scene: !!scene, 
        THREE: !!THREE,
        sceneIsScene: scene ? scene.isScene : false,
        coinsInMemory: gameState.coins.length,
        coinsNotCollected: gameState.coins.filter(c => !c.collected).length
      });
      
      if (!scene) {
        console.warn('⚠️ Scene not provided');
        return;
      }

      // Verify scene is a THREE.Scene (more lenient check)
      if (!scene.isScene && scene.type !== 'Scene' && !scene.children) {
        console.warn('⚠️ Provided object might not be a THREE.Scene:', scene);
        console.log('💡 But trying anyway...');
      }

      // Get THREE.js - use provided or global
      if (!THREE && window.THREE) {
        THREE = window.THREE;
      }
      
      if (!THREE) {
        console.warn('⚠️ THREE.js not found. Please ensure THREE.js is loaded or call window.setTHREE(THREE) first.');
        console.log('💡 Try: window.setTHREE(THREE) in your React component');
        return;
      }

      console.log('✅ Scene and THREE.js confirmed, loading coin model...');
      console.log('📊 Scene children count before:', scene.children.length);
      console.log('🪙 Coins to add:', gameState.coins.filter(c => !c.collected).length);

      // Load GLB model (will fallback to simple geometry)
      loadCoinModel(scene, THREE);
    };

    // Load coin GLB model
    function loadCoinModel(scene, THREE) {
      // Check if GLTFLoader is available
      let GLTFLoader;
      if (THREE.GLTFLoader) {
        GLTFLoader = THREE.GLTFLoader;
      } else if (window.GLTFLoader) {
        GLTFLoader = window.GLTFLoader;
      } else if (typeof THREE !== 'undefined' && THREE.Loader) {
        // Try to use GLTFLoader from drei or react-three-fiber
        // For now, fallback to simple geometry
        console.warn('GLTFLoader not found. Falling back to simple geometry.');
        console.log('To use GLB models, ensure GLTFLoader is available. You can add it via:');
        console.log('import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"');
        createCoinsWithSimpleGeometry(scene, THREE);
        return;
      } else {
        console.warn('GLTFLoader not found. Falling back to simple geometry.');
        createCoinsWithSimpleGeometry(scene, THREE);
        return;
      }

      const loader = new GLTFLoader();
      
      loader.load(
        './coin.glb',
        (gltf) => {
          console.log('✅ Coin model loaded successfully from coin.glb');
          gameState.coinModel = gltf.scene;
          
          // Clone the model for each coin
          createCoinsFromModel(scene, THREE);
        },
        (progress) => {
          // Loading progress
          if (progress.lengthComputable) {
            const percentComplete = (progress.loaded / progress.total) * 100;
            console.log('Loading coin model: ' + percentComplete.toFixed(0) + '%');
          }
        },
        (error) => {
          console.warn('Failed to load coin.glb, using simple geometry:', error);
          createCoinsWithSimpleGeometry(scene, THREE);
        }
      );
    }

    // Create coins from loaded GLB model
    function createCoinsFromModel(scene, THREE) {
      if (!gameState.coinModel) {
        createCoinsWithSimpleGeometry(scene, THREE);
        return;
      }

      let coinsAdded = 0;
      gameState.coins.forEach((coin) => {
        if (coin.collected || coin.mesh) return;

        // Clone the model
        const coinMesh = gameState.coinModel.clone();
        
        // Position coins on terrain surface
        coinMesh.position.set(coin.x, coin.y + 1.5, coin.z);
        coinMesh.rotation.y = coin.rotation;
        coinMesh.userData = { coinId: coin.id, isCoin: true, isGLBModel: true };
        
        // Add rotation and bobbing animation
        coinMesh.userData.rotationSpeed = 0.02 + Math.random() * 0.01;
        coinMesh.userData.baseY = coin.y + 1.5;
        coinMesh.userData.bobOffset = Math.random() * Math.PI * 2;
        coinMesh.userData.bobSpeed = 0.5 + Math.random() * 0.5;
        
        // Scale the coin model (adjust as needed)
        coinMesh.scale.set(1, 1, 1);
        
        scene.add(coinMesh);
        coin.mesh = coinMesh;
        coinsAdded++;
      });

      if (coinsAdded > 0) {
        console.log(`✅ Added ${coinsAdded} coins to scene using GLB model`);
        gameState.coinsAddedToScene = true;
        // Start coin animation if not already started
        if (!gameState.animationStarted) {
          startCoinAnimation();
          gameState.animationStarted = true;
        }
        // Update minimap with coins
        updateCoinsOnMinimap();
      }
    }

    // Fallback: Create coins with simple geometry if GLB fails
    function createCoinsWithSimpleGeometry(scene, THREE) {
      console.log('🔄 Creating coins with simple geometry...');
      console.log('📊 Scene type:', scene.constructor.name);
      console.log('📊 Scene isScene:', scene.isScene);
      console.log('📊 Scene children before:', scene.children.length);
      
      // Verify scene is valid
      if (!scene || !scene.add) {
        console.error('❌ Invalid scene object - scene.add is not a function');
        return;
      }
      
      // Create shared coin geometry and material for better performance
      if (!gameState.coinGeometry) {
        gameState.coinGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.2, 16); // Made even larger
        gameState.coinMaterial = new THREE.MeshStandardMaterial({
          color: 0xffd700,
          metalness: 0.9,
          roughness: 0.1,
          emissive: 0xffaa00,
          emissiveIntensity: 0.8 // Made even brighter
        });
      }

      let coinsAdded = 0;
      let errors = 0;
      
      gameState.coins.forEach((coin) => {
        if (coin.collected || coin.mesh) return;

        try {
          // Create coin mesh
          const coinMesh = new THREE.Mesh(gameState.coinGeometry, gameState.coinMaterial.clone());
          
          // Position coins on terrain surface - make them more visible
          coinMesh.position.set(coin.x, coin.y + 3, coin.z); // Raised even higher
          coinMesh.rotation.x = Math.PI / 2;
          coinMesh.rotation.z = coin.rotation;
          coinMesh.userData = { coinId: coin.id, isCoin: true };
          
          // Add rotation and bobbing animation
          coinMesh.userData.rotationSpeed = 0.02 + Math.random() * 0.01;
          coinMesh.userData.baseY = coin.y + 3;
          coinMesh.userData.bobOffset = Math.random() * Math.PI * 2;
          coinMesh.userData.bobSpeed = 0.5 + Math.random() * 0.5;
          
          // Make coins VERY visible
          coinMesh.scale.set(2, 2, 2); // Even larger scale
          
          // Add to scene
          scene.add(coinMesh);
          coin.mesh = coinMesh;
          coinsAdded++;
          
          if (coinsAdded <= 5) {
            console.log(`  ✓ Added coin ${coin.id} at (${coin.x.toFixed(1)}, ${coin.z.toFixed(1)})`);
          }
        } catch (error) {
          errors++;
          console.error(`  ✗ Error adding coin ${coin.id}:`, error);
        }
      });

      console.log(`📊 Scene children after: ${scene.children.length}`);
      console.log(`📊 Coins added: ${coinsAdded}, Errors: ${errors}`);

      if (coinsAdded > 0) {
        console.log(`✅ Successfully added ${coinsAdded} coins to scene using simple geometry`);
        console.log(`🎯 Scene type: ${scene.constructor.name}`);
        console.log(`🎯 First coin mesh:`, gameState.coins.find(c => c.mesh)?.mesh);
        gameState.coinsAddedToScene = true;
        
        // Start coin animation if not already started
        if (!gameState.animationStarted) {
          startCoinAnimation();
          gameState.animationStarted = true;
        }
        
        // Update minimap with coins
        updateCoinsOnMinimap();
        
        // Verify coins are actually in scene
        setTimeout(() => {
          const coinsInScene = scene.children.filter(child => 
            child.userData && child.userData.isCoin
          ).length;
          console.log(`🔍 Verification: ${coinsInScene} coin meshes found in scene`);
          console.log(`🔍 Total scene children: ${scene.children.length}`);
          
          if (coinsInScene === 0) {
            console.error('❌ CRITICAL: Coins were added but not found in scene!');
            console.log('💡 This means scene.add() was called but objects were not actually added.');
            console.log('💡 Possible causes:');
            console.log('   1. Scene is being reset/recreated');
            console.log('   2. React Three Fiber is removing objects');
            console.log('   3. Wrong scene object was passed');
            console.log('');
            console.log('🔧 Solution: Add coins directly in React component using useThree hook');
          } else {
            console.log(`✅ SUCCESS: ${coinsInScene} coins are visible in scene!`);
          }
        }, 1000);
      } else {
        console.error('❌ No coins were added to scene');
        console.log('💡 Check: Are there coins in memory?', gameState.coins.filter(c => !c.collected).length);
        console.log('💡 Scene valid?', !!scene && typeof scene.add === 'function');
      }
    }

    // Try multiple methods to get the scene
    function tryToGetScene() {
      // Method 1: Check if getScene function exists
      if (window.getScene) {
        const scene = window.getScene();
        if (scene) {
          window.addCoinsToScene(scene);
          return true;
        }
      }

      // Method 2: Try to access through React DevTools
      if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        // This is a fallback - we'll rely on the main app to call addCoinsToScene
      }

      // Method 3: Wait and retry
      return false;
    }

    // Try immediately
    if (!tryToGetScene()) {
      // Retry after a delay
      setTimeout(() => {
        if (!tryToGetScene()) {
          console.log('Waiting for scene to be available. The main app should call window.addCoinsToScene(scene) when ready.');
        }
      }, 2000);
    }
  }

  // Coin collection loop - checks distance to player
  function startCoinCollectionLoop() {
    let lastCheckTime = 0;
    
    function checkCoinCollection() {
      const now = Date.now();
      // Check every 50ms (20 times per second) instead of every frame for better performance
      if (now - lastCheckTime < 50) {
        requestAnimationFrame(checkCoinCollection);
        return;
      }
      lastCheckTime = now;

      // Try multiple methods to get player position (same as minimap)
      let playerPos = null;
      
      // Method 1: Direct function call
      if (window.getPlayerPosition && typeof window.getPlayerPosition === 'function') {
        try {
          playerPos = window.getPlayerPosition();
        } catch (e) {
          // Ignore errors
        }
      }
      
      // Method 2: From minimap state (updated by minimap function)
      if (!playerPos && minimapState.playerPos && 
          typeof minimapState.playerPos.x === 'number' && 
          typeof minimapState.playerPos.z === 'number') {
        playerPos = minimapState.playerPos;
      }
      
      // Method 3: Try to find player mesh directly in scene
      if (!playerPos && window.getScene && typeof window.getScene === 'function') {
        try {
          const scene = window.getScene();
          if (scene && scene.children) {
            // Look for player mesh by name or userData
            const playerMesh = scene.children.find(child => {
              if (!child || !child.position) return false;
              const name = child.name ? child.name.toLowerCase() : '';
              return name.includes('explorer') || 
                     name.includes('player') || 
                     name.includes('character') ||
                     child.userData?.isPlayer ||
                     child.userData?.isExplorer;
            });
            
            if (playerMesh && playerMesh.position) {
              playerPos = {
                x: playerMesh.position.x,
                y: playerMesh.position.y,
                z: playerMesh.position.z
              };
              minimapState.playerPos = playerPos;
              
              // Also set position getter for future use
              if (!window.getPlayerPosition) {
                window.setPlayerPositionGetter(() => ({
                  x: playerMesh.position.x,
                  y: playerMesh.position.y,
                  z: playerMesh.position.z
                }));
              }
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }
      
      // Method 4: Try to find player through React Fiber tree (more aggressive)
      if (!playerPos) {
        try {
          const root = document.getElementById('root');
          if (root) {
            const reactRoot = root._reactRootContainer || root._reactInternalFiber;
            if (reactRoot) {
              const playerMesh = findPlayerMeshInReactFiber(reactRoot);
              if (playerMesh && playerMesh.position) {
                playerPos = {
                  x: playerMesh.position.x,
                  y: playerMesh.position.y,
                  z: playerMesh.position.z
                };
                minimapState.playerPos = playerPos;
              }
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }

      if (!playerPos || (playerPos.x === undefined || playerPos.z === undefined)) {
        requestAnimationFrame(checkCoinCollection);
        return;
      }

      let collectedAny = false;
      
      gameState.coins.forEach((coin) => {
        if (coin.collected || !coin.mesh) return;

        // Calculate 2D distance (only X and Z, ignore Y height)
        const dx = coin.x - playerPos.x;
        const dz = coin.z - playerPos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // Debug log for first coin
        if (gameState.coins.indexOf(coin) === 0 && distance < 20) {
          console.log(`Distance to coin ${coin.id}: ${distance.toFixed(2)}, pickup distance: ${gameState.PICKUP_DISTANCE}`);
        }

        if (distance < gameState.PICKUP_DISTANCE) {
          collectCoin(coin);
          collectedAny = true;
        }
      });
      
      if (collectedAny) {
        console.log(`✅ Collected coin! Total: ${gameState.coinsCollected}`);
      }

      requestAnimationFrame(checkCoinCollection);
    }

    // Start the loop
    requestAnimationFrame(checkCoinCollection);
  }

  // Collect a coin
  function collectCoin(coin) {
    if (coin.collected) return;

    coin.collected = true;
    gameState.coinsCollected++;

    // Each coin = +1 buyback from team for 1 SOL
    const buybackAmount = gameState.BUYBACK_PER_COIN;
    addBuybackTransaction(buybackAmount);

    // Remove coin from scene
    if (coin.mesh) {
      if (coin.mesh.parent) {
        coin.mesh.parent.remove(coin.mesh);
      }
      if (coin.mesh.geometry) coin.mesh.geometry.dispose();
      if (coin.mesh.material) coin.mesh.material.dispose();
      coin.mesh = null;
    }

    // Remove coin from minimap
    if (minimapCoinsEl) {
      const coinEl = minimapCoinsEl.querySelector(`[data-coin-id="${coin.id}"]`);
      if (coinEl) {
        coinEl.remove();
      }
    }

    updateUI();
    
    // Show collection effect
    showCoinCollectionEffect(coin);
  }

  // Show coin collection effect
  function showCoinCollectionEffect(coin) {
    // Create a small floating text effect
    const effect = document.createElement('div');
    effect.textContent = '+1 Coin';
    effect.style.cssText = `
      position: fixed;
      top: ${50 + Math.random() * 10}%;
      left: ${50 + Math.random() * 10}%;
      color: #ffd700;
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      font-size: 18px;
      text-shadow: 0 0 10px rgba(255, 215, 0, 0.8);
      z-index: 9999;
      pointer-events: none;
      animation: coinCollectionAnimation 1s ease-out forwards;
    `;
    
    document.body.appendChild(effect);
    
    setTimeout(() => {
      effect.remove();
    }, 1000);
  }

  // Export game state for debugging
  window.gameState = gameState;

  // Add animation for coin collection
  if (!document.getElementById('coin-collection-styles')) {
    const style = document.createElement('style');
    style.id = 'coin-collection-styles';
    style.textContent = `
      @keyframes coinCollectionAnimation {
        0% {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        100% {
          opacity: 0;
          transform: translateY(-50px) scale(1.2);
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Animate coins rotation and bobbing
  function animateCoins() {
    const time = Date.now() * 0.001;
    
    gameState.coins.forEach((coin) => {
      if (coin.collected || !coin.mesh) return;
      
      // Rotation animation (rotate around Y axis for GLB model, or Z axis for simple geometry)
      if (coin.mesh.userData.isGLBModel) {
        coin.mesh.rotation.y += coin.mesh.userData.rotationSpeed || 0.02;
      } else {
        coin.mesh.rotation.z += coin.mesh.userData.rotationSpeed || 0.02;
      }
      
      // Bobbing animation with individual offsets
      const bobOffset = coin.mesh.userData.bobOffset || 0;
      const bobSpeed = coin.mesh.userData.bobSpeed || 1;
      const baseY = coin.mesh.userData.baseY || (coin.y + 1.5);
      coin.mesh.position.y = baseY + Math.sin(time * bobSpeed + bobOffset) * 0.15;
      
      // Optional: Add a subtle scale pulse
      const pulse = 1 + Math.sin(time * 2 + bobOffset) * 0.05;
      coin.mesh.scale.set(pulse, pulse, pulse);
    });
  }

  // Start coin animation loop
  function startCoinAnimation() {
    if (gameState.animationLoopRunning) return;
    gameState.animationLoopRunning = true;
    
    function animate() {
      animateCoins();
      requestAnimationFrame(animate);
    }
    animate();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
  } else {
    initGame();
  }

  // Coin animation will be started when coins are added to scene
  // Don't start it here to avoid errors if scene isn't ready

  // Export game state for debugging
  window.gameState = gameState;
  // Also expose minimapState directly for easier access
  window.minimapState = minimapState;
  
  // Debug function to manually add coins to scene
  window.debugAddCoins = function(scene, THREE) {
    if (!scene || !THREE) {
      console.error('❌ Please provide scene and THREE: window.debugAddCoins(scene, THREE)');
      console.log('');
      console.log('💡 Как найти сцену:');
      console.log('   1. Установи React DevTools расширение для браузера');
      console.log('   2. Открой React DevTools');
      console.log('   3. Найди компонент Canvas или Scene');
      console.log('   4. В консоли выполни: $r для выбора элемента');
      console.log('   5. Затем найди scene в props или state');
      console.log('');
      console.log('💡 Или попробуй:');
      console.log('   const canvas = document.querySelector("canvas");');
      console.log('   // Затем найди сцену через React DevTools');
      return;
    }
    
    console.log('🔧 Debug: Manually adding coins to scene...');
    console.log('Coins in memory:', gameState.coins.length);
    console.log('Coins not collected:', gameState.coins.filter(c => !c.collected).length);
    
    window.addCoinsToScene(scene, THREE);
  };

  // Auto-find and add coins function
  window.autoAddCoins = function() {
    console.log('🔍 Attempting to auto-find scene and add coins...');
    
    // Try all methods
    const methods = [
      () => {
        if (window.getScene && typeof window.getScene === 'function') {
          const scene = window.getScene();
          const THREE = window.THREE;
          if (scene && THREE) {
            console.log('✅ Found via window.getScene()');
            window.addCoinsToScene(scene, THREE);
            return true;
          }
        }
        return false;
      },
      () => {
        // Try aggressive scene find
        return aggressiveSceneFind();
      }
    ];
    
    for (const method of methods) {
      try {
        if (method()) {
          return true;
        }
      } catch (e) {
        console.warn('Method failed:', e);
      }
    }
    
    console.warn('❌ Could not auto-find scene');
    console.log('');
    console.log('📋 ИНСТРУКЦИЯ: Как добавить монеты вручную');
    console.log('');
    console.log('1️⃣ Открой React DevTools (расширение для браузера)');
    console.log('2️⃣ В Components найди компонент Canvas');
    console.log('3️⃣ Выдели его и в консоли выполни: $r');
    console.log('4️⃣ Затем найди scene:');
    console.log('   - Попробуй: $r.props.children');
    console.log('   - Или: $r._owner.stateNode');
    console.log('   - Или найди в props объект с scene');
    console.log('5️⃣ Когда найдешь scene, выполни:');
    console.log('   window.debugAddCoins(найденнаяСцена, THREE)');
    console.log('');
    console.log('💡 Или добавь код в основной файл (см. INTEGRATION.md)');
    return false;
  };

  // Simple function to create coins if you have scene reference
  window.quickAddCoins = function() {
    console.log('⚡ Quick Add Coins');
    console.log('');
    console.log('Если у тебя есть ссылка на сцену, выполни:');
    console.log('window.debugAddCoins(scene, THREE)');
    console.log('');
    console.log('Чтобы найти сцену через React DevTools:');
    console.log('1. Выдели Canvas компонент');
    console.log('2. В консоли: $r');
    console.log('3. Ищи scene в props или state');
    console.log('');
    console.log('Текущий статус монет:');
    window.debugCheckCoins();
  };
  
  // Debug function to check coin status
  window.debugCheckCoins = function() {
    console.log('=== Coin Debug Info ===');
    console.log('Total coins:', gameState.coins.length);
    console.log('Collected:', gameState.coins.filter(c => c.collected).length);
    console.log('Not collected:', gameState.coins.filter(c => !c.collected).length);
    console.log('With mesh:', gameState.coins.filter(c => c.mesh).length);
    console.log('Coins added to scene:', gameState.coinsAddedToScene);
    console.log('First 5 coins positions:');
    gameState.coins.slice(0, 5).forEach((coin, i) => {
      console.log(`  Coin ${i}: x=${coin.x.toFixed(2)}, z=${coin.z.toFixed(2)}, collected=${coin.collected}, hasMesh=${!!coin.mesh}`);
    });
    console.log('======================');
  };
  
  // Call debug check after initialization
  setTimeout(() => {
    window.debugCheckCoins();
  }, 3000);
  
  // Debug function to check coordinates tracking status
  window.debugCheckCoordinates = function() {
    console.log('=== Coordinates Tracking Debug Info ===');
    console.log('Has getPlayerPosition:', !!window.getPlayerPosition);
    console.log('Has __playerMesh:', !!window.__playerMesh);
    console.log('Player mesh position:', window.__playerMesh ? {
      x: window.__playerMesh.position?.x,
      y: window.__playerMesh.position?.y,
      z: window.__playerMesh.position?.z
    } : null);
    console.log('Minimap state position:', minimapState.playerPos);
    console.log('Coordinate elements:', {
      x: !!coordXEl,
      y: !!coordYEl,
      z: !!coordZEl,
      xValue: coordXEl?.textContent,
      yValue: coordYEl?.textContent,
      zValue: coordZEl?.textContent
    });
    console.log('Last valid position:', lastValidPosition);
    console.log('Has scene:', !!window.getScene);
    if (window.getScene) {
      try {
        const scene = window.getScene();
        console.log('Scene children count:', scene?.children?.length);
      } catch (e) {
        console.warn('Error getting scene:', e);
      }
    }
    console.log('========================================');
  };
  
  // Expose coordinate update function for manual testing
  window.testCoordinatesUpdate = function(x, y, z) {
    console.log('Testing coordinates update with:', { x, y, z });
    updateCoordinates({ x: x || 10, y: y || 5, z: z || 15 });
  };

  // Diagnostic function to check coordinate tracking status
  window.checkCoordinateTracking = function() {
    console.log('=== Проверка отслеживания координат ===');
    console.log('');
    
    // Check THREE.js
    if (window.THREE && window.THREE.Scene) {
      console.log('✅ THREE.js найден');
    } else {
      console.warn('❌ THREE.js НЕ найден');
      console.log('💡 Попробуйте: window.findTHREE() или window.forceFindTHREE()');
    }
    
    // Check Scene
    if (window.getScene && typeof window.getScene === 'function') {
      try {
        const scene = window.getScene();
        if (scene && scene.isScene) {
          console.log('✅ Сцена найдена');
          console.log('   Детей в сцене:', scene.children.length);
        } else {
          console.warn('❌ Сцена невалидна');
        }
      } catch (e) {
        console.warn('❌ Ошибка при получении сцены:', e);
      }
    } else {
      console.warn('❌ Сцена НЕ найдена');
      console.log('💡 Попробуйте: window.findAndExportScene()');
    }
    
    // Check Player Position Getter
    if (window.getPlayerPosition && typeof window.getPlayerPosition === 'function') {
      try {
        const pos = window.getPlayerPosition();
        if (pos && typeof pos.x === 'number') {
          console.log('✅ Позиция игрока доступна:', pos);
        } else {
          console.warn('⚠️ Позиция игрока невалидна:', pos);
        }
      } catch (e) {
        console.warn('❌ Ошибка при получении позиции игрока:', e);
      }
    } else {
      console.warn('❌ Позиция игрока НЕ найдена');
      console.log('💡 Попробуйте: window.findAndExportScene()');
    }
    
    // Check Player Mesh
    if (window.__playerMesh && window.__playerMesh.position) {
      console.log('✅ Mesh игрока найден');
      console.log('   Позиция:', {
        x: window.__playerMesh.position.x,
        y: window.__playerMesh.position.y,
        z: window.__playerMesh.position.z
      });
    } else {
      console.warn('⚠️ Mesh игрока не найден');
    }
    
    // Check Coordinate Elements
    const coordX = document.getElementById('coord-x');
    const coordY = document.getElementById('coord-y');
    const coordZ = document.getElementById('coord-z');
    if (coordX && coordY && coordZ) {
      console.log('✅ Элементы координат найдены');
      console.log('   Текущие значения:', {
        x: coordX.textContent,
        y: coordY.textContent,
        z: coordZ.textContent
      });
    } else {
      console.warn('❌ Элементы координат НЕ найдены');
    }
    
    console.log('');
    console.log('=== Конец проверки ===');
    console.log('');
    console.log('💡 Полезные команды:');
    console.log('   - window.checkCoordinateTracking() - эта проверка');
    console.log('   - window.debugCheckCoordinates() - детальная отладка');
    console.log('   - window.findTHREE() - найти THREE.js');
    console.log('   - window.findAndExportScene() - найти сцену и персонажа');
    console.log('   - window.testCoordinatesUpdate(10, 5, 15) - тест обновления координат');
  };
})();
