// Coin Preview Renderer
// Renders the 3D coin model in the COINS panel

(function() {
  'use strict';

  let scene, camera, renderer, coinModel, animationId;
  let canvas = null;

  function initCoinPreview() {
    canvas = document.getElementById('coin-preview-canvas');
    if (!canvas) {
      console.warn('Coin preview canvas not found');
      return;
    }

    // Wait for THREE.js to be available
    const checkForTHREE = setInterval(() => {
      if (window.THREE) {
        clearInterval(checkForTHREE);
        setupScene();
      }
    }, 100);

    // Stop after 10 seconds
    setTimeout(() => clearInterval(checkForTHREE), 10000);
  }

  function setupScene() {
    const THREE = window.THREE;
    if (!THREE) {
      console.error('THREE.js not available');
      showFallback();
      return;
    }

    // Get canvas dimensions
    const width = 64;
    const height = 64;
    canvas.width = width;
    canvas.height = height;

    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Create camera
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 3);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ 
      canvas: canvas, 
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(2, 2, 2);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-2, -1, -2);
    scene.add(directionalLight2);

    // Load coin model
    loadCoinModel(THREE);
  }

  function loadCoinModel(THREE) {
    // Check for GLTFLoader
    let GLTFLoader;
    if (THREE.GLTFLoader) {
      GLTFLoader = THREE.GLTFLoader;
    } else if (window.GLTFLoader) {
      GLTFLoader = window.GLTFLoader;
    } else {
      console.warn('GLTFLoader not found, showing fallback');
      showFallback();
      return;
    }

    const loader = new GLTFLoader();
    
    loader.load(
      './coin.glb',
      (gltf) => {
        console.log('✅ Coin preview model loaded');
        
        // Clone the model
        coinModel = gltf.scene.clone();
        
        // Scale and position
        const box = new THREE.Box3().setFromObject(coinModel);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.5 / maxDim;
        coinModel.scale.set(scale, scale, scale);
        
        // Center the model
        const center = box.getCenter(new THREE.Vector3());
        coinModel.position.sub(center);
        
        scene.add(coinModel);
        
        // Start animation
        animate();
      },
      (progress) => {
        // Loading progress
        if (progress.lengthComputable) {
          const percentComplete = (progress.loaded / progress.total) * 100;
          console.log('Loading coin preview: ' + percentComplete.toFixed(0) + '%');
        }
      },
      (error) => {
        console.warn('Failed to load coin.glb for preview:', error);
        showFallback();
      }
    );
  }

  function animate() {
    if (!renderer || !scene || !camera) return;
    
    animationId = requestAnimationFrame(animate);
    
    // Rotate coin
    if (coinModel) {
      coinModel.rotation.y += 0.01;
    }
    
    renderer.render(scene, camera);
  }

  function showFallback() {
    if (canvas) {
      const fallback = canvas.parentElement.querySelector('.coin-icon-fallback');
      if (fallback) {
        fallback.style.display = 'block';
      }
    }
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
    if (renderer) {
      renderer.dispose();
    }
  });

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCoinPreview);
  } else {
    initCoinPreview();
  }
})();
