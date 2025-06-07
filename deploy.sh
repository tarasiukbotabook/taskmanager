#!/bin/bash

echo "🚀 Deploying Task Manager to Firebase..."

# Проверяем, что мы залогинены в Firebase
if ! firebase projects:list > /dev/null 2>&1; then
    echo "❌ Not logged in to Firebase. Please run 'firebase login' first."
    exit 1
fi

# Устанавливаем зависимости для functions
echo "📦 Installing dependencies for Cloud Functions..."
cd functions
npm install
cd ..

# Деплоим на Firebase
echo "🌐 Deploying to Firebase Hosting and Functions..."
firebase deploy

echo "✅ Deployment complete!"
echo "🔗 Your app is now live at: https://$(firebase projects:list | grep '(current)' | awk '{print $1}').web.app"

# Показываем логи функций
echo "📋 To view logs, run: firebase functions:log"