# 🚀 Firebase Deployment Guide

Этот гайд поможет вам задеплоить Task Manager на Firebase.

## Предварительные требования

1. **Firebase CLI**: Установлен через `npm install -g firebase-tools`
2. **Google Cloud Project**: Создан проект в Firebase Console
3. **Google OAuth**: Настроены учетные данные в Google Cloud Console

## Настройка Firebase

### 1. Логин в Firebase

```bash
firebase login
```

### 2. Инициализация проекта

```bash
firebase init
```

Выберите:
- ✅ Functions: Configure a Cloud Functions directory
- ✅ Firestore: Configure security rules and indexes  
- ✅ Hosting: Configure files for Firebase Hosting

### 3. Выбор проекта

```bash
firebase use --add
```

Выберите ваш Firebase проект.

## Настройка переменных окружения

### В Firebase Console:

1. Перейдите в **Project Settings > Service accounts**
2. Создайте новый service account key
3. Скачайте JSON файл

### Установка переменных для Cloud Functions:

```bash
# Telegram Bot Token
firebase functions:config:set telegram.bot_token="YOUR_BOT_TOKEN"

# Google OAuth
firebase functions:config:set google.client_id="YOUR_GOOGLE_CLIENT_ID"
firebase functions:config:set google.client_secret="YOUR_GOOGLE_CLIENT_SECRET"
firebase functions:config:set google.callback_url="https://YOUR_PROJECT.web.app/auth/google/callback"

# Session Secret
firebase functions:config:set session.secret="YOUR_SESSION_SECRET"
```

## Деплой

### Автоматический деплой

```bash
npm run deploy
```

### Ручной деплой

```bash
# Установить зависимости
cd functions
npm install
cd ..

# Деплой
firebase deploy
```

### Деплой только Functions

```bash
firebase deploy --only functions
```

### Деплой только Hosting

```bash
firebase deploy --only hosting
```

## Проверка деплоя

После деплоя:

1. Откройте `https://YOUR_PROJECT.web.app`
2. Проверьте авторизацию через Google
3. Протестируйте создание задачи через Telegram бота
4. Убедитесь, что уведомления работают

## Просмотр логов

```bash
# Логи Cloud Functions
firebase functions:log

# Логи конкретной функции
firebase functions:log --only api
```

## Локальная разработка с Firebase

### Запуск эмуляторов

```bash
firebase emulators:start
```

Откроется:
- Functions: http://localhost:5001
- Firestore: http://localhost:8080
- Hosting: http://localhost:5000

### Запуск с Firestore

```bash
npm run firestore
```

## Структура проекта для Firebase

```
├── functions/              # Cloud Functions
│   ├── index.js            # Entry point
│   ├── app.js              # Express app
│   ├── database-firestore.js # Firestore database
│   ├── bot.js              # Telegram bot
│   └── package.json        # Functions dependencies
├── public/                 # Static files for hosting
│   ├── index.html          # Main app
│   └── login.html          # Login page
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore indexes
├── firebase.json           # Firebase configuration
└── deploy.sh               # Deployment script
```

## Настройка Google OAuth для продакшн

В Google Cloud Console обновите:

1. **Authorized origins**: 
   - `https://YOUR_PROJECT.web.app`
   
2. **Authorized redirect URIs**:
   - `https://YOUR_PROJECT.web.app/auth/google/callback`

## Мониторинг

### Firebase Console

- **Functions**: Просмотр вызовов и ошибок
- **Firestore**: Мониторинг запросов к базе данных
- **Hosting**: Статистика посещений

### Логирование

```javascript
// В коде Cloud Functions
console.log('Info message');
console.error('Error message');
```

## Устранение неполадок

### Проблемы с авторизацией

1. Проверьте Google OAuth settings
2. Убедитесь, что callback URL корректный
3. Проверьте переменные окружения

### Проблемы с Telegram Bot

1. Проверьте BOT_TOKEN в functions config
2. Убедитесь, что бот добавлен в группу с правами админа
3. Проверьте логи Cloud Functions

### Проблемы с Firestore

1. Проверьте правила безопасности
2. Убедитесь, что индексы созданы
3. Проверьте права доступа

## Команды для отладки

```bash
# Просмотр конфигурации
firebase functions:config:get

# Локальный запуск functions
firebase emulators:start --only functions

# Деплой с отладкой
firebase deploy --debug
```