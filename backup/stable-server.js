require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Простая проверка
app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'working', 
        time: new Date().toISOString(),
        message: 'Server is running!'
    });
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(PORT, '127.0.0.1', () => {
    console.log(`Stable server running on http://127.0.0.1:${PORT}`);
    console.log(`Test API: http://127.0.0.1:${PORT}/api/test`);
}).on('error', (err) => {
    console.error('Server error:', err);
});