/**
 * Модуль для управления задачами
 * Отвечает за отображение, создание, редактирование и управление задачами
 */

// Состояние модуля задач
const TasksModule = {
    tasks: [],
    currentFilter: 'all',
    
    // Инициализация модуля
    init() {
        this.bindEvents();
        this.loadTasks();
    },
    
    // Привязка событий
    bindEvents() {
        // Кнопки фильтрации
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });
        
        // Кнопка создания задачи
        const createBtn = document.getElementById('createTaskBtn');
        if (createBtn) {
            createBtn.addEventListener('click', () => this.openCreateModal());
        }
        
        // Форма создания задачи
        const taskForm = document.getElementById('taskForm');
        if (taskForm) {
            taskForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }
    },
    
    // Загрузка задач с сервера
    async loadTasks() {
        try {
            this.tasks = await TasksAPI.getAll();
            this.renderTasks();
            this.updateStats();
        } catch (error) {
            console.error('Ошибка загрузки задач:', error);
            this.showNotification('Ошибка загрузки задач', 'error');
        }
    },
    
    // Отрисовка списка задач
    renderTasks() {
        const container = document.getElementById('tasksList');
        if (!container) return;
        
        const filteredTasks = this.getFilteredTasks();
        
        if (filteredTasks.length === 0) {
            container.innerHTML = `
                <div class="text-center p-5 text-light">
                    <p>Задач не найдено</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = filteredTasks.map(task => this.renderTaskCard(task)).join('');
        
        // Привязываем события к кнопкам задач
        this.bindTaskEvents();
    },
    
    // Отрисовка карточки задачи
    renderTaskCard(task) {
        const statusClass = this.getStatusClass(task.status);
        const statusText = this.getStatusText(task.status);
        
        return `
            <div class="task-card" data-task-id="${task.id}">
                <div class="task-header">
                    <h3 class="task-title">${this.escapeHtml(task.title)}</h3>
                    <span class="task-status ${statusClass}">${statusText}</span>
                </div>
                
                <div class="task-meta">
                    <span>Исполнитель: ${this.escapeHtml(task.assignee_username || 'Не назначен')}</span>
                    <span>Дедлайн: ${this.formatDate(task.deadline)}</span>
                    ${task.estimated_time ? `<span>Время: ${task.estimated_time} ч</span>` : ''}
                </div>
                
                <div class="task-description">
                    ${this.escapeHtml(task.description || '')}
                </div>
                
                <div class="task-actions">
                    ${this.renderTaskActions(task)}
                </div>
            </div>
        `;
    },
    
    // Отрисовка действий для задачи
    renderTaskActions(task) {
        const actions = [];
        
        // Базовые действия
        actions.push(`<button class="btn btn-sm btn-secondary" onclick="TasksModule.editTask('${task.id}')">Изменить</button>`);
        
        // Действия в зависимости от статуса
        switch (task.status) {
            case 'pending':
                actions.push(`<button class="btn btn-sm btn-info" onclick="TasksModule.startTask('${task.id}')">Начать</button>`);
                break;
            case 'in_progress':
                actions.push(`<button class="btn btn-sm btn-warning" onclick="TasksModule.submitForReview('${task.id}')">На проверку</button>`);
                break;
            case 'review':
                actions.push(`<button class="btn btn-sm btn-success" onclick="TasksModule.approveTask('${task.id}')">Одобрить</button>`);
                actions.push(`<button class="btn btn-sm btn-danger" onclick="TasksModule.rejectTask('${task.id}')">Отклонить</button>`);
                break;
            case 'revision':
                actions.push(`<button class="btn btn-sm btn-info" onclick="TasksModule.returnToWork('${task.id}')">В работу</button>`);
                break;
        }
        
        if (task.status !== 'completed') {
            actions.push(`<button class="btn btn-sm btn-success" onclick="TasksModule.completeTask('${task.id}')">Завершить</button>`);
        }
        
        actions.push(`<button class="btn btn-sm btn-danger" onclick="TasksModule.deleteTask('${task.id}')">Удалить</button>`);
        
        return actions.join('');
    },
    
    // Привязка событий к элементам задач
    bindTaskEvents() {
        // События уже привязаны через onclick в HTML
        // Можно добавить дополнительные события здесь
    },
    
    // Фильтрация задач
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Обновляем активный таб
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.filter === filter);
        });
        
        this.renderTasks();
    },
    
    // Получение отфильтрованных задач
    getFilteredTasks() {
        if (this.currentFilter === 'all') {
            return this.tasks;
        }
        return this.tasks.filter(task => task.status === this.currentFilter);
    },
    
    // Открытие модального окна создания задачи
    async openCreateModal() {
        this.resetTaskForm();
        await this.loadUsersForSelect();
        this.showModal('taskModal');
    },
    
    // Открытие модального окна редактирования
    async editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;
        
        await this.loadUsersForSelect();
        this.fillTaskForm(task);
        this.showModal('taskModal');
    },
    
    // Загрузка пользователей для выбора исполнителя
    async loadUsersForSelect() {
        try {
            const users = await UsersAPI.getAll();
            const select = document.getElementById('taskAssignee');
            
            // Очищаем select
            select.innerHTML = '<option value="">Выберите исполнителя...</option>';
            
            // Добавляем пользователей
            users.forEach(user => {
                const option = document.createElement('option');
                const username = user.username ? `@${user.username.replace('@', '')}` : user.first_name;
                option.value = username;
                option.textContent = `${user.first_name || 'Без имени'} (${username})`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Ошибка загрузки пользователей:', error);
        }
    },
    
    // Заполнение формы данными задачи
    fillTaskForm(task) {
        document.getElementById('taskTitle').value = task.title || '';
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskAssignee').value = task.assignee_username || '';
        document.getElementById('taskDeadline').value = task.deadline || '';
        document.getElementById('taskEstimatedTime').value = task.estimated_time || '';
        document.getElementById('taskId').value = task.id || '';
    },
    
    // Сброс формы
    resetTaskForm() {
        document.getElementById('taskForm').reset();
        document.getElementById('taskId').value = '';
    },
    
    // Обработка отправки формы
    async handleSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const taskData = {
            title: formData.get('title'),
            description: formData.get('description'),
            assignee: formData.get('assignee'),
            deadline: formData.get('deadline'),
            estimated_time: formData.get('estimated_time') || 0
        };
        
        const taskId = formData.get('taskId');
        
        try {
            if (taskId) {
                await TasksAPI.update(taskId, taskData);
                this.showNotification('Задача обновлена', 'success');
            } else {
                const result = await TasksAPI.create(taskData);
                this.showNotification('Задача создана. Уведомление отправлено исполнителю.', 'success');
            }
            
            this.hideModal('taskModal');
            this.loadTasks();
        } catch (error) {
            console.error('Ошибка сохранения задачи:', error);
            this.showNotification('Ошибка сохранения задачи', 'error');
        }
    },
    
    // Завершение задачи
    async completeTask(taskId) {
        const confirmed = await ModalHelper.confirm(
            'Завершить задачу',
            'Вы уверены, что хотите завершить эту задачу?',
            'Завершить',
            'Отмена'
        );
        
        if (!confirmed) return;
        
        try {
            await TasksAPI.complete(taskId);
            this.showNotification('Задача завершена', 'success');
            this.loadTasks();
        } catch (error) {
            console.error('Ошибка завершения задачи:', error);
            this.showNotification('Ошибка завершения задачи', 'error');
        }
    },
    
    // Удаление задачи
    async deleteTask(taskId) {
        const confirmed = await ModalHelper.confirm(
            'Удалить задачу',
            'Вы уверены, что хотите удалить эту задачу? Это действие нельзя отменить.',
            'Удалить',
            'Отмена'
        );
        
        if (!confirmed) return;
        
        try {
            await TasksAPI.delete(taskId);
            this.showNotification('Задача удалена', 'success');
            this.loadTasks();
        } catch (error) {
            console.error('Ошибка удаления задачи:', error);
            this.showNotification('Ошибка удаления задачи', 'error');
        }
    },
    
    // Отправка на проверку
    async submitForReview(taskId) {
        try {
            await TasksAPI.submitForReview(taskId);
            this.showNotification('Задача отправлена на проверку', 'success');
            this.loadTasks();
        } catch (error) {
            console.error('Ошибка отправки на проверку:', error);
            this.showNotification('Ошибка отправки на проверку', 'error');
        }
    },
    
    // Одобрение задачи
    async approveTask(taskId) {
        const comment = await ModalHelper.prompt(
            'Одобрить задачу',
            'Комментарий к одобрению (необязательно):',
            'Отличная работа!',
            false
        );
        
        if (comment === null) return; // Пользователь отменил
        
        try {
            await TasksAPI.approve(taskId, comment || '');
            this.showNotification('Задача одобрена! Уведомление отправлено в чат.', 'success');
            this.loadTasks();
        } catch (error) {
            console.error('Ошибка одобрения задачи:', error);
            this.showNotification('Ошибка одобрения задачи: ' + error.message, 'error');
        }
    },
    
    // Отклонение задачи
    async rejectTask(taskId) {
        const comment = await ModalHelper.prompt(
            'Отклонить задачу',
            'Укажите причину отклонения (обязательно):',
            'Требуется доработка...',
            true
        );
        
        if (!comment) return; // Пользователь отменил или не ввел комментарий
        
        try {
            await TasksAPI.reject(taskId, comment);
            this.showNotification('Задача отклонена. Уведомление отправлено в чат.', 'success');
            this.loadTasks();
        } catch (error) {
            console.error('Ошибка отклонения задачи:', error);
            this.showNotification('Ошибка отклонения задачи: ' + error.message, 'error');
        }
    },
    
    // Возврат в работу
    async returnToWork(taskId) {
        try {
            await TasksAPI.update(taskId, { status: 'in_progress' });
            this.showNotification('Задача возвращена в работу', 'success');
            this.loadTasks();
        } catch (error) {
            console.error('Ошибка возврата задачи:', error);
            this.showNotification('Ошибка возврата задачи', 'error');
        }
    },
    
    // Обновление статистики
    updateStats() {
        const stats = {
            total: this.tasks.length,
            pending: this.tasks.filter(t => t.status === 'pending').length,
            in_progress: this.tasks.filter(t => t.status === 'in_progress').length,
            completed: this.tasks.filter(t => t.status === 'completed').length,
            review: this.tasks.filter(t => t.status === 'review').length
        };
        
        // Обновляем элементы статистики
        this.updateStatElement('totalTasks', stats.total);
        this.updateStatElement('pendingTasks', stats.pending);
        this.updateStatElement('activeTasks', stats.in_progress);
        this.updateStatElement('completedTasks', stats.completed);
    },
    
    // Обновление элемента статистики
    updateStatElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    },
    
    // Вспомогательные методы
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
    
    formatDate(dateString) {
        if (!dateString) return 'Не указан';
        
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('ru-RU');
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
    showModal(modalId) {
        ModalHelper.showModal(modalId);
    },
    
    hideModal(modalId) {
        ModalHelper.hideModal(modalId);
    },
    
    showNotification(message, type = 'info') {
        // Используем красивые уведомления
        NotificationHelper.show(message, type);
    }
};