// Manual Coin Setup Script
// Run this in browser console to manually add coins to scene

(function() {
  'use strict';

  console.log('🔧 Manual Coin Setup Script Loaded');
  console.log('');
  console.log('📋 Instructions:');
  console.log('1. Open React DevTools (install extension if needed)');
  console.log('2. Find the Canvas component in Components tab');
  console.log('3. Select it');
  console.log('4. In console, type: $r');
  console.log('5. Then find scene:');
  console.log('   - Try: $r.props.children');
  console.log('   - Or: $r._owner.stateNode');
  console.log('   - Or look for scene in props/state');
  console.log('');
  console.log('6. Once you find scene, execute:');
  console.log('   window.debugAddCoins(scene, THREE)');
  console.log('');
  console.log('💡 Alternative: If you have access to THREE.js:');
  console.log('   const scene = new THREE.Scene(); // or get from your app');
  console.log('   window.debugAddCoins(scene, THREE)');
  console.log('');
  
  // Try to auto-find scene through various methods
  function autoFindScene() {
    console.log('🔍 Attempting to auto-find scene...');
    
    // Method 1: Check if THREE is available
    if (!window.THREE) {
      console.warn('⚠️ THREE.js not found in window.THREE');
      console.log('💡 Try: window.setTHREE(THREE) first');
      return null;
    }
    
    const THREE = window.THREE;
    console.log('✅ THREE.js found');
    
    // Method 2: Check canvas
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      console.warn('⚠️ Canvas not found');
      return null;
    }
    
    console.log('✅ Canvas found');
    
    // Method 3: Try to get scene from canvas renderer
    try {
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
      if (gl) {
        // Check various properties
        const possibleRenderers = [
          canvas.__r3f,
          canvas._r3f,
          gl.canvas.__r3f,
          canvas.__reactInternalInstance,
          canvas._reactInternalInstance
        ];
        
        for (const renderer of possibleRenderers) {
          if (renderer) {
            if (renderer.scene && renderer.scene.isScene) {
              console.log('✅ Found scene through renderer!');
              return renderer.scene;
            }
            if (renderer.getState && typeof renderer.getState === 'function') {
              try {
                const state = renderer.getState();
                if (state && state.scene && state.scene.isScene) {
                  console.log('✅ Found scene through renderer.getState()!');
                  return state.scene;
                }
              } catch (e) {
                // Ignore
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Error accessing WebGL context:', e);
    }
    
    // Method 4: Try React root
    const root = document.getElementById('root');
    if (root) {
      console.log('✅ Root element found, trying React tree traversal...');
      // This would require more complex traversal
    }
    
    console.warn('⚠️ Could not auto-find scene');
    return null;
  }
  
  // Expose auto-find function
  window.autoFindScene = autoFindScene;
  
  // Try auto-find after a delay
  setTimeout(() => {
    const scene = autoFindScene();
    if (scene && window.addCoinsToScene) {
      console.log('🎯 Auto-adding coins to found scene...');
      window.addCoinsToScene(scene, window.THREE);
    }
  }, 3000);
  
})();
