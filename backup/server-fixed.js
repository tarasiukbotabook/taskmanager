require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Инициализация базы данных с обработкой ошибок
let database;
let getAllTasks, getTaskStats, completeTask, deleteTask, updateTask;

try {
    database = require('./database');
    ({ getAllTasks, getTaskStats, completeTask, deleteTask, updateTask } = database);
    console.log('✅ SQLite database connected');
} catch (error) {
    console.error('❌ Database connection failed:', error.message);
    // Заглушки для функций базы данных
    getAllTasks = async () => [];
    getTaskStats = async () => ({ total: 0, completed: 0, pending: 0 });
    completeTask = async () => 0;
    deleteTask = async () => 0;
    updateTask = async () => 0;
}

// Инициализация бота с обработкой ошибок
let bot;
const botToken = process.env.BOT_TOKEN;

if (botToken) {
    try {
        const TaskBot = require('./bot');
        bot = new TaskBot(botToken);
        console.log('✅ Telegram bot started successfully');
    } catch (error) {
        console.error('❌ Bot initialization failed:', error.message);
        bot = null;
    }
} else {
    console.warn('⚠️  BOT_TOKEN not provided. Bot disabled.');
}

// Обработчик ошибок для async функций
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// API маршруты с обработкой ошибок
app.get('/api/tasks', asyncHandler(async (req, res) => {
    try {
        const tasks = await getAllTasks();
        res.json(tasks || []);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.json([]); // Возвращаем пустой массив вместо ошибки
    }
}));

app.get('/api/stats', asyncHandler(async (req, res) => {
    try {
        const stats = await getTaskStats();
        res.json(stats || { total: 0, completed: 0, pending: 0 });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.json({ total: 0, completed: 0, pending: 0 });
    }
}));

app.put('/api/tasks/:id/complete', asyncHandler(async (req, res) => {
    try {
        const taskId = req.params.id;
        const result = await completeTask(taskId);
        
        if (result > 0) {
            res.json({ success: true, message: 'Task completed successfully' });
        } else {
            res.status(404).json({ error: 'Task not found' });
        }
    } catch (error) {
        console.error('Error completing task:', error);
        res.status(500).json({ error: 'Failed to complete task' });
    }
}));

app.delete('/api/tasks/:id', asyncHandler(async (req, res) => {
    try {
        const taskId = req.params.id;
        const result = await deleteTask(taskId);
        
        if (result > 0) {
            res.json({ success: true, message: 'Task deleted successfully' });
        } else {
            res.status(404).json({ error: 'Task not found' });
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Failed to delete task' });
    }
}));

// Простая проверка здоровья сервера
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        bot: !!bot,
        database: !!database
    });
});

// Главная страница
app.get('/', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } catch (error) {
        res.send(`
            <h1>Task Manager</h1>
            <p>Server is running but public files are not available.</p>
            <p>Time: ${new Date().toLocaleString()}</p>
            <a href="/api/health">Health Check</a>
        `);
    }
});

// Обработчик 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Глобальный обработчик ошибок
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: error.message
    });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    if (bot) {
        try {
            bot.bot.stopPolling();
        } catch (error) {
            console.error('Error stopping bot:', error);
        }
    }
    process.exit(0);
});

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Не завершаем процесс, просто логируем
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Не завершаем процесс, просто логируем
});

// Запуск сервера
const server = app.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 Server running on http://127.0.0.1:${PORT}`);
    console.log(`📊 Health check: http://127.0.0.1:${PORT}/api/health`);
    console.log(`🤖 Bot status: ${bot ? 'Active' : 'Disabled'}`);
    console.log(`💾 Database: ${database ? 'Connected' : 'Offline'}`);
});

server.on('error', (err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
});

module.exports = app;