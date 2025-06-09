const functions = require('firebase-functions');
const app = require('./app');

// Firebase Functions endpoint для API
exports.api = functions.https.onRequest(app);

// Примечание: bot.js и database-firestore.js теперь используются из корневой директории
// Это устраняет дублирование кода и упрощает поддержку