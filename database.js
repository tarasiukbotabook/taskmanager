const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'tasks.db');
const db = new sqlite3.Database(dbPath);

// Инициализация базы данных
db.serialize(() => {
    // Таблица групп
    db.run(`CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Таблица пользователей
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        points INTEGER DEFAULT 0,
        balance DECIMAL(10,2) DEFAULT 0.00,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Добавляем новые колонки если они не существуют
    db.run(`ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN balance DECIMAL(10,2) DEFAULT 0.00`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'executor'`, () => {}); // executor, manager, admin
    db.run(`ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN email TEXT`, () => {});
    db.run(`ALTER TABLE users ADD COLUMN avatar_url TEXT`, () => {});

    // Таблица задач
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        assignee_username TEXT NOT NULL,
        deadline TEXT,
        status TEXT DEFAULT 'pending',
        chat_id TEXT NOT NULL,
        created_by_user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME NULL,
        reviewed_by_user_id TEXT NULL,
        review_comment TEXT NULL,
        submitted_for_review_at DATETIME NULL,
        FOREIGN KEY (chat_id) REFERENCES groups(chat_id),
        FOREIGN KEY (created_by_user_id) REFERENCES users(user_id),
        FOREIGN KEY (reviewed_by_user_id) REFERENCES users(user_id)
    )`);

    // Добавляем новые колонки если они не существуют
    db.run(`ALTER TABLE tasks ADD COLUMN reviewed_by_user_id TEXT NULL`, () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN review_comment TEXT NULL`, () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN submitted_for_review_at DATETIME NULL`, () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN rejection_reason TEXT NULL`, () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN revision_count INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN started_at DATETIME NULL`, () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN time_spent_minutes INTEGER DEFAULT 0`, () => {});
    db.run(`ALTER TABLE tasks ADD COLUMN efficiency_score DECIMAL(3,2) DEFAULT 0.00`, () => {});

    // Таблица настроек системы
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Добавляем базовые настройки если их нет
    db.run(`INSERT OR IGNORE INTO settings (key, value, description) VALUES 
        ('work_chat_id', '', 'ID рабочего чата где работает бот'),
        ('default_admin_role', 'admin', 'Роль по умолчанию для администраторов')`, () => {});
});

// Функции для работы с группами
function addGroup(chatId, title) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT OR REPLACE INTO groups (chat_id, title) VALUES (?, ?)',
            [chatId, title],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

// Функции для работы с пользователями
function addUser(userId, username, firstName, lastName) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT OR REPLACE INTO users (user_id, username, first_name, last_name) VALUES (?, ?, ?, ?)',
            [userId, username, firstName, lastName],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

// Функции для работы с задачами
function addTask(title, description, assigneeUsername, deadline, chatId, createdByUserId) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO tasks (title, description, assignee_username, deadline, chat_id, created_by_user_id, started_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [title, description, assigneeUsername, deadline, chatId, createdByUserId],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

function getAllTasks(chatId = null) {
    return new Promise((resolve, reject) => {
        let query = `
            SELECT t.*, u.first_name, u.last_name, u.username as creator_username 
            FROM tasks t 
            LEFT JOIN users u ON t.created_by_user_id = u.user_id
        `;
        let params = [];
        
        if (chatId) {
            query += ' WHERE t.chat_id = ?';
            params.push(chatId);
        }
        
        query += ' ORDER BY t.created_at DESC';
        
        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function completeTask(taskId) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE tasks SET status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['completed', taskId],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

function updateTask(taskId, title, description, deadline) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE tasks SET title = ?, description = ?, deadline = ? WHERE id = ?',
            [title, description, deadline, taskId],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

function deleteTask(taskId) {
    return new Promise((resolve, reject) => {
        db.run(
            'DELETE FROM tasks WHERE id = ?',
            [taskId],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

function submitForReview(taskId, userId) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE tasks SET status = ?, submitted_for_review_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?',
            ['review', taskId, 'pending'],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

function approveTask(taskId, reviewerId, comment = null) {
    return new Promise((resolve, reject) => {
        // Сначала получаем информацию о задаче
        db.get('SELECT * FROM tasks WHERE id = ?', [parseInt(taskId)], (err, task) => {
            if (err) {
                console.error('Database error in approveTask:', err);
                reject(err);
                return;
            }
            
            if (!task) {
                console.error(`Task ${taskId} not found in database`);
                reject(new Error('Task not found'));
                return;
            }
            
            // Вычисляем время выполнения
            const startTime = new Date(task.started_at);
            const endTime = new Date();
            const timeSpentMinutes = Math.round((endTime - startTime) / (1000 * 60));
            
            // Вычисляем эффективность (меньше доработок = выше эффективность)
            let efficiencyScore = 1.0;
            if (task.revision_count > 0) {
                efficiencyScore = Math.max(0.1, 1.0 - (task.revision_count * 0.2));
            }
            
            // Обновляем статус задачи с новыми метриками
            const updateQuery = `UPDATE tasks SET 
                status = ?, 
                completed_at = CURRENT_TIMESTAMP, 
                reviewed_by_user_id = ?, 
                review_comment = ?,
                time_spent_minutes = ?,
                efficiency_score = ?
                WHERE id = ?`;
            const updateParams = ['completed', reviewerId, comment, timeSpentMinutes, efficiencyScore, parseInt(taskId)];
            
            db.run(updateQuery, updateParams,
                function(err) {
                    if (err) {
                        console.error('Error updating task status:', err);
                        reject(err);
                        return;
                    }
                    
                    const changesCount = this.changes;
                    
                    // Получаем user_id исполнителя по username
                    const cleanUsername = task.assignee_username.replace('@', '');
                    db.get('SELECT user_id FROM users WHERE username = ? OR username = ?', 
                           [cleanUsername, `@${cleanUsername}`], 
                           (err, user) => {
                        if (err) {
                            console.error('Error finding user:', err);
                        } else if (user) {
                            // Добавляем баллы с учетом эффективности
                            const points = Math.round(efficiencyScore);
                            addPoints(user.user_id, points).catch(console.error);
                        }
                        
                        resolve({ 
                            changes: changesCount, 
                            task: {...task, time_spent_minutes: timeSpentMinutes, efficiency_score: efficiencyScore}, 
                            userId: user?.user_id 
                        });
                    });
                }
            );
        });
    });
}

function requestRevision(taskId, reviewerId, comment) {
    return new Promise((resolve, reject) => {
        console.log(`requestRevision called: taskId=${taskId}, reviewerId=${reviewerId}, comment=${comment}`);
        
        // Сначала проверим текущий статус задачи
        db.get('SELECT id, title, status FROM tasks WHERE id = ?', [parseInt(taskId)], (err, task) => {
            if (err) {
                console.error('Error getting task for revision:', err);
                reject(err);
                return;
            }
            
            if (!task) {
                console.error(`Task ${taskId} not found for revision`);
                reject(new Error('Task not found'));
                return;
            }
            
            console.log(`Found task for revision: id=${task.id}, title="${task.title}", current status="${task.status}"`);
            
            // Теперь обновляем задачу
            db.run(
                'UPDATE tasks SET status = ?, reviewed_by_user_id = ?, review_comment = ?, rejection_reason = ?, revision_count = revision_count + 1 WHERE id = ?',
                ['revision', reviewerId, comment, comment, parseInt(taskId)],
                function(err) {
                    if (err) {
                        console.error('Database error in requestRevision:', err);
                        reject(err);
                    } else {
                        console.log(`requestRevision completed: ${this.changes} rows affected for task ${taskId}`);
                        resolve(this.changes);
                    }
                }
            );
        });
    });
}

function returnToWork(taskId) {
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE tasks SET status = ?, review_comment = NULL, submitted_for_review_at = NULL WHERE id = ?',
            ['pending', taskId],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

function addPoints(userId, points) {
    return new Promise((resolve, reject) => {
        console.log(`Adding ${points} points to user ${userId}`);
        db.run(
            'UPDATE users SET points = points + ? WHERE user_id = ?',
            [points, userId],
            function(err) {
                if (err) {
                    console.error('Error adding points:', err);
                    reject(err);
                } else {
                    console.log(`Points updated, changes: ${this.changes}`);
                    resolve(this.changes);
                }
            }
        );
    });
}

function getUserRating() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT user_id, username, first_name, last_name, points, balance
            FROM users 
            WHERE points > 0 
            ORDER BY points DESC
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getTaskStats() {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) as review,
                SUM(CASE WHEN status = 'revision' THEN 1 ELSE 0 END) as revision,
                SUM(CASE WHEN status = 'pending' AND deadline < date('now') THEN 1 ELSE 0 END) as overdue,
                AVG(CASE WHEN status = 'completed' THEN time_spent_minutes END) as avg_completion_time,
                AVG(CASE WHEN status = 'completed' THEN efficiency_score END) as avg_efficiency,
                SUM(revision_count) as total_revisions
            FROM tasks
        `, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function getDetailedTaskStats() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT 
                assignee_username,
                COUNT(*) as total_tasks,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
                AVG(CASE WHEN status = 'completed' THEN time_spent_minutes END) as avg_time,
                AVG(CASE WHEN status = 'completed' THEN efficiency_score END) as avg_efficiency,
                SUM(revision_count) as total_revisions,
                AVG(revision_count) as avg_revisions
            FROM tasks 
            GROUP BY assignee_username
            ORDER BY completed_tasks DESC, avg_efficiency DESC
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function getTaskPerformanceMetrics() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as tasks_created,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as tasks_completed,
                AVG(CASE WHEN status = 'completed' THEN time_spent_minutes END) as avg_completion_time
            FROM tasks 
            WHERE created_at >= date('now', '-30 days')
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Функции для работы с ролями пользователей
function updateUserRole(userId, role) {
    return new Promise((resolve, reject) => {
        const validRoles = ['executor', 'manager', 'admin'];
        if (!validRoles.includes(role)) {
            reject(new Error('Invalid role'));
            return;
        }
        
        db.run(
            'UPDATE users SET role = ? WHERE user_id = ?',
            [role, userId],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

function getUserRole(userId) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT role FROM users WHERE user_id = ?',
            [userId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.role : 'executor');
            }
        );
    });
}

function getAllUsersWithRoles() {
    return new Promise((resolve, reject) => {
        db.all(`
            SELECT user_id, username, first_name, last_name, role, points, balance
            FROM users 
            ORDER BY role DESC, first_name ASC
        `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Функции для работы с настройками
function setSetting(key, value) {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
            [key, value],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
}

function getSetting(key) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT value FROM settings WHERE key = ?',
            [key],
            (err, row) => {
                if (err) reject(err);
                else resolve(row ? row.value : null);
            }
        );
    });
}

function getAllSettings() {
    return new Promise((resolve, reject) => {
        db.all(
            'SELECT key, value, description FROM settings ORDER BY key',
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

// Функции для работы с Google OAuth
function findOrCreateGoogleUser(googleProfile) {
    return new Promise((resolve, reject) => {
        // Сначала ищем пользователя по Google ID
        db.get(
            'SELECT * FROM users WHERE google_id = ?',
            [googleProfile.id],
            (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (row) {
                    // Пользователь существует, обновляем информацию
                    db.run(
                        'UPDATE users SET email = ?, avatar_url = ?, first_name = ?, last_name = ? WHERE google_id = ?',
                        [
                            googleProfile.emails[0].value,
                            googleProfile.photos[0].value,
                            googleProfile.name.givenName,
                            googleProfile.name.familyName,
                            googleProfile.id
                        ],
                        function(updateErr) {
                            if (updateErr) reject(updateErr);
                            else resolve(row);
                        }
                    );
                } else {
                    // Создаем нового пользователя
                    db.run(
                        'INSERT INTO users (google_id, email, avatar_url, first_name, last_name, username, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [
                            googleProfile.id,
                            googleProfile.emails[0].value,
                            googleProfile.photos[0].value,
                            googleProfile.name.givenName,
                            googleProfile.name.familyName,
                            googleProfile.emails[0].value.split('@')[0],
                            'executor' // По умолчанию роль исполнителя
                        ],
                        function(insertErr) {
                            if (insertErr) {
                                reject(insertErr);
                            } else {
                                // Получаем созданного пользователя
                                db.get(
                                    'SELECT * FROM users WHERE id = ?',
                                    [this.lastID],
                                    (selectErr, newUser) => {
                                        if (selectErr) reject(selectErr);
                                        else resolve(newUser);
                                    }
                                );
                            }
                        }
                    );
                }
            }
        );
    });
}

function findUserByGoogleId(googleId) {
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT * FROM users WHERE google_id = ?',
            [googleId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

module.exports = {
    db,
    addGroup,
    addUser,
    addTask,
    getAllTasks,
    completeTask,
    updateTask,
    deleteTask,
    submitForReview,
    approveTask,
    requestRevision,
    returnToWork,
    addPoints,
    getUserRating,
    getTaskStats,
    getDetailedTaskStats,
    getTaskPerformanceMetrics,
    updateUserRole,
    getUserRole,
    getAllUsersWithRoles,
    setSetting,
    getSetting,
    getAllSettings,
    findOrCreateGoogleUser,
    findUserByGoogleId
};