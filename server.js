// Загрузка переменных окружения из .env файла
require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Новый unified database interface
const { createDatabase } = require('./src/database');

const PORT = 3001;

// Инициализация единой базы данных
let db;
try {
    db = createDatabase();
    console.log('🗄️  Unified database interface initialized');
} catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    // Добавляем CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    try {
        if (pathname === '/') {
            // Главная страница - используем модульную версию
            const modularPath = path.join(__dirname, 'public', 'modular-index.html');
            const legacyPath = path.join(__dirname, 'public', 'index.html');
            
            // Проверяем, есть ли модульная версия
            if (fs.existsSync(modularPath)) {
                const content = fs.readFileSync(modularPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(content);
            } else if (fs.existsSync(legacyPath)) {
                const content = fs.readFileSync(legacyPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(content);
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head><title>Task Manager</title><meta charset="utf-8"></head>
                    <body>
                        <h1>🚀 Task Manager Server</h1>
                        <p>Сервер работает на порту ${PORT}</p>
                        <p>Время: ${new Date().toLocaleString('ru-RU')}</p>
                        <ul>
                            <li><a href="/api/health">Health Check</a></li>
                            <li><a href="/api/tasks">Tasks API</a></li>
                            <li><a href="/api/stats">Stats API</a></li>
                            <li><a href="/legacy">Legacy версия</a></li>
                        </ul>
                    </body>
                    </html>
                `);
            }
        } else if (pathname === '/legacy') {
            // Legacy версия - старый index.html
            const legacyPath = path.join(__dirname, 'public', 'index.html');
            if (fs.existsSync(legacyPath)) {
                const content = fs.readFileSync(legacyPath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(content);
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Legacy version not found');
            }
        } else if (pathname === '/api/health') {
            // Health check
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                timestamp: new Date().toISOString(),
                port: PORT,
                uptime: process.uptime()
            }));
        } else if (pathname === '/api/tasks' && req.method === 'GET') {
            // API для получения всех задач
            (async () => {
                try {
                    const tasks = await db.getAllTasks();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(tasks || []));
                } catch (error) {
                    console.error('Tasks API error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to fetch tasks' }));
                }
            })();
        } else if (pathname === '/api/tasks' && req.method === 'POST') {
            // API для создания задачи
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', async () => {
                try {
                    const taskData = JSON.parse(body);
                    const { title, description, assignee, deadline, estimatedTime } = taskData;
                    
                    if (!title || !assignee) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Title and assignee are required' }));
                        return;
                    }
                    
                    // Создаем задачу через базу данных
                    const taskId = await db.addTask(
                        title,
                        description || '',
                        assignee,
                        deadline || null,
                        'web', // chatId для веб-интерфейса
                        'web_admin' // createdByUserId для веб-интерфейса
                    );
                    
                    // Отправляем уведомление о новой задаче
                    await sendNewTaskNotification(taskId, db);
                    
                    res.writeHead(201, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: true, 
                        taskId: taskId,
                        message: 'Task created successfully' 
                    }));
                } catch (error) {
                    console.error('Task creation error:', error);
                    if (error.message.includes('JSON')) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid JSON data' }));
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to create task' }));
                    }
                }
            });
            return;
        } else if (pathname.startsWith('/api/tasks/') && req.method === 'PUT') {
            // API для обновления задачи
            const taskId = pathname.split('/api/tasks/')[1];
            
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', async () => {
                try {
                    const updateData = JSON.parse(body);
                    const { title, description, deadline, status, assignee } = updateData;
                    
                    if (status) {
                        // Обновление статуса
                        let result;
                        switch (status) {
                            case 'completed':
                                result = await db.completeTask(taskId);
                                break;
                            case 'review':
                                result = await db.submitForReview(taskId, 'web_user');
                                break;
                            case 'pending':
                                result = await db.returnToWork(taskId);
                                break;
                            default:
                                throw new Error('Invalid status');
                        }
                        
                        if (result > 0) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, message: 'Task status updated' }));
                        } else {
                            res.writeHead(404, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Task not found' }));
                        }
                    } else {
                        // Получаем старые данные задачи для сравнения
                        const tasks = await db.getAllTasks();
                        const oldTask = tasks.find(t => t.id == taskId);
                        
                        // Обновление данных задачи
                        const result = await db.updateTask(taskId, title, description, deadline, assignee);
                        
                        if (result > 0) {
                            // Формируем объект изменений для уведомления
                            const changes = {};
                            if (oldTask) {
                                if (title && title !== oldTask.title) {
                                    changes.title = title;
                                }
                                if (description !== oldTask.description) {
                                    changes.description = description;
                                }
                                if (deadline !== oldTask.deadline) {
                                    changes.deadline = deadline;
                                }
                                if (assignee && assignee !== oldTask.assignee_username) {
                                    changes.assignee = assignee;
                                }
                                
                                // Отправляем уведомление только если есть изменения
                                if (Object.keys(changes).length > 0) {
                                    await sendTaskUpdateNotification(taskId, changes, db);
                                }
                            }
                            
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, message: 'Task updated' }));
                        } else {
                            res.writeHead(404, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Task not found' }));
                        }
                    }
                } catch (error) {
                    console.error('Task update error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to update task' }));
                }
            });
            return;
        } else if (pathname.startsWith('/api/tasks/') && req.method === 'DELETE') {
            // API для удаления задачи
            const taskId = pathname.split('/api/tasks/')[1];
            
            (async () => {
                try {
                    const result = await db.deleteTask(taskId);
                    
                    if (result > 0) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: 'Task deleted' }));
                    } else {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Task not found' }));
                    }
                } catch (error) {
                    console.error('Task deletion error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to delete task' }));
                }
            })();
        } else if (pathname === '/api/stats') {
            // API для получения статистики задач
            (async () => {
                try {
                    const stats = await db.getTaskStats();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(stats || { total: 0, completed: 0, pending: 0, in_progress: 0, review: 0 }));
                } catch (error) {
                    console.error('Stats API error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to fetch stats' }));
                }
            })();
        } else if (pathname.startsWith('/api/tasks/') && pathname.endsWith('/history') && req.method === 'GET') {
            // API для получения истории изменений задачи
            const taskId = pathname.split('/api/tasks/')[1].split('/history')[0];
            
            (async () => {
                try {
                    const history = await db.getTaskHistory(taskId);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(history || []));
                } catch (error) {
                    console.error('Task history API error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to fetch task history' }));
                }
            })();
        } else if (pathname.startsWith('/api/tasks/') && pathname.endsWith('/approve') && req.method === 'POST') {
            // API для одобрения задачи
            const taskId = pathname.split('/api/tasks/')[1].split('/approve')[0];
            
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', async () => {
                try {
                    const { comment } = JSON.parse(body);
                    const result = await db.approveTask(taskId, 'web_admin', comment || '');
                    
                    if (result && result.changes > 0) {
                        // Отправляем уведомление в чат об одобрении
                        await sendTaskApprovalNotification(taskId, db);
                        
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: 'Task approved' }));
                    } else {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Task not found' }));
                    }
                } catch (error) {
                    console.error('Task approval error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to approve task' }));
                }
            });
            return;
        } else if (pathname.startsWith('/api/tasks/') && pathname.endsWith('/reject') && req.method === 'POST') {
            // API для отклонения задачи
            const taskId = pathname.split('/api/tasks/')[1].split('/reject')[0];
            
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', async () => {
                try {
                    const { comment } = JSON.parse(body);
                    
                    if (!comment) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Comment is required for rejection' }));
                        return;
                    }
                    
                    const result = await db.requestRevision(taskId, 'web_admin', comment);
                    
                    if (result > 0) {
                        // Отправляем уведомление в чат об отклонении
                        await sendTaskRejectionNotification(taskId, comment, db);
                        
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: 'Task rejected for revision' }));
                    } else {
                        res.writeHead(404, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Task not found' }));
                    }
                } catch (error) {
                    console.error('Task rejection error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to reject task' }));
                }
            });
            return;
        } else if (pathname === '/api/telegram/start-polling' && req.method === 'POST') {
            // API для запуска polling бота
            (async () => {
                try {
                    const botToken = await db.getSetting('bot_token');
                    if (!botToken) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Bot token not configured' }));
                        return;
                    }
                    
                    // Запускаем polling
                    startBotPolling(botToken, db);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: true, 
                        message: 'Bot polling started. Users can now send /start to register.' 
                    }));
                } catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: error.message }));
                }
            })();
            return;
        } else if (pathname === '/api/admin/users') {
            // API пользователей из рабочего чата
            (async () => {
                try {
                    // Получаем work_chat_id из настроек
                    const workChatId = await db.getSetting('work_chat_id');
                    
                    // Получаем всех пользователей
                    const users = await db.getAllUsersWithRoles();
                    
                    if (!workChatId) {
                        // Если чат ID не настроен, возвращаем всех пользователей
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(users || []));
                    } else {
                        // Фильтруем только активированных пользователей
                        const activatedUsers = [];
                        
                        for (const user of users) {
                            // Проверяем, активировал ли пользователь бота
                            const isActivated = await db.getSetting(`user_activated_${user.user_id}`);
                            
                            if (isActivated) {
                                // Проверяем, состоит ли в чате
                                const botToken = await db.getSetting('bot_token');
                                if (botToken) {
                                    const isMember = await checkChatMembership(user.user_id, workChatId, botToken);
                                    if (isMember) {
                                        activatedUsers.push({
                                            ...user,
                                            chat_id: workChatId,
                                            is_from_configured_chat: true,
                                            is_activated: true
                                        });
                                    }
                                }
                            }
                        }
                        
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(activatedUsers));
                    }
                } catch (error) {
                    console.error('Users API error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to fetch users' }));
                }
            })();
        } else if (pathname === '/api/settings') {
            // API для получения настроек
            (async () => {
                try {
                    const settings = await db.getAllSettings();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(settings));
                } catch (error) {
                    console.error('Settings API error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to fetch settings' }));
                }
            })();
        } else if (pathname.startsWith('/api/settings/') && req.method === 'PUT') {
            // API для сохранения настройки
            const settingKey = pathname.split('/api/settings/')[1];
            
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', async () => {
                try {
                    const { value } = JSON.parse(body);
                    
                    await db.setSetting(settingKey, value, '');
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: true, 
                        message: 'Setting saved successfully',
                        key: settingKey,
                        value: value
                    }));
                } catch (error) {
                    console.error('Setting save error:', error);
                    if (error.message.includes('JSON')) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid JSON data' }));
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to save setting' }));
                    }
                }
            });
            return; // Важно: выходим из функции, чтобы не продолжать обработку
        } else if (pathname === '/api/admin/users/refresh' && req.method === 'POST') {
            // API для обновления списка пользователей из Telegram чата
            (async () => {
                try {
                    // Получаем work_chat_id из настроек
                    const workChatId = await db.getSetting('work_chat_id');
                    if (!workChatId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Chat ID not configured' }));
                        return;
                    }
                    
                    try {
                        // Получаем токен бота из настроек или переменных окружения
                        let botToken = await db.getSetting('bot_token');
                        
                        if (!botToken) {
                            botToken = process.env.BOT_TOKEN;
                        }
                        
                        if (!botToken) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Bot token not configured' }));
                            return;
                        }
                        
                        // Получаем количество участников чата
                        const https = require('https');
                        const chatMembersUrl = `https://api.telegram.org/bot${botToken}/getChatMembersCount?chat_id=${workChatId}`;
                        
                        https.get(chatMembersUrl, (telegramRes) => {
                            let data = '';
                            telegramRes.on('data', chunk => data += chunk);
                            telegramRes.on('end', async () => {
                                try {
                                    const membersCount = JSON.parse(data);
                                    
                                    if (!membersCount.ok) {
                                        throw new Error(membersCount.description || 'Failed to get chat members count');
                                    }
                                    
                                    console.log(`Chat ${workChatId} has ${membersCount.result} members`);
                                    
                                    // Получаем актуальных пользователей из базы и обновляем их статус
                                    try {
                                        const users = await db.getAllUsersWithRoles();
                                        
                                        // Фильтруем только активированных пользователей, которые в чате
                                        const filteredUsers = [];
                                        const botToken = await db.getSetting('bot_token');
                                        
                                        for (const user of users) {
                                            const isActivated = await db.getSetting(`user_activated_${user.user_id}`);
                                            
                                            if (isActivated && botToken) {
                                                const isMember = await checkChatMembership(user.user_id, workChatId, botToken);
                                                if (isMember) {
                                                    filteredUsers.push({
                                                        ...user,
                                                        chat_id: workChatId,
                                                        is_from_configured_chat: true,
                                                        is_activated: true
                                                    });
                                                }
                                            }
                                        }
                                        
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({
                                            success: true,
                                            message: `Обновлено пользователей из чата`,
                                            users: filteredUsers,
                                            chat_id: workChatId,
                                            total_chat_members: membersCount.result,
                                            users_in_db: filteredUsers.length,
                                            timestamp: new Date().toISOString()
                                        }));
                                    } catch (dbError) {
                                        console.error('Database error:', dbError);
                                        res.writeHead(500, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ error: 'Database error' }));
                                    }
                                } catch (parseError) {
                                    console.error('Telegram API parse error:', parseError);
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ error: 'Failed to parse Telegram response' }));
                                    db.close();
                                }
                            });
                        }).on('error', async (telegramError) => {
                            console.error('Telegram API error:', telegramError);
                            // Fallback: возвращаем пользователей из базы
                            try {
                                const users = await db.getAllUsersWithRoles();
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({
                                    success: true,
                                    message: 'Users list refreshed (offline mode)',
                                    users: users,
                                    chat_id: workChatId,
                                    warning: 'Could not fetch live chat data',
                                    timestamp: new Date().toISOString()
                                }));
                            } catch (dbError) {
                                console.error('Database error:', dbError);
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Database error' }));
                            }
                        });
                    } catch (error) {
                        console.error('Refresh error:', error);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to refresh users' }));
                    }
                } catch (error) {
                    console.error('Refresh API error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to refresh users list' }));
                }
            })();
            return;
        } else if (pathname === '/api/admin/chat/info' && req.method === 'GET') {
            // API для получения информации о чате
            (async () => {
                try {
                    const workChatId = await db.getSetting('work_chat_id');
                    if (!workChatId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Chat ID not configured' }));
                        return;
                    }
                    
                    // Получаем токен бота из настроек или переменных окружения
                    let botToken = await db.getSetting('bot_token');
                    
                    if (!botToken) {
                        botToken = process.env.BOT_TOKEN;
                    }
                    
                    if (!botToken) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Bot token not configured' }));
                        return;
                    }
                    
                    // Получаем информацию о чате
                    const https = require('https');
                    const chatInfoUrl = `https://api.telegram.org/bot${botToken}/getChat?chat_id=${workChatId}`;
                    
                    https.get(chatInfoUrl, (telegramRes) => {
                        let data = '';
                        telegramRes.on('data', chunk => data += chunk);
                        telegramRes.on('end', () => {
                            try {
                                const chatInfo = JSON.parse(data);
                                
                                if (!chatInfo.ok) {
                                    throw new Error(chatInfo.description || 'Failed to get chat info');
                                }
                                
                                // Получаем количество участников
                                const membersCountUrl = `https://api.telegram.org/bot${botToken}/getChatMembersCount?chat_id=${workChatId}`;
                                
                                https.get(membersCountUrl, (membersRes) => {
                                    let membersData = '';
                                    membersRes.on('data', chunk => membersData += chunk);
                                    membersRes.on('end', () => {
                                        try {
                                            const membersCount = JSON.parse(membersData);
                                            
                                            res.writeHead(200, { 'Content-Type': 'application/json' });
                                            res.end(JSON.stringify({
                                                success: true,
                                                chat: {
                                                    id: chatInfo.result.id,
                                                    title: chatInfo.result.title,
                                                    type: chatInfo.result.type,
                                                    description: chatInfo.result.description,
                                                    members_count: membersCount.ok ? membersCount.result : 'unknown'
                                                }
                                            }));
                                        } catch (parseError) {
                                            res.writeHead(200, { 'Content-Type': 'application/json' });
                                            res.end(JSON.stringify({
                                                success: true,
                                                chat: {
                                                    id: chatInfo.result.id,
                                                    title: chatInfo.result.title,
                                                    type: chatInfo.result.type,
                                                    description: chatInfo.result.description,
                                                    members_count: 'unknown'
                                                }
                                            }));
                                        }
                                    });
                                }).on('error', () => {
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({
                                        success: true,
                                        chat: {
                                            id: chatInfo.result.id,
                                            title: chatInfo.result.title,
                                            type: chatInfo.result.type,
                                            description: chatInfo.result.description,
                                            members_count: 'unknown'
                                        }
                                    }));
                                });
                            } catch (parseError) {
                                console.error('Chat info parse error:', parseError);
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Failed to parse chat info' }));
                            }
                        });
                    }).on('error', (telegramError) => {
                        console.error('Telegram chat info error:', telegramError);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to get chat info' }));
                    });
                } catch (error) {
                    console.error('Chat info API error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to get chat information' }));
                }
            })();
            return;
        } else if ((pathname === '/api/bot/status' || pathname === '/api/admin/bot/status') && req.method === 'GET') {
            // API для проверки статуса бота
            (async () => {
                try {
                    // Сначала пытаемся получить токен из настроек
                    let botToken = await db.getSetting('bot_token');
                    
                    // Если в настройках нет токена, используем переменную окружения
                    if (!botToken) {
                        botToken = process.env.BOT_TOKEN;
                    }
                    
                    if (!botToken) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            isRunning: false,
                            hasToken: false,
                            botInfo: 'Bot token not configured',
                            status: 'offline'
                        }));
                        return;
                    }
                    
                    try {
                        // Проверяем бота через Telegram API
                        const https = require('https');
                        const botInfoUrl = `https://api.telegram.org/bot${botToken}/getMe`;
                        
                        https.get(botInfoUrl, (telegramRes) => {
                            let data = '';
                            telegramRes.on('data', chunk => data += chunk);
                            telegramRes.on('end', () => {
                                try {
                                    const botInfo = JSON.parse(data);
                                    
                                    if (botInfo.ok && botInfo.result) {
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({
                                            isRunning: true,
                                            hasToken: true,
                                            botInfo: `Bot @${botInfo.result.username} (${botInfo.result.first_name})`,
                                            status: 'online',
                                            botData: {
                                                id: botInfo.result.id,
                                                username: botInfo.result.username,
                                                first_name: botInfo.result.first_name,
                                                can_join_groups: botInfo.result.can_join_groups,
                                                can_read_all_group_messages: botInfo.result.can_read_all_group_messages
                                            }
                                        }));
                                    } else {
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({
                                            isRunning: false,
                                            hasToken: true,
                                            botInfo: 'Bot token is invalid',
                                            status: 'error',
                                            error: botInfo.description || 'Invalid token'
                                        }));
                                    }
                                } catch (parseError) {
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({
                                        isRunning: false,
                                        hasToken: true,
                                        botInfo: 'Failed to parse bot response',
                                        status: 'error',
                                        error: parseError.message
                                    }));
                                }
                            });
                        }).on('error', (telegramError) => {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                isRunning: false,
                                hasToken: true,
                                botInfo: 'Failed to connect to Telegram API',
                                status: 'error',
                                error: telegramError.message
                            }));
                        });
                    } catch (error) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            isRunning: false,
                            hasToken: true,
                            botInfo: 'Bot status check failed',
                            status: 'error',
                            error: error.message
                        }));
                    }
                } catch (dbError) {
                    console.error('Database error in bot status:', dbError);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        isRunning: false,
                        hasToken: false,
                        botInfo: 'Database error',
                        status: 'error',
                        error: dbError.message
                    }));
                }
            })();
            return;
        } else if ((pathname === '/api/bot/token' || pathname === '/api/admin/bot/token') && req.method === 'POST') {
            // API для сохранения токена бота
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', async () => {
                try {
                    const { token } = JSON.parse(body);
                    
                    if (!token) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Token is required' }));
                        return;
                    }
                    
                    // Сохраняем токен в настройки
                    await db.setSetting('bot_token', token, 'Telegram Bot Token');
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: true, 
                        message: 'Bot token saved successfully' 
                    }));
                } catch (error) {
                    console.error('Bot token save error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to save bot token' }));
                }
            });
            return;
        } else if ((pathname === '/api/bot/stop' || pathname === '/api/admin/bot/stop') && req.method === 'POST') {
            // API для остановки бота
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                message: 'Bot stopped (simulation - no actual bot process running)' 
            }));
            return;
        } else if ((pathname === '/api/bot/test' || pathname === '/api/admin/bot/test') && req.method === 'POST') {
            // API для тестирования уведомлений
            (async () => {
                try {
                    // Получаем токен бота и ID чата
                    let botToken = await db.getSetting('bot_token');
                    
                    if (!botToken) {
                        botToken = process.env.BOT_TOKEN;
                    }
                    
                    const workChatId = await db.getSetting('work_chat_id');
                    
                    if (!botToken || !workChatId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Bot token or chat ID not configured' }));
                        return;
                    }
                    
                    // Отправляем тестовое сообщение
                    const https = require('https');
                    const testMessage = `🔔 Тестовое уведомление от Task Manager\\n\\nВремя: ${new Date().toLocaleString('ru-RU')}\\nСтатус: Система работает корректно!`;
                    
                    const postData = JSON.stringify({
                        chat_id: workChatId,
                        text: testMessage,
                        parse_mode: 'Markdown'
                    });
                    
                    const options = {
                        hostname: 'api.telegram.org',
                        path: `/bot${botToken}/sendMessage`,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(postData)
                        }
                    };
                    
                    const req = https.request(options, (telegramRes) => {
                        let data = '';
                        telegramRes.on('data', chunk => data += chunk);
                        telegramRes.on('end', () => {
                            try {
                                const result = JSON.parse(data);
                                if (result.ok) {
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ 
                                        success: true, 
                                        message: 'Test notification sent successfully',
                                        messageId: result.result.message_id
                                    }));
                                } else {
                                    res.writeHead(400, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ 
                                        error: 'Failed to send test message',
                                        details: result.description 
                                    }));
                                }
                            } catch (parseError) {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Failed to parse Telegram response' }));
                            }
                        });
                    });
                    
                    req.on('error', (error) => {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to send test notification' }));
                    });
                    
                    req.write(postData);
                    req.end();
                    
                } catch (error) {
                    console.error('Test notification error:', error);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Failed to send test notification' }));
                }
            })();
            return;
        } else if (pathname.startsWith('/css/') || pathname.startsWith('/js/') || pathname.startsWith('/public/') || pathname.match(/\.(css|js|png|jpg|ico)$/)) {
            // Статические файлы
            let filePath;
            if (pathname.startsWith('/css/') || pathname.startsWith('/js/')) {
                filePath = path.join(__dirname, 'public', pathname);
            } else {
                filePath = path.join(__dirname, 'public', pathname.replace('/public/', ''));
            }
            if (fs.existsSync(filePath)) {
                const ext = path.extname(filePath);
                const contentType = {
                    '.css': 'text/css',
                    '.js': 'application/javascript',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.ico': 'image/x-icon'
                }[ext] || 'text/plain';
                
                const content = fs.readFileSync(filePath);
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content);
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('File not found');
            }
        } else {
            // 404
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found' }));
        }
    } catch (error) {
        console.error('Request error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
    }
});

// Переменные для polling
let pollingInterval = null;
let lastUpdateId = 0;

// Функция запуска polling бота
function startBotPolling(botToken, db) {
    if (pollingInterval) {
        clearInterval(pollingInterval);
    }
    
    console.log('🤖 Starting bot polling...');
    
    pollingInterval = setInterval(async () => {
        try {
            await pollTelegramUpdates(botToken, db);
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 2000); // Опрашиваем каждые 2 секунды
}

// Функция получения обновлений от Telegram
async function pollTelegramUpdates(botToken, db) {
    const https = require('https');
    const url = `https://api.telegram.org/bot${botToken}/getUpdates?offset=${lastUpdateId + 1}&timeout=1`;
    
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', async () => {
                try {
                    const response = JSON.parse(data);
                    if (response.ok) {
                        if (response.result.length > 0) {
                            console.log(`📬 Received ${response.result.length} updates`);
                            for (const update of response.result) {
                                await handleUpdate(update, botToken, db);
                                lastUpdateId = update.update_id;
                            }
                        }
                    } else {
                        console.error('❌ Telegram API error:', response);
                    }
                    resolve();
                } catch (error) {
                    console.error('Error parsing updates:', error);
                    resolve();
                }
            });
        }).on('error', (error) => {
            console.error('Error getting updates:', error);
            resolve();
        });
    });
}

// Обработка обновления
async function handleUpdate(update, botToken, db) {
    console.log('📨 Received update:', JSON.stringify(update, null, 2));
    
    if (update.message && update.message.text) {
        const message = update.message;
        console.log(`💬 Message from ${message.from.first_name} (@${message.from.username || 'no_username'}) in chat ${message.chat.id} (${message.chat.title || 'no_title'}): ${message.text}`);
        
        // Обрабатываем команду /start
        if (message.text === '/start') {
            console.log('🚀 Handling /start command');
            await handleStartCommand(message, botToken, db);
        }
        // Обрабатываем команду /task
        else if (message.text.startsWith('/task ')) {
            console.log('📋 Handling /task command');
            await handleTaskCommand(message, botToken, db);
        }
        // Обрабатываем команду /tasks
        else if (message.text === '/tasks') {
            console.log('📝 Handling /tasks command');
            await handleTasksCommand(message, botToken, db);
        }
        // Добавим команду для отладки чата
        else if (message.text === '/chatinfo') {
            console.log('🔍 Handling /chatinfo command');
            const workChatId = await db.getSetting('work_chat_id');
            await sendMessage(botToken, message.chat.id, `Информация о чате:
            
Текущий чат ID: ${message.chat.id}
Текущий чат ID (строка): "${message.chat.id.toString()}"
Рабочий чат ID: ${workChatId}
Рабочий чат ID (строка): "${workChatId ? workChatId.toString() : 'null'}"
Совпадают ли: ${workChatId && workChatId.toString() === message.chat.id.toString()}

Название чата: ${message.chat.title || 'Без названия'}
Тип чата: ${message.chat.type}`);
        }
        else {
            console.log(`❓ Unknown command: ${message.text}`);
        }
    } else if (update.callback_query) {
        console.log('🔘 Handling callback query');
        await handleCallbackQuery(update.callback_query, botToken, db);
    } else {
        console.log('🔍 Update does not contain text message or callback query');
    }
}

// Обработка команды /start
async function handleStartCommand(message, botToken, db) {
    try {
        const user = message.from;
        const workChatId = await db.getSetting('work_chat_id');
        
        // Сохраняем пользователя в базу данных
        await db.addUser(
            user.id.toString(),
            user.username || null,
            user.first_name || '',
            user.last_name || null
        );
        
        // Помечаем пользователя как активированного через бота
        // Используем настройки для хранения активированных пользователей
        await db.setSetting(`user_activated_${user.id}`, 'true', 'User activated via bot');
        
        console.log(`User registered: ${user.first_name} (@${user.username || 'no_username'})`);
        
        // Проверяем, состоит ли пользователь в рабочем чате
        if (workChatId) {
            const isMember = await checkChatMembership(user.id, workChatId, botToken);
            if (isMember) {
                await sendMessage(botToken, user.id, 
                    '✅ Отлично! Вы зарегистрированы в системе управления задачами.\n\n' +
                    'Вы являетесь участником рабочего чата и можете получать задачи.');
            } else {
                await sendMessage(botToken, user.id, 
                    '⚠️ Вы зарегистрированы, но не состоите в рабочем чате.\n\n' +
                    'Попросите администратора добавить вас в рабочий чат для получения задач.');
            }
        } else {
            await sendMessage(botToken, user.id, 
                '✅ Вы зарегистрированы в системе управления задачами!');
        }
        
    } catch (error) {
        console.error('Error handling /start command:', error);
    }
}

// Обработка callback queries (кнопок)
async function handleCallbackQuery(callbackQuery, botToken, db) {
    try {
        const action = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        const userId = callbackQuery.from.id.toString();
        const messageId = callbackQuery.message.message_id;
        
        console.log(`🔘 Callback: ${action} from user ${userId} in chat ${chatId}`);
        
        if (action.startsWith('submit_')) {
            const taskId = action.split('submit_')[1];
            await handleSubmitTask(callbackQuery, taskId, botToken, db);
        } else if (action.startsWith('approve_')) {
            const taskId = action.split('approve_')[1];
            await handleApproveTask(callbackQuery, taskId, botToken, db);
        } else if (action.startsWith('reject_')) {
            const taskId = action.split('reject_')[1];
            await handleRejectTask(callbackQuery, taskId, botToken, db);
        } else {
            console.log(`❓ Unknown callback action: ${action}`);
            await answerCallbackQuery(botToken, callbackQuery.id, '❌ Неизвестное действие');
        }
    } catch (error) {
        console.error('Error handling callback query:', error);
        await answerCallbackQuery(botToken, callbackQuery.id, '❌ Произошла ошибка');
    }
}

// Обработка сдачи задачи на проверку
async function handleSubmitTask(callbackQuery, taskId, botToken, db) {
    try {
        const userId = callbackQuery.from.id.toString();
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        // Проверяем, что пользователь является исполнителем задачи
        const tasks = await db.getAllTasks({ chatId: chatId.toString() });
        const task = tasks.find(t => t.id == taskId);
        
        if (!task) {
            await answerCallbackQuery(botToken, callbackQuery.id, '❌ Задача не найдена');
            return;
        }
        
        // Проверяем, является ли пользователь исполнителем
        const users = await db.getAllUsersWithRoles();
        const currentUser = users.find(u => u.user_id === userId);
        const assigneeUsername = task.assignee_username.replace('@', '').toLowerCase();
        const currentUsername = currentUser?.username?.toLowerCase();
        
        if (!currentUser || currentUsername !== assigneeUsername) {
            await answerCallbackQuery(botToken, callbackQuery.id, '❌ Только исполнитель может сдать задачу на проверку');
            return;
        }
        
        // Обновляем статус задачи
        await db.submitForReview(taskId, userId);
        
        // Обновляем сообщение
        const newText = callbackQuery.message.text.replace('📋 Задача:', '🔍 Задача на проверке:');
        
        // Создаем новые кнопки для администраторов
        const keyboard = {
            inline_keyboard: [
                [
                    { text: '✅ Принять', callback_data: `approve_${taskId}` },
                    { text: '❌ На доработку', callback_data: `reject_${taskId}` }
                ]
            ]
        };
        
        await editMessage(botToken, chatId, messageId, newText, keyboard);
        await answerCallbackQuery(botToken, callbackQuery.id, '📤 Задача отправлена на проверку');
        
    } catch (error) {
        console.error('Error handling submit task:', error);
        await answerCallbackQuery(botToken, callbackQuery.id, '❌ Ошибка при отправке на проверку');
    }
}

// Обработка принятия задачи
async function handleApproveTask(callbackQuery, taskId, botToken, db) {
    try {
        const userId = callbackQuery.from.id.toString();
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        // Проверяем права пользователя
        const users = await db.getAllUsersWithRoles();
        const currentUser = users.find(u => u.user_id === userId);
        
        // Получаем задачу для проверки создателя
        const tasks = await db.getAllTasks({ chatId: chatId.toString() });
        const task = tasks.find(t => t.id == taskId);
        
        if (!currentUser || !task) {
            await answerCallbackQuery(botToken, callbackQuery.id, '❌ Задача не найдена или пользователь не найден');
            return;
        }
        
        // Разрешаем принимать задачи: админам, менеджерам и создателям задач
        const canApprove = currentUser.role === 'admin' || 
                          currentUser.role === 'manager' || 
                          task.created_by_user_id === userId;
        
        console.log(`Approve check: userId=${userId}, currentUser.role=${currentUser.role}, task.created_by_user_id=${task.created_by_user_id}, canApprove=${canApprove}`);
        
        if (!canApprove) {
            await answerCallbackQuery(botToken, callbackQuery.id, '❌ Недостаточно прав для принятия задач');
            return;
        }
        
        // Обновляем статус задачи
        const result = await db.approveTask(taskId, userId, '');
        
        if (result && result.changes > 0) {
            // Отправляем уведомление об одобрении
            await sendTaskApprovalNotification(taskId, db);
            
            // Обновляем сообщение
            const newText = callbackQuery.message.text.replace(/🔍 Задача на проверке:|📋 Задача:/, '✅ Задача выполнена:');
            
            await editMessage(botToken, chatId, messageId, newText, null);
            await answerCallbackQuery(botToken, callbackQuery.id, '✅ Задача принята!');
        } else {
            await answerCallbackQuery(botToken, callbackQuery.id, '❌ Задача не найдена или уже обработана');
        }
        
    } catch (error) {
        console.error('Error handling approve task:', error);
        await answerCallbackQuery(botToken, callbackQuery.id, '❌ Ошибка при принятии задачи');
    }
}

// Обработка отклонения задачи
async function handleRejectTask(callbackQuery, taskId, botToken, db) {
    try {
        const userId = callbackQuery.from.id.toString();
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        // Проверяем права пользователя
        const users = await db.getAllUsersWithRoles();
        const currentUser = users.find(u => u.user_id === userId);
        
        // Получаем задачу для проверки создателя
        const tasks = await db.getAllTasks({ chatId: chatId.toString() });
        const task = tasks.find(t => t.id == taskId);
        
        if (!currentUser || !task) {
            await answerCallbackQuery(botToken, callbackQuery.id, '❌ Задача не найдена или пользователь не найден');
            return;
        }
        
        // Разрешаем отклонять задачи: админам, менеджерам и создателям задач
        const canReject = currentUser.role === 'admin' || 
                         currentUser.role === 'manager' || 
                         task.created_by_user_id === userId;
        
        console.log(`Reject check: userId=${userId}, currentUser.role=${currentUser.role}, task.created_by_user_id=${task.created_by_user_id}, canReject=${canReject}`);
        
        if (!canReject) {
            await answerCallbackQuery(botToken, callbackQuery.id, '❌ Недостаточно прав для отклонения задач');
            return;
        }
        
        // Запрашиваем комментарий
        await answerCallbackQuery(botToken, callbackQuery.id, '💬 Напишите комментарий для доработки...');
        
        // Отправляем сообщение с просьбой написать комментарий
        await sendMessage(botToken, chatId, `❌ Задача #${taskId} отклонена на доработку.

👤 ${currentUser.first_name || 'Администратор'}, ответьте на это сообщение с комментарием о том, что нужно исправить.`);
        
        // Сохраняем информацию для обработки следующего сообщения
        // Это упрощенный подход - в продакшене лучше использовать состояния
        
    } catch (error) {
        console.error('Error handling reject task:', error);
        await answerCallbackQuery(botToken, callbackQuery.id, '❌ Ошибка при отклонении задачи');
    }
}

// Ответ на callback query
async function answerCallbackQuery(botToken, callbackQueryId, text) {
    const https = require('https');
    const postData = JSON.stringify({
        callback_query_id: callbackQueryId,
        text: text
    });
    
    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${botToken}/answerCallbackQuery`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            resolve();
        });
        req.on('error', () => resolve());
        req.write(postData);
        req.end();
    });
}

// Редактирование сообщения
async function editMessage(botToken, chatId, messageId, text, replyMarkup = null) {
    const https = require('https');
    const postData = JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: text,
        reply_markup: replyMarkup
    });
    
    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${botToken}/editMessageText`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            resolve();
        });
        req.on('error', () => resolve());
        req.write(postData);
        req.end();
    });
}

// Обработка команды /task
async function handleTaskCommand(message, botToken, db) {
    try {
        const chatId = message.chat.id.toString();
        const userId = message.from.id.toString();
        
        // Проверяем, что это рабочий чат
        const workChatId = await db.getSetting('work_chat_id');
        
        if (!workChatId || workChatId.toString() !== chatId.toString()) {
            await sendMessage(botToken, chatId, `❌ Команды задач доступны только в рабочем чате.
            
Попробуйте команду /chatinfo для диагностики`);
            return;
        }
        
        // Парсим команду
        const taskText = message.text.substring(6); // Убираем "/task "
        const parsed = parseTaskCommand(taskText);
        
        if (!parsed.title || !parsed.assignee) {
            await sendMessage(botToken, chatId, `❌ Неверный формат команды

Правильный формат:
/task Заголовок @username описание дедлайн

Пример:
/task Создать дизайн @anna_designer Разработать макет главной страницы 2025-06-15`);
            return;
        }
        
        // Проверяем, что исполнитель существует в системе
        const users = await db.getAllUsersWithRoles();
        const assigneeUsername = parsed.assignee.replace('@', '').toLowerCase();
        const assigneeUser = users.find(u => 
            u.username && u.username.toLowerCase() === assigneeUsername
        );
        
        if (!assigneeUser) {
            await sendMessage(botToken, chatId, `❌ Пользователь ${parsed.assignee} не найден в системе. 
            
Пользователь должен сначала написать /start боту для регистрации.`);
            return;
        }
        
        // Создаем задачу
        const taskId = await db.addTask(
            parsed.title,
            parsed.description,
            parsed.assignee,
            parsed.deadline,
            chatId,
            userId
        );
        
        // НЕ отправляем дублирующее уведомление для телеграм бота, 
        // так как само сообщение о создании уже является уведомлением
        
        // Формируем ответ
        const creatorName = message.from.first_name + (message.from.last_name ? ` ${message.from.last_name}` : '');
        let deadlineText = '';
        if (parsed.deadline) {
            deadlineText = `📅 Дедлайн: ${parsed.deadline}`;
        }
        
        const response = `✅ Задача создана!

📋 Задача: ${parsed.title}
👤 Исполнитель: ${parsed.assignee}
👨‍💼 Создал: ${creatorName}
${parsed.description ? `📝 Описание: ${parsed.description}` : ''}
${deadlineText}

ID задачи: #${taskId}`;

        await sendMessageWithButtons(botToken, chatId, response, taskId, parsed.assignee);
        
        // Отправляем уведомление исполнителю
        if (assigneeUser.user_id) {
            const notificationText = `📋 Вам назначена новая задача!

Задача: ${parsed.title}
Создатель: ${creatorName}
${parsed.description ? `Описание: ${parsed.description}` : ''}
${deadlineText}

ID: #${taskId}`;
            
            await sendMessage(botToken, assigneeUser.user_id, notificationText);
        }
        
    } catch (error) {
        console.error('Error handling /task command:', error);
        await sendMessage(botToken, message.chat.id, '❌ Произошла ошибка при создании задачи.');
    }
}

// Обработка команды /tasks
async function handleTasksCommand(message, botToken, db) {
    try {
        const chatId = message.chat.id.toString();
        
        // Проверяем, что это рабочий чат
        const workChatId = await db.getSetting('work_chat_id');
        console.log(`Tasks command in chat ${chatId}, work chat is ${workChatId}`);
        
        if (!workChatId || workChatId.toString() !== chatId.toString()) {
            console.log(`Tasks command rejected: not in work chat. Current: ${chatId}, Work: ${workChatId}`);
            await sendMessage(botToken, chatId, `❌ Команды задач доступны только в рабочем чате.
            
Текущий чат: ${chatId}
Рабочий чат: ${workChatId || 'не настроен'}`);
            return;
        }
        
        const tasks = await db.getAllTasks({ chatId });

        if (tasks.length === 0) {
            await sendMessage(botToken, chatId, `📝 Список задач пуст

Создайте новую задачу командой:
/task Заголовок @username описание дедлайн`);
            return;
        }

        let response = '📋 Список задач:\n\n';
        
        const pendingTasks = tasks.filter(t => t.status === 'pending');
        const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
        const reviewTasks = tasks.filter(t => t.status === 'review');
        const revisionTasks = tasks.filter(t => t.status === 'revision');
        const completedTasks = tasks.filter(t => t.status === 'completed');

        if (pendingTasks.length > 0) {
            response += '⏳ Ожидают выполнения:\n';
            pendingTasks.forEach(task => {
                let deadlineText = '';
                if (task.deadline) {
                    const isOverdue = new Date(task.deadline) < new Date();
                    deadlineText = isOverdue ? ` ⚠️ (просрочено)` : ` (до ${task.deadline})`;
                }
                response += `#${task.id} ${task.title} → ${task.assignee_username}${deadlineText}\n`;
            });
            response += '\n';
        }

        if (inProgressTasks.length > 0) {
            response += '🔄 В работе:\n';
            inProgressTasks.forEach(task => {
                let deadlineText = '';
                if (task.deadline) {
                    const isOverdue = new Date(task.deadline) < new Date();
                    deadlineText = isOverdue ? ` ⚠️ (просрочено)` : ` (до ${task.deadline})`;
                }
                response += `#${task.id} ${task.title} → ${task.assignee_username}${deadlineText}\n`;
            });
            response += '\n';
        }

        if (reviewTasks.length > 0) {
            response += '🔍 На проверке:\n';
            reviewTasks.forEach(task => {
                response += `#${task.id} ${task.title} → ${task.assignee_username}\n`;
            });
            response += '\n';
        }

        if (revisionTasks.length > 0) {
            response += '🔄 На доработке:\n';
            revisionTasks.forEach(task => {
                const comment = task.review_comment ? ` (${task.review_comment})` : '';
                response += `#${task.id} ${task.title} → ${task.assignee_username}${comment}\n`;
            });
            response += '\n';
        }

        if (completedTasks.length > 0) {
            response += '✅ Выполнено:\n';
            completedTasks.slice(0, 5).forEach(task => {
                response += `#${task.id} ${task.title} → ${task.assignee_username}\n`;
            });
            if (completedTasks.length > 5) {
                response += `... и еще ${completedTasks.length - 5} задач\n`;
            }
        }

        await sendMessage(botToken, chatId, response);
        
    } catch (error) {
        console.error('Error handling /tasks command:', error);
        await sendMessage(botToken, message.chat.id, '❌ Произошла ошибка при получении списка задач.');
    }
}

// Парсер команды /task 
function parseTaskCommand(text) {
    // Формат: /task Заголовок @username описание дедлайн
    const parts = text.trim().split(' ');
    let title = '';
    let assignee = '';
    let description = '';
    let deadline = '';
    
    let currentPart = 'title';
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        if (part.startsWith('@')) {
            // Найден исполнитель - переключаемся на описание
            assignee = part;
            currentPart = 'description';
        } else if (part.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Найдена дата - это дедлайн
            deadline = part;
            // Проверяем следующую часть на время
            if (i + 1 < parts.length && parts[i + 1].match(/^\d{1,2}:\d{2}$/)) {
                deadline += ' ' + parts[i + 1];
                i++; // Пропускаем время в следующей итерации
            }
            currentPart = 'done';
        } else {
            // Добавляем к текущей части
            if (currentPart === 'title') {
                title += (title ? ' ' : '') + part;
            } else if (currentPart === 'description') {
                description += (description ? ' ' : '') + part;
            }
        }
    }
    
    return {
        title: title.trim(),
        assignee: assignee,
        description: description.trim(),
        deadline: deadline
    };
}

// Проверка членства в чате
async function checkChatMembership(userId, chatId, botToken) {
    const https = require('https');
    const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${userId}`;
    
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.ok) {
                        const status = response.result.status;
                        // Пользователь считается участником если он не покинул чат и не забанен
                        resolve(['creator', 'administrator', 'member', 'restricted'].includes(status));
                    } else {
                        resolve(false);
                    }
                } catch (error) {
                    resolve(false);
                }
            });
        }).on('error', () => resolve(false));
    });
}

// Отправка сообщения пользователю
async function sendMessage(botToken, chatId, text) {
    const https = require('https');
    const postData = JSON.stringify({
        chat_id: chatId,
        text: text
    });
    
    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${botToken}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            resolve();
        });
        req.on('error', () => resolve());
        req.write(postData);
        req.end();
    });
}

// Отправка сообщения с кнопками
async function sendMessageWithButtons(botToken, chatId, text, taskId, assigneeUsername) {
    const https = require('https');
    
    // Создаем клавиатуру с кнопками для управления задачей
    const keyboard = {
        inline_keyboard: [
            [
                { text: '📤 Сдать на проверку', callback_data: `submit_${taskId}` }
            ]
        ]
    };
    
    const postData = JSON.stringify({
        chat_id: chatId,
        text: text,
        reply_markup: keyboard
    });
    
    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${botToken}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            resolve();
        });
        req.on('error', () => resolve());
        req.write(postData);
        req.end();
    });
}

// Функция отправки уведомления о новой задаче
async function sendNewTaskNotification(taskId, db) {
    try {
        // Получаем информацию о задаче
        const tasks = await db.getAllTasks();
        const task = tasks.find(t => t.id == taskId);
        
        if (!task) {
            console.log('Task not found for new task notification');
            return;
        }

        // Получаем настройки для отправки уведомлений
        const botToken = await db.getSetting('bot_token') || process.env.BOT_TOKEN;
        const workChatId = await db.getSetting('work_chat_id');
        
        if (!botToken || !workChatId) {
            console.log('Bot token or work chat not configured');
            return;
        }

        // Формируем сообщение
        const message = `📋 Новая задача назначена!

📝 Задача: ${task.title}
👤 Исполнитель: ${task.assignee_username}
${task.description ? `📄 Описание: ${task.description}` : ''}
${task.deadline ? `📅 Дедлайн: ${task.deadline}` : ''}

✨ Удачи в выполнении!

ID: #${task.id}`;

        // Отправляем уведомление в рабочий чат
        await sendMessage(botToken, workChatId, message);
        console.log(`New task notification sent for task ${taskId}`);
        
    } catch (error) {
        console.error('Error sending new task notification:', error);
    }
}

// Функция отправки уведомления об одобрении задачи
async function sendTaskApprovalNotification(taskId, db) {
    try {
        // Получаем информацию о задаче
        const tasks = await db.getAllTasks();
        const task = tasks.find(t => t.id == taskId);
        
        if (!task) {
            console.log('Task not found for approval notification');
            return;
        }

        // Получаем настройки для отправки уведомлений
        const botToken = await db.getSetting('bot_token') || process.env.BOT_TOKEN;
        const workChatId = await db.getSetting('work_chat_id');
        
        if (!botToken || !workChatId) {
            console.log('Bot token or work chat not configured');
            return;
        }

        // Формируем сообщение
        const message = `🎉 Задача одобрена!

📋 Задача: ${task.title}
👤 Исполнитель: ${task.assignee_username}
✅ Статус: Выполнена

🏆 Молодец! Тебе плюс балл за качественно выполненную работу!

ID: #${task.id}`;

        // Отправляем уведомление в рабочий чат
        await sendMessage(botToken, workChatId, message);
        console.log(`Approval notification sent for task ${taskId}`);
        
    } catch (error) {
        console.error('Error sending approval notification:', error);
    }
}

// Функция отправки уведомления об отклонении задачи
async function sendTaskRejectionNotification(taskId, reason, db) {
    try {
        // Получаем информацию о задаче
        const tasks = await db.getAllTasks();
        const task = tasks.find(t => t.id == taskId);
        
        if (!task) {
            console.log('Task not found for rejection notification');
            return;
        }

        // Получаем настройки для отправки уведомлений
        const botToken = await db.getSetting('bot_token') || process.env.BOT_TOKEN;
        const workChatId = await db.getSetting('work_chat_id');
        
        if (!botToken || !workChatId) {
            console.log('Bot token or work chat not configured');
            return;
        }

        // Формируем сообщение
        const message = `❌ Задача отклонена на доработку

📋 Задача: ${task.title}
👤 Исполнитель: ${task.assignee_username}
🔄 Статус: На доработке

💬 Причина отклонения: ${reason}

⚠️ Пожалуйста, внесите необходимые исправления и отправьте задачу на проверку снова.

ID: #${task.id}`;

        // Отправляем уведомление в рабочий чат
        await sendMessage(botToken, workChatId, message);
        console.log(`Rejection notification sent for task ${taskId}`);
        
    } catch (error) {
        console.error('Error sending rejection notification:', error);
    }
}

// Функция отправки уведомления об обновлении задачи
async function sendTaskUpdateNotification(taskId, changes, db) {
    try {
        // Получаем информацию о задаче
        const tasks = await db.getAllTasks();
        const task = tasks.find(t => t.id == taskId);
        
        if (!task) {
            console.log('Task not found for update notification');
            return;
        }

        // Получаем настройки для отправки уведомлений
        const botToken = await db.getSetting('bot_token') || process.env.BOT_TOKEN;
        const workChatId = await db.getSetting('work_chat_id');
        
        if (!botToken || !workChatId) {
            console.log('Bot token or work chat not configured');
            return;
        }

        // Формируем список изменений
        let changesText = '';
        if (changes.title) {
            changesText += `📝 Название: ${changes.title}\n`;
        }
        if (changes.description !== undefined) {
            changesText += `📄 Описание: ${changes.description || 'удалено'}\n`;
        }
        if (changes.assignee) {
            changesText += `👤 Исполнитель: ${changes.assignee}\n`;
        }
        if (changes.deadline !== undefined) {
            changesText += `📅 Дедлайн: ${changes.deadline || 'удален'}\n`;
        }

        // Формируем сообщение
        const message = `✏️ Задача обновлена

📋 Задача: ${task.title}
ID: #${task.id}

📝 Изменения:
${changesText}

👤 Исполнитель: ${task.assignee_username}`;

        // Отправляем уведомление в рабочий чат
        await sendMessage(botToken, workChatId, message);
        console.log(`Update notification sent for task ${taskId}`);
        
    } catch (error) {
        console.error('Error sending update notification:', error);
    }
}

server.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 Minimal server running on http://127.0.0.1:${PORT}`);
    console.log(`📊 Health: http://127.0.0.1:${PORT}/api/health`);
});

server.on('error', (err) => {
    console.error('Server error:', err);
});