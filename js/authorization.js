import { playerop } from './player-operations.js';
import { loadAndDisplayLobbies } from './lobby-list.js';


// Ключи
const AUTH_KEYS = {
    TOKEN: 'token',
    PLAYER_ID: 'playerId',
    ROLE: 'role'
};

const SERVER_CONFIGURATION = {
    FULLURL: 'fullurl',
    ENDPOINTS: 'endpoints'
}

export const serverConfig = {
    setServerData(configdata) {
        localStorage.setItem(SERVER_CONFIGURATION.FULLURL, configdata.fullURL);
        localStorage.setItem(SERVER_CONFIGURATION.ENDPOINTS, JSON.stringify(configdata.endpoints));
    },

    async initConfig() {
        try{
            const response = await fetch('/config.json')
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Ошибка авторизации');
            }
            const data = await response.json()
            const fullURL = new URL(data.backend_address)
            fullURL.port = data.port

            const endpoints = {
                login: 'auth/login',
                register: 'players',
                getplayer:'players/', //+playerID чтобы получить Никнейм и контактные данные
                lobby: {
                    get: 'lobbies',
                    join: 'join',
                    ready: 'ready',
                    matchfinished: 'match-finished',
                    list: 'api/lobby/list',
                }
            }

            const configData = {
                fullURL: fullURL.toString(),
                endpoints: endpoints                
            }

            this.setServerData(configData)
            return{
                success: true,
                data: configData
            }
        }
        catch(error){
            console.error('Ошибка конфига:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    getUrl(){
        return localStorage.getItem(SERVER_CONFIGURATION.FULLURL);
    },
    getEndpoints(){
        const endpointsStr = localStorage.getItem(SERVER_CONFIGURATION.ENDPOINTS);
        if (!endpointsStr) return null;
        try {
            return JSON.parse(endpointsStr);
        } catch (e) {
            console.error('Ошибка парсинга endpoints:', e);
            return null;
        }
    },
    reset() {
        localStorage.removeItem(SERVER_KEYS.FULLURL);
        localStorage.removeItem(SERVER_KEYS.ENDPOINTS);
        console.log('Конфиг сброшен');
    }
}

export const auth = {
    setUserData(data) {
        localStorage.setItem(AUTH_KEYS.PLAYER_ID, data.playerId);
        localStorage.setItem(AUTH_KEYS.ROLE, data.role);
        localStorage.setItem(AUTH_KEYS.TOKEN, data.token);
    },
    async loginprofile(login, password) {
        try {
            const response = await fetch(`${serverConfig.getUrl()}${serverConfig.getEndpoints().login}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nickname: login,
                    password: password
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Ошибка авторизации');
            }
            
            const data = await response.json();
            
            this.setUserData({
                playerId: data.playerId,
                role: data.role,
                token: data.token
            });

            window.location.reload();
            
            return {
                success: true,
                data: data
            };
            
        } catch (error) {
            console.error('Ошибка входа:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    // Получить токен
    getToken() {
        return localStorage.getItem(AUTH_KEYS.TOKEN);
    },
    
    decodeToken() {
        const token = this.getToken();
        if (!token) return null;
        
        try {
            // JWT состоит из трех частей: header.payload.signature
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(atob(base64));
            return payload;
        } catch (error) {
            console.error('Ошибка декодирования токена:', error);
            return null;
        }
    },
    
    isTokenExpired() {
        const decoded = this.decodeToken();
        if (!decoded || !decoded.exp) return true;
        
        // exp хранится в секундах, переводим в миллисекунды
        const expirationTime = decoded.exp * 1000;
        const currentTime = Date.now();
        
        return currentTime >= expirationTime;
    },
    

    // Получить роль
    getRole() {
        return localStorage.getItem(AUTH_KEYS.ROLE);
    },
    
    // Получить ID игрока
    getPlayerId() {
        return localStorage.getItem(AUTH_KEYS.PLAYER_ID);
    },
    
    // Проверить, залогинен ли
    isLoggedIn() {
        return this.getToken() !== null;
    },
    
    isTokenValid() {
        return this.isLoggedIn() && !this.isTokenExpired();
    },

    autoCheckAndCleanup() {
        if (this.isLoggedIn() && !this.isTokenValid()) {
            console.warn('Сессия истекла или невалидна, перезайдите, пожалуйста');
            this.logout();
            return true; // Токен был очищен
        }
        return false; // Токен валиден или в аккаунт ещё не входили
    },

    // Проверить, админ ли
    isAdmin() {
        return this.getRole() === 'admin';
    },
    
    // Выйти
    logout() {
        localStorage.removeItem(AUTH_KEYS.PLAYER_ID);
        localStorage.removeItem(AUTH_KEYS.ROLE);
        localStorage.removeItem(AUTH_KEYS.TOKEN);
        window.location.reload();
    }
};


// Функция обновления интерфейса после входа
async function updateUIAfterLogin(userData) {
    const loginForm = document.getElementById('loginForm');
    const userGreeting = document.getElementById('userGreeting');
    const usernameSpan = document.getElementById('username');
    
    if (loginForm) loginForm.style.display = 'none';
    if (userGreeting) userGreeting.style.display = 'block';
    if (usernameSpan) usernameSpan.textContent = await playerop.getNameById(auth.getPlayerId());
}

// Функция обновления интерфейса после выхода
function updateUIAfterLogout(reason = 'manual') {
    const loginForm = document.getElementById('loginForm');
    const userGreeting = document.getElementById('userGreeting');
    const loginInput = document.getElementById('login');
    const passwordInput = document.getElementById('password');
    
    if (loginForm) loginForm.style.display = 'block';
    if (userGreeting) userGreeting.style.display = 'none';
    
    // Очищаем поля ввода
    if (loginInput) loginInput.value = '';
    if (passwordInput) passwordInput.value = '';
    
    if (reason === 'expired') {
        showNotification('Сессия истекла, войдите заново', 'warning');
    } else if (reason === 'invalid') {
        showNotification('Сессия недействительна, войдите заново', 'error');
    }
}

// Универсальная проверка состояния
function checkAuthState() {
    // Автоматическая проверка и очистка невалидного токена
    const wasCleaned = auth.autoCheckAndCleanup();
    
    if (wasCleaned) {
        // Токен был автоматически очищен, обновляем UI
        updateUIAfterLogout('expired');
        return false;
    }
    
    if (auth.isLoggedIn()) {
        // Токен существует и валиден
        updateUIAfterLogin({ playerId: auth.getPlayerId() });
        return true;
    } else {
        // Нет токена
        updateUIAfterLogout();
        return false;
    }
}


// Периодическая проверка токена (каждую минуту)
let checkInterval = null;

function stopAutoCheck() {
    if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
    }
}

// 60000 мс это 1 минута
function startAutoCheck(intervalMs = 60000) {
    if (checkInterval) clearInterval(checkInterval);
    
    checkInterval = setInterval(() => {
        // Проверяем только если пользователь "залогинен"
        if (auth.isLoggedIn()) {
            const wasCleaned = auth.autoCheckAndCleanup();
            
            if (wasCleaned) {
                // Токен истек - обновляем UI и показываем уведомление
                updateUIAfterLogout('expired');
                showNotification('Ваша сессия истекла. Пожалуйста, войдите снова.', 'warning');
            }
        }
        else{stopAutoCheck()}
    }, intervalMs);
}


// Вспомогательная функция для уведомлений
// Вспомогательная функция для уведомлений (улучшенная версия)
function showNotification(message, type = 'info') {
    // Удаляем старые уведомления, если они есть
    const oldNotifications = document.querySelectorAll('.custom-notification');
    oldNotifications.forEach(notif => notif.remove());
    
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = 'custom-notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 1001;
        animation: slideIn 0.3s ease-out;
        max-width: 350px;
        word-wrap: break-word;
    `;
    
    // Цвет в зависимости от типа
    if (type === 'error') {
        notification.style.backgroundColor = '#f44336';
    } else if (type === 'success') {
        notification.style.backgroundColor = '#4CAF50';
    } else if (type === 'warning') {
        notification.style.backgroundColor = '#ff9800';
    } else {
        notification.style.backgroundColor = '#2196F3';
    }
    
    notification.textContent = message;
    
    // Добавляем анимацию, если её нет
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Автоматическое удаление через 3 секунды
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                if (notification.parentNode) notification.remove();
            }, 300);
        }
    }, 3000);
}

// Обработчик кнопки входа
// для входа мы берём пароль и логин и при нажатии кнопки отправляем эти данные запросом на сервер бэкенда
// получаем Токен, Айди и роль и записываем их
async function handleLogin() {
    const loginInput = document.getElementById('login');
    const passwordInput = document.getElementById('password');
    const loginButton = document.getElementById('loginButton');
    
    const login = loginInput?.value || '';
    const password = passwordInput?.value || '';
    
    // Валидация полей
    if (!login || !password) {
        alert('Заполните логин и пароль');
        return;
    }
    
    // Показываем индикатор загрузки
    if (loginButton) {
        loginButton.disabled = true;
        loginButton.textContent = 'Вход...';
    }
    
    // Вызываем функцию входа
    const result = await auth.loginprofile(login, password);
    
    // Восстанавливаем кнопку
    if (loginButton) {
        loginButton.disabled = false;
        loginButton.textContent = 'Войти';
    }
    
    if (result.success) {
        // Успешный вход - обновляем интерфейс
        updateUIAfterLogin(result.data);
    } else {
        // Ошибка - показываем сообщение
        alert('Ошибка: ' + result.error);
    }
}

// Обработчик кнопки выхода
function handleLogout() {
    auth.logout();
    updateUIAfterLogout();
}

// Функция для отображения модального окна регистрации
function showRegistrationModal() {
    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.id = 'registrationModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    // Создаем форму регистрации
    modal.innerHTML = `
        <div style="
            background: white;
            padding: 30px;
            border-radius: 10px;
            width: 400px;
            max-width: 90%;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        ">
            <h2 style="margin-top: 0; text-align: center;">Регистрация</h2>
            <form id="registrationForm">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">Полное имя:</label>
                    <input type="text" id="regFullName" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">Никнейм:</label>
                    <input type="text" id="regNickname" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">Город:</label>
                    <input type="text" id="regCity" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">Контакты:</label>
                    <input type="text" id="regContacts" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">Предпочитаемая локация:</label>
                    <input type="text" id="regPreferredLocation" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">Пароль:</label>
                    <input type="password" id="regPassword" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 5px;">Подтверждение пароля:</label>
                    <input type="password" id="regConfirmPassword" required style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button type="button" id="cancelRegBtn" style="padding: 8px 16px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">Отмена</button>
                    <button type="submit" style="padding: 8px 16px; background: rgba(194, 118, 47, 0.9); color: white; border: none; border-radius: 4px; cursor: pointer;">Зарегистрироваться</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Обработчик отправки формы
    const form = document.getElementById('registrationForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleRegistration();
    });
    
    // Обработчик закрытия модального окна
    const cancelBtn = document.getElementById('cancelRegBtn');
    cancelBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Закрытие по клику на фон
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Функция регистрации
async function handleRegistration() {
    // Получаем значения из формы
    const fullName = document.getElementById('regFullName')?.value;
    const nickname = document.getElementById('regNickname')?.value;
    const city = document.getElementById('regCity')?.value;
    const contacts = document.getElementById('regContacts')?.value;
    const preferredLocation = document.getElementById('regPreferredLocation')?.value;
    const password = document.getElementById('regPassword')?.value;
    const confirmPassword = document.getElementById('regConfirmPassword')?.value;
    
    // Валидация
    if (!fullName || !nickname || !city || !contacts || !preferredLocation || !password) {
        showNotification('Пожалуйста, заполните все поля', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Пароль должен быть не менее 6 символов', 'error');
        return;
    }
    
    // Показываем индикатор загрузки
    const submitBtn = document.querySelector('#registrationForm button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Регистрация...';
    submitBtn.disabled = true;
    
    try {
        // Отправляем запрос на сервер
        const response = await fetch(`${serverConfig.getUrl()}players`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fullName: fullName,
                nickname: nickname,
                city: city,
                contacts: contacts,
                preferredLocation: preferredLocation,
                password: password
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Ошибка регистрации');
        }
        
        const data = await response.json();
        
        // Закрываем модальное окно
        const modal = document.getElementById('registrationModal');
        if (modal) modal.remove();
        
        // Показываем сообщение об успехе
        showNotification('Регистрация успешна! Теперь вы можете войти в систему.', 'success');
        
        // Опционально: автоматически заполнить поля логина
        const loginInput = document.getElementById('login');
        if (loginInput) {
            loginInput.value = nickname;
        }
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        showNotification('Ошибка регистрации: ' + error.message, 'error');
    } finally {
        // Восстанавливаем кнопку
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    serverConfig.initConfig();

    checkAuthState();
    startAutoCheck(60000); // 60 секунд

    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    const regButton = document.getElementById('regButton'); // Добавлено
    
    if (loginButton) {
        loginButton.addEventListener('click', handleLogin);
    }
    
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
    
    // Добавлен обработчик для кнопки регистрации
    if (regButton) {
        regButton.addEventListener('click', showRegistrationModal);
    }

    loadAndDisplayLobbies('lobbiesListContainer', {
        status: 'open',      // Показываем открытые лобби
        sort: 'created_desc', // Сначала новые
        limit: 10            // По 10 на страницу
    });
});