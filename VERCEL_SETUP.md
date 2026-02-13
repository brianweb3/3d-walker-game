# Настройка Vercel для проекта

## Проблема: Vercel не подтягивает изменения

Если Vercel не автоматически деплоит изменения, выполните следующие шаги:

### 1. Проверьте настройки проекта в Vercel Dashboard

1. Зайдите в [Vercel Dashboard](https://vercel.com/dashboard)
2. Найдите проект `3d-walker-game`
3. Перейдите в **Settings** → **General**
4. Убедитесь, что:
   - **Root Directory**: должен быть пустым или `.` (корень репозитория)
   - **Output Directory**: `dist`
   - **Build Command**: оставьте пустым или `echo 'No build needed'`
   - **Install Command**: оставьте пустым

### 2. Переподключите репозиторий (если нужно)

1. В Vercel Dashboard → **Settings** → **Git**
2. Нажмите **Disconnect** (если подключен)
3. Затем **Connect Git Repository**
4. Выберите `brianweb3/3d-walker-game`
5. Vercel автоматически обнаружит `vercel.json`

### 3. Ручной деплой

Если автоматический деплой не работает:

1. В Vercel Dashboard → выберите проект
2. Перейдите на вкладку **Deployments**
3. Нажмите **Redeploy** на последнем деплое
4. Или нажмите **Deploy** → выберите ветку `main`

### 4. Проверьте webhook'и GitHub

1. В GitHub репозитории → **Settings** → **Webhooks**
2. Убедитесь, что есть webhook от Vercel
3. Если нет - Vercel должен создать его автоматически при подключении

### Текущая конфигурация

- **Output Directory**: `dist`
- **Framework**: None (Static)
- **Build Command**: не требуется
- **Все файлы в папке `dist`** будут развернуты
