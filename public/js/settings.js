/**
 * Модуль настроек системы
 * Отвечает за управление настройками бота, чата и системы
 */

const SettingsModule = {
    settings: {},
    botConnectionStatus: {
        isConnected: false,
        isChecking: false,
        lastCheck: null,
        botInfo: null,
        error: null
    },
    
    // Инициализация модуля
    init() {
        this.bindEvents();
        this.loadSettings();
        this.startBotMonitoring();
    },
    
    // Привязка событий
    bindEvents() {
        // Сохранение ID рабочего чата
        const saveChatBtn = document.getElementById('saveChatIdBtn');
        if (saveChatBtn) {
            saveChatBtn.addEventListener('click', () => this.saveWorkChatId());
        }
        
        // Проверка чата
        const checkChatBtn = document.getElementById('checkChatBtn');
        if (checkChatBtn) {
            checkChatBtn.addEventListener('click', () => this.checkWorkChatId());
        }
        
        // Сохранение токена бота
        const saveBotTokenBtn = document.getElementById('saveBotTokenBtn');
        if (saveBotTokenBtn) {
            saveBotTokenBtn.addEventListener('click', () => this.saveBotToken());
        }
        
        // Проверка статуса бота
        const checkBotBtn = document.getElementById('checkBotStatusBtn');
        if (checkBotBtn) {
            checkBotBtn.addEventListener('click', () => this.checkBotStatus());
        }
        
        // Тест уведомлений
        const testNotificationsBtn = document.getElementById('testNotificationsBtn');
        if (testNotificationsBtn) {
            testNotificationsBtn.addEventListener('click', () => this.testNotifications());
        }
        
        // Кнопка подключения к боту
        const connectBotBtn = document.getElementById('connectBotBtn');
        if (connectBotBtn) {
            connectBotBtn.addEventListener('click', () => this.connectToBot());
        }
        
        // Кнопка отключения бота
        const disconnectBotBtn = document.getElementById('disconnectBotBtn');
        if (disconnectBotBtn) {
            disconnectBotBtn.addEventListener('click', () => this.disconnectBot());
        }
        
        // Кнопка перезапуска бота
        const restartBotBtn = document.getElementById('restartBotBtn');
        if (restartBotBtn) {
            restartBotBtn.addEventListener('click', () => this.restartBot());
        }
    },
    
    // Загрузка настроек
    async loadSettings() {
        try {
            this.settings = await SettingsAPI.getAll();
            this.displaySettings();
            this.checkBotStatus(); // Проверяем статус бота при загрузке
        } catch (error) {
            console.error('Ошибка загрузки настроек:', error);
            this.showNotification('Ошибка загрузки настроек', 'error');
        }
    },
    
    // Отображение настроек в форме
    displaySettings() {
        // ID рабочего чата
        const workChatInput = document.getElementById('workChatId');
        if (workChatInput && this.settings.work_chat_id) {
            workChatInput.value = this.settings.work_chat_id.value || '';
        }
        
        // Токен бота - оставляем поле пустым для нового ввода
        const botTokenInput = document.getElementById('botToken');
        if (botTokenInput) {
            botTokenInput.value = '';
            botTokenInput.placeholder = 'Введите токен бота';
            botTokenInput.dataset.hasToken = this.settings.bot_token ? 'true' : 'false';
        }
        
        // Другие настройки
        this.displayOtherSettings();
    },
    
    // Отображение дополнительных настроек
    displayOtherSettings() {
        const container = document.getElementById('otherSettings');
        if (!container) return;
        
        const otherSettings = Object.keys(this.settings)
            .filter(key => !['work_chat_id', 'bot_token'].includes(key))
            .map(key => ({
                key,
                ...this.settings[key]
            }));
        
        if (otherSettings.length === 0) {
            container.innerHTML = '<p class="text-light">Дополнительных настроек нет</p>';
            return;
        }
        
        container.innerHTML = otherSettings.map(setting => `
            <div class="setting-item">
                <div class="setting-info">
                    <strong>${this.escapeHtml(setting.key)}</strong>
                    <p class="setting-description">${this.escapeHtml(setting.description || '')}</p>
                </div>
                <div class="setting-value">
                    <input type="text" 
                           class="form-input" 
                           value="${this.escapeHtml(setting.value || '')}"
                           onchange="SettingsModule.updateSetting('${setting.key}', this.value)">
                </div>
            </div>
        `).join('');
    },
    
    // Сохранение ID рабочего чата
    async saveWorkChatId() {
        const input = document.getElementById('workChatId');
        if (!input) {
            this.showNotification('Поле ID чата не найдено', 'error');
            return;
        }
        
        const chatId = input.value.trim();
        
        // Проверяем, введен ли ID чата
        if (!chatId) {
            this.showNotification('Введите ID чата', 'warning');
            input.focus();
            return;
        }
        
        // Валидация ID чата (должен начинаться с - для групп или быть числом для приватных чатов)
        if (!chatId.match(/^-?\d+$/)) {
            this.showNotification('Неверный формат ID чата. Используйте числовой ID (например: -1001234567890)', 'error');
            input.focus();
            return;
        }
        
        // Блокируем кнопку на время сохранения
        const saveBtn = document.getElementById('saveChatIdBtn');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Сохранение...';
        }
        
        try {
            await SettingsAPI.save('work_chat_id', chatId);
            this.showNotification('ID рабочего чата сохранен', 'success');
            
            // Обновляем настройки
            await this.loadSettings();
            
            // Автоматически проверяем чат после сохранения
            setTimeout(() => this.checkWorkChatId(), 1000);
            
        } catch (error) {
            console.error('Ошибка сохранения ID чата:', error);
            this.showNotification('Ошибка сохранения ID чата: ' + error.message, 'error');
        } finally {
            // Разблокируем кнопку
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Сохранить';
            }
        }
    },
    
    // Проверка рабочего чата
    async checkWorkChatId() {
        // Блокируем кнопку проверки на время выполнения
        const checkBtn = document.getElementById('checkChatBtn');
        if (checkBtn) {
            checkBtn.disabled = true;
            checkBtn.textContent = 'Проверка...';
        }
        
        try {
            const chatInfo = await SettingsAPI.getChatInfo();
            
            const statusElement = document.getElementById('chatStatus');
            const infoElement = document.getElementById('chatInfo');
            
            if (statusElement) {
                statusElement.innerHTML = `
                    <span class="text-success">✓ Подключен к "${this.escapeHtml(chatInfo.chat.title)}"</span>
                `;
            }
            
            if (infoElement) {
                infoElement.innerHTML = `
                    <div class="chat-info-card">
                        <div class="d-flex align-center gap-3 mb-3">
                            <div class="chat-avatar">💬</div>
                            <div>
                                <h4 class="mb-1">${this.escapeHtml(chatInfo.chat.title)}</h4>
                                <p class="text-light mb-0">ID: ${chatInfo.chat.id}</p>
                            </div>
                        </div>
                        
                        <div class="chat-details">
                            <div class="detail-row">
                                <strong>Тип чата:</strong> ${this.getChatTypeText(chatInfo.chat.type)}
                            </div>
                            <div class="detail-row">
                                <strong>Участников:</strong> ${chatInfo.chat.members_count}
                            </div>
                            ${chatInfo.chat.description ? `
                                <div class="detail-row">
                                    <strong>Описание:</strong> ${this.escapeHtml(chatInfo.chat.description)}
                                </div>
                            ` : ''}
                            <div class="detail-row">
                                <strong>Последняя проверка:</strong> 
                                <span class="text-light">${this.formatTime(new Date())}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            // Показываем уведомление об успешном подключении
            this.showNotification(`Подключен к чату "${chatInfo.chat.title}"`, 'success');
            
        } catch (error) {
            console.error('Ошибка проверки чата:', error);
            
            const statusElement = document.getElementById('chatStatus');
            const infoElement = document.getElementById('chatInfo');
            
            if (statusElement) {
                statusElement.innerHTML = `
                    <span class="text-danger">✗ Ошибка подключения</span>
                `;
            }
            
            if (infoElement) {
                infoElement.innerHTML = `
                    <div class="chat-error-card">
                        <div class="d-flex align-center gap-2 mb-2">
                            <span class="text-danger">⚠️</span>
                            <strong>Ошибка подключения к чату</strong>
                        </div>
                        <p class="text-danger mb-2">${this.escapeHtml(error.message)}</p>
                        <div class="chat-troubleshooting">
                            <p class="text-light mb-2">Возможные причины:</p>
                            <ul class="text-light">
                                <li>Неверный ID чата</li>
                                <li>Бот не добавлен в чат</li>
                                <li>Бот не имеет прав в чате</li>
                                <li>Чат не существует или удален</li>
                            </ul>
                        </div>
                    </div>
                `;
            }
            
            this.showNotification('Ошибка подключения к чату: ' + error.message, 'error');
        } finally {
            // Разблокируем кнопку
            if (checkBtn) {
                checkBtn.disabled = false;
                checkBtn.textContent = 'Проверить чат';
            }
        }
    },
    
    // Сохранение токена бота
    async saveBotToken() {
        const input = document.getElementById('botToken');
        if (!input) return;
        
        const token = input.value.trim();
        
        // Если поле содержит замаскированный токен, не сохраняем
        if (token.startsWith('•')) {
            this.showNotification('Введите новый токен бота', 'warning');
            return;
        }
        
        if (!token) {
            this.showNotification('Введите токен бота', 'warning');
            return;
        }
        
        // Базовая валидация токена Telegram Bot
        if (!token.match(/^\d+:[A-Za-z0-9_-]{35}$/)) {
            this.showNotification('Неверный формат токена бота', 'error');
            return;
        }
        
        try {
            await SettingsAPI.save('bot_token', token);
            this.showNotification('Токен бота сохранен', 'success');
            this.loadSettings();
            
            // Автоматически проверяем статус бота после сохранения
            setTimeout(() => this.checkBotStatus(), 1000);
        } catch (error) {
            console.error('Ошибка сохранения токена:', error);
            this.showNotification('Ошибка сохранения токена', 'error');
        }
    },
    
    // Запуск мониторинга бота
    startBotMonitoring() {
        // Проверяем статус сразу
        this.checkBotStatus();
        
        // Автопроверка каждые 30 секунд
        setInterval(() => {
            if (!this.botConnectionStatus.isChecking) {
                this.checkBotStatus();
            }
        }, 30000);
    },
    
    // Проверка статуса бота
    async checkBotStatus() {
        if (this.botConnectionStatus.isChecking) {
            return; // Предотвращаем множественные проверки
        }
        
        this.botConnectionStatus.isChecking = true;
        this.updateBotStatusDisplay('checking');
        
        try {
            const status = await BotAPI.getStatus();
            
            // Обновляем состояние подключения
            this.botConnectionStatus.isConnected = status.isRunning;
            this.botConnectionStatus.botInfo = status.botData;
            this.botConnectionStatus.error = status.isRunning ? null : status.error;
            this.botConnectionStatus.lastCheck = new Date();
            
            if (status.isRunning) {
                this.updateBotStatusDisplay('connected', status.botData);
                this.enableBotControls();
            } else {
                this.updateBotStatusDisplay('disconnected', null, status.botInfo || status.error);
                this.disableBotControls();
            }
            
        } catch (error) {
            console.error('Ошибка проверки статуса бота:', error);
            
            this.botConnectionStatus.isConnected = false;
            this.botConnectionStatus.error = error.message;
            this.botConnectionStatus.lastCheck = new Date();
            
            this.updateBotStatusDisplay('error', null, error.message);
            this.disableBotControls();
        } finally {
            this.botConnectionStatus.isChecking = false;
        }
    },
    
    // Обновление отображения статуса бота
    updateBotStatusDisplay(status, botData = null, errorMessage = null) {
        const statusElement = document.getElementById('botStatus');
        const infoElement = document.getElementById('botInfo');
        
        if (statusElement) {
            switch (status) {
                case 'checking':
                    statusElement.innerHTML = '<span class="text-warning">⏳ Проверка подключения...</span>';
                    break;
                case 'connected':
                    statusElement.innerHTML = '<span class="text-success">✅ Подключен и работает</span>';
                    break;
                case 'disconnected':
                    statusElement.innerHTML = '<span class="text-danger">❌ Не подключен</span>';
                    break;
                case 'error':
                    statusElement.innerHTML = '<span class="text-danger">⚠️ Ошибка подключения</span>';
                    break;
            }
        }
        
        if (infoElement) {
            if (status === 'connected' && botData) {
                infoElement.innerHTML = `
                    <div class="bot-info-card">
                        <div class="d-flex align-center gap-3 mb-3">
                            <div class="bot-avatar">🤖</div>
                            <div>
                                <h4 class="mb-1">@${this.escapeHtml(botData.username)}</h4>
                                <p class="text-light mb-0">${this.escapeHtml(botData.first_name)}</p>
                            </div>
                        </div>
                        
                        <div class="bot-details">
                            <div class="detail-row">
                                <strong>ID бота:</strong> ${botData.id}
                            </div>
                            <div class="detail-row">
                                <strong>Может вступать в группы:</strong> 
                                <span class="${botData.can_join_groups ? 'text-success' : 'text-danger'}">
                                    ${botData.can_join_groups ? '✅ Да' : '❌ Нет'}
                                </span>
                            </div>
                            <div class="detail-row">
                                <strong>Читает все сообщения:</strong> 
                                <span class="${botData.can_read_all_group_messages ? 'text-success' : 'text-warning'}">
                                    ${botData.can_read_all_group_messages ? '✅ Да' : '⚠️ Нет'}
                                </span>
                            </div>
                            <div class="detail-row">
                                <strong>Последняя проверка:</strong> 
                                <span class="text-light">${this.formatTime(this.botConnectionStatus.lastCheck)}</span>
                            </div>
                        </div>
                        
                        <div id="botActions" class="mt-3">
                            <button id="disconnectBotBtn" class="btn btn-danger btn-sm">Отключить</button>
                            <button id="restartBotBtn" class="btn btn-warning btn-sm">Перезапустить</button>
                            <button id="testNotificationsBtn" class="btn btn-info btn-sm">Тест уведомлений</button>
                        </div>
                    </div>
                `;
            } else if (status === 'error' && errorMessage) {
                infoElement.innerHTML = `
                    <div class="bot-error-card">
                        <div class="d-flex align-center gap-2 mb-2">
                            <span class="text-danger">⚠️</span>
                            <strong>Ошибка подключения</strong>
                        </div>
                        <p class="text-danger mb-2">${this.escapeHtml(errorMessage)}</p>
                        <div class="bot-troubleshooting">
                            <p class="text-light mb-2">Возможные причины:</p>
                            <ul class="text-light">
                                <li>Неверный токен бота</li>
                                <li>Бот заблокирован или отключен</li>
                                <li>Проблемы с сетевым подключением</li>
                                <li>API Telegram недоступно</li>
                            </ul>
                        </div>
                        
                        <div id="botActions" class="mt-3">
                            <button id="connectBotBtn" class="btn btn-success btn-sm">Подключить заново</button>
                            <button id="checkBotStatusBtn" class="btn btn-secondary btn-sm">Проверить статус</button>
                        </div>
                    </div>
                `;
            } else {
                infoElement.innerHTML = `
                    <div class="bot-disconnected-card">
                        <div class="d-flex align-center gap-2 mb-2">
                            <span class="text-warning">⚠️</span>
                            <strong>Бот не подключен</strong>
                        </div>
                        <p class="text-light mb-2">Для работы системы необходимо подключить Telegram бота</p>
                        <div class="bot-setup-steps">
                            <p class="text-light mb-2">Шаги для подключения:</p>
                            <ol class="text-light">
                                <li>Получите токен от @BotFather</li>
                                <li>Введите токен в поле выше</li>
                                <li>Нажмите "Подключить бота"</li>
                            </ol>
                        </div>
                        
                        <div id="botActions" class="mt-3">
                            <button id="connectBotBtn" class="btn btn-success btn-sm">Подключить бота</button>
                            <button id="checkBotStatusBtn" class="btn btn-secondary btn-sm">Проверить статус</button>
                        </div>
                    </div>
                `;
            }
        }
        
        // Перепривязываем события после обновления HTML
        this.rebindBotControlEvents();
    },
    
    // Перепривязка событий для кнопок управления ботом
    rebindBotControlEvents() {
        const connectBtn = document.getElementById('connectBotBtn');
        const disconnectBtn = document.getElementById('disconnectBotBtn');
        const restartBtn = document.getElementById('restartBotBtn');
        const testBtn = document.getElementById('testNotificationsBtn');
        const checkBtn = document.getElementById('checkBotStatusBtn');
        
        if (connectBtn) {
            connectBtn.addEventListener('click', () => this.connectToBot());
        }
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => this.disconnectBot());
        }
        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.restartBot());
        }
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testNotifications());
        }
        if (checkBtn) {
            checkBtn.addEventListener('click', () => this.checkBotStatus());
        }
    },
    
    // Подключение к боту
    async connectToBot() {
        const input = document.getElementById('botToken');
        if (!input) {
            this.showNotification('Поле токена не найдено', 'error');
            return;
        }
        
        const token = input.value.trim();
        
        // Проверяем, введен ли токен
        if (!token) {
            this.showNotification('Введите токен бота', 'warning');
            input.focus();
            return;
        }
        
        // Валидация токена
        if (!token.match(/^\d+:[A-Za-z0-9_-]{35}$/)) {
            this.showNotification('Неверный формат токена. Формат: 123456789:ABC-DEF1234567890...', 'error');
            input.focus();
            return;
        }
        
        // Блокируем кнопку на время подключения
        const connectBtn = document.getElementById('connectBotBtn');
        if (connectBtn) {
            connectBtn.disabled = true;
            connectBtn.textContent = 'Подключение...';
        }
        
        this.updateBotStatusDisplay('checking');
        
        try {
            // Сохраняем токен
            await SettingsAPI.save('bot_token', token);
            
            // Перезагружаем настройки
            await this.loadSettings();
            
            // Проверяем подключение
            await this.checkBotStatus();
            
            if (this.botConnectionStatus.isConnected && this.botConnectionStatus.botInfo) {
                const botName = this.botConnectionStatus.botInfo.username 
                    ? `@${this.botConnectionStatus.botInfo.username}` 
                    : this.botConnectionStatus.botInfo.first_name;
                this.showNotification(`Бот ${botName} успешно подключен!`, 'success');
                input.value = ''; // Очищаем поле только при успешном подключении
                input.placeholder = 'Токен сохранен';
            } else {
                this.showNotification('Не удалось подключиться к боту. Проверьте токен.', 'error');
                this.updateBotStatusDisplay('error', null, 'Неверный токен или бот недоступен');
                // Возвращаем токен в поле при ошибке
                input.value = token;
            }
            
        } catch (error) {
            console.error('Ошибка подключения к боту:', error);
            this.showNotification('Ошибка подключения к боту: ' + error.message, 'error');
            this.updateBotStatusDisplay('error', null, error.message);
            // Возвращаем токен в поле при ошибке
            input.value = token;
        } finally {
            // Разблокируем кнопку
            if (connectBtn) {
                connectBtn.disabled = false;
                connectBtn.textContent = 'Подключить бота';
            }
        }
    },
    
    // Отключение бота
    async disconnectBot() {
        if (!confirm('Отключить бота? Это остановит все уведомления и команды.')) {
            return;
        }
        
        try {
            await BotAPI.stop();
            this.botConnectionStatus.isConnected = false;
            this.updateBotStatusDisplay('disconnected');
            this.showNotification('Бот отключен', 'success');
        } catch (error) {
            console.error('Ошибка отключения бота:', error);
            this.showNotification('Ошибка отключения бота', 'error');
        }
    },
    
    // Перезапуск бота
    async restartBot() {
        if (!confirm('Перезапустить бота? Это может занять несколько секунд.')) {
            return;
        }
        
        try {
            this.updateBotStatusDisplay('checking');
            
            // Останавливаем бота
            await BotAPI.stop();
            
            // Ждем немного
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Запускаем заново
            await this.connectToBot();
            
        } catch (error) {
            console.error('Ошибка перезапуска бота:', error);
            this.showNotification('Ошибка перезапуска бота', 'error');
        }
    },
    
    // Валидация токена бота
    validateBotToken() {
        const input = document.getElementById('botToken');
        if (!input) return false;
        
        const token = input.value.trim();
        
        // Если поле пустое или содержит замаскированный токен, используем сохраненный токен
        if (!token || token.startsWith('•')) {
            if (this.settings.bot_token && this.settings.bot_token.value) {
                return true; // Используем сохраненный токен
            } else {
                this.showNotification('Введите токен бота', 'warning');
                input.focus();
                input.value = '';
                return false;
            }
        }
        
        // Базовая валидация токена Telegram Bot
        if (!token.match(/^\d+:[A-Za-z0-9_-]{35}$/)) {
            this.showNotification('Неверный формат токена. Формат: 123456:ABC-DEF...', 'error');
            input.focus();
            return false;
        }
        
        return true;
    },
    
    // Включение элементов управления ботом
    enableBotControls() {
        const elements = ['testNotificationsBtn', 'disconnectBotBtn', 'restartBotBtn'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.disabled = false;
                element.classList.remove('btn-secondary');
            }
        });
    },
    
    // Отключение элементов управления ботом
    disableBotControls() {
        const elements = ['testNotificationsBtn', 'disconnectBotBtn', 'restartBotBtn'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.disabled = true;
                element.classList.add('btn-secondary');
            }
        });
    },
    
    // Тест уведомлений
    async testNotifications() {
        if (!this.botConnectionStatus.isConnected) {
            this.showNotification('Сначала подключите бота', 'warning');
            return;
        }
        
        try {
            const result = await BotAPI.testNotifications();
            this.showNotification('Тестовое уведомление отправлено в чат', 'success');
        } catch (error) {
            console.error('Ошибка отправки тестового уведомления:', error);
            this.showNotification('Ошибка отправки уведомления', 'error');
        }
    },
    
    // Форматирование времени
    formatTime(date) {
        if (!date) return 'Никогда';
        
        try {
            return new Date(date).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
        } catch {
            return 'Неизвестно';
        }
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
    
    // Получение статуса подключения бота
    getBotConnectionStatus() {
        return {
            ...this.botConnectionStatus,
            isHealthy: this.botConnectionStatus.isConnected && !this.botConnectionStatus.error
        };
    },
    
    // Обновление произвольной настройки
    async updateSetting(key, value) {
        try {
            await SettingsAPI.save(key, value);
            this.showNotification(`Настройка "${key}" обновлена`, 'success');
        } catch (error) {
            console.error('Ошибка обновления настройки:', error);
            this.showNotification('Ошибка обновления настройки', 'error');
            this.loadSettings(); // Возвращаем к исходному значению
        }
    },
    
    // Экспорт настроек
    exportSettings() {
        const exportData = {
            settings: this.settings,
            exported_at: new Date().toISOString(),
            version: '1.0'
        };
        
        // Исключаем чувствительные данные
        if (exportData.settings.bot_token) {
            delete exportData.settings.bot_token;
        }
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `task-manager-settings-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Настройки экспортированы', 'success');
    },
    
    // Импорт настроек
    async importSettings(file) {
        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            
            if (!importData.settings) {
                throw new Error('Неверный формат файла настроек');
            }
            
            // Импортируем каждую настройку
            for (const [key, setting] of Object.entries(importData.settings)) {
                if (key !== 'bot_token') { // Не импортируем токен из соображений безопасности
                    await SettingsAPI.save(key, setting.value);
                }
            }
            
            this.showNotification('Настройки импортированы', 'success');
            this.loadSettings();
        } catch (error) {
            console.error('Ошибка импорта настроек:', error);
            this.showNotification('Ошибка импорта настроек', 'error');
        }
    },
    
    // Сброс настроек
    async resetSettings() {
        if (!confirm('Сбросить все настройки? Это действие нельзя отменить!')) {
            return;
        }
        
        try {
            // Удаляем все настройки кроме критически важных
            const keysToReset = Object.keys(this.settings).filter(key => 
                !['bot_token', 'work_chat_id'].includes(key)
            );
            
            for (const key of keysToReset) {
                await SettingsAPI.save(key, '');
            }
            
            this.showNotification('Настройки сброшены', 'success');
            this.loadSettings();
        } catch (error) {
            console.error('Ошибка сброса настроек:', error);
            this.showNotification('Ошибка сброса настроек', 'error');
        }
    },
    
    // Вспомогательные методы
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },
    
    showNotification(message, type = 'info') {
        // Удаляем предыдущие уведомления того же типа
        const existingNotifications = document.querySelectorAll(`.notification-${type}`);
        existingNotifications.forEach(notif => {
            if (notif.parentNode) {
                notif.parentNode.removeChild(notif);
            }
        });
        
        // Создаем уведомление в стиле приложения
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Иконки для разных типов
        const icons = {
            'success': '✅',
            'error': '❌', 
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        
        notification.innerHTML = `
            <span class="notification-icon">${icons[type] || icons.info}</span>
            <span class="notification-message">${this.escapeHtml(message)}</span>
            <button class="notification-close">&times;</button>
        `;
        
        // Добавляем стили
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            min-width: 300px;
            max-width: 500px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
            transform: translateX(100%);
        `;
        
        // Цвета в зависимости от типа
        const colors = {
            'success': '#48bb78',
            'error': '#f56565',
            'warning': '#ed8936',
            'info': '#4299e1'
        };
        notification.style.backgroundColor = colors[type] || colors.info;
        
        // Стили для кнопки закрытия
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.style.cssText = `
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                margin-left: auto;
                opacity: 0.8;
            `;
            closeBtn.addEventListener('click', () => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            });
            closeBtn.addEventListener('mouseenter', () => closeBtn.style.opacity = '1');
            closeBtn.addEventListener('mouseleave', () => closeBtn.style.opacity = '0.8');
        }
        
        document.body.appendChild(notification);
        
        // Анимация появления
        requestAnimationFrame(() => {
            notification.style.transform = 'translateX(0)';
        });
        
        // Автоматическое скрытие через 4 секунды
        const hideTimeout = setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 4000);
        
        // Сохраняем ссылку на таймер для возможной отмены
        notification.hideTimeout = hideTimeout;
        
        // Логируем в консоль для отладки
        console.log(`[SETTINGS ${type.toUpperCase()}] ${message}`);
    }
};