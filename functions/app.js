const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const functions = require('firebase-functions');
const jwt = require('jsonwebtoken');
const TaskBot = require('./bot');

// Firebase configuration
const config = functions.config();

// Импортируем функции базы данных (Firestore)
const { getAllTasks, getTaskStats, getDetailedTaskStats, getTaskPerformanceMetrics, completeTask, deleteTask, updateTask, submitForReview, approveTask, requestRevision, returnToWork, getUserRating, addPoints, updateUserRole, getUserRole, getAllUsersWithRoles, setSetting, getSetting, getAllSettings, findOrCreateGoogleUser, findUserByGoogleId } = require('./database-firestore');

// JWT helper functions
const JWT_SECRET = config.session?.secret || 'fallback-secret-key';

function generateToken(user) {
    return jwt.sign(
        { 
            id: user.id, 
            email: user.email, 
            role: user.role 
        }, 
        JWT_SECRET, 
        { expiresIn: '24h' }
    );
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

const app = express();

// Middleware
app.use(cors({
    origin: ['https://pro-telegram.web.app', 'http://localhost:3000'],
    credentials: true // Важно для работы сессий
}));
app.use(express.json());

// Cookie parser for JWT tokens
app.use((req, res, next) => {
    // Simple cookie parser
    const cookies = {};
    if (req.headers.cookie) {
        req.headers.cookie.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            cookies[parts[0].trim()] = parts[1]?.trim();
        });
    }
    req.cookies = cookies;
    next();
});

// Session configuration для Cloud Functions
app.use(session({
    secret: config.session?.secret || 'task-manager-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Изменяем на false для работы в Firebase Functions
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax'
    }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

// Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: config.google?.client_id || 'placeholder',
    clientSecret: config.google?.client_secret || 'placeholder',
    callbackURL: config.google?.callback_url || 'https://pro-telegram.web.app/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const user = await findOrCreateGoogleUser(profile);
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Passport serialization
passport.serializeUser((user, done) => {
    console.log('Serializing user:', user.id);
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        console.log('Deserializing user ID:', id);
        const user = await findUserByGoogleId(id);
        console.log('Found user:', user ? 'yes' : 'no');
        done(null, user);
    } catch (error) {
        console.error('Error deserializing user:', error);
        done(error, null);
    }
});

// Authentication middleware using JWT
function ensureAuthenticated(req, res, next) {
    console.log('JWT Auth check - path:', req.path);
    
    // Проверяем токен в Authorization header
    const authHeader = req.headers.authorization;
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        // Проверяем токен в cookies
        token = req.cookies?.auth_token;
    }
    
    console.log('Token present:', !!token);
    
    if (token) {
        const decoded = verifyToken(token);
        console.log('Token valid:', !!decoded);
        
        if (decoded) {
            req.user = decoded;
            return next();
        }
    }
    
    // Если это API запрос, возвращаем JSON
    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Иначе перенаправляем на страницу входа
    res.redirect('/login.html');
}

// Role-based middleware
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        next();
    };
}

// Инициализация бота
let bot;
let botToken = config.telegram?.bot_token;

function initBot(token) {
    if (bot) {
        try {
            console.log('Stopping existing bot instance...');
            bot.bot.stopPolling();
            bot = null;
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

// Authentication routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login.html?error=auth_failed' }),
    async (req, res) => {
        try {
            console.log('OAuth callback - user:', req.user);
            
            // Генерируем JWT токен
            const token = generateToken(req.user);
            console.log('Generated token for user:', req.user.email);
            
            // Устанавливаем токен в cookie
            res.cookie('auth_token', token, {
                httpOnly: true,
                secure: false, // false для Firebase Functions
                sameSite: 'lax',
                maxAge: 24 * 60 * 60 * 1000 // 24 часа
            });
            
            console.log('Redirecting to /');
            res.redirect('/');
        } catch (error) {
            console.error('OAuth callback error:', error);
            res.redirect('/login.html?error=callback_failed');
        }
    }
);

// Главная страница - проверяем авторизацию сразу
app.get('/', (req, res) => {
    console.log('Main page request - checking auth');
    
    // Проверяем токен
    const authHeader = req.headers.authorization;
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        token = req.cookies?.auth_token;
    }
    
    console.log('Main page - token present:', !!token);
    
    if (token) {
        const decoded = verifyToken(token);
        console.log('Main page - token valid:', !!decoded);
        
        if (decoded) {
            // Пользователь авторизован, показываем главную страницу
            return res.sendFile(path.join(__dirname, '../public/index.html'));
        }
    }
    
    // Пользователь не авторизован, перенаправляем на логин
    console.log('Main page - redirecting to login');
    res.redirect('/login.html');
});

app.get('/login.html', (req, res) => {
    console.log('Login page request');
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

app.get('/login', (req, res) => {
    // Перенаправляем на login.html
    res.redirect('/login.html' + (req.query.error ? `?error=${req.query.error}` : ''));
});

app.get('/logout', (req, res) => {
    console.log('Logout request');
    
    // Очищаем JWT токен из cookies
    res.clearCookie('auth_token', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax'
    });
    
    console.log('Redirecting to login after logout');
    res.redirect('/login.html');
});

app.get('/api/user', ensureAuthenticated, async (req, res) => {
    try {
        console.log('API /user - user from token:', req.user);
        
        // Получаем полную информацию о пользователе из базы данных
        const fullUser = await findUserByGoogleId(req.user.id);
        
        if (!fullUser) {
            console.log('User not found in database:', req.user.id);
            return res.status(404).json({ error: 'User not found' });
        }
        
        console.log('Returning user info:', fullUser.email);
        res.json({
            id: fullUser.id,
            email: fullUser.email,
            name: `${fullUser.first_name || ''} ${fullUser.last_name || ''}`.trim(),
            avatar: fullUser.avatar_url,
            role: fullUser.role || 'executor'
        });
    } catch (error) {
        console.error('Error in /api/user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API маршруты (защищены аутентификацией)
app.get('/api/tasks', ensureAuthenticated, async (req, res) => {
    try {
        const tasks = await getAllTasks();
        res.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Failed to fetch tasks' });
    }
});

app.get('/api/stats', ensureAuthenticated, async (req, res) => {
    try {
        const stats = await getTaskStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

app.put('/api/tasks/:id/complete', ensureAuthenticated, async (req, res) => {
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

app.put('/api/tasks/:id', ensureAuthenticated, async (req, res) => {
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

app.delete('/api/tasks/:id', ensureAuthenticated, async (req, res) => {
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

app.put('/api/tasks/:id/submit', ensureAuthenticated, async (req, res) => {
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

app.put('/api/tasks/:id/approve', ensureAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
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

app.put('/api/tasks/:id/revision', ensureAuthenticated, requireRole(['admin', 'manager']), async (req, res) => {
    try {
        const taskId = req.params.id;
        const { reviewerId, comment } = req.body;
        
        // Получаем задачу ПЕРЕД обновлением
        const tasks = await getAllTasks();
        const originalTask = tasks.find(t => t.id == taskId);
        
        if (!originalTask) {
            return res.status(404).json({ error: 'Task not found' });
        }
        
        if (originalTask.status !== 'review' && originalTask.status !== 'completed') {
            return res.status(400).json({ error: `Task cannot be rejected. Current status: ${originalTask.status}` });
        }
        
        const result = await requestRevision(taskId, reviewerId, comment);
        
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

                    const keyboard = {
                        inline_keyboard: [[
                            { text: '🔄 Взять в работу', callback_data: `return_${taskId}` }
                        ]]
                    };

                    await bot.bot.sendMessage(originalTask.chat_id, rejectionMessage, {
                        reply_markup: keyboard
                    });
                    console.log(`✅ Rejection notification sent successfully for task ${taskId}`);
                } catch (telegramError) {
                    console.error('❌ Error sending rejection notification:', telegramError);
                }
            }
            
            res.json({ success: true, message: 'Task sent for revision and notification sent' });
        } else {
            res.status(404).json({ error: 'Task not found or not updated' });
        }
    } catch (error) {
        console.error('Error in revision endpoint:', error);
        res.status(500).json({ error: 'Failed to request revision' });
    }
});

app.put('/api/tasks/:id/return', ensureAuthenticated, async (req, res) => {
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

app.post('/api/bot/token', requireRole(['admin']), (req, res) => {
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

// API для рейтинга
app.get('/api/rating', ensureAuthenticated, async (req, res) => {
    try {
        const rating = await getUserRating();
        res.json(rating);
    } catch (error) {
        console.error('Error fetching rating:', error);
        res.status(500).json({ error: 'Failed to fetch rating' });
    }
});

// API для детальной статистики
app.get('/api/stats/detailed', ensureAuthenticated, async (req, res) => {
    try {
        const detailedStats = await getDetailedTaskStats();
        res.json(detailedStats);
    } catch (error) {
        console.error('Error fetching detailed stats:', error);
        res.status(500).json({ error: 'Failed to fetch detailed stats' });
    }
});

app.get('/api/stats/performance', ensureAuthenticated, async (req, res) => {
    try {
        const performanceMetrics = await getTaskPerformanceMetrics();
        res.json(performanceMetrics);
    } catch (error) {
        console.error('Error fetching performance metrics:', error);
        res.status(500).json({ error: 'Failed to fetch performance metrics' });
    }
});

// API для управления ролями пользователей
app.get('/api/users/roles', ensureAuthenticated, async (req, res) => {
    try {
        const users = await getAllUsersWithRoles();
        res.json(users);
    } catch (error) {
        console.error('Error fetching users with roles:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.put('/api/users/:userId/role', requireRole(['admin']), async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;
        
        if (!role || !['executor', 'manager', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        
        const result = await updateUserRole(userId, role);
        
        if (result > 0) {
            res.json({ success: true, message: 'Role updated successfully' });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Failed to update role' });
    }
});

// API для управления настройками
app.get('/api/settings', ensureAuthenticated, async (req, res) => {
    try {
        const settings = await getAllSettings();
        res.json(settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

app.put('/api/settings/:key', requireRole(['admin']), async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;
        
        const result = await setSetting(key, value);
        
        if (result > 0) {
            res.json({ success: true, message: 'Setting updated successfully' });
        } else {
            res.status(500).json({ error: 'Failed to update setting' });
        }
    } catch (error) {
        console.error('Error updating setting:', error);
        res.status(500).json({ error: 'Failed to update setting' });
    }
});

// Главная страница
app.get('/', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Статические файлы
app.use(express.static(path.join(__dirname, '../public')));

module.exports = app;