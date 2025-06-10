/**
 * Утилита для работы с модальными окнами
 */

const ModalHelper = {
    // Показать модальное окно
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    },

    // Скрыть модальное окно
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            document.body.style.overflow = '';
        }
    },

    // Модальное окно подтверждения
    confirm(title, message, confirmText = 'Подтвердить', cancelText = 'Отмена') {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirmModal');
            const titleEl = document.getElementById('confirmTitle');
            const messageEl = document.getElementById('confirmMessage');
            const confirmBtn = document.getElementById('confirmOkBtn');

            titleEl.textContent = title;
            messageEl.textContent = message;
            confirmBtn.textContent = confirmText;

            // Удаляем старые обработчики
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

            // Добавляем новые обработчики
            newConfirmBtn.addEventListener('click', () => {
                this.hideModal('confirmModal');
                resolve(true);
            });

            // Обработчик отмены
            const handleCancel = () => {
                this.hideModal('confirmModal');
                resolve(false);
            };

            // Кнопка отмены
            const cancelBtn = modal.querySelector('.btn-secondary');
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            newCancelBtn.addEventListener('click', handleCancel);

            // Закрытие по Escape
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    handleCancel();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);

            this.showModal('confirmModal');
        });
    },

    // Модальное окно для ввода комментария
    prompt(title, message, placeholder = 'Введите комментарий...', required = false) {
        return new Promise((resolve) => {
            const modal = document.getElementById('commentModal');
            const titleEl = document.getElementById('commentTitle');
            const messageEl = document.getElementById('commentMessage');
            const textArea = document.getElementById('commentText');
            const confirmBtn = document.getElementById('commentOkBtn');

            titleEl.textContent = title;
            messageEl.textContent = message;
            textArea.placeholder = placeholder;
            textArea.value = '';

            // Удаляем старые обработчики
            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

            // Добавляем новые обработчики
            newConfirmBtn.addEventListener('click', () => {
                const text = textArea.value.trim();
                if (required && !text) {
                    textArea.focus();
                    textArea.style.borderColor = 'var(--danger-color)';
                    return;
                }
                this.hideModal('commentModal');
                resolve(text || null);
            });

            // Обработчик отмены
            const handleCancel = () => {
                this.hideModal('commentModal');
                resolve(null);
            };

            // Кнопка отмены
            const cancelBtn = modal.querySelector('.btn-secondary');
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            newCancelBtn.addEventListener('click', handleCancel);

            // Сброс стиля поля при вводе
            textArea.addEventListener('input', () => {
                textArea.style.borderColor = '';
            });

            // Закрытие по Escape
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    handleCancel();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);

            this.showModal('commentModal');
            textArea.focus();
        });
    },

    // Модальное окно с информацией
    alert(title, message, type = 'info') {
        return this.confirm(title, message, 'OK').then(() => true);
    }
};