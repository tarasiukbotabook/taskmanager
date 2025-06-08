require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const TaskBot = require('./bot');
const database = process.env.USE_FIRESTORE ? './database-firestore' : './database';
const { getAllTasks, getTaskStats, completeTask, deleteTask, updateTask, submitForReview, approveTask, requestRevision, returnToWork } = require(database);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Отдаем только определенные статичные файлы без авторизации
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));

// Убрана авторизация для упрощения

// Инициализация бота
let bot;
let botToken = process.env.BOT_TOKEN;

function initBot(token) {
    if (bot) {
        try {
            console.log('Stopping existing bot instance...');
            bot.bot.stopPolling();
            bot = null;
            // Даем время для корректного завершения polling
            setTimeout(() => {}, 1000);
        } catch (error) {
            console.warn('Error stopping previous bot:', error);
        }
    }
    
    try {
        console.log('Starting new bot instance...');
        bot = new TaskBot(token);
        botToken = token;
        console.log('✅ Telegram bot started successfully');
        return true;
    } catch (error) {
        console.error('❌ Error starting bot:', error);
        return false;
    }
}

if (botToken) {
    const initResult = initBot(botToken);
    console.log('Bot initialization result:', initResult);
} else {
    console.warn('BOT_TOKEN not provided. Add it in settings to start the bot.');
    console.warn('Bot notifications will not work until token is set.');
}

// Убраны все роуты авторизации

// API маршруты
app.get('/api/tasks', async (req, res) => {
    try {
        const tasks = await getAllTasks();
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const stats = await getTaskStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.put('/api/tasks/:id/complete', async (req, res) => {
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
});

app.put('/api/tasks/:id', async (req, res) => {
    try {
        const taskId = req.params.id;
        const { title, description, deadline } = req.body;
        
        if (!title || !deadline) {
            return res.status(400).json({ error: 'Title and deadline are required' });
        }
        
        const result = await updateTask(taskId, title, description, deadline);
        
        if (result > 0) {
            res.json({ success: true, message: 'Task updated successfully' });
        } else {
            res.status(404).json({ error: 'Task not found' });
        }
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Failed to update task' });
    }
});

app.delete('/api/tasks/:id', async (req, res) => {
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
});

app.put('/api/tasks/:id/submit', async (req, res) => {
    try {
        const taskId = req.params.id;
        const { userId } = req.body;
        const result = await submitForReview(taskId, userId);
        
        if (result > 0) {
            res.json({ success: true, message: 'Task submitted for review' });
        } else {
            res.status(404).json({ error: 'Task not found or already submitted' });
        }
    } catch (error) {
        console.error('Error submitting task:', error);
        res.status(500).json({ error: 'Failed to submit task' });
    }
});

app.put('/api/tasks/:id/approve', async (req, res) => {
    try {
        const taskId = req.params.id;
        const { reviewerId, comment } = req.body;
        const result = await approveTask(taskId, reviewerId, comment);
        
        if (result.changes > 0) {
            // Отправляем поздравительное сообщение в Telegram
            if (bot && result.task) {
                const timeSpent = result.task.time_spent_minutes || 0;
                const efficiency = result.task.efficiency_score ? Math.round(result.task.efficiency_score * 100) : 100;
                const points = Math.round(result.task.efficiency_score || 1);
                
                let congratsMessage = `🎉 Отличная работа, ${result.task.assignee_username}!

📋 Задача "${result.task.title}" успешно выполнена!

⏱️ Время выполнения: ${timeSpent} минут
📊 Эффективность: ${efficiency}%
💎 Заработано баллов: ${points}`;

                try {
                    await bot.bot.sendMessage(result.task.chat_id, congratsMessage);
                    console.log(`Approval notification sent for task ${taskId} to chat ${result.task.chat_id}`);
                } catch (telegramError) {
                    console.error('Error sending Telegram message:', telegramError);
                }
            }
            
            res.json({ success: true, message: 'Task approved and points awarded' });
        } else {
            res.status(404).json({ error: 'Task not found' });
        }
    } catch (error) {
        console.error('Error approving task:', error);
        res.status(500).json({ error: 'Failed to approve task' });
    }
});

app.put('/api/tasks/:id/revision', async (req, res) => {
    console.log('🚀 REVISION ENDPOINT CALLED!');
    console.log('Request params:', req.params);
    console.log('Request body:', req.body);
    
    try {
        const taskId = req.params.id;
        const { reviewerId, comment } = req.body;
        
        console.log(`Revision request: taskId=${taskId}, reviewerId=${reviewerId}, comment="${comment}"`);
        
        // Получаем задачу ПЕРЕД обновлением для сохранения chat_id
        const tasks = await getAllTasks();
        const originalTask = tasks.find(t => t.id == taskId);
        
        if (!originalTask) {
            console.log(`Task ${taskId} not found in database`);
            return res.status(404).json({ error: 'Task not found' });
        }
        
        console.log(`Original task found: ${originalTask.title}, status: ${originalTask.status}, chat_id: ${originalTask.chat_id}`);
        
        // Проверяем, что задача может быть отклонена
        if (originalTask.status !== 'review' && originalTask.status !== 'completed') {
            console.log(`❌ Task ${taskId} cannot be rejected. Current status: ${originalTask.status}`);
            return res.status(400).json({ error: `Task cannot be rejected. Current status: ${originalTask.status}. Only tasks with status 'review' can be rejected.` });
        }
        
        // Обновляем статус задачи
        const result = await requestRevision(taskId, reviewerId, comment);
        console.log(`Revision update result: ${result} rows affected`);
        
        if (result > 0) {
            // Отправляем уведомление об отклонении в Telegram
            if (bot && originalTask.chat_id) {
                try {
                    const rejisionCount = (originalTask.revision_count || 0) + 1;
                    const rejectionMessage = `🔄 Задача отклонена на доработку

📋 Задача: ${originalTask.title}
👤 Исполнитель: ${originalTask.assignee_username}
💬 Причина: ${comment}

Количество доработок: ${rejisionCount}

⚠️ Пожалуйста, внесите необходимые исправления и отправьте задачу на проверку снова.`;

                    // Создаем кнопку для возврата к работе
                    const keyboard = {
                        inline_keyboard: [[
                            { text: '🔄 Взять в работу', callback_data: `return_${taskId}` }
                        ]]
                    };

                    console.log(`Sending rejection notification to chat ${originalTask.chat_id}`);
                    await bot.bot.sendMessage(originalTask.chat_id, rejectionMessage, {
                        reply_markup: keyboard
                    });
                    console.log(`✅ Rejection notification sent successfully for task ${taskId}`);
                } catch (telegramError) {
                    console.error('❌ Error sending rejection notification:', telegramError);
                    console.error('Full Telegram error:', telegramError);
                }
            } else {
                console.log(`❌ Cannot send notification: bot=${!!bot}, chat_id=${originalTask.chat_id}`);
                if (!bot) {
                    console.log('❌ Bot is not initialized. Please set bot token in settings.');
                }
                if (!originalTask.chat_id) {
                    console.log('❌ Task has no chat_id.');
                }
            }
            
            res.json({ success: true, message: 'Task sent for revision and notification sent' });
        } else {
            console.log(`❌ No rows affected when updating task ${taskId}`);
            res.status(404).json({ error: 'Task not found or not updated' });
        }
    } catch (error) {
        console.error('❌ Error in revision endpoint:', error);
        res.status(500).json({ error: 'Failed to request revision' });
    }
});

app.put('/api/tasks/:id/return', async (req, res) => {
    try {
        const taskId = req.params.id;
        const result = await returnToWork(taskId);
        
        if (result > 0) {
            res.json({ success: true, message: 'Task returned to work' });
        } else {
            res.status(404).json({ error: 'Task not found' });
        }
    } catch (error) {
        console.error('Error returning task to work:', error);
        res.status(500).json({ error: 'Failed to return task to work' });
    }
});

// Настройки бота
app.get('/api/bot/status', (req, res) => {
    res.json({ 
        isRunning: !!bot,
        hasToken: !!botToken,
        botInfo: bot ? 'Bot initialized' : 'Bot not initialized'
    });
});

app.post('/api/bot/token', (req, res) => {
    const { token } = req.body;
    
    if (!token) {
        return res.status(400).json({ error: 'Token is required' });
    }
    
    console.log('Attempting to initialize bot with new token...');
    const success = initBot(token);
    console.log('Bot initialization result:', success);
    
    if (success) {
        console.log('Bot successfully started and ready for notifications');
        res.json({ success: true, message: 'Bot started successfully' });
    } else {
        console.error('Failed to initialize bot with provided token');
        res.status(400).json({ error: 'Failed to start bot. Check token validity.' });
    }
});

app.post('/api/bot/stop', (req, res) => {
    if (bot) {
        bot.bot.stopPolling();
        bot = null;
        res.json({ success: true, message: 'Bot stopped' });
    } else {
        res.json({ success: true, message: 'Bot was not running' });
    }
});

// API для рейтинга
app.get('/api/rating', async (req, res) => {
    try {
        const rating = await getUserRating();
        res.json(rating);
    } catch (error) {
        console.error('Error fetching rating:', error);
        res.status(500).json({ error: 'Failed to fetch rating' });
    }
});

// API для детальной статистики по исполнителям
app.get('/api/stats/detailed', async (req, res) => {
    try {
        const detailedStats = await getDetailedTaskStats();
        res.json(detailedStats);
    } catch (error) {
        console.error('Error fetching detailed stats:', error);
        res.status(500).json({ error: 'Failed to fetch detailed stats' });
    }
});

// API для метрик производительности
app.get('/api/stats/performance', async (req, res) => {
    try {
        const performanceMetrics = await getTaskPerformanceMetrics();
        res.json(performanceMetrics);
    } catch (error) {
        console.error('Error fetching performance metrics:', error);
        res.status(500).json({ error: 'Failed to fetch performance metrics' });
    }
});

// API для тестирования уведомлений
app.post('/api/bot/test', async (req, res) => {
    const { chatId } = req.body;
    
    if (!bot) {
        return res.status(400).json({ error: 'Bot not initialized' });
    }
    
    if (!chatId) {
        return res.status(400).json({ error: 'Chat ID required' });
    }
    
    try {
        await bot.bot.sendMessage(chatId, '🧪 Тест уведомлений: бот работает!');
        res.json({ success: true, message: 'Test message sent' });
    } catch (error) {
        console.error('Test message error:', error);
        res.status(500).json({ error: 'Failed to send test message', details: error.message });
    }
});

// API для напоминания о задаче
app.post('/api/tasks/:id/remind', async (req, res) => {
    try {
        const taskId = req.params.id;
        
        // Получаем информацию о задаче
        const tasks = await getAllTasks();
        const task = tasks.find(t => t.id == taskId);
        
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (task.status !== 'pending' && task.status !== 'revision') {
            return res.status(400).json({ error: 'Can only remind about active tasks' });
        }

        // Отправляем напоминание в Telegram
        if (bot && task.chat_id) {
            const deadlineText = task.deadline ? ` до ${task.deadline}` : '';
            const reminderMessage = `⏰ Напоминание о задаче!\n\n📋 ${task.title}\n👤 ${task.assignee_username}${deadlineText}\n\n${task.description || 'Описание не указано'}\n\n⚠️ Не забудьте выполнить задачу в срок!`;
            
            try {
                await bot.bot.sendMessage(task.chat_id, reminderMessage);
                res.json({ success: true, message: 'Reminder sent successfully' });
            } catch (telegramError) {
                console.error('Error sending reminder:', telegramError);
                res.status(500).json({ error: 'Failed to send reminder' });
            }
        } else {
            res.status(500).json({ error: 'Bot not available' });
        }
    } catch (error) {
        console.error('Error sending reminder:', error);
        res.status(500).json({ error: 'Failed to send reminder' });
    }
});

// Убраны API для управления ролями и настройками

// Статичные ресурсы
app.use('/', express.static(path.join(__dirname, 'public')));

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    if (bot) {
        bot.bot.stopPolling();
    }
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Web interface: http://localhost:${PORT}`);
    console.log('API endpoints:');
    console.log('- GET /api/tasks - получить все задачи');
    console.log('- GET /api/stats - получить статистику');
    console.log('- PUT /api/tasks/:id/complete - отметить задачу как выполненную');
    console.log('- DELETE /api/tasks/:id - удалить задачу');
});