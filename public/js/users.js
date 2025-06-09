/**
 * Модуль для управления пользователями
 * Отвечает за отображение пользователей, управление ролями и правами
 */

const UsersModule = {
    users: [],
    chatInfo: null,
    
    // Инициализация модуля
    init() {
        this.bindEvents();
        this.loadUsers();
        this.loadChatInfo();
    },
    
    // Привязка событий
    bindEvents() {
        // Кнопка обновления списка пользователей
        const refreshBtn = document.getElementById('refreshUsersBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshUsers());
        }
        
        // Кнопка запуска обработки команд /start
        const startPollingBtn = document.getElementById('startPollingBtn');
        if (startPollingBtn) {
            startPollingBtn.addEventListener('click', () => this.startBotPolling());
        }
        
        // Кнопка добавления пользователя
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => this.openAddUserModal());
        }
    },
    
    // Перепривязка событий после обновления HTML
    rebindEvents() {
        // Кнопка запуска polling
        const startPollingBtn = document.getElementById('startPollingBtn');
        if (startPollingBtn) {
            startPollingBtn.removeEventListener('click', this.startBotPolling);
            startPollingBtn.addEventListener('click', () => this.startBotPolling());
        }
    },
    
    // Загрузка пользователей
    async loadUsers() {
        try {
            this.users = await UsersAPI.getAll();
            this.renderUsers();
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
            this.showNotification('Ошибка загрузки пользователей', 'error');
        }
    },
    
    // Загрузка информации о чате
    async loadChatInfo() {
        try {
            this.chatInfo = await SettingsAPI.getChatInfo();
            this.updateChatInfoDisplay();
        } catch (error) {
            console.error('Ошибка загрузки информации о чате:', error);
            // Не показываем ошибку, так как чат может быть не настроен
        }
    },
    
    // Обновление списка пользователей из Telegram
    async refreshUsers() {
        const refreshBtn = document.getElementById('refreshUsersBtn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.textContent = 'Обновление...';
        }
        
        try {
            const result = await UsersAPI.refresh();
            
            // Обновляем информацию о чате если есть данные
            if (result.total_chat_members) {
                this.updateChatStats(result.total_chat_members, result.users_in_db);
            }
            
            // Обновляем список пользователей
            this.users = result.users || [];
            this.renderUsers();
            
            // Показываем краткое уведомление без назойливой информации
            this.showNotification(`Обновлено: ${this.users.length} пользователей`, 'success');
        } catch (error) {
            console.error('Ошибка обновления пользователей:', error);
            this.showNotification('Ошибка обновления пользователей: ' + error.message, 'error');
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.textContent = 'Обновить из Telegram';
            }
        }
    },
    
    // Запуск обработки команд /start
    async startBotPolling() {
        const startBtn = document.getElementById('startPollingBtn');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = 'Запуск...';
        }
        
        try {
            const result = await BotAPI.startPolling();
            
            if (result.success) {
                this.showNotification('Бот запущен! Участники чата могут написать /start боту для регистрации.', 'success');
                this.updatePollingStatus(true);
            } else {
                throw new Error('Не удалось запустить бот');
            }
            
        } catch (error) {
            console.error('Ошибка запуска бота:', error);
            this.showNotification('Ошибка запуска бота: ' + error.message, 'error');
        } finally {
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.textContent = 'Запустить бота';
            }
        }
    },
    
    // Обновление статуса polling
    updatePollingStatus(isActive) {
        const statusElement = document.getElementById('pollingStatus');
        if (statusElement) {
            statusElement.innerHTML = isActive 
                ? '<span class="text-success">🟢 Бот активен</span>'
                : '<span class="text-warning">🟡 Бот неактивен</span>';
        }
        
        const startBtn = document.getElementById('startPollingBtn');
        if (startBtn && isActive) {
            startBtn.style.display = 'none';
        }
    },
    
    // Обновление отображения информации о чате
    updateChatInfoDisplay() {
        const chatInfoElement = document.getElementById('chatInfo');
        if (chatInfoElement && this.chatInfo) {
            chatInfoElement.innerHTML = `
                <div class="chat-info-header">
                    <div class="chat-avatar">💬</div>
                    <div class="chat-details">
                        <h3>${this.escapeHtml(this.chatInfo.chat.title)}</h3>
                        <p class="text-light">ID: ${this.chatInfo.chat.id} • ${this.getChatTypeText(this.chatInfo.chat.type)}</p>
                    </div>
                </div>
            `;
        }
    },
    
    // Обновление статистики чата
    updateChatStats(totalMembers, usersInDb) {
        const statsElement = document.getElementById('chatStats');
        if (statsElement) {
            statsElement.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-number">${totalMembers}</span>
                        <span class="stat-label">Всего участников</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${usersInDb}</span>
                        <span class="stat-label">В системе</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${Math.round((usersInDb / totalMembers) * 100)}%</span>
                        <span class="stat-label">Активность</span>
                    </div>
                </div>
            `;
        }
    },
    
    // Отрисовка списка пользователей
    renderUsers() {
        const container = document.getElementById('usersList');
        if (!container) return;
        
        if (this.users.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <h3>Пользователи не найдены</h3>
                    <p class="text-light">
                        ${this.chatInfo 
                            ? `Участники чата "${this.chatInfo.chat.title}" должны написать /start боту для регистрации в системе.` 
                            : 'Сначала настройте чат в разделе "Настройки".'
                        }
                    </p>
                    
                    <div class="bot-info">
                        <div id="pollingStatus">
                            <span class="text-warning">🟡 Бот неактивен</span>
                        </div>
                        <p class="text-light">
                            Запустите бота, участники смогут написать ему /start для автоматической регистрации.
                        </p>
                        <div class="instructions">
                            <p class="text-light"><strong>Инструкция для участников:</strong></p>
                            <ol class="text-light">
                                <li>Найти бота в Telegram</li>
                                <li>Написать команду /start</li>
                                <li>Получить подтверждение регистрации</li>
                            </ol>
                        </div>
                    </div>
                    
                    <div class="action-buttons">
                        <button id="startPollingBtn" class="btn btn-success" onclick="UsersModule.startBotPolling()">
                            <span>🤖</span> Запустить бота
                        </button>
                        <button class="btn btn-primary" onclick="UsersModule.refreshUsers()">
                            <span>🔄</span> Обновить список
                        </button>
                    </div>
                </div>
            `;
            
            // Перепривязываем события для кнопок в пустом состоянии
            setTimeout(() => this.rebindEvents(), 100);
            return;
        }
        
        // Группируем пользователей по ролям
        const groupedUsers = this.groupUsersByRole();
        
        container.innerHTML = `
            <div class="users-header">
                <div class="users-summary">
                    <p class="text-light">Найдено ${this.users.length} зарегистрированных участников чата "${this.chatInfo?.chat?.title || 'Telegram'}"</p>
                </div>
                
                <div class="bot-controls">
                    <div id="pollingStatus" class="polling-status">
                        <span class="text-success">🟢 Бот активен</span>
                    </div>
                    <div class="action-buttons">
                        <button class="btn btn-primary btn-sm" onclick="UsersModule.refreshUsers()">
                            <span>🔄</span> Обновить список
                        </button>
                    </div>
                </div>
            </div>
            
            ${Object.keys(groupedUsers).map(role => `
                <div class="role-section">
                    <h4 class="role-header">${this.getRoleText(role)} (${groupedUsers[role].length})</h4>
                    <div class="users-grid">
                        ${groupedUsers[role].map(user => this.renderUserCard(user)).join('')}
                    </div>
                </div>
            `).join('')}
        `;
        
        // Перепривязываем события после обновления HTML
        this.rebindEvents();
    },
    
    // Группировка пользователей по ролям
    groupUsersByRole() {
        return this.users.reduce((groups, user) => {
            const role = user.role || 'executor';
            if (!groups[role]) {
                groups[role] = [];
            }
            groups[role].push(user);
            return groups;
        }, {});
    },
    
    // Отрисовка карточки пользователя
    renderUserCard(user) {
        const roleClass = this.getRoleClass(user.role);
        const roleText = this.getRoleText(user.role);
        const isFromChat = user.is_from_configured_chat;
        
        return `
            <div class="user-card ${isFromChat ? 'from-chat' : ''}" data-user-id="${user.user_id}">
                <div class="user-avatar">
                    ${this.getUserInitials(user.first_name, user.last_name)}
                    ${isFromChat ? '<span class="chat-badge">💬</span>' : ''}
                </div>
                
                <div class="user-info">
                    <div class="user-name">
                        ${this.escapeHtml(user.first_name || '')} ${this.escapeHtml(user.last_name || '')}
                        ${isFromChat ? '<span class="verified-badge">✓</span>' : ''}
                    </div>
                    <div class="user-meta">
                        <span class="user-username">@${this.escapeHtml(user.username || 'no_username')}</span>
                        <span class="user-role ${roleClass}">${roleText}</span>
                    </div>
                    <div class="user-stats">
                        <div class="stat-item">
                            <span class="stat-label">Очки:</span>
                            <span class="stat-value">${user.points || 0}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Баланс:</span>
                            <span class="stat-value">${user.balance || 0}</span>
                        </div>
                    </div>
                    ${isFromChat ? `
                        <div class="user-source">
                            <span class="source-badge">Участник чата "${this.chatInfo?.chat?.title || 'Telegram'}"</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="user-actions">
                    ${this.renderUserActions(user)}
                </div>
            </div>
        `;
    },
    
    // Отрисовка действий для пользователя
    renderUserActions(user) {
        const actions = [];
        
        // Управление ролями
        if (user.role !== 'admin') {
            actions.push(`
                <select class="form-select" onchange="UsersModule.updateUserRole('${user.user_id}', this.value)">
                    <option value="user" ${user.role === 'user' ? 'selected' : ''}>Пользователь</option>
                    <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>Модератор</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
                </select>
            `);
        } else {
            actions.push(`<span class="text-success font-weight-bold">Администратор</span>`);
        }
        
        // Дополнительные действия
        actions.push(`
            <button class="btn btn-sm btn-info" onclick="UsersModule.viewUserDetails('${user.user_id}')">
                Подробно
            </button>
        `);
        
        // Только для модераторов и админов
        if (user.role !== 'admin') {
            actions.push(`
                <button class="btn btn-sm btn-warning" onclick="UsersModule.resetUserStats('${user.user_id}')">
                    Сбросить
                </button>
            `);
        }
        
        return actions.join('');
    },
    
    // Обновление роли пользователя
    async updateUserRole(userId, newRole) {
        if (!confirm(`Изменить роль пользователя на "${this.getRoleText(newRole)}"?`)) {
            // Возвращаем обратно предыдущее значение
            this.renderUsers();
            return;
        }
        
        try {
            await UsersAPI.updateRole(userId, newRole);
            this.showNotification('Роль пользователя обновлена', 'success');
            this.loadUsers();
        } catch (error) {
            console.error('Ошибка обновления роли:', error);
            this.showNotification('Ошибка обновления роли', 'error');
            this.renderUsers(); // Возвращаем к исходному состоянию
        }
    },
    
    // Просмотр деталей пользователя
    viewUserDetails(userId) {
        const user = this.users.find(u => u.user_id === userId);
        if (!user) return;
        
        const modalContent = `
            <div class="user-details">
                <h3>Информация о пользователе</h3>
                
                <div class="detail-row">
                    <strong>ID:</strong> ${user.user_id}
                </div>
                
                <div class="detail-row">
                    <strong>Имя:</strong> ${this.escapeHtml(user.first_name || '')} ${this.escapeHtml(user.last_name || '')}
                </div>
                
                <div class="detail-row">
                    <strong>Username:</strong> @${this.escapeHtml(user.username || 'Не указан')}
                </div>
                
                <div class="detail-row">
                    <strong>Роль:</strong> ${this.getRoleText(user.role)}
                </div>
                
                <div class="detail-row">
                    <strong>Очки:</strong> ${user.points || 0}
                </div>
                
                <div class="detail-row">
                    <strong>Баланс:</strong> ${user.balance || 0}
                </div>
                
                <div class="detail-row">
                    <strong>Дата регистрации:</strong> ${this.formatDate(user.created_at)}
                </div>
                
                ${user.is_from_configured_chat ? '<div class="detail-row"><strong>Статус:</strong> Из рабочего чата</div>' : ''}
            </div>
        `;
        
        this.showInfoModal('Детали пользователя', modalContent);
    },
    
    // Сброс статистики пользователя
    async resetUserStats(userId) {
        if (!confirm('Сбросить статистику пользователя (очки и баланс)?')) return;
        
        try {
            // Этот API endpoint нужно будет добавить на сервер
            await UsersAPI.resetStats(userId);
            this.showNotification('Статистика пользователя сброшена', 'success');
            this.loadUsers();
        } catch (error) {
            console.error('Ошибка сброса статистики:', error);
            this.showNotification('Ошибка сброса статистики', 'error');
        }
    },
    
    // Открытие модального окна добавления пользователя
    openAddUserModal() {
        const modalContent = `
            <form id="addUserForm" onsubmit="UsersModule.handleAddUser(event)">
                <div class="form-group">
                    <label class="form-label">Telegram ID</label>
                    <input type="text" name="userId" class="form-input" required 
                           placeholder="Введите Telegram ID пользователя">
                </div>
                
                <div class="form-group">
                    <label class="form-label">Имя</label>
                    <input type="text" name="firstName" class="form-input" 
                           placeholder="Имя пользователя">
                </div>
                
                <div class="form-group">
                    <label class="form-label">Фамилия</label>
                    <input type="text" name="lastName" class="form-input" 
                           placeholder="Фамилия пользователя">
                </div>
                
                <div class="form-group">
                    <label class="form-label">Username</label>
                    <input type="text" name="username" class="form-input" 
                           placeholder="Без символа @">
                </div>
                
                <div class="form-group">
                    <label class="form-label">Роль</label>
                    <select name="role" class="form-select">
                        <option value="user">Пользователь</option>
                        <option value="moderator">Модератор</option>
                        <option value="admin">Администратор</option>
                    </select>
                </div>
                
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="UsersModule.hideModal('userModal')">
                        Отмена
                    </button>
                    <button type="submit" class="btn btn-primary">
                        Добавить пользователя
                    </button>
                </div>
            </form>
        `;
        
        this.showModal('Добавить пользователя', modalContent, 'userModal');
    },
    
    // Обработка добавления пользователя
    async handleAddUser(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const userData = {
            userId: formData.get('userId'),
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            username: formData.get('username'),
            role: formData.get('role')
        };
        
        try {
            // Этот API endpoint нужно будет добавить на сервер
            await UsersAPI.create(userData);
            this.showNotification('Пользователь добавлен', 'success');
            this.hideModal('userModal');
            this.loadUsers();
        } catch (error) {
            console.error('Ошибка добавления пользователя:', error);
            this.showNotification('Ошибка добавления пользователя', 'error');
        }
    },
    
    // Поиск пользователей
    searchUsers(query) {
        const filteredUsers = this.users.filter(user => {
            const searchText = `${user.first_name} ${user.last_name} ${user.username}`.toLowerCase();
            return searchText.includes(query.toLowerCase());
        });
        
        this.renderFilteredUsers(filteredUsers);
    },
    
    // Отрисовка отфильтрованных пользователей
    renderFilteredUsers(users) {
        const container = document.getElementById('usersList');
        if (!container) return;
        
        if (users.length === 0) {
            container.innerHTML = `
                <div class="text-center p-5 text-light">
                    <p>Пользователи не найдены</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = users.map(user => this.renderUserCard(user)).join('');
    },
    
    // Вспомогательные методы
    getRoleClass(role) {
        const classes = {
            'user': 'text-secondary',
            'moderator': 'text-warning',
            'admin': 'text-danger'
        };
        return classes[role] || 'text-secondary';
    },
    
    // Получение текста типа чата
    getChatTypeText(type) {
        const types = {
            'private': '👤 Приватный чат',
            'group': '👥 Группа', 
            'supergroup': '🏢 Супергруппа',
            'channel': '📢 Канал'
        };
        return types[type] || `❓ ${type}`;
    },
    
    getRoleText(role) {
        const texts = {
            'user': 'Пользователь',
            'moderator': 'Модератор', 
            'admin': 'Администратор'
        };
        return texts[role] || 'Пользователь';
    },
    
    getUserInitials(firstName, lastName) {
        const first = (firstName || '').charAt(0).toUpperCase();
        const last = (lastName || '').charAt(0).toUpperCase();
        return first + last || '??';
    },
    
    formatDate(dateString) {
        if (!dateString) return 'Не указана';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    // UI утилиты
    showModal(title, content, modalId = 'userModal') {
        // Создаем модальное окно если его нет
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('div');
            modal.id = modalId;
            modal.className = 'modal';
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${title}</h3>
                    <button class="close-btn" onclick="UsersModule.hideModal('${modalId}')">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        
        modal.classList.add('show');
    },
    
    showInfoModal(title, content) {
        this.showModal(title, content + `
            <div class="form-actions">
                <button class="btn btn-primary" onclick="UsersModule.hideModal('userModal')">
                    Закрыть
                </button>
            </div>
        `);
    },
    
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
        }
    },
    
    showNotification(message, type = 'info') {
        // Простая реализация уведомлений
        alert(message);
        // TODO: Заменить на красивые уведомления
    }
};