// ⚠️ ОБЯЗАТЕЛЬНЫЙ ПАТЧ
// Этот код НУЖНО добавить в explorer_local.js ПЕРЕД основным кодом
// Или выполнить в консоли браузера после загрузки страницы

(function() {
  'use strict';
  
  // Ждем загрузки React Three Fiber
  const checkInterval = setInterval(() => {
    // Проверяем, есть ли Canvas компонент
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    
    // Ищем React Three Fiber через глобальные переменные
    // React Three Fiber обычно хранит store в canvas или root
    const root = document.getElementById('root');
    if (!root) return;
    
    // Пытаемся найти store через React internals
    try {
      const reactRoot = root._reactRootContainer || root._reactInternalFiber;
      if (reactRoot) {
        // Ищем компонент Canvas в дереве
        findCanvasAndPatch(reactRoot);
      }
    } catch (e) {
      // Ignore
    }
    
    clearInterval(checkInterval);
  }, 500);
  
  function findCanvasAndPatch(fiber) {
    if (!fiber) return;
    
    // Проверяем тип компонента
    if (fiber.type && fiber.type.name === 'Canvas') {
      // Нашли Canvas! Патчим его
      patchCanvasComponent(fiber);
      return;
    }
    
    // Рекурсивно ищем в детях
    if (fiber.child) findCanvasAndPatch(fiber.child);
    if (fiber.sibling) findCanvasAndPatch(fiber.sibling);
  }
  
  function patchCanvasComponent(canvasFiber) {
    console.log('✅ Found Canvas component, patching...');
    
    // Патчим useThree hook если возможно
    // Это сложно без доступа к исходному коду
    
    // Вместо этого, создаем глобальную функцию для вызова из компонента
    window.__R3F_PATCH_READY = true;
    console.log('✅ Patch ready. Now you need to add code to your Canvas component.');
  }
  
  // Также создаем простой способ через консоль
  window.findSceneManually = function() {
    console.log('🔍 Manual scene finder');
    console.log('');
    console.log('Способ 1: Через React DevTools');
    console.log('1. Установи React DevTools расширение');
    console.log('2. Открой Components вкладку');
    console.log('3. Найди Canvas компонент');
    console.log('4. Выдели его');
    console.log('5. В консоли выполни: $r');
    console.log('6. Затем найди scene в props/state');
    console.log('7. Выполни: window.debugAddCoins(scene, THREE)');
    console.log('');
    console.log('Способ 2: Если есть доступ к коду');
    console.log('Добавь в компонент Canvas:');
    console.log('useEffect(() => {');
    console.log('  const { scene } = useThree();');
    console.log('  window.setTHREE(THREE);');
    console.log('  if (window.addCoinsToScene) {');
    console.log('    window.addCoinsToScene(scene, THREE);');
    console.log('  }');
    console.log('}, [scene]);');
  };
  
})();
