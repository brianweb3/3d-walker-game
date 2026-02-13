// React Three Fiber Patch
// This script patches React Three Fiber to automatically expose scene and add coins

(function() {
  'use strict';

  console.log('🔧 React Three Fiber Patch Loaded');

  // Wait for React Three Fiber to load
  function patchR3F() {
    // Try to find useThree hook
    if (typeof window !== 'undefined' && window.React) {
      // React Three Fiber usually exports useThree
      // We'll try to intercept Canvas component creation
    }

    // Method: Patch Canvas component by watching for scene creation
    const originalCreateElement = document.createElement;
    let sceneFound = false;

    // Watch for canvas creation
    document.createElement = function(tagName, options) {
      const element = originalCreateElement.call(this, tagName, options);
      
      if (tagName === 'canvas' && !sceneFound) {
        // Wait a bit for React to mount
        setTimeout(() => {
          tryFindAndAddCoins();
        }, 2000);
      }
      
      return element;
    };

    // Also try to intercept React Three Fiber's useThree
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
      
      // Try to get renderer instances
      const originalOnCommitFiberRoot = hook.onCommitFiberRoot;
      hook.onCommitFiberRoot = function(id, root, ...args) {
        if (originalOnCommitFiberRoot) {
          originalOnCommitFiberRoot.call(this, id, root, ...args);
        }
        
        // Try to find scene in fiber tree
        if (root && root.current) {
          setTimeout(() => {
            tryFindSceneInFiber(root.current);
          }, 1000);
        }
      };
    }
  }

  function tryFindSceneInFiber(fiber) {
    if (!fiber) return null;
    
    // Check if this fiber has scene
    if (fiber.memoizedState) {
      let state = fiber.memoizedState;
      while (state) {
        if (state.memoizedState && state.memoizedState.scene && state.memoizedState.scene.isScene) {
          console.log('✅ Found scene in React Fiber!');
          addCoinsToFoundScene(state.memoizedState.scene);
          return state.memoizedState.scene;
        }
        state = state.next;
      }
    }

    // Check children
    if (fiber.child) {
      const scene = tryFindSceneInFiber(fiber.child);
      if (scene) return scene;
    }

    // Check sibling
    if (fiber.sibling) {
      const scene = tryFindSceneInFiber(fiber.sibling);
      if (scene) return scene;
    }

    return null;
  }

  function tryFindAndAddCoins() {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    // Try multiple methods
    const methods = [
      () => {
        // Method 1: Check if scene is stored in canvas
        if (canvas.__r3f && canvas.__r3f.scene) {
          return canvas.__r3f.scene;
        }
        return null;
      },
      () => {
        // Method 2: Check React internals
        const root = document.getElementById('root');
        if (root) {
          const reactRoot = root._reactRootContainer || root._reactInternalFiber;
          if (reactRoot) {
            return tryFindSceneInFiber(reactRoot);
          }
        }
        return null;
      },
      () => {
        // Method 3: Try to get from window.getScene
        if (window.getScene && typeof window.getScene === 'function') {
          return window.getScene();
        }
        return null;
      }
    ];

    for (const method of methods) {
      try {
        const scene = method();
        if (scene && scene.isScene) {
          addCoinsToFoundScene(scene);
          return;
        }
      } catch (e) {
        // Ignore
      }
    }
  }

  function addCoinsToFoundScene(scene) {
    if (!scene || !scene.isScene) return;
    
    console.log('✅ Scene found! Attempting to add coins...');
    
    // Get THREE.js
    let THREE = window.THREE;
    if (!THREE) {
      console.warn('⚠️ THREE.js not found');
      return;
    }

    // Add coins
    if (window.addCoinsToScene) {
      window.addCoinsToScene(scene, THREE);
    } else {
      console.warn('⚠️ window.addCoinsToScene not available');
    }
  }

  // Start patching
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchR3F);
  } else {
    patchR3F();
  }

  // Also try periodically
  setTimeout(tryFindAndAddCoins, 3000);
  setTimeout(tryFindAndAddCoins, 5000);
  setTimeout(tryFindAndAddCoins, 10000);

})();
