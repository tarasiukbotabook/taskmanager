/**
 * API слой для взаимодействия с сервером
 * Централизованные функции для работы с REST API
 */

// Базовая конфигурация API
const API_CONFIG = {
    baseURL: window.location.origin,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
};

/**
 * Базовая функция для API вызовов
 * @param {string} url - URL для запроса
 * @param {Object} options - Опции для fetch
 * @returns {Promise<Response>} - Promise с ответом
 */
async function apiCall(url, options = {}) {
    const defaultOptions = {
        credentials: 'include',
        headers: {
            ...API_CONFIG.headers,
            ...options.headers
        }
    };
    
    // Добавляем префикс /api если его нет
    const apiUrl = url.startsWith('/api') ? url : `/api${url}`;
    const fullUrl = `${API_CONFIG.baseURL}${apiUrl}`;
    
    try {
        const response = await fetch(fullUrl, { ...defaultOptions, ...options });
        return response;
    } catch (error) {
        console.error('API Call Error:', error);
        throw error;
    }
}

/**
 * API функции для работы с задачами
 */
const TasksAPI = {
    // Получить все задачи
    async getAll() {
        const response = await apiCall('/tasks');
        if (!response.ok) throw new Error('Failed to fetch tasks');
        return response.json();
    },

    // Создать новую задачу  
    async create(taskData) {
        const response = await apiCall('/tasks', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
        if (!response.ok) throw new Error('Failed to create task');
        return response.json();
    },

    // Обновить задачу
    async update(taskId, taskData) {
        const response = await apiCall(`/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify(taskData)
        });
        if (!response.ok) throw new Error('Failed to update task');
        return response.json();
    },

    // Завершить задачу
    async complete(taskId) {
        const response = await apiCall(`/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'completed' })
        });
        if (!response.ok) throw new Error('Failed to complete task');
        return response.json();
    },

    // Удалить задачу
    async delete(taskId) {
        const response = await apiCall(`/tasks/${taskId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Failed to delete task');
        return response.json();
    },

    // Отправить на проверку
    async submitForReview(taskId) {
        const response = await apiCall(`/tasks/${taskId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'review' })
        });
        if (!response.ok) throw new Error('Failed to submit task for review');
        return response.json();
    },

    // Одобрить задачу
    async approve(taskId, comment = '') {
        const response = await apiCall(`/tasks/${taskId}/approve`, {
            method: 'POST',
            body: JSON.stringify({ comment })
        });
        if (!response.ok) throw new Error('Failed to approve task');
        return response.json();
    },

    // Отклонить задачу
    async reject(taskId, comment) {
        const response = await apiCall(`/tasks/${taskId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ comment })
        });
        if (!response.ok) throw new Error('Failed to reject task');
        return response.json();
    }
};

/**
 * API функции для работы со статистикой
 */
const StatsAPI = {
    // Получить базовую статистику
    async getBasic() {
        const response = await apiCall('/stats');
        if (!response.ok) throw new Error('Failed to fetch stats');
        return response.json();
    },

    // Получить детальную статистику
    async getDetailed() {
        const response = await apiCall('/stats/detailed');
        if (!response.ok) throw new Error('Failed to fetch detailed stats');
        return response.json();
    },

    // Получить метрики производительности
    async getPerformance() {
        const response = await apiCall('/stats/performance');
        if (!response.ok) throw new Error('Failed to fetch performance metrics');
        return response.json();
    }
};

/**
 * API функции для работы с пользователями
 */
const UsersAPI = {
    // Получить всех пользователей
    async getAll() {
        const response = await apiCall('/admin/users');
        if (!response.ok) throw new Error('Failed to fetch users');
        return response.json();
    },

    // Обновить роль пользователя
    async updateRole(userId, role) {
        const response = await apiCall(`/admin/users/${userId}/role`, {
            method: 'PUT',
            body: JSON.stringify({ role })
        });
        if (!response.ok) throw new Error('Failed to update user role');
        return response.json();
    },

    // Обновить список пользователей из Telegram
    async refresh() {
        const response = await apiCall('/admin/users/refresh', {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to refresh users');
        return response.json();
    }
};

/**
 * API функции для работы с настройками
 */
const SettingsAPI = {
    // Получить все настройки
    async getAll() {
        const response = await apiCall('/settings');
        if (!response.ok) throw new Error('Failed to fetch settings');
        return response.json();
    },

    // Сохранить настройку
    async save(key, value) {
        const response = await apiCall(`/settings/${key}`, {
            method: 'PUT',
            body: JSON.stringify({ value })
        });
        if (!response.ok) throw new Error('Failed to save setting');
        return response.json();
    },

    // Получить информацию о чате
    async getChatInfo() {
        const response = await apiCall('/admin/chat/info');
        if (!response.ok) throw new Error('Failed to get chat info');
        return response.json();
    }
};

/**
 * API функции для работы с ботом
 */
const BotAPI = {
    // Получить статус бота
    async getStatus() {
        const response = await apiCall('/admin/bot/status');
        if (!response.ok) throw new Error('Failed to get bot status');
        return response.json();
    },

    // Сохранить токен бота
    async saveToken(token) {
        const response = await apiCall('/admin/bot/token', {
            method: 'POST',
            body: JSON.stringify({ token })
        });
        if (!response.ok) throw new Error('Failed to save bot token');
        return response.json();
    },

    // Остановить бота
    async stop() {
        const response = await apiCall('/admin/bot/stop', {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to stop bot');
        return response.json();
    },

    // Тест уведомлений
    async testNotifications() {
        const response = await apiCall('/admin/bot/test', {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to test notifications');
        return response.json();
    },

    // Запустить polling для обработки команд /start
    async startPolling() {
        const response = await apiCall('/telegram/start-polling', {
            method: 'POST'
        });
        if (!response.ok) throw new Error('Failed to start polling');
        return response.json();
    }
};

/**
 * Обработка ошибок API
 */
function handleAPIError(error) {
    console.error('API Error:', error);
    
    // Показываем уведомление пользователю
    if (typeof showNotification === 'function') {
        showNotification('Ошибка соединения с сервером', 'error');
    }
    
    return null;
}