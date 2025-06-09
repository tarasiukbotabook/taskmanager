/**
 * Абстрактный базовый класс для всех реализаций базы данных
 * Определяет единый API для работы с данными независимо от типа БД
 */
class DatabaseInterface {
    
    // ==================== ГРУППЫ ====================
    
    /**
     * Добавить группу (чат)
     * @param {string} chatId - ID чата
     * @param {string} title - Название группы
     * @returns {Promise<Object>} Результат операции
     */
    async addGroup(chatId, title) {
        throw new Error('Method addGroup must be implemented');
    }
    
    // ==================== ПОЛЬЗОВАТЕЛИ ====================
    
    /**
     * Добавить пользователя
     * @param {string} userId - ID пользователя 
     * @param {string} username - Username
     * @param {string} firstName - Имя
     * @param {string} lastName - Фамилия
     * @returns {Promise<Object>} Результат операции
     */
    async addUser(userId, username, firstName, lastName) {
        throw new Error('Method addUser must be implemented');
    }
    
    /**
     * Получить всех пользователей с ролями
     * @returns {Promise<Array>} Список пользователей
     */
    async getAllUsersWithRoles() {
        throw new Error('Method getAllUsersWithRoles must be implemented');
    }
    
    /**
     * Обновить роль пользователя
     * @param {string} userId - ID пользователя
     * @param {string} role - Новая роль (executor/manager/admin)
     * @returns {Promise<number>} Количество обновленных записей
     */
    async updateUserRole(userId, role) {
        throw new Error('Method updateUserRole must be implemented');
    }
    
    /**
     * Получить роль пользователя
     * @param {string} userId - ID пользователя
     * @returns {Promise<string>} Роль пользователя
     */
    async getUserRole(userId) {
        throw new Error('Method getUserRole must be implemented');
    }
    
    /**
     * Получить рейтинг пользователей
     * @returns {Promise<Array>} Рейтинг пользователей
     */
    async getUserRating() {
        throw new Error('Method getUserRating must be implemented');
    }
    
    // ==================== ЗАДАЧИ ====================
    
    /**
     * Добавить задачу
     * @param {string} title - Название задачи
     * @param {string} description - Описание
     * @param {string} assigneeUsername - Username исполнителя
     * @param {string} deadline - Дедлайн
     * @param {string} chatId - ID чата
     * @param {string} createdByUserId - ID создателя
     * @param {number} estimatedTime - Оценочное время
     * @returns {Promise<Object>} Созданная задача
     */
    async addTask(title, description, assigneeUsername, deadline, chatId, createdByUserId, estimatedTime = 0) {
        throw new Error('Method addTask must be implemented');
    }
    
    /**
     * Получить все задачи
     * @param {Object} filter - Фильтры для задач
     * @returns {Promise<Array>} Список задач
     */
    async getAllTasks(filter = {}) {
        throw new Error('Method getAllTasks must be implemented');
    }
    
    /**
     * Получить статистику задач
     * @returns {Promise<Object>} Статистика задач
     */
    async getTaskStats() {
        throw new Error('Method getTaskStats must be implemented');
    }
    
    /**
     * Завершить задачу
     * @param {string} taskId - ID задачи
     * @param {string} userId - ID пользователя
     * @returns {Promise<number>} Количество обновленных записей
     */
    async completeTask(taskId, userId = null) {
        throw new Error('Method completeTask must be implemented');
    }
    
    /**
     * Удалить задачу
     * @param {string} taskId - ID задачи
     * @returns {Promise<number>} Количество удаленных записей
     */
    async deleteTask(taskId) {
        throw new Error('Method deleteTask must be implemented');
    }
    
    /**
     * Обновить задачу
     * @param {string} taskId - ID задачи
     * @param {string} title - Новое название
     * @param {string} description - Новое описание
     * @param {string} deadline - Новый дедлайн
     * @returns {Promise<number>} Количество обновленных записей
     */
    async updateTask(taskId, title, description, deadline) {
        throw new Error('Method updateTask must be implemented');
    }
    
    /**
     * Отправить задачу на проверку
     * @param {string} taskId - ID задачи
     * @param {string} userId - ID пользователя
     * @returns {Promise<number>} Количество обновленных записей
     */
    async submitForReview(taskId, userId) {
        throw new Error('Method submitForReview must be implemented');
    }
    
    /**
     * Одобрить задачу
     * @param {string} taskId - ID задачи
     * @param {string} reviewerId - ID проверяющего
     * @param {string} comment - Комментарий
     * @returns {Promise<Object>} Результат операции
     */
    async approveTask(taskId, reviewerId, comment = '') {
        throw new Error('Method approveTask must be implemented');
    }
    
    /**
     * Запросить доработку задачи
     * @param {string} taskId - ID задачи
     * @param {string} reviewerId - ID проверяющего
     * @param {string} comment - Комментарий о доработке
     * @returns {Promise<number>} Количество обновленных записей
     */
    async requestRevision(taskId, reviewerId, comment) {
        throw new Error('Method requestRevision must be implemented');
    }
    
    /**
     * Вернуть задачу в работу
     * @param {string} taskId - ID задачи
     * @returns {Promise<number>} Количество обновленных записей
     */
    async returnToWork(taskId) {
        throw new Error('Method returnToWork must be implemented');
    }
    
    /**
     * Получить детальную статистику задач
     * @returns {Promise<Array>} Детальная статистика
     */
    async getDetailedTaskStats() {
        throw new Error('Method getDetailedTaskStats must be implemented');
    }
    
    /**
     * Получить метрики производительности
     * @returns {Promise<Object>} Метрики производительности
     */
    async getTaskPerformanceMetrics() {
        throw new Error('Method getTaskPerformanceMetrics must be implemented');
    }
    
    // ==================== НАСТРОЙКИ ====================
    
    /**
     * Получить все настройки
     * @returns {Promise<Array>} Список настроек
     */
    async getAllSettings() {
        throw new Error('Method getAllSettings must be implemented');
    }
    
    /**
     * Установить настройку
     * @param {string} key - Ключ настройки
     * @param {string} value - Значение настройки
     * @param {string} description - Описание настройки
     * @returns {Promise<number>} Количество обновленных записей
     */
    async setSetting(key, value, description = '') {
        throw new Error('Method setSetting must be implemented');
    }
    
    /**
     * Получить настройку по ключу
     * @param {string} key - Ключ настройки
     * @returns {Promise<string|null>} Значение настройки
     */
    async getSetting(key) {
        throw new Error('Method getSetting must be implemented');
    }
}

module.exports = DatabaseInterface;