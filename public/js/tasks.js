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
                    <h3 class="task-title" onclick="TasksModule.showTaskDetails('${task.id}')">${this.escapeHtml(task.title)}</h3>
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
                this.showNotification('Задача обновлена. Уведомление отправлено в Telegram.', 'success');
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
    },
    
    // Показать детальную информацию о задаче с inline-редактированием
    async showTaskDetails(taskId) {
        const task = this.tasks.find(t => t.id == taskId);
        if (!task) {
            this.showNotification('Задача не найдена', 'error');
            return;
        }
        
        // Сохраняем оригинальные данные для отслеживания изменений
        this.originalTaskData = {
            title: task.title || '',
            description: task.description || '',
            deadline: task.deadline || '',
            estimated_time: task.estimated_time || '',
            assignee_username: task.assignee_username || ''
        };
        this.currentTaskId = taskId;
        
        // Сбрасываем флаг setup для корректной привязки событий
        this.inlineEditingSetup = false;
        
        // Заполняем модальное окно данными задачи
        document.getElementById('taskDetailsTitle').textContent = `Задача #${task.id}`;
        
        // Заполняем редактируемые поля
        document.getElementById('detailTitle').textContent = task.title || '-';
        document.getElementById('editTitle').value = task.title || '';
        
        // Устанавливаем статус с правильным классом
        const statusElement = document.getElementById('detailStatus');
        const statusClass = this.getStatusClass(task.status);
        const statusText = this.getStatusText(task.status);
        statusElement.className = `task-status ${statusClass}`;
        statusElement.textContent = statusText;
        
        document.getElementById('detailAssignee').textContent = task.assignee_username || 'Не назначен';
        document.getElementById('detailDeadline').textContent = this.formatDate(task.deadline);
        document.getElementById('editDeadline').value = task.deadline || '';
        
        document.getElementById('detailEstimatedTime').textContent = task.estimated_time ? `${task.estimated_time} ч` : 'Не указано';
        document.getElementById('editEstimatedTime').value = task.estimated_time || '';
        
        document.getElementById('detailCreatedAt').textContent = this.formatDate(task.created_at);
        
        // Описание
        const descriptionElement = document.getElementById('detailDescription');
        const editDescriptionElement = document.getElementById('editDescription');
        if (task.description && task.description.trim()) {
            descriptionElement.innerHTML = this.escapeHtml(task.description).replace(/\n/g, '<br>');
        } else {
            descriptionElement.innerHTML = '<p class="text-light">Описание отсутствует</p>';
        }
        editDescriptionElement.value = task.description || '';
        
        // Загружаем пользователей для select исполнителя
        await this.loadUsersForAssigneeSelect();
        document.getElementById('editAssignee').value = task.assignee_username || '';
        
        // Комментарии к проверке
        const commentsSection = document.getElementById('detailCommentsSection');
        const commentsElement = document.getElementById('detailComments');
        if (task.review_comment && task.review_comment.trim()) {
            commentsSection.style.display = 'block';
            commentsElement.textContent = task.review_comment;
        } else {
            commentsSection.style.display = 'none';
        }
        
        // Загружаем и показываем историю изменений
        await this.loadTaskHistory(taskId);
        
        // Скрываем кнопку сохранения по умолчанию
        document.getElementById('saveTaskChanges').style.display = 'none';
        
        // Настраиваем inline-редактирование
        this.setupInlineEditing();
        
        // Показываем модальное окно
        this.showModal('taskDetailsModal');
    },
    
    // Загрузка пользователей для select исполнителя в детальном просмотре
    async loadUsersForAssigneeSelect() {
        try {
            const users = await UsersAPI.getAll();
            const select = document.getElementById('editAssignee');
            
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
            console.error('Ошибка загрузки пользователей для назначения:', error);
        }
    },
    
    // Настройка inline-редактирования
    setupInlineEditing() {
        // Используем делегирование событий и проверяем, не привязаны ли уже обработчики
        if (this.inlineEditingSetup) return;
        this.inlineEditingSetup = true;
        
        // Обработчики для заголовка
        const titleText = document.getElementById('detailTitle');
        const titleInput = document.getElementById('editTitle');
        
        titleText.onclick = () => this.startEdit('title');
        titleInput.onblur = () => this.endEdit('title');
        titleInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                titleInput.blur();
            } else if (e.key === 'Escape') {
                this.cancelEdit('title');
            }
        };
        titleInput.oninput = () => this.checkForChanges();
        
        // Обработчики для исполнителя
        const assigneeText = document.getElementById('detailAssignee');
        const assigneeSelect = document.getElementById('editAssignee');
        
        assigneeText.onclick = () => this.startEdit('assignee');
        assigneeSelect.onblur = () => this.endEdit('assignee');
        assigneeSelect.onchange = () => {
            this.endEdit('assignee');
            this.checkForChanges();
        };
        
        // Обработчики для дедлайна
        const deadlineText = document.getElementById('detailDeadline');
        const deadlineInput = document.getElementById('editDeadline');
        
        deadlineText.onclick = () => this.startEdit('deadline');
        deadlineInput.onblur = () => this.endEdit('deadline');
        deadlineInput.onchange = () => this.checkForChanges();
        
        // Обработчики для времени выполнения
        const timeText = document.getElementById('detailEstimatedTime');
        const timeInput = document.getElementById('editEstimatedTime');
        
        timeText.onclick = () => this.startEdit('estimatedTime');
        timeInput.onblur = () => this.endEdit('estimatedTime');
        timeInput.oninput = () => this.checkForChanges();
        
        // Обработчики для описания
        const descriptionText = document.getElementById('detailDescription');
        const descriptionTextarea = document.getElementById('editDescription');
        
        descriptionText.onclick = () => this.startEdit('description');
        descriptionTextarea.onblur = () => this.endEdit('description');
        descriptionTextarea.oninput = () => this.checkForChanges();
        
        // Обработчик кнопки сохранения
        const saveButton = document.getElementById('saveTaskChanges');
        saveButton.onclick = () => this.saveTaskChanges();
    },
    
    // Начать редактирование поля
    startEdit(field) {
        const textElement = document.getElementById(`detail${field.charAt(0).toUpperCase() + field.slice(1)}`);
        const inputElement = document.getElementById(`edit${field.charAt(0).toUpperCase() + field.slice(1)}`);
        
        // Особая обработка для времени выполнения
        if (field === 'estimatedTime') {
            const textEl = document.getElementById('detailEstimatedTime');
            const inputEl = document.getElementById('editEstimatedTime');
            textEl.style.display = 'none';
            inputEl.style.display = 'block';
            inputEl.focus();
            return;
        }
        
        textElement.style.display = 'none';
        inputElement.style.display = 'block';
        inputElement.focus();
        
        if (field === 'description') {
            // Для textarea устанавливаем курсор в конец
            inputElement.setSelectionRange(inputElement.value.length, inputElement.value.length);
        } else if (field === 'title') {
            // Для заголовка выделяем весь текст
            inputElement.select();
        }
    },
    
    // Закончить редактирование поля
    endEdit(field) {
        const textElement = document.getElementById(`detail${field.charAt(0).toUpperCase() + field.slice(1)}`);
        const inputElement = document.getElementById(`edit${field.charAt(0).toUpperCase() + field.slice(1)}`);
        
        // Особая обработка для разных полей
        if (field === 'estimatedTime') {
            const textEl = document.getElementById('detailEstimatedTime');
            const inputEl = document.getElementById('editEstimatedTime');
            const value = inputEl.value;
            textEl.textContent = value ? `${value} ч` : 'Не указано';
            textEl.style.display = 'block';
            inputEl.style.display = 'none';
            return;
        } else if (field === 'assignee') {
            const value = inputElement.value;
            textElement.textContent = value || 'Не назначен';
        } else if (field === 'deadline') {
            const value = inputElement.value;
            textElement.textContent = this.formatDate(value);
        } else if (field === 'description') {
            const value = inputElement.value;
            if (value && value.trim()) {
                textElement.innerHTML = this.escapeHtml(value).replace(/\n/g, '<br>');
            } else {
                textElement.innerHTML = '<p class="text-light">Описание отсутствует</p>';
            }
        } else {
            const value = inputElement.value;
            textElement.textContent = value || '-';
        }
        
        textElement.style.display = 'block';
        inputElement.style.display = 'none';
    },
    
    // Отменить редактирование поля
    cancelEdit(field) {
        const inputElement = document.getElementById(`edit${field.charAt(0).toUpperCase() + field.slice(1)}`);
        
        // Восстанавливаем оригинальное значение
        switch (field) {
            case 'title':
                inputElement.value = this.originalTaskData.title;
                break;
            case 'description':
                inputElement.value = this.originalTaskData.description;
                break;
            case 'deadline':
                inputElement.value = this.originalTaskData.deadline;
                break;
            case 'estimatedTime':
                inputElement.value = this.originalTaskData.estimated_time;
                break;
            case 'assignee':
                inputElement.value = this.originalTaskData.assignee_username;
                break;
        }
        
        this.endEdit(field);
        this.checkForChanges();
    },
    
    // Проверка изменений для показа кнопки сохранения
    checkForChanges() {
        if (!this.originalTaskData) {
            return;
        }
        
        const currentValues = {
            title: document.getElementById('editTitle').value,
            description: document.getElementById('editDescription').value,
            deadline: document.getElementById('editDeadline').value,
            estimated_time: document.getElementById('editEstimatedTime').value,
            assignee_username: document.getElementById('editAssignee').value
        };
        
        const hasChanges = 
            currentValues.title !== this.originalTaskData.title ||
            currentValues.description !== this.originalTaskData.description ||
            currentValues.deadline !== this.originalTaskData.deadline ||
            currentValues.estimated_time !== this.originalTaskData.estimated_time ||
            currentValues.assignee_username !== this.originalTaskData.assignee_username;
        
        const saveButton = document.getElementById('saveTaskChanges');
        if (saveButton) {
            saveButton.style.display = hasChanges ? 'inline-block' : 'none';
        }
    },
    
    // Сохранение изменений задачи
    async saveTaskChanges() {
        if (!this.currentTaskId) return;
        
        try {
            const taskData = {
                title: document.getElementById('editTitle').value,
                description: document.getElementById('editDescription').value,
                deadline: document.getElementById('editDeadline').value,
                estimated_time: document.getElementById('editEstimatedTime').value || 0,
                assignee: document.getElementById('editAssignee').value
            };
            
            await TasksAPI.update(this.currentTaskId, taskData);
            this.showNotification('Задача обновлена. Уведомление отправлено в Telegram.', 'success');
            
            // Обновляем оригинальные данные
            this.originalTaskData = {
                title: taskData.title,
                description: taskData.description,
                deadline: taskData.deadline,
                estimated_time: taskData.estimated_time,
                assignee_username: document.getElementById('editAssignee').value
            };
            
            // Скрываем кнопку сохранения
            document.getElementById('saveTaskChanges').style.display = 'none';
            
            // Перезагружаем задачи и историю
            this.loadTasks();
            await this.loadTaskHistory(this.currentTaskId);
            
        } catch (error) {
            console.error('Ошибка сохранения изменений:', error);
            this.showNotification('Ошибка сохранения изменений', 'error');
        }
    },

    // Загрузка истории изменений задачи
    async loadTaskHistory(taskId) {
        try {
            const history = await TasksAPI.getHistory(taskId);
            this.displayTaskHistory(history);
        } catch (error) {
            console.error('Ошибка загрузки истории:', error);
            // Показываем заглушку при ошибке
            this.displayTaskHistory([]);
        }
    },

    // Отображение истории изменений
    displayTaskHistory(history) {
        const historySection = document.getElementById('detailHistorySection');
        const historyElement = document.getElementById('detailHistory');
        
        historySection.style.display = 'block';
        
        if (history.length === 0) {
            historyElement.innerHTML = `
                <div class="history-item">
                    <div class="history-date">${new Date().toLocaleDateString('ru-RU')}</div>
                    <div class="history-change">Задача создана</div>
                </div>
                <p class="text-light mt-3">История изменений пуста</p>
            `;
            return;
        }

        const historyHTML = history.map(item => {
            const fieldNames = {
                'title': 'Название',
                'description': 'Описание', 
                'deadline': 'Дедлайн',
                'assignee_username': 'Исполнитель'
            };
            
            const fieldName = fieldNames[item.field_name] || item.field_name;
            const userName = item.first_name || item.username || 'Система';
            const changeDate = new Date(item.changed_at).toLocaleString('ru-RU');
            
            let changeText = `${fieldName}: изменено`;
            if (item.old_value && item.new_value) {
                changeText = `${fieldName}: "${item.old_value}" → "${item.new_value}"`;
            } else if (item.new_value) {
                changeText = `${fieldName}: установлено "${item.new_value}"`;
            } else if (item.old_value) {
                changeText = `${fieldName}: удалено "${item.old_value}"`;
            }

            return `
                <div class="history-item">
                    <div class="history-date">${changeDate}</div>
                    <div class="history-change">${changeText}</div>
                    <div class="history-user">Изменил: ${userName}</div>
                </div>
            `;
        }).join('');

        historyElement.innerHTML = historyHTML;
    }
};