/**
 * Главная точка входа для database модуля
 * Экспортирует фабрику и интерфейсы для удобного использования
 */

const DatabaseFactory = require('./DatabaseFactory');
const DatabaseInterface = require('./DatabaseInterface');

/**
 * Создать экземпляр базы данных с автоматическим определением типа
 * @param {Object} options - Опции конфигурации
 * @returns {DatabaseInterface} Экземпляр базы данных
 */
function createDatabase(options = {}) {
    const {
        type = null,
        config = {},
        environment = process.env.NODE_ENV || 'development'
    } = options;
    
    // Определяем тип БД
    const dbType = type || DatabaseFactory.getRecommendedType(environment);
    
    // Создаем экземпляр
    return DatabaseFactory.create(dbType, config);
}

/**
 * Создать экземпляр БД с явным указанием типа
 */
const create = {
    sqlite: (config = {}) => DatabaseFactory.create('sqlite', config),
    firestore: (config = {}) => DatabaseFactory.create('firestore', config),
    auto: (config = {}) => createDatabase(config)
};

module.exports = {
    // Основные классы
    DatabaseFactory,
    DatabaseInterface,
    
    // Функции создания
    createDatabase,
    create,
    
    // Утилиты
    getSupportedTypes: DatabaseFactory.getSupportedTypes,
    isTypeSupported: DatabaseFactory.isTypeSupported,
    getRecommendedType: DatabaseFactory.getRecommendedType
};