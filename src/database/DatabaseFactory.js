const DatabaseInterface = require('./DatabaseInterface');

/**
 * Фабрика для создания экземпляров базы данных
 * Скрывает детали создания конкретных реализаций
 */
class DatabaseFactory {
    
    /**
     * Создать экземпляр базы данных
     * @param {string} type - Тип БД ('sqlite' | 'firestore')
     * @param {Object} config - Конфигурация подключения
     * @returns {DatabaseInterface} Экземпляр базы данных
     */
    static create(type = null, config = {}) {
        // Определяем тип БД из environment или параметра
        const dbType = type || process.env.DB_TYPE || (process.env.USE_FIRESTORE === 'true' ? 'firestore' : 'sqlite');
        
        console.log(`🗄️  Initializing ${dbType.toUpperCase()} database...`);
        
        switch (dbType.toLowerCase()) {
            case 'sqlite':
                return DatabaseFactory._createSQLite(config);
                
            case 'firestore':
                return DatabaseFactory._createFirestore(config);
                
            default:
                console.warn(`⚠️  Unknown database type: ${dbType}, falling back to SQLite`);
                return DatabaseFactory._createSQLite(config);
        }
    }
    
    /**
     * Создать SQLite базу данных
     * @param {Object} config - Конфигурация SQLite
     * @returns {SQLiteDatabase} Экземпляр SQLite БД
     * @private
     */
    static _createSQLite(config) {
        try {
            const SQLiteDatabase = require('./SQLiteDatabase');
            const instance = new SQLiteDatabase(config);
            console.log('✅ SQLite database initialized');
            return instance;
        } catch (error) {
            console.error('❌ Failed to initialize SQLite database:', error.message);
            throw new Error(`SQLite initialization failed: ${error.message}`);
        }
    }
    
    /**
     * Создать Firestore базу данных
     * @param {Object} config - Конфигурация Firestore
     * @returns {FirestoreDatabase} Экземпляр Firestore БД
     * @private
     */
    static _createFirestore(config) {
        try {
            const FirestoreDatabase = require('./FirestoreDatabase');
            const instance = new FirestoreDatabase(config);
            console.log('✅ Firestore database initialized');
            return instance;
        } catch (error) {
            console.error('❌ Failed to initialize Firestore database:', error.message);
            throw new Error(`Firestore initialization failed: ${error.message}`);
        }
    }
    
    /**
     * Получить список поддерживаемых типов БД
     * @returns {Array<string>} Список типов БД
     */
    static getSupportedTypes() {
        return ['sqlite', 'firestore'];
    }
    
    /**
     * Проверить доступность типа БД
     * @param {string} type - Тип БД для проверки
     * @returns {boolean} Доступен ли тип БД
     */
    static isTypeSupported(type) {
        return DatabaseFactory.getSupportedTypes().includes(type.toLowerCase());
    }
    
    /**
     * Получить рекомендуемый тип БД для среды
     * @param {string} environment - Среда (development/production)
     * @returns {string} Рекомендуемый тип БД
     */
    static getRecommendedType(environment = 'development') {
        const recommendations = {
            'development': 'sqlite',
            'test': 'sqlite',
            'staging': 'firestore',
            'production': 'firestore'
        };
        
        return recommendations[environment] || 'sqlite';
    }
}

module.exports = DatabaseFactory;