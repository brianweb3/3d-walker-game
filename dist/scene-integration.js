// Scene Integration Helper
// This file helps integrate coins into the React Three Fiber scene
// It should be loaded after explorer_local.js

(function() {
  'use strict';

  // Wait for the React app to mount
  function waitForScene(callback, maxAttempts = 50) {
    let attempts = 0;
    
    const checkScene = () => {
      attempts++;
      
      // Try to find the canvas
      const canvas = document.querySelector('canvas');
      if (!canvas) {
        if (attempts < maxAttempts) {
          setTimeout(checkScene, 200);
        }
        return;
      }

      // Try to access the scene through various methods
      let scene = null;
      
      // Method 1: Check if scene is exposed globally
      if (window.getScene && typeof window.getScene === 'function') {
        scene = window.getScene();
      }
      
      // Method 2: Try to access through React root
      if (!scene) {
        const root = document.getElementById('root');
        if (root) {
          // Try to find React Fiber node
          const reactFiber = root._reactRootContainer || root._reactInternalInstance;
          if (reactFiber) {
            // Traverse React tree to find scene
            scene = findSceneInReactTree(reactFiber);
          }
        }
      }

      // Method 3: Try to get from canvas userData or properties
      if (!scene && canvas.__reactInternalInstance) {
        scene = findSceneInReactTree(canvas.__reactInternalInstance);
      }

      if (scene) {
        callback(scene);
      } else if (attempts < maxAttempts) {
        setTimeout(checkScene, 200);
      } else {
        console.warn('Could not find scene automatically. Please call window.addCoinsToScene(scene) manually.');
      }
    };

    checkScene();
  }

  // Traverse React tree to find Scene object
  function findSceneInReactTree(node, depth = 0) {
    if (depth > 20) return null; // Prevent infinite recursion
    
    if (!node) return null;

    // Check if this is a THREE.Scene
    if (node.memoizedState) {
      const state = node.memoizedState;
      if (state.memoizedState) {
        const scene = findSceneInState(state.memoizedState);
        if (scene) return scene;
      }
    }

    // Check stateNode
    if (node.stateNode) {
      const stateNode = node.stateNode;
      if (stateNode && stateNode.type === 'Scene') {
        return stateNode;
      }
      if (stateNode && stateNode.isScene) {
        return stateNode;
      }
    }

    // Check children
    if (node.child) {
      const childScene = findSceneInReactTree(node.child, depth + 1);
      if (childScene) return childScene;
    }

    // Check sibling
    if (node.sibling) {
      const siblingScene = findSceneInReactTree(node.sibling, depth + 1);
      if (siblingScene) return siblingScene;
    }

    return null;
  }

  // Find scene in state object
  function findSceneInState(state) {
    if (!state) return null;
    
    // Check various properties where scene might be stored
    const props = ['scene', 'state', 'store', 'getState'];
    
    for (const prop of props) {
      if (state[prop]) {
        const value = state[prop];
        if (value && typeof value === 'object') {
          if (value.isScene || value.type === 'Scene') {
            return value;
          }
          if (typeof value === 'function') {
            try {
              const result = value();
              if (result && result.scene) {
                if (result.scene.isScene) return result.scene;
              }
            } catch (e) {
              // Ignore errors
            }
          }
        }
      }
    }
    
    return null;
  }

  // Expose helper functions
  window.findScene = waitForScene;
  
  // Auto-initialize when DOM is ready
  function autoInitCoins() {
    waitForScene((scene) => {
      console.log('🎯 Scene found, attempting to add coins...');
      if (window.addCoinsToScene) {
        // Try to get THREE.js
        let THREE = window.THREE;
        if (!THREE && window.setTHREE) {
          console.warn('THREE.js not set. Please call window.setTHREE(THREE) first.');
        }
        window.addCoinsToScene(scene, THREE);
      } else {
        console.warn('window.addCoinsToScene not available yet');
      }
    }, 30); // Try up to 30 times (15 seconds)
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(autoInitCoins, 1000);
    });
  } else {
    setTimeout(autoInitCoins, 1000);
  }

  // Also expose a function to get player position
  // This will be called by the main app
  window.setPlayerPositionGetter = function(getter) {
    window.getPlayerPosition = getter;
    console.log('✅ Player position getter set');
  };

  // Also expose a function to set player position directly
  window.setPlayerPosition = function(x, y, z) {
    if (window.gameState && window.gameState.minimapState) {
      window.gameState.minimapState.playerPos = { x, y, z };
    }
  };

  // Try to find player position automatically
  function tryFindPlayerPosition() {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    // Try to find player mesh
    try {
      if (window.getScene && typeof window.getScene === 'function') {
        const scene = window.getScene();
        if (scene && scene.children) {
          const playerMesh = scene.children.find(child => 
            child.name && (
              child.name.toLowerCase().includes('explorer') ||
              child.name.toLowerCase().includes('player') ||
              child.name.toLowerCase().includes('character')
            )
          );
          
          if (playerMesh && playerMesh.position) {
            // Create a getter function
            window.getPlayerPosition = () => ({
              x: playerMesh.position.x,
              y: playerMesh.position.y,
              z: playerMesh.position.z
            });
            console.log('✅ Auto-found player position getter');
            return true;
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
    
    return false;
  }

  // Try to find player position periodically
  let playerFindAttempts = 0;
  const playerFindInterval = setInterval(() => {
    playerFindAttempts++;
    if (tryFindPlayerPosition() || playerFindAttempts >= 20) {
      clearInterval(playerFindInterval);
    }
  }, 500);

  // Expose a function to get THREE.js
  window.setTHREE = function(THREE) {
    window.THREE = THREE;
  };

})();
