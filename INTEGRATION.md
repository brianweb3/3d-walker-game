# Интеграция игровой механики The Walker

## Обзор

Добавлена игровая механика сбора монет и обмена на токены $Walker. Система состоит из:

1. **UI-хедер** с логотипом X PUMPFUN и названием "The Walker"
2. **HUD панель** с отображением монет и баланса токенов
3. **Система монет** - монеты спавнятся в 3D-сцене и собираются при приближении
4. **Механика обмена** - 10 монет = 1,000,000 $Walker токенов

## Файлы

- `dist/index.html` - обновлён с хедером и HUD
- `dist/style.css` - добавлены стили для UI элементов
- `dist/game-mechanics.js` - основная логика игры
- `dist/scene-integration.js` - помощник для интеграции с React Three Fiber

## Загрузка GLB модели монеты

Файл `coin.glb` уже скопирован в папку `dist`. Для загрузки GLB моделей необходимо убедиться, что GLTFLoader доступен:

### Вариант 1: Если используется React Three Fiber с drei
```javascript
import { useGLTF } from '@react-three/drei';

// В компоненте монеты
const { scene } = useGLTF('./coin.glb');
```

### Вариант 2: Если используется чистый Three.js
```javascript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Экспортируйте loader
window.GLTFLoader = GLTFLoader;
```

### Вариант 3: Fallback
Если GLTFLoader недоступен, система автоматически использует простую геометрию (золотой цилиндр) вместо GLB модели.

## Интеграция с основным приложением

Для полной работы системы монет необходимо добавить в основной код (explorer_local.js или исходный код) следующие вызовы:

### 1. Экспорт THREE.js в глобальную область

```javascript
// В начале файла, где импортируется THREE.js
window.setTHREE(THREE);
```

### 2. Экспорт сцены

```javascript
// В компоненте, где создаётся сцена (Scene)
import { useThree } from '@react-three/fiber';

function YourSceneComponent() {
  const { scene } = useThree();
  
  useEffect(() => {
    // Экспортируем сцену для добавления монет
    if (window.addCoinsToScene) {
      window.addCoinsToScene(scene, THREE);
    }
  }, [scene]);
  
  // ... остальной код
}
```

### 3. Экспорт позиции персонажа

```javascript
// В компоненте персонажа (Explorer/Character)
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';

function Explorer() {
  const ref = useRef();
  
  useFrame(() => {
    if (ref.current && window.setPlayerPositionGetter) {
      const pos = ref.current.position;
      window.setPlayerPositionGetter(() => ({
        x: pos.x,
        y: pos.y,
        z: pos.z
      }));
    }
  });
  
  // ... остальной код
}
```

## Альтернативный подход (без модификации основного кода)

Если модификация основного кода невозможна, система будет работать частично:

- ✅ UI-хедер и HUD будут отображаться
- ✅ Кнопка обмена будет работать (можно тестировать вручную)
- ⚠️ Монеты не будут появляться в сцене автоматически
- ⚠️ Автоматический сбор монет не будет работать

Для тестирования можно вручную вызвать в консоли браузера:

```javascript
// Если у вас есть доступ к сцене и THREE
window.setTHREE(THREE);
window.addCoinsToScene(yourScene, THREE);

// Если у вас есть доступ к позиции персонажа
window.setPlayerPositionGetter(() => ({
  x: playerPosition.x,
  y: playerPosition.y,
  z: playerPosition.z
}));
```

## Настройка параметров

Параметры игры можно изменить в `game-mechanics.js`:

```javascript
const gameState = {
  COINS_PER_SWAP: 10,        // Монет для обмена
  TOKENS_PER_SWAP: 1000000,  // Токенов за обмен
  PICKUP_DISTANCE: 2.5,      // Расстояние сбора монеты
  COIN_COUNT: 30             // Количество монет на карте
};
```

## Тестирование

1. Откройте `dist/index.html` в браузере
2. Проверьте, что хедер и HUD отображаются
3. Если монеты не появляются, проверьте консоль браузера на наличие ошибок
4. Для тестирования обмена можно временно установить начальное количество монет:

```javascript
// В консоли браузера
window.gameState.coinsCollected = 10;
window.gameState.updateUI();
```

## Производительность

- Монеты используют общую геометрию для оптимизации
- Анимация монет выполняется через requestAnimationFrame
- Проверка коллизий выполняется каждые 16ms (60fps)

## Дальнейшие улучшения

- Добавить сохранение прогресса в localStorage
- Добавить звуковые эффекты при сборе монет
- Добавить частицы при сборе монет
- Добавить разные типы монет с разными значениями
- Добавить систему достижений
