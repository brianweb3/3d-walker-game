# Быстрое решение: Монеты не видны в 3D-сцене

Если монеты видны на мини-карте, но не видны в 3D-сцене, выполни следующие шаги:

## Решение 1: Добавь в консоль браузера

Открой консоль (F12) и выполни:

```javascript
// Проверь статус монет
window.debugCheckCoins();

// Если монеты есть в памяти, но не в сцене, найди сцену и добавь их вручную
// Для React Three Fiber:
// 1. Найди компонент со сценой
// 2. Добавь useEffect:

useEffect(() => {
  const { scene } = useThree();
  if (window.addCoinsToScene && scene) {
    window.addCoinsToScene(scene, THREE);
  }
}, []);
```

## Решение 2: Добавь в основной код приложения

В компоненте, где создается сцена (обычно это Canvas или Scene компонент):

```javascript
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';

function YourSceneComponent() {
  const { scene } = useThree();
  
  useEffect(() => {
    // Экспортируем THREE и сцену
    window.setTHREE(THREE);
    
    // Добавляем монеты в сцену
    if (window.addCoinsToScene) {
      window.addCoinsToScene(scene, THREE);
    }
  }, [scene]);
  
  return (
    // ... твой код сцены
  );
}
```

## Решение 3: Временное решение - создай монеты вручную

В консоли браузера:

```javascript
// Если у тебя есть доступ к сцене через React DevTools или другой способ
// Найди сцену и выполни:
window.debugAddCoins(yourScene, THREE);
```

## Проверка

После выполнения любого из решений:
1. Проверь консоль - должны быть сообщения "✅ Added X coins to scene"
2. Посмотри в 3D-сцену - должны появиться золотые цилиндры (монеты)
3. Проверь мини-карту - монеты должны совпадать с позициями в 3D
