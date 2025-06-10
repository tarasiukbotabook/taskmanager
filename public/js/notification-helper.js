/**
 * Система красивых уведомлений
 */

const NotificationHelper = {
    container: null,
    notifications: new Map(),
    counter: 0,

    // Инициализация
    init() {
        this.container = document.getElementById('notificationsContainer');
        if (!this.container) {
            console.warn('Notifications container not found');
        }
    },

    // Создание уведомления
    show(message, type = 'info', options = {}) {
        if (!this.container) this.init();
        if (!this.container) return null;

        const id = ++this.counter;
        const notification = this.createNotification(id, message, type, options);
        
        this.container.appendChild(notification);
        this.notifications.set(id, notification);

        // Показываем уведомление с задержкой для анимации
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Автоматическое закрытие
        const duration = options.duration !== undefined ? options.duration : this.getDefaultDuration(type);
        if (duration > 0) {
            this.startAutoClose(id, duration);
        }

        return id;
    },

    // Создание HTML элемента уведомления
    createNotification(id, message, type, options) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.dataset.id = id;

        const icon = this.getIcon(type);
        const title = options.title || this.getDefaultTitle(type);

        notification.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                ${title ? `<div class="notification-title">${title}</div>` : ''}
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" onclick="NotificationHelper.hide(${id})">&times;</button>
            ${options.progress !== false ? '<div class="notification-progress"></div>' : ''}
        `;

        return notification;
    },

    // Скрытие уведомления
    hide(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        notification.classList.add('hide');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            this.notifications.delete(id);
        }, 300);
    },

    // Автоматическое закрытие с прогресс-баром
    startAutoClose(id, duration) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        const progressBar = notification.querySelector('.notification-progress');
        if (progressBar) {
            progressBar.style.width = '100%';
            progressBar.style.transition = `width ${duration}ms linear`;
            
            setTimeout(() => {
                progressBar.style.width = '0%';
            }, 10);
        }

        setTimeout(() => {
            this.hide(id);
        }, duration);
    },

    // Получение иконки по типу
    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'i'
        };
        return icons[type] || icons.info;
    },

    // Получение заголовка по умолчанию
    getDefaultTitle(type) {
        const titles = {
            success: 'Успешно',
            error: 'Ошибка',
            warning: 'Предупреждение',
            info: 'Информация'
        };
        return titles[type] || titles.info;
    },

    // Получение длительности по умолчанию
    getDefaultDuration(type) {
        const durations = {
            success: 4000,
            error: 6000,
            warning: 5000,
            info: 4000
        };
        return durations[type] || 4000;
    },

    // Удобные методы для разных типов уведомлений
    success(message, options = {}) {
        return this.show(message, 'success', options);
    },

    error(message, options = {}) {
        return this.show(message, 'error', options);
    },

    warning(message, options = {}) {
        return this.show(message, 'warning', options);
    },

    info(message, options = {}) {
        return this.show(message, 'info', options);
    },

    // Очистка всех уведомлений
    clear() {
        this.notifications.forEach((notification, id) => {
            this.hide(id);
        });
    }
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    NotificationHelper.init();
});