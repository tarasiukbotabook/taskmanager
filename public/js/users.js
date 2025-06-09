/**
 * Модуль для управления пользователями
 * Отвечает за отображение пользователей, управление ролями и правами
 */

const UsersModule = {
    users: [],
    
    // Инициализация модуля
    init() {
        this.bindEvents();
        this.loadUsers();
    },
    
    // Привязка событий
    bindEvents() {
        // Кнопка обновления списка пользователей
        const refreshBtn = document.getElementById('refreshUsersBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshUsers());
        }
        
        // Кнопка добавления пользователя
        const addUserBtn = document.getElementById('addUserBtn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', () => this.openAddUserModal());
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
    
    // Обновление списка пользователей из Telegram
    async refreshUsers() {
        try {
            const result = await UsersAPI.refresh();
            this.showNotification(result.message, 'success');
            this.loadUsers();
        } catch (error) {
            console.error('Ошибка обновления пользователей:', error);
            this.showNotification('Ошибка обновления пользователей', 'error');
        }
    },
    
    // Отрисовка списка пользователей
    renderUsers() {
        const container = document.getElementById('usersList');
        if (!container) return;
        
        if (this.users.length === 0) {
            container.innerHTML = `
                <div class="text-center p-5 text-light">
                    <p>Пользователи не найдены</p>
                    <button class="btn btn-primary" onclick="UsersModule.refreshUsers()">
                        Обновить из Telegram
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.users.map(user => this.renderUserCard(user)).join('');
    },
    
    // Отрисовка карточки пользователя
    renderUserCard(user) {
        const roleClass = this.getRoleClass(user.role);
        const roleText = this.getRoleText(user.role);
        
        return `
            <div class="user-card" data-user-id="${user.user_id}">
                <div class="user-avatar">
                    ${this.getUserInitials(user.first_name, user.last_name)}
                </div>
                
                <div class="user-info">
                    <div class="user-name">
                        ${this.escapeHtml(user.first_name || '')} ${this.escapeHtml(user.last_name || '')}
                    </div>
                    <div class="user-meta">
                        <span class="user-username">@${this.escapeHtml(user.username || 'no_username')}</span>
                        <span class="user-role ${roleClass}">${roleText}</span>
                    </div>
                    <div class="user-stats">
                        <span>Очки: ${user.points || 0}</span>
                        <span>Баланс: ${user.balance || 0}</span>
                    </div>
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