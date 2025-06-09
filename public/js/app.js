/**
 * Главный файл приложения
 * Отвечает за инициализацию, навигацию и общее управление приложением
 */

const App = {
    currentPage: 'dashboard',
    modules: {},
    
    // Инициализация приложения
    init() {
        console.log('🚀 Инициализация Task Manager...');
        
        this.bindGlobalEvents();
        this.initializeModules();
        this.setupNavigation();
        this.loadInitialPage();
        
        console.log('✅ Task Manager готов к работе');
    },
    
    // Привязка глобальных событий
    bindGlobalEvents() {
        // Обработка закрытия модальных окон по ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
        
        // Обработка кликов по оверлею модальных окон
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.classList.remove('show');
            }
        });
        
        // Обработка ошибок JavaScript
        window.addEventListener('error', (e) => {
            console.error('JavaScript Error:', e.error);
            this.showNotification('Произошла ошибка в приложении', 'error');
        });
        
        // Обработка unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled Promise Rejection:', e.reason);
            this.showNotification('Ошибка сетевого запроса', 'error');
        });
    },
    
    // Инициализация модулей
    initializeModules() {
        // Регистрируем модули
        this.modules = {
            tasks: TasksModule,
            users: UsersModule,
            settings: SettingsModule
        };
        
        // Инициализируем каждый модуль
        Object.keys(this.modules).forEach(moduleName => {
            try {
                if (this.modules[moduleName].init) {
                    this.modules[moduleName].init();
                    console.log(`✅ Модуль ${moduleName} инициализирован`);
                }
            } catch (error) {
                console.error(`❌ Ошибка инициализации модуля ${moduleName}:`, error);
            }
        });
    },
    
    // Настройка навигации
    setupNavigation() {
        // Привязываем события к пунктам навигации
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) {
                    this.navigateTo(page);
                }
            });
        });
        
        // Обработка браузерной навигации
        window.addEventListener('popstate', (e) => {
            const page = e.state?.page || 'dashboard';
            this.showPage(page, false);
        });
    },
    
    // Загрузка начальной страницы
    loadInitialPage() {
        // Получаем страницу из URL или используем dashboard по умолчанию
        const urlParams = new URLSearchParams(window.location.search);
        const initialPage = urlParams.get('page') || 'dashboard';
        
        this.navigateTo(initialPage, false);
    },
    
    // Навигация к странице
    navigateTo(page, updateHistory = true) {
        if (this.currentPage === page) return;
        
        this.showPage(page, updateHistory);
    },
    
    // Отображение страницы
    showPage(page, updateHistory = true) {
        // Скрываем все страницы
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });
        
        // Показываем нужную страницу
        const pageElement = document.getElementById(`${page}Page`);
        if (pageElement) {
            pageElement.classList.add('active');
        } else {
            console.error(`Страница ${page} не найдена`);
            return;
        }
        
        // Обновляем активный пункт навигации
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const navItem = document.querySelector(`[data-page=\"${page}\"]`);
        if (navItem) {
            navItem.classList.add('active');
        }
        
        // Обновляем заголовок страницы
        this.updatePageTitle(page);
        
        // Обновляем URL
        if (updateHistory) {
            const url = new URL(window.location);
            url.searchParams.set('page', page);
            window.history.pushState({ page }, '', url);
        }
        
        // Обновляем текущую страницу
        this.currentPage = page;
        
        // Вызываем обработчик страницы
        this.onPageChange(page);
    },
    
    // Обработчик смены страницы
    onPageChange(page) {
        switch (page) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'tasks':
                if (this.modules.tasks.loadTasks) {
                    this.modules.tasks.loadTasks();
                }
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
            case 'users':
                if (this.modules.users.loadUsers) {
                    this.modules.users.loadUsers();
                }
                break;
            case 'settings':
                if (this.modules.settings.loadSettings) {
                    this.modules.settings.loadSettings();
                }
                break;
        }
    },
    
    // Обновление заголовка страницы
    updatePageTitle(page) {
        const titles = {
            'dashboard': 'Дашборд',
            'tasks': 'Задачи', 
            'analytics': 'Аналитика',
            'users': 'Пользователи',
            'settings': 'Настройки'
        };
        
        const pageTitle = document.querySelector('.page-title');
        if (pageTitle) {
            pageTitle.textContent = titles[page] || 'Task Manager';
        }
        
        // Обновляем title документа
        document.title = `${titles[page] || 'Task Manager'} - Task Manager`;
    },
    
    // Загрузка дашборда
    async loadDashboard() {
        try {
            // Загружаем статистику
            const stats = await StatsAPI.getBasic();
            this.updateDashboardStats(stats);
            
            // Загружаем последние задачи
            const tasks = await TasksAPI.getAll();
            this.updateRecentTasks(tasks.slice(0, 5));
            
        } catch (error) {
            console.error('Ошибка загрузки дашборда:', error);
            this.showNotification('Ошибка загрузки дашборда', 'error');
        }
    },
    
    // Обновление статистики на дашборде
    updateDashboardStats(stats) {
        const elements = {
            'totalTasks': stats.total || 0,
            'pendingTasks': stats.pending || 0,
            'activeTasks': stats.in_progress || 0,
            'completedTasks': stats.completed || 0
        };
        
        Object.keys(elements).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = elements[id];
            }
        });
    },
    
    // Обновление списка последних задач
    updateRecentTasks(tasks) {
        const container = document.getElementById('recentTasksList');
        if (!container) return;
        
        if (tasks.length === 0) {
            container.innerHTML = '<p class="text-light">Нет задач</p>';
            return;
        }
        
        container.innerHTML = tasks.map(task => `
            <div class="task-item-small">
                <div class="task-info">
                    <h4>${this.escapeHtml(task.title)}</h4>
                    <p class="task-assignee">Исполнитель: ${this.escapeHtml(task.assignee || 'Не назначен')}</p>
                </div>
                <span class="task-status ${this.getStatusClass(task.status)}">
                    ${this.getStatusText(task.status)}
                </span>
            </div>
        `).join('');
    },
    
    // Загрузка аналитики
    async loadAnalytics() {
        try {
            // Загружаем детальную статистику
            const detailed = await StatsAPI.getDetailed();
            this.renderDetailedStats(detailed);
            
            // Загружаем метрики производительности
            const performance = await StatsAPI.getPerformance();
            this.renderPerformanceMetrics(performance);
            
        } catch (error) {
            console.error('Ошибка загрузки аналитики:', error);
            this.showNotification('Ошибка загрузки аналитики', 'error');
        }
    },
    
    // Отрисовка детальной статистики
    renderDetailedStats(stats) {
        const container = document.getElementById('detailedStats');
        if (!container || !stats) return;
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${stats.totalTasks || 0}</div>
                    <div class="stat-label">Всего задач</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.completionRate || 0}%</div>
                    <div class="stat-label">Процент завершения</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.averageTime || 0}</div>
                    <div class="stat-label">Среднее время (ч)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.activeUsers || 0}</div>
                    <div class="stat-label">Активных пользователей</div>
                </div>
            </div>
        `;
    },
    
    // Отрисовка метрик производительности
    renderPerformanceMetrics(metrics) {
        const container = document.getElementById('performanceMetrics');
        if (!container || !metrics) return;
        
        container.innerHTML = `
            <div class="metrics-list">
                ${metrics.map(metric => `
                    <div class="metric-item">
                        <div class="metric-name">${this.escapeHtml(metric.name)}</div>
                        <div class="metric-value">${metric.value}</div>
                        <div class="metric-trend ${metric.trend}">${metric.trend}</div>
                    </div>
                `).join('')}
            </div>
        `;
    },
    
    // Утилиты
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    getStatusClass(status) {
        const classes = {
            'pending': 'pending',
            'in_progress': 'in-progress', 
            'review': 'review',
            'completed': 'completed',
            'revision': 'revision'
        };
        return classes[status] || 'pending';
    },
    
    getStatusText(status) {
        const texts = {
            'pending': 'Ожидает',
            'in_progress': 'В работе',
            'review': 'На проверке',
            'completed': 'Завершена',
            'revision': 'На доработке'
        };
        return texts[status] || 'Неизвестно';
    },
    
    // UI утилиты
    closeAllModals() {
        document.querySelectorAll('.modal.show').forEach(modal => {
            modal.classList.remove('show');
        });
    },
    
    showNotification(message, type = 'info') {
        // Простая реализация уведомлений
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // Создаем простое уведомление
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Добавляем стили для уведомления
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            transition: all 0.3s ease;
        `;
        
        // Цвета в зависимости от типа
        const colors = {
            'success': '#48bb78',
            'error': '#f56565',
            'warning': '#ed8936',
            'info': '#4299e1'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        
        document.body.appendChild(notification);
        
        // Убираем уведомление через 3 секунды
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
};

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Экспортируем App в глобальную область видимости для отладки
window.App = App;