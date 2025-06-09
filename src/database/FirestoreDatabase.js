const DatabaseInterface = require('./DatabaseInterface');

/**
 * Firestore реализация DatabaseInterface
 * Обертка над существующим database-firestore.js с приведением к единому API
 */
class FirestoreDatabase extends DatabaseInterface {
    
    constructor(config = {}) {
        super();
        
        // Импортируем все функции из существующего database-firestore.js
        const dbModule = require('../../database-firestore');
        
        // Привязываем все методы из database-firestore.js
        this.dbModule = dbModule;
        
        console.log('☁️  Firestore database wrapper initialized');
    }
    
    // ==================== ГРУППЫ ====================
    
    async addGroup(chatId, title) {
        return this.dbModule.addGroup(chatId, title);
    }
    
    // ==================== ПОЛЬЗОВАТЕЛИ ====================
    
    async addUser(userId, username, firstName, lastName) {
        return this.dbModule.addUser(userId, username, firstName, lastName);
    }
    
    async getAllUsersWithRoles() {
        return this.dbModule.getAllUsersWithRoles();
    }
    
    async updateUserRole(userId, role) {
        return this.dbModule.updateUserRole(userId, role);
    }
    
    async getUserRole(userId) {
        return this.dbModule.getUserRole(userId);
    }
    
    async getUserRating() {
        return this.dbModule.getUserRating();
    }
    
    // ==================== ЗАДАЧИ ====================
    
    async addTask(title, description, assigneeUsername, deadline, chatId, createdByUserId, estimatedTime = 0) {
        return this.dbModule.addTask(title, description, assigneeUsername, deadline, chatId, createdByUserId, estimatedTime);
    }
    
    async getAllTasks(filter = {}) {
        return this.dbModule.getAllTasks(filter);
    }
    
    async getTaskStats() {
        return this.dbModule.getTaskStats();
    }
    
    async completeTask(taskId, userId = null) {
        return this.dbModule.completeTask(taskId, userId);
    }
    
    async deleteTask(taskId) {
        return this.dbModule.deleteTask(taskId);
    }
    
    async updateTask(taskId, title, description, deadline) {
        return this.dbModule.updateTask(taskId, title, description, deadline);
    }
    
    async submitForReview(taskId, userId) {
        return this.dbModule.submitForReview(taskId, userId);
    }
    
    async approveTask(taskId, reviewerId, comment = '') {
        return this.dbModule.approveTask(taskId, reviewerId, comment);
    }
    
    async requestRevision(taskId, reviewerId, comment) {
        return this.dbModule.requestRevision(taskId, reviewerId, comment);
    }
    
    async returnToWork(taskId) {
        return this.dbModule.returnToWork(taskId);
    }
    
    async getDetailedTaskStats() {
        return this.dbModule.getDetailedTaskStats();
    }
    
    async getTaskPerformanceMetrics() {
        return this.dbModule.getTaskPerformanceMetrics();
    }
    
    // ==================== НАСТРОЙКИ ====================
    
    async getAllSettings() {
        return this.dbModule.getAllSettings();
    }
    
    async setSetting(key, value, description = '') {
        return this.dbModule.setSetting(key, value, description);
    }
    
    async getSetting(key) {
        return this.dbModule.getSetting(key);
    }
    
    // ==================== ДОПОЛНИТЕЛЬНЫЕ МЕТОДЫ ====================
    
    /**
     * Получить прямой доступ к Firestore модулю (для специфичных операций)
     * @returns {Object} Объект database-firestore.js модуля
     */
    getRawDatabase() {
        return this.dbModule;
    }
    
    /**
     * Получить информацию о подключении
     * @returns {Object} Информация о БД
     */
    getConnectionInfo() {
        return {
            type: 'firestore',
            project: process.env.FIREBASE_PROJECT_ID || 'default',
            driver: 'firebase-admin',
            status: 'connected'
        };
    }
}

module.exports = FirestoreDatabase;