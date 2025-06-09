const TelegramBot = require('node-telegram-bot-api');
// Используем новый unified database interface
const { createDatabase } = require('./src/database');

// Инициализация единой базы данных
let db;
try {
    db = createDatabase();
    console.log('🤖 Bot: Unified database interface initialized');
} catch (error) {
    console.error('❌ Bot: Database initialization failed:', error);
    process.exit(1);
}

class TaskBot {
    constructor(token) {
        this.bot = new TelegramBot(token, { polling: true });
        this.setupCommands();
        this.setupCallbacks();
    }

    setupCommands() {
        // Команда для создания задачи
        this.bot.onText(/\/task (.+)/, async (msg, match) => {
            try {
                await this.handleTaskCommand(msg, match[1]);
            } catch (error) {
                console.error('Error handling task command:', error);
                this.bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при создании задачи.');
            }
        });

        // Команда для просмотра задач
        this.bot.onText(/\/tasks/, async (msg) => {
            try {
                await this.handleTasksCommand(msg);
            } catch (error) {
                console.error('Error handling tasks command:', error);
                this.bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при получении списка задач.');
            }
        });

        // Команда start - активация бота
        this.bot.onText(/\/start/, async (msg) => {
            try {
                // Сохраняем информацию о группе и пользователе при активации
                if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
                    await db.addGroup(msg.chat.id.toString(), msg.chat.title || 'Unknown Group');
                }
                
                await db.addUser(
                    msg.from.id.toString(),
                    msg.from.username,
                    msg.from.first_name,
                    msg.from.last_name
                );

                const welcomeText = `👋 Добро пожаловать в Task Manager Bot!

🤖 Я помогу вам управлять задачами и повышать продуктивность команды.

*Основные команды:*
/task <задача> @исполнитель <описание> <дедлайн>
/tasks - показать все задачи  
/help - подробная помощь

*Пример использования:*
\`/task Создать дизайн @anna_designer Разработать макет главной страницы 2025-06-15\`

✨ Начните с создания первой задачи!`;

                this.bot.sendMessage(msg.chat.id, welcomeText, { 
                    reply_to_message_id: msg.message_id,
                    parse_mode: 'Markdown'
                });
            } catch (error) {
                console.error('Error handling start command:', error);
                this.bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при активации бота.');
            }
        });

        // Команда помощи
        this.bot.onText(/\/help/, async (msg) => {
            try {
                // Сохраняем пользователя и при команде help
                await db.addUser(
                    msg.from.id.toString(),
                    msg.from.username,
                    msg.from.first_name,
                    msg.from.last_name
                );

                const helpText = `
🤖 *Бот для управления задачами*

*Команды:*
/start - активировать бота
/task <задача> @исполнитель <описание> <дедлайн> [время]
/tasks - показать все задачи
/help - показать это сообщение

*Примеры использования:*
\`/task Создать дизайн @anna_designer Разработать макет главной страницы 2025-06-15\`
\`/task Написать код @dev_alex Исправить баг с авторизацией 2025-06-15 18:00\`

*Формат команды /task:*
- Задача: краткое название
- @исполнитель: username пользователя
- Описание: подробное описание (опционально)
- Дедлайн: дата в формате YYYY-MM-DD (опционально)
- Время: время в формате HH:MM (опционально)
            `;
            
            this.bot.sendMessage(msg.chat.id, helpText, { 
                reply_to_message_id: msg.message_id 
            });
            } catch (error) {
                console.error('Error handling help command:', error);
                this.bot.sendMessage(msg.chat.id, '❌ Произошла ошибка при получении помощи.');
            }
        });

        // Обработка входа в группу
        this.bot.on('new_chat_members', async (msg) => {
            if (msg.new_chat_members.some(member => member.id === this.bot.options.id)) {
                await this.handleBotAddedToGroup(msg);
            }
        });
    }

    setupCallbacks() {
        // Обработка inline кнопок
        this.bot.on('callback_query', async (callbackQuery) => {
            const action = callbackQuery.data;
            const msg = callbackQuery.message;

            try {
                if (action.startsWith('complete_')) {
                    const taskId = parseInt(action.split('_')[1]);
                    await this.handleCompleteTask(callbackQuery, taskId);
                } else if (action.startsWith('delete_')) {
                    const taskId = parseInt(action.split('_')[1]);
                    await this.handleDeleteTask(callbackQuery, taskId);
                } else if (action.startsWith('submit_')) {
                    const taskId = parseInt(action.split('_')[1]);
                    await this.handleSubmitForReview(callbackQuery, taskId);
                } else if (action.startsWith('approve_')) {
                    const taskId = parseInt(action.split('_')[1]);
                    await this.handleApproveTask(callbackQuery, taskId);
                } else if (action.startsWith('revision_')) {
                    const taskId = parseInt(action.split('_')[1]);
                    await this.handleRequestRevision(callbackQuery, taskId);
                } else if (action.startsWith('return_')) {
                    const taskId = parseInt(action.split('_')[1]);
                    await this.handleReturnToWork(callbackQuery, taskId);
                } else if (action.startsWith('resubmit_')) {
                    const taskId = parseInt(action.split('_')[1]);
                    await this.handleResubmitTask(callbackQuery, taskId);
                } else if (action === 'refresh_tasks') {
                    await this.handleRefreshTasks(callbackQuery);
                } else {
                    console.log('Unknown callback action:', action);
                    this.bot.answerCallbackQuery(callbackQuery.id, '❌ Неизвестное действие');
                }
            } catch (error) {
                console.error('Error handling callback:', error);
                this.bot.answerCallbackQuery(callbackQuery.id, '❌ Произошла ошибка');
            }
        });
    }

    async handleTaskCommand(msg, taskText) {
        // Сохраняем информацию о группе и пользователе
        if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
            await db.addGroup(msg.chat.id.toString(), msg.chat.title || 'Unknown Group');
        }
        
        await db.addUser(
            msg.from.id.toString(),
            msg.from.username,
            msg.from.first_name,
            msg.from.last_name
        );

        // Парсим команду
        const parsed = this.parseTaskCommand(taskText);
        
        if (!parsed.title || !parsed.assignee) {
            this.bot.sendMessage(msg.chat.id, `❌ Неверный формат команды

Правильный формат:
/task <задача> @исполнитель <описание> <дедлайн>

Пример:
/task Создать дизайн @anna_designer Разработать макет главной страницы 2025-06-15`, { 
                reply_to_message_id: msg.message_id 
            });
            return;
        }

        // Создаем задачу
        const taskId = await db.addTask(
            parsed.title,
            parsed.description,
            parsed.assignee,
            parsed.deadline,
            msg.chat.id.toString(),
            msg.from.id.toString()
        );

        // Формируем ответ
        const creatorName = msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : '');
        let deadlineText = '';
        if (parsed.deadline) {
            try {
                // Если дедлайн содержит время, форматируем его красиво
                if (parsed.deadline.includes(' ')) {
                    const [date, time] = parsed.deadline.split(' ');
                    deadlineText = `📅 Дедлайн: ${date} в ${time}`;
                } else {
                    deadlineText = `📅 Дедлайн: ${parsed.deadline}`;
                }
            } catch (e) {
                deadlineText = `📅 Дедлайн: ${parsed.deadline}`;
            }
        }
        
        const response = `✅ Задача создана!

📋 Задача: ${parsed.title}
👤 Исполнитель: ${parsed.assignee}
👨‍💼 Создал: ${creatorName}
${parsed.description ? `📝 Описание: ${parsed.description}` : ''}
${deadlineText}

ID задачи: #${taskId}`;

        // Получаем правильную клавиатуру для задачи
        const keyboard = await this.getTaskKeyboard(taskId, msg.from.id, parsed.assignee, msg.chat.id, 'pending');

        const messageOptions = {
            reply_to_message_id: msg.message_id
        };

        if (keyboard) {
            messageOptions.reply_markup = keyboard;
        }

        this.bot.sendMessage(msg.chat.id, response, messageOptions);
    }

    async handleTasksCommand(msg) {
        const chatId = msg.chat.id.toString();
        const tasks = await db.getAllTasks({ chatId });

        if (tasks.length === 0) {
            this.bot.sendMessage(msg.chat.id, `📝 Список задач пуст

Создайте новую задачу командой:
/task <задача> @исполнитель <описание> <дедлайн>`, { 
                reply_to_message_id: msg.message_id 
            });
            return;
        }

        let response = '📋 Список задач:\n\n';
        
        const pendingTasks = tasks.filter(t => t.status === 'pending');
        const completedTasks = tasks.filter(t => t.status === 'completed');

        if (pendingTasks.length > 0) {
            response += '🔄 В работе:\n';
            pendingTasks.forEach(task => {
                let deadlineText = '';
                if (task.deadline) {
                    if (task.deadline.includes(' ')) {
                        const [date, time] = task.deadline.split(' ');
                        deadlineText = ` (до ${date} в ${time})`;
                    } else {
                        deadlineText = ` (до ${task.deadline})`;
                    }
                }
                const isOverdue = task.deadline && new Date(task.deadline) < new Date() ? ' ⚠️' : '';
                response += `#${task.id} ${task.title} → ${task.assignee_username}${deadlineText}${isOverdue}\n`;
            });
            response += '\n';
        }

        const reviewTasks = tasks.filter(t => t.status === 'review');
        if (reviewTasks.length > 0) {
            response += '🔍 На проверке:\n';
            reviewTasks.forEach(task => {
                response += `#${task.id} ${task.title} → ${task.assignee_username}\n`;
            });
            response += '\n';
        }

        const revisionTasks = tasks.filter(t => t.status === 'revision');
        if (revisionTasks.length > 0) {
            response += '🔄 На доработке:\n';
            revisionTasks.forEach(task => {
                const comment = task.review_comment ? ` (${task.review_comment})` : '';
                response += `#${task.id} ${task.title} → ${task.assignee_username}${comment}\n`;
            });
            response += '\n';
        }

        if (completedTasks.length > 0) {
            response += '✅ Выполнено:\n';
            completedTasks.slice(0, 5).forEach(task => {
                response += `#${task.id} ${task.title} → ${task.assignee_username}\n`;
            });
            if (completedTasks.length > 5) {
                response += `... и еще ${completedTasks.length - 5} задач\n`;
            }
        }

        const keyboard = {
            inline_keyboard: [
                [{ text: '🔄 Обновить', callback_data: 'refresh_tasks' }]
            ]
        };

        this.bot.sendMessage(msg.chat.id, response, {
            reply_markup: keyboard,
            reply_to_message_id: msg.message_id
        });
    }

    async handleCompleteTask(callbackQuery, taskId) {
        const result = await db.completeTask(taskId);
        
        if (result > 0) {
            this.bot.answerCallbackQuery(callbackQuery.id, '✅ Задача выполнена!');
            
            // Обновляем сообщение
            const newText = callbackQuery.message.text.replace(/📋 Задача:/, '✅ Задача выполнена:');
            this.bot.editMessageText(newText, {
                chat_id: callbackQuery.message.chat.id,
                message_id: callbackQuery.message.message_id
            });
        } else {
            this.bot.answerCallbackQuery(callbackQuery.id, '❌ Задача не найдена');
        }
    }

    async handleDeleteTask(callbackQuery, taskId) {
        const result = await db.deleteTask(taskId);
        
        if (result > 0) {
            this.bot.answerCallbackQuery(callbackQuery.id, '🗑️ Задача удалена');
            this.bot.deleteMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id);
        } else {
            this.bot.answerCallbackQuery(callbackQuery.id, '❌ Задача не найдена');
        }
    }

    async handleRefreshTasks(callbackQuery) {
        this.bot.answerCallbackQuery(callbackQuery.id, '🔄 Обновление...');
        
        // Создаем псевдо-сообщение для повторного использования handleTasksCommand
        const msg = {
            chat: callbackQuery.message.chat,
            message_id: callbackQuery.message.message_id
        };
        
        await this.handleTasksCommand(msg);
        this.bot.deleteMessage(callbackQuery.message.chat.id, callbackQuery.message.message_id);
    }

    async handleBotAddedToGroup(msg) {
        const welcomeText = `👋 Привет! Я бот для управления задачами

Я помогу вам организовать работу в этой группе.

Основные команды:
/task <задача> @исполнитель <описание> <дедлайн>
/tasks - показать все задачи
/help - помощь

Начните с создания первой задачи!`;

        this.bot.sendMessage(msg.chat.id, welcomeText);
    }

    async getUserRoleAndValidateChat(userId, chatId) {
        try {
            // Проверяем, что это рабочий чат
            const workChatSetting = await db.getSetting('work_chat_id');
            const workChatId = workChatSetting ? workChatSetting.value : null;
            if (workChatId && workChatId !== chatId.toString()) {
                console.log(`Chat ${chatId} is not the work chat (${workChatId})`);
                return { role: null, isWorkChat: false };
            }

            // Получаем роль пользователя из базы
            const role = await db.getUserRole(userId.toString());
            return { role, isWorkChat: true };
        } catch (error) {
            console.error('Error checking user role:', error);
            return { role: 'executor', isWorkChat: true }; // По умолчанию исполнитель
        }
    }

    async getTaskKeyboard(taskId, currentUserId, assigneeUsername, chatId, status) {
        const { role, isWorkChat } = await this.getUserRoleAndValidateChat(currentUserId, chatId);
        
        if (!isWorkChat) {
            console.log('Not in work chat, no buttons shown');
            return null;
        }
        
        const canManage = role === 'admin' || role === 'manager';
        
        // Получаем информацию о пользователе для сравнения
        let currentUser;
        try {
            currentUser = await this.bot.getChatMember(chatId, currentUserId);
        } catch (error) {
            console.error('Error getting user info:', error);
            return null;
        }
        
        // Проверяем, является ли пользователь исполнителем
        const currentUsername = currentUser?.user?.username;
        if (!currentUsername) {
            console.log('No username found for user:', currentUserId);
            return null;
        }
        
        // Нормализуем имена пользователей для сравнения
        const normalizedCurrentUsername = currentUsername.replace('@', '').toLowerCase();
        const normalizedAssigneeUsername = assigneeUsername.replace('@', '').toLowerCase();
        
        // Проверяем разные варианты совпадения
        const isAssignee = normalizedCurrentUsername === normalizedAssigneeUsername ||
                          currentUsername === assigneeUsername ||
                          `@${currentUsername}` === assigneeUsername ||
                          currentUsername === assigneeUsername.replace('@', '');
        
        console.log(`Debug: currentUserId=${currentUserId}, currentUsername=${currentUsername}, assigneeUsername=${assigneeUsername}, normalizedCurrent=${normalizedCurrentUsername}, normalizedAssignee=${normalizedAssigneeUsername}, isAssignee=${isAssignee}, role=${role}, canManage=${canManage}, status=${status}`);
        
        let buttons = [];

        if (status === 'pending') {
            // Для новых задач всегда показываем кнопку - проверку исполнителя делаем при нажатии
            buttons.push({ text: '📤 Сдать на проверку', callback_data: `submit_${taskId}` });
            console.log(`Added submit button for pending task: isAssignee=${isAssignee}, role=${role}`);
        } else if (status === 'review') {
            // Управление только через веб-интерфейс
        } else if (status === 'revision') {
            if (isAssignee) {
                buttons.push({ text: '🔄 Взять в работу', callback_data: `return_${taskId}` });
            }
        }

        // Возвращаем клавиатуру только если есть кнопки
        if (buttons.length === 0) {
            return null;
        }

        // Разбиваем кнопки на строки по 2
        const keyboard = { inline_keyboard: [] };
        for (let i = 0; i < buttons.length; i += 2) {
            keyboard.inline_keyboard.push(buttons.slice(i, i + 2));
        }

        return keyboard;
    }

    async handleSubmitForReview(callbackQuery, taskId) {
        // Сначала проверяем, является ли пользователь исполнителем
        const tasks = await db.getAllTasks({ chatId: callbackQuery.message.chat.id.toString() });
        const task = tasks.find(t => t.id === taskId);
        
        if (!task) {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Задача не найдена' });
            return;
        }

        // Проверяем информацию о пользователе
        let currentUser;
        try {
            currentUser = await this.bot.getChatMember(callbackQuery.message.chat.id, callbackQuery.from.id);
        } catch (error) {
            console.error('Error getting user info:', error);
        }
        
        const currentUsername = currentUser?.user?.username;
        
        // Используем ту же логику сравнения что и в getTaskKeyboard
        const normalizedCurrentUsername = currentUsername ? currentUsername.replace('@', '').toLowerCase() : '';
        const normalizedAssigneeUsername = task.assignee_username.replace('@', '').toLowerCase();
        
        const isAssignee = normalizedCurrentUsername === normalizedAssigneeUsername ||
                          currentUsername === task.assignee_username ||
                          `@${currentUsername}` === task.assignee_username ||
                          currentUsername === task.assignee_username.replace('@', '');

        if (!isAssignee) {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Только исполнитель может сдать задачу на проверку' });
            return;
        }

        const result = await db.submitForReview(taskId, callbackQuery.from.id);
        
        if (result > 0) {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: '📤 Задача отправлена на проверку' });
            
            const newText = callbackQuery.message.text.replace('📋 Задача:', '🔍 Задача на проверке:');
            
            // Убираем кнопки для задач на проверке
            this.bot.editMessageText(newText, {
                chat_id: callbackQuery.message.chat.id,
                message_id: callbackQuery.message.message_id
            });
        } else {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Ошибка при отправке на проверку' });
        }
    }

    async handleApproveTask(callbackQuery, taskId) {
        const { role, isWorkChat } = await this.getUserRoleAndValidateChat(callbackQuery.from.id, callbackQuery.message.chat.id);
        
        if (!isWorkChat || (role !== 'admin' && role !== 'manager')) {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Только администраторы и менеджеры могут принимать задачи' });
            return;
        }

        const result = await db.approveTask(taskId, callbackQuery.from.id);
        
        if (result > 0) {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: '✅ Задача принята!' });
            
            const newText = callbackQuery.message.text.replace(/🔍 Задача на проверке:|📋 Задача:/, '✅ Задача выполнена:');
            this.bot.editMessageText(newText, {
                chat_id: callbackQuery.message.chat.id,
                message_id: callbackQuery.message.message_id
            });
        } else {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Задача не найдена' });
        }
    }

    async handleRequestRevision(callbackQuery, taskId) {
        const { role, isWorkChat } = await this.getUserRoleAndValidateChat(callbackQuery.from.id, callbackQuery.message.chat.id);
        
        if (!isWorkChat || (role !== 'admin' && role !== 'manager')) {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Только администраторы и менеджеры могут отправлять на доработку' });
            return;
        }

        // Запрашиваем комментарий для доработки
        this.bot.answerCallbackQuery(callbackQuery.id, { text: '💬 Напишите комментарий для доработки...' });
        
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        
        // Создаем временный обработчик для получения комментария
        const commentHandler = async (msg) => {
            if (msg.chat.id === chatId && msg.reply_to_message && msg.reply_to_message.message_id === messageId) {
                const comment = msg.text;
                
                const result = await db.requestRevision(taskId, callbackQuery.from.id, comment);
                
                if (result > 0) {
                    const newText = callbackQuery.message.text.replace('🔍 Задача на проверке:', '🔄 Задача на доработке:') + `\n\n💬 Комментарий: ${comment}`;
                    
                    // Получаем исполнителя из базы данных
                    const tasks = await db.getAllTasks({ chatId: chatId.toString() });
                    const task = tasks.find(t => t.id === taskId);
                    const assigneeUsername = task ? task.assignee_username : '';
                    
                    const newKeyboard = await this.getTaskKeyboard(taskId, callbackQuery.from.id, assigneeUsername, chatId, 'revision');
                    
                    const editOptions = {
                        chat_id: chatId,
                        message_id: messageId
                    };

                    if (newKeyboard) {
                        editOptions.reply_markup = newKeyboard;
                    }

                    this.bot.editMessageText(newText, editOptions);
                    
                    // Отправляем уведомление исполнителю о причине отклонения
                    this.sendRejectionNotification(task, comment, chatId);
                }
                
                // Удаляем обработчик
                this.bot.removeListener('message', commentHandler);
            }
        };

        this.bot.on('message', commentHandler);
        
        // Удаляем обработчик через 5 минут, если не получили ответ
        setTimeout(() => {
            this.bot.removeListener('message', commentHandler);
        }, 5 * 60 * 1000);
    }

    async sendRejectionNotification(task, reason, chatId) {
        try {
            const message = `🔄 Задача отклонена на доработку

📋 Задача: ${task.title}
👤 Исполнитель: ${task.assignee_username}
💬 Причина: ${reason}

Количество доработок: ${(task.revision_count || 0) + 1}

⚠️ Пожалуйста, внесите необходимые исправления и отправьте задачу на проверку снова.`;

            // Создаем inline кнопку для повторной отправки
            const keyboard = {
                inline_keyboard: [[
                    { text: '🔄 Взять в работу', callback_data: `return_${task.id}` }
                ]]
            };

            this.bot.sendMessage(chatId, message, {
                reply_markup: keyboard
            });
        } catch (error) {
            console.error('Error sending rejection notification:', error);
        }
    }

    async handleReturnToWork(callbackQuery, taskId) {
        const result = await db.returnToWork(taskId);
        
        if (result > 0) {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: '🔄 Задача взята в работу' });
            
            const newText = callbackQuery.message.text.replace('🔄 Задача на доработке:', '📋 Задача:').split('\n\n💬 Комментарий:')[0];
            // Получаем исполнителя из базы данных
            const tasks = await db.getAllTasks({ chatId: callbackQuery.message.chat.id.toString() });
            const task = tasks.find(t => t.id === taskId);
            const assigneeUsername = task ? task.assignee_username : '';
            
            const newKeyboard = await this.getTaskKeyboard(taskId, callbackQuery.from.id, assigneeUsername, callbackQuery.message.chat.id, 'pending');
            
            const editOptions = {
                chat_id: callbackQuery.message.chat.id,
                message_id: callbackQuery.message.message_id
            };

            if (newKeyboard) {
                editOptions.reply_markup = newKeyboard;
            }

            this.bot.editMessageText(newText, editOptions);
        } else {
            this.bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Ошибка при возврате в работу' });
        }
    }

    async handleResubmitTask(callbackQuery, taskId) {
        // Просто вызываем обработчик submit for review
        await this.handleSubmitForReview(callbackQuery, taskId);
    }

    parseTaskCommand(text) {
        // Улучшенный парсер для команды /task
        // Формат: /task Заголовок @username описание дедлайн
        const parts = text.trim().split(' ');
        let title = '';
        let assignee = '';
        let description = '';
        let deadline = '';
        
        let currentPart = 'title';
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            
            if (part.startsWith('@')) {
                // Найден исполнитель - переключаемся на описание
                assignee = part;
                currentPart = 'description';
            } else if (part.match(/^\d{4}-\d{2}-\d{2}$/)) {
                // Найдена дата - это дедлайн
                deadline = part;
                // Проверяем следующую часть на время
                if (i + 1 < parts.length && parts[i + 1].match(/^\d{1,2}:\d{2}$/)) {
                    deadline += ' ' + parts[i + 1];
                    i++; // Пропускаем время в следующей итерации
                }
                currentPart = 'done';
            } else {
                // Добавляем к текущей части
                if (currentPart === 'title') {
                    title += (title ? ' ' : '') + part;
                } else if (currentPart === 'description') {
                    description += (description ? ' ' : '') + part;
                }
            }
        }
        
        return {
            title: title.trim(),
            assignee: assignee,
            description: description.trim(),
            deadline: deadline
        };
    }
}

module.exports = TaskBot;