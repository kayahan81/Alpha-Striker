import { playerop } from './player-operations.js';

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
                    delete: 'api/lobby/delete',
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
        else{stopAutoCheck}
    }, intervalMs);
}


// Вспомогательная функция для уведомлений
function showNotification(message, type = 'info') {
    alert(message);
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



// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
document.addEventListener('DOMContentLoaded', () => {
    // Считываем данные из конфига (сервер, порт и ручки)
    serverConfig.initConfig();
    // Проверяем состояние при загрузке
    checkAuthState();
    
    // Запускаем автоматическую проверку токена каждую минуту
    startAutoCheck(60000); // 60 секунд
    
    // Навешиваем обработчики на кнопки
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    
    if (loginButton) {
        loginButton.addEventListener('click', handleLogin);
    }
    
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
});