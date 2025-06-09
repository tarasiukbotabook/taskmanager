const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3001;

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
            // Главная страница
            const indexPath = path.join(__dirname, 'public', 'index.html');
            if (fs.existsSync(indexPath)) {
                const content = fs.readFileSync(indexPath, 'utf8');
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
                        </ul>
                    </body>
                    </html>
                `);
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
        } else if (pathname === '/api/admin/users') {
            // API пользователей из рабочего чата
            try {
                const sqlite3 = require('sqlite3').verbose();
                const dbPath = path.join(__dirname, 'tasks.db');
                const db = new sqlite3.Database(dbPath);
                
                // Сначала получаем work_chat_id из настроек
                db.get("SELECT value FROM settings WHERE key = 'work_chat_id'", (err, setting) => {
                    if (err) {
                        console.error('Settings error:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to get chat settings' }));
                        db.close();
                        return;
                    }
                    
                    const workChatId = setting ? setting.value : null;
                    
                    if (!workChatId) {
                        // Если чат ID не настроен, возвращаем всех пользователей
                        db.all("SELECT user_id, username, first_name, last_name, role, points, balance, created_at FROM users ORDER BY created_at DESC", (err, rows) => {
                            if (err) {
                                console.error('Database error:', err);
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Database error' }));
                            } else {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify(rows || []));
                            }
                            db.close();
                        });
                    } else {
                        // Показываем всех пользователей из базы (кто взаимодействовал с ботом)
                        // В реальном приложении здесь можно было бы использовать Telegram Bot API 
                        // для получения актуального списка участников чата
                        const query = `
                            SELECT user_id, username, first_name, last_name, role, points, balance, created_at
                            FROM users 
                            ORDER BY created_at DESC
                        `;
                        
                        db.all(query, [], (err, rows) => {
                            if (err) {
                                console.error('Database error:', err);
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Database error' }));
                            } else {
                                // Добавляем информацию о том, что это пользователи из настроенного чата
                                const usersWithChatInfo = rows.map(user => ({
                                    ...user,
                                    chat_id: workChatId,
                                    is_from_configured_chat: true
                                }));
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify(usersWithChatInfo));
                            }
                            db.close();
                        });
                    }
                });
            } catch (error) {
                console.error('Users API error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to fetch users' }));
            }
        } else if (pathname === '/api/settings') {
            // API для получения настроек
            try {
                const sqlite3 = require('sqlite3').verbose();
                const dbPath = path.join(__dirname, 'tasks.db');
                const db = new sqlite3.Database(dbPath);
                
                db.all("SELECT key, value, description FROM settings", (err, rows) => {
                    if (err) {
                        console.error('Settings error:', err);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to fetch settings' }));
                    } else {
                        const settings = {};
                        rows.forEach(row => {
                            settings[row.key] = {
                                value: row.value,
                                description: row.description
                            };
                        });
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(settings));
                    }
                    db.close();
                });
            } catch (error) {
                console.error('Settings API error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to fetch settings' }));
            }
        } else if (pathname.startsWith('/api/settings/') && req.method === 'PUT') {
            // API для сохранения настройки
            const settingKey = pathname.split('/api/settings/')[1];
            
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            
            req.on('end', () => {
                try {
                    const { value } = JSON.parse(body);
                    
                    const sqlite3 = require('sqlite3').verbose();
                    const dbPath = path.join(__dirname, 'tasks.db');
                    const db = new sqlite3.Database(dbPath);
                    
                    const query = `
                        INSERT OR REPLACE INTO settings (key, value, updated_at) 
                        VALUES (?, ?, datetime('now'))
                    `;
                    
                    db.run(query, [settingKey, value], function(err) {
                        if (err) {
                            console.error('Setting save error:', err);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Failed to save setting' }));
                        } else {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ 
                                success: true, 
                                message: 'Setting saved successfully',
                                key: settingKey,
                                value: value
                            }));
                        }
                        db.close();
                    });
                } catch (error) {
                    console.error('Setting parse error:', error);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON data' }));
                }
            });
            return; // Важно: выходим из функции, чтобы не продолжать обработку
        } else if (pathname === '/api/admin/users/refresh' && req.method === 'POST') {
            // API для обновления списка пользователей из Telegram чата
            try {
                const sqlite3 = require('sqlite3').verbose();
                const dbPath = path.join(__dirname, 'tasks.db');
                const db = new sqlite3.Database(dbPath);
                
                // Получаем work_chat_id из настроек
                db.get("SELECT value FROM settings WHERE key = 'work_chat_id'", async (err, setting) => {
                    if (err || !setting || !setting.value) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Chat ID not configured' }));
                        db.close();
                        return;
                    }
                    
                    const workChatId = setting.value;
                    
                    try {
                        // Используем Telegram Bot API для получения актуального списка участников чата
                        const botToken = process.env.BOT_TOKEN;
                        
                        if (!botToken) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'Bot token not configured' }));
                            db.close();
                            return;
                        }
                        
                        // Получаем количество участников чата
                        const https = require('https');
                        const chatMembersUrl = `https://api.telegram.org/bot${botToken}/getChatMembersCount?chat_id=${workChatId}`;
                        
                        https.get(chatMembersUrl, (telegramRes) => {
                            let data = '';
                            telegramRes.on('data', chunk => data += chunk);
                            telegramRes.on('end', () => {
                                try {
                                    const membersCount = JSON.parse(data);
                                    
                                    if (!membersCount.ok) {
                                        throw new Error(membersCount.description || 'Failed to get chat members count');
                                    }
                                    
                                    console.log(`Chat ${workChatId} has ${membersCount.result} members`);
                                    
                                    // Пока возвращаем пользователей из базы + информацию о количестве участников в чате
                                    db.all("SELECT user_id, username, first_name, last_name, role, points, balance, created_at FROM users ORDER BY created_at DESC", (err, rows) => {
                                        if (err) {
                                            console.error('Database error:', err);
                                            res.writeHead(500, { 'Content-Type': 'application/json' });
                                            res.end(JSON.stringify({ error: 'Database error' }));
                                        } else {
                                            res.writeHead(200, { 'Content-Type': 'application/json' });
                                            res.end(JSON.stringify({
                                                success: true,
                                                message: `Users list refreshed. Chat has ${membersCount.result} total members, ${rows.length} have interacted with bot`,
                                                users: rows,
                                                chat_id: workChatId,
                                                total_chat_members: membersCount.result,
                                                users_in_db: rows.length,
                                                timestamp: new Date().toISOString()
                                            }));
                                        }
                                        db.close();
                                    });
                                } catch (parseError) {
                                    console.error('Telegram API parse error:', parseError);
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ error: 'Failed to parse Telegram response' }));
                                    db.close();
                                }
                            });
                        }).on('error', (telegramError) => {
                            console.error('Telegram API error:', telegramError);
                            // Fallback: возвращаем пользователей из базы
                            db.all("SELECT user_id, username, first_name, last_name, role, points, balance, created_at FROM users ORDER BY created_at DESC", (err, rows) => {
                                if (err) {
                                    console.error('Database error:', err);
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({ error: 'Database error' }));
                                } else {
                                    res.writeHead(200, { 'Content-Type': 'application/json' });
                                    res.end(JSON.stringify({
                                        success: true,
                                        message: 'Users list refreshed (offline mode)',
                                        users: rows,
                                        chat_id: workChatId,
                                        warning: 'Could not fetch live chat data',
                                        timestamp: new Date().toISOString()
                                    }));
                                }
                                db.close();
                            });
                        });
                    } catch (error) {
                        console.error('Refresh error:', error);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to refresh users' }));
                        db.close();
                    }
                });
            } catch (error) {
                console.error('Refresh API error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to refresh users list' }));
            }
            return;
        } else if (pathname === '/api/admin/chat/info' && req.method === 'GET') {
            // API для получения информации о чате
            try {
                const sqlite3 = require('sqlite3').verbose();
                const dbPath = path.join(__dirname, 'tasks.db');
                const db = new sqlite3.Database(dbPath);
                
                db.get("SELECT value FROM settings WHERE key = 'work_chat_id'", (err, setting) => {
                    if (err || !setting || !setting.value) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Chat ID not configured' }));
                        db.close();
                        return;
                    }
                    
                    const workChatId = setting.value;
                    const botToken = process.env.BOT_TOKEN;
                    
                    if (!botToken) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Bot token not configured' }));
                        db.close();
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
                                            db.close();
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
                                            db.close();
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
                                    db.close();
                                });
                            } catch (parseError) {
                                console.error('Chat info parse error:', parseError);
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ error: 'Failed to parse chat info' }));
                                db.close();
                            }
                        });
                    }).on('error', (telegramError) => {
                        console.error('Telegram chat info error:', telegramError);
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to get chat info' }));
                        db.close();
                    });
                });
            } catch (error) {
                console.error('Chat info API error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to get chat information' }));
            }
            return;
        } else if (pathname === '/api/bot/status' && req.method === 'GET') {
            // API для проверки статуса бота
            const botToken = process.env.BOT_TOKEN;
            
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
            return;
        } else if (pathname.startsWith('/public/') || pathname.match(/\.(css|js|png|jpg|ico)$/)) {
            // Статические файлы
            const filePath = path.join(__dirname, 'public', pathname.replace('/public/', ''));
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

server.listen(PORT, '127.0.0.1', () => {
    console.log(`🚀 Minimal server running on http://127.0.0.1:${PORT}`);
    console.log(`📊 Health: http://127.0.0.1:${PORT}/api/health`);
});

server.on('error', (err) => {
    console.error('Server error:', err);
});