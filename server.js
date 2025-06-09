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
        } else if (pathname === '/api/tasks') {
            // Заглушка для задач
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify([
                { id: 1, title: 'Тестовая задача', status: 'pending', assignee: 'test_user' }
            ]));
        } else if (pathname === '/api/stats') {
            // Заглушка для статистики
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                total: 1,
                completed: 0,
                pending: 1
            }));
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
                    const botTokenSetting = await db.getSetting('bot_token');
                    let botToken = botTokenSetting ? botTokenSetting.value : null;
                    
                    if (!botToken) {
                        botToken = process.env.BOT_TOKEN;
                    }
                    
                    const workChatSetting = await db.getSetting('work_chat_id');
                    const workChatId = workChatSetting ? workChatSetting.value : null;
                    
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
                    if (response.ok && response.result.length > 0) {
                        for (const update of response.result) {
                            await handleUpdate(update, botToken, db);
                            lastUpdateId = update.update_id;
                        }
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
    if (update.message && update.message.text) {
        const message = update.message;
        
        // Обрабатываем команду /start
        if (message.text === '/start') {
            await handleStartCommand(message, botToken, db);
        }
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

server.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 Minimal server running on http://127.0.0.1:${PORT}`);
    console.log(`📊 Health: http://127.0.0.1:${PORT}/api/health`);
});

server.on('error', (err) => {
    console.error('Server error:', err);
});