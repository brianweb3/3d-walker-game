# Настройка Railway для проекта

## Быстрый старт

1. Зайдите на [Railway](https://railway.app)
2. Нажмите **New Project**
3. Выберите **Deploy from GitHub repo**
4. Выберите репозиторий `brianweb3/3d-walker-game`
5. Railway автоматически обнаружит конфигурацию

## Настройки проекта в Railway

После создания проекта:

1. Перейдите в **Settings** проекта
2. Установите:
   - **Root Directory**: `.` (корень репозитория)
   - **Build Command**: оставьте пустым (Railway использует nixpacks.toml)
   - **Start Command**: `serve -s dist -l $PORT` (уже настроено в nixpacks.toml)

## Переменные окружения

Не требуются для статического сайта.

## Структура проекта

- `dist/` - папка со статическими файлами для деплоя
- `nixpacks.toml` - конфигурация для Railway/Nixpacks
- `railway.json` - дополнительная конфигурация Railway
- `package.json` - содержит start команду

## Проверка деплоя

После деплоя Railway предоставит URL вида: `https://your-project.railway.app`

Все файлы из папки `dist` будут доступны по этому URL.
