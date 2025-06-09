const admin = require('firebase-admin');

// Инициализация Firebase Admin SDK
if (!admin.apps.length) {
    // В продакшене Firebase автоматически найдет service account
    // Для локальной разработки укажите путь к service account key
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
    } else {
        admin.initializeApp();
    }
}

const db = admin.firestore();

// Утилиты для работы с Firestore
function generateId() {
    return db.collection('_').doc().id;
}

function timestampToDate(timestamp) {
    if (!timestamp) return null;
    if (timestamp.toDate) return timestamp.toDate();
    return new Date(timestamp);
}

// Функции для работы с группами
async function addGroup(chatId, title) {
    const groupRef = db.collection('groups').doc(chatId);
    await groupRef.set({
        chat_id: chatId,
        title: title,
        created_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return chatId;
}

// Функции для работы с пользователями
async function addUser(userId, username, firstName, lastName) {
    const userRef = db.collection('users').doc(userId);
    await userRef.set({
        user_id: userId,
        username: username,
        first_name: firstName,
        last_name: lastName,
        points: 0,
        balance: 0.00,
        role: 'executor',
        created_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return userId;
}

async function updateUserRole(userId, role) {
    const userRef = db.collection('users').doc(userId);
    await userRef.update({ role: role });
    return 1; // Для совместимости с SQLite
}

async function getUserRole(userId) {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
        return userDoc.data().role || 'executor';
    }
    return 'executor';
}

async function getAllUsersWithRoles() {
    const snapshot = await db.collection('users').get();
    
    const users = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: timestampToDate(doc.data().created_at)
    }));
    
    // Фильтруем только пользователей Telegram бота (у них есть user_id, но нет google_id)
    const telegramUsers = users.filter(user => user.user_id && !user.google_id);
    
    // Сортируем в JavaScript для избежания индексов
    return telegramUsers.sort((a, b) => {
        // Сначала по роли (admin > manager > executor)
        const roleOrder = { admin: 3, manager: 2, executor: 1 };
        const roleA = roleOrder[a.role] || 0;
        const roleB = roleOrder[b.role] || 0;
        
        if (roleA !== roleB) {
            return roleB - roleA;
        }
        
        // Потом по имени
        const nameA = a.first_name || a.username || '';
        const nameB = b.first_name || b.username || '';
        return nameA.localeCompare(nameB);
    });
}

// Функции для работы с задачами
async function addTask(title, description, assigneeUsername, deadline, chatId, createdByUserId) {
    const taskRef = db.collection('tasks').doc();
    const taskData = {
        id: taskRef.id,
        title: title,
        description: description,
        assignee_username: assigneeUsername,
        deadline: deadline,
        status: 'pending',
        chat_id: chatId,
        created_by_user_id: createdByUserId,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        started_at: admin.firestore.FieldValue.serverTimestamp(),
        revision_count: 0,
        time_spent_minutes: 0,
        efficiency_score: 1.0
    };
    
    await taskRef.set(taskData);
    return taskRef.id;
}

async function getAllTasks(chatId = null) {
    let query = db.collection('tasks').orderBy('created_at', 'desc');
    
    if (chatId) {
        query = query.where('chat_id', '==', chatId);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({
        ...doc.data(),
        created_at: timestampToDate(doc.data().created_at),
        completed_at: timestampToDate(doc.data().completed_at),
        submitted_for_review_at: timestampToDate(doc.data().submitted_for_review_at),
        started_at: timestampToDate(doc.data().started_at)
    }));
}

async function updateTask(taskId, title, description, deadline) {
    const taskRef = db.collection('tasks').doc(taskId);
    await taskRef.update({
        title: title,
        description: description,
        deadline: deadline
    });
    return 1;
}

async function deleteTask(taskId) {
    await db.collection('tasks').doc(taskId).delete();
    return 1;
}

async function completeTask(taskId) {
    const taskRef = db.collection('tasks').doc(taskId);
    await taskRef.update({
        status: 'completed',
        completed_at: admin.firestore.FieldValue.serverTimestamp()
    });
    return 1;
}

async function submitForReview(taskId, userId) {
    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();
    
    if (taskDoc.exists && taskDoc.data().status === 'pending') {
        await taskRef.update({
            status: 'review',
            submitted_for_review_at: admin.firestore.FieldValue.serverTimestamp()
        });
        return 1;
    }
    return 0;
}

async function approveTask(taskId, reviewerId, comment = null) {
    const taskRef = db.collection('tasks').doc(taskId);
    const taskDoc = await taskRef.get();
    
    if (!taskDoc.exists) {
        throw new Error('Task not found');
    }
    
    const task = taskDoc.data();
    const startTime = timestampToDate(task.started_at);
    const endTime = new Date();
    const timeSpentMinutes = Math.round((endTime - startTime) / (1000 * 60));
    
    // Вычисляем эффективность
    let efficiencyScore = 1.0;
    if (task.revision_count > 0) {
        efficiencyScore = Math.max(0.1, 1.0 - (task.revision_count * 0.2));
    }
    
    await taskRef.update({
        status: 'completed',
        completed_at: admin.firestore.FieldValue.serverTimestamp(),
        reviewed_by_user_id: reviewerId,
        review_comment: comment,
        time_spent_minutes: timeSpentMinutes,
        efficiency_score: efficiencyScore
    });
    
    // Добавляем баллы пользователю
    const points = Math.round(efficiencyScore);
    await addPoints(task.assignee_username, points);
    
    return { 
        changes: 1, 
        task: { 
            ...task, 
            time_spent_minutes: timeSpentMinutes, 
            efficiency_score: efficiencyScore 
        } 
    };
}

async function requestRevision(taskId, reviewerId, comment) {
    const taskRef = db.collection('tasks').doc(taskId);
    await taskRef.update({
        status: 'revision',
        reviewed_by_user_id: reviewerId,
        review_comment: comment,
        rejection_reason: comment,
        revision_count: admin.firestore.FieldValue.increment(1)
    });
    return 1;
}

async function returnToWork(taskId) {
    const taskRef = db.collection('tasks').doc(taskId);
    await taskRef.update({
        status: 'pending',
        review_comment: null,
        submitted_for_review_at: null
    });
    return 1;
}

// Функции для работы с баллами
async function addPoints(usernameOrId, points) {
    // Сначала ищем пользователя по username
    let userQuery = db.collection('users').where('username', '==', usernameOrId);
    let snapshot = await userQuery.get();
    
    if (snapshot.empty) {
        // Если не найден по username, ищем по user_id
        userQuery = db.collection('users').where('user_id', '==', usernameOrId);
        snapshot = await userQuery.get();
    }
    
    if (!snapshot.empty) {
        const userDoc = snapshot.docs[0];
        await userDoc.ref.update({
            points: admin.firestore.FieldValue.increment(points)
        });
        return 1;
    }
    return 0;
}

async function getUserRating() {
    const snapshot = await db.collection('users')
        .where('points', '>', 0)
        .orderBy('points', 'desc')
        .get();
    
    return snapshot.docs.map(doc => ({
        ...doc.data(),
        created_at: timestampToDate(doc.data().created_at)
    }));
}

// Функции для статистики
async function getTaskStats() {
    const snapshot = await db.collection('tasks').get();
    const tasks = snapshot.docs.map(doc => doc.data());
    
    const stats = {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        pending: tasks.filter(t => t.status === 'pending').length,
        review: tasks.filter(t => t.status === 'review').length,
        revision: tasks.filter(t => t.status === 'revision').length,
        overdue: tasks.filter(t => t.status === 'pending' && t.deadline && new Date(t.deadline) < new Date()).length,
        total_revisions: tasks.reduce((sum, t) => sum + (t.revision_count || 0), 0)
    };
    
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.time_spent_minutes);
    if (completedTasks.length > 0) {
        stats.avg_completion_time = completedTasks.reduce((sum, t) => sum + t.time_spent_minutes, 0) / completedTasks.length;
        stats.avg_efficiency = completedTasks.reduce((sum, t) => sum + (t.efficiency_score || 1), 0) / completedTasks.length;
    }
    
    return stats;
}

async function getDetailedTaskStats() {
    const snapshot = await db.collection('tasks').get();
    const tasks = snapshot.docs.map(doc => doc.data());
    
    const statsByAssignee = {};
    
    tasks.forEach(task => {
        const assignee = task.assignee_username;
        if (!statsByAssignee[assignee]) {
            statsByAssignee[assignee] = {
                assignee_username: assignee,
                total_tasks: 0,
                completed_tasks: 0,
                total_time: 0,
                total_efficiency: 0,
                total_revisions: 0
            };
        }
        
        const stats = statsByAssignee[assignee];
        stats.total_tasks++;
        
        if (task.status === 'completed') {
            stats.completed_tasks++;
            stats.total_time += task.time_spent_minutes || 0;
            stats.total_efficiency += task.efficiency_score || 1;
        }
        
        stats.total_revisions += task.revision_count || 0;
    });
    
    return Object.values(statsByAssignee).map(stats => ({
        ...stats,
        avg_time: stats.completed_tasks > 0 ? stats.total_time / stats.completed_tasks : 0,
        avg_efficiency: stats.completed_tasks > 0 ? stats.total_efficiency / stats.completed_tasks : 0,
        avg_revisions: stats.total_tasks > 0 ? stats.total_revisions / stats.total_tasks : 0
    })).sort((a, b) => b.completed_tasks - a.completed_tasks);
}

async function getTaskPerformanceMetrics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const snapshot = await db.collection('tasks')
        .where('created_at', '>=', thirtyDaysAgo)
        .orderBy('created_at', 'desc')
        .get();
    
    const tasks = snapshot.docs.map(doc => ({
        ...doc.data(),
        created_at: timestampToDate(doc.data().created_at)
    }));
    
    const metricsByDate = {};
    
    tasks.forEach(task => {
        const date = task.created_at.toISOString().split('T')[0];
        if (!metricsByDate[date]) {
            metricsByDate[date] = {
                date: date,
                tasks_created: 0,
                tasks_completed: 0,
                total_completion_time: 0,
                completed_count: 0
            };
        }
        
        const metrics = metricsByDate[date];
        metrics.tasks_created++;
        
        if (task.status === 'completed') {
            metrics.tasks_completed++;
            if (task.time_spent_minutes) {
                metrics.total_completion_time += task.time_spent_minutes;
                metrics.completed_count++;
            }
        }
    });
    
    return Object.values(metricsByDate).map(metrics => ({
        date: metrics.date,
        tasks_created: metrics.tasks_created,
        tasks_completed: metrics.tasks_completed,
        avg_completion_time: metrics.completed_count > 0 ? metrics.total_completion_time / metrics.completed_count : 0
    })).sort((a, b) => new Date(b.date) - new Date(a.date));
}

// Функции для работы с настройками
async function setSetting(key, value) {
    const settingRef = db.collection('settings').doc(key);
    await settingRef.set({
        key: key,
        value: value,
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return 1;
}

async function getSetting(key) {
    const settingDoc = await db.collection('settings').doc(key).get();
    if (settingDoc.exists) {
        return settingDoc.data().value;
    }
    return null;
}

async function getAllSettings() {
    const snapshot = await db.collection('settings').get();
    return snapshot.docs.map(doc => ({
        key: doc.id,
        ...doc.data(),
        updated_at: timestampToDate(doc.data().updated_at)
    }));
}

// Функции для работы с Google OAuth
async function findOrCreateGoogleUser(googleProfile) {
    const userRef = db.collection('users').doc(googleProfile.id);
    const userDoc = await userRef.get();
    
    const userData = {
        google_id: googleProfile.id,
        email: googleProfile.emails[0].value,
        avatar_url: googleProfile.photos[0].value,
        first_name: googleProfile.name.givenName,
        last_name: googleProfile.name.familyName,
        username: googleProfile.emails[0].value.split('@')[0],
        updated_at: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (userDoc.exists) {
        // Обновляем существующего пользователя
        await userRef.update(userData);
        return { id: googleProfile.id, ...userDoc.data(), ...userData };
    } else {
        // Создаем нового пользователя
        userData.role = 'executor';
        userData.points = 0;
        userData.balance = 0.00;
        userData.created_at = admin.firestore.FieldValue.serverTimestamp();
        
        await userRef.set(userData);
        return { id: googleProfile.id, ...userData };
    }
}

async function findUserByGoogleId(googleId) {
    const userDoc = await db.collection('users').doc(googleId).get();
    if (userDoc.exists) {
        return { id: userDoc.id, ...userDoc.data() };
    }
    return null;
}

module.exports = {
    db: admin.firestore(),
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