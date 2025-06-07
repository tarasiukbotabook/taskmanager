const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Инициализируем Firebase Admin
admin.initializeApp();

// Импортируем Express приложение
const app = require('./app');

// Экспортируем как Cloud Function
exports.api = functions.https.onRequest(app);