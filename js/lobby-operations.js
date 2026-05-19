import { auth } from './authorization.js';
import { serverConfig } from './authorization.js';
import { playerop } from './player-operations.js';
import { playerCard } from './player-operations.js';

export const lobbyDataParser = {
    parse(responseData) {
        const players = [];
        let hostPlayer = null;
        for (const key in responseData) {
            if (key.startsWith('player')) {
                const playerData = responseData[key];
                const player = {
                    id: playerData.playerId,
                    faction: playerData.faction,
                    isReady: playerData.isReady,
                    isFinished: playerData.isFinished,
                    joinedAt: playerData.joinedAt,
                    isHost: playerData.playerId === responseData.hostPlayerId
                };
                
                players.push(player);
                
                if (player.isHost) {
                    hostPlayer = player;
                }
            }
        }
        
        return {
            id: responseData.id,
            hostPlayerId: responseData.hostPlayerId,
            hostPlayer: hostPlayer,
            meetingPlace: responseData.meetingPlace,
            matchSize: responseData.matchSize,
            isRanked: responseData.isRanked,
            status: responseData.status,
            createdAt: new Date(responseData.createdAt),
            updatedAt: new Date(responseData.updatedAt),
            players: players,
            playerCount: players.length,
            maxPlayers: 2,
            
            // Проверка, есть ли свободное место
            hasFreeSlot() {
                return this.players.length < this.maxPlayers;
            },
            
            // Проверка, заполнено ли лобби
            isFull() {
                return this.players.length >= this.maxPlayers;
            },
            
            // Проверка, может ли игрок присоединиться (есть место ИЛИ игрок уже в лобби)
            canJoin(playerId) {
                return this.isPlayerInLobby(playerId) || this.hasFreeSlot();
            },
            
            // Есть ли игрок в лобби
            isPlayerInLobby(playerId) {
                return this.players.some(p => p.id === playerId);
            },
            
            // Получить игрока по ID
            getPlayerById(playerId) {
                return this.players.find(p => p.id === playerId);
            },
            
            // Все ли игроки готовы
            areAllPlayersReady() {
                return this.players.length > 0 && this.players.every(p => p.isReady);
            },
            
            // Можно ли начать игру
            canStartGame() {
                return this.status === 'open' && 
                       this.players.length === 2 && 
                       this.areAllPlayersReady();
            }
        };
    }
};

export const lobbyManager = {
    createPlayerData(playerId, faction){
        const playerKey = `player${playerId}`;
        return {
            [playerKey]: { faction: faction }
        };
    },

    // НОВЫЙ МЕТОД: Проверка, есть ли свободное место в лобби
    hasFreeSlot(lobbyData) {
        // Подсчитываем количество игроков в лобби
        let playerCount = 0;
        for (const key in lobbyData) {
            if (key.startsWith('player')) {
                playerCount++;
            }
        }
        
        // Максимальный размер лобби (matchSize - это количество юнитов? или игроков?)
        // Судя по вашему коду, matchSize = 350 (это размер армии, не количество игроков)
        // Поэтому нужно отдельное поле maxPlayers или просто ограничение на 2 игрока
        
        // В вашем случае лобби рассчитано на 2 игроков
        const MAX_PLAYERS = 2;
        
        return playerCount < MAX_PLAYERS;
    },

    // НОВЫЙ МЕТОД: Получить количество игроков в лобби
    getPlayerCount(lobbyData) {
        let playerCount = 0;
        for (const key in lobbyData) {
            if (key.startsWith('player')) {
                playerCount++;
            }
        }
        return playerCount;
    },

   
    async joinLobbyById(inputLobbyId, faction){
        if (!auth.isLoggedIn()) {
            alert('Авторизуйтесь');
            console.error('Ошибка: пользователь не авторизован');
            return {
                success: false,
                error: "Сеанс устарел. Авторизуйтесь снова."
            };
        }
        
        try{
            // Получаем текущее состояние лобби
            const lobbyCheck = await this.getLobbyById(inputLobbyId);
            
            if (!lobbyCheck.success) {
                return {
                    success: false,
                    error: "Не удалось проверить состояние лобби"
                };
            }
            
            const parsedLobby = lobbyDataParser.parse(lobbyCheck.data);
            const currentPlayerId = parseInt(auth.getPlayerId());
            const isPlayerInLobby = parsedLobby.isPlayerInLobby(currentPlayerId);
            
            // Если игрок уже в лобби
            if (isPlayerInLobby) {
                console.log('Игрок уже в лобби');
                return {
                    success: true,
                    data: { id: inputLobbyId },
                    alreadyInLobby: true
                };
            }
            
            // Если игрок НЕ в лобби И лобби заполнено
            if (!isPlayerInLobby && parsedLobby.isFull()) {
                alert('Лобби заполнено! Нет свободных мест.');
                return {
                    success: false,
                    error: "Лобби заполнено"
                };
            }
            
            // Игрок не в лобби и есть свободное место - присоединяемся
            const playerData = this.createPlayerData(auth.getPlayerId(), faction);
            const response = await fetch(`${serverConfig.getUrl()}${serverConfig.getEndpoints().lobby.get}/${inputLobbyId}/${serverConfig.getEndpoints().lobby.join}`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + auth.getToken(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    playerId: +auth.getPlayerId(),
                    ...playerData,
                })               
            });
        
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Ошибка: не удалось присоединиться к лобби');
            }
            
            const data = await response.json();
            return {
                success: true,
                data: data
            };                
        }
        catch(error){
            console.error('Ошибка присоединения:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },

    getLobbyIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    },

    // Тестовые данные для того чтобы не создавать пустое лобби
    async createLobby(lobbyData = {place: "Main Meeting Place", 
                                   size: 81,
                                   faction: "Clan Wolf",
                                   ranked: false})
    {
        if (!auth.isLoggedIn()) {
            alert('Авторизуйтесь')
            console.error('Ошибка: пользователь не авторизован');
            return {
                success: false,
                error: "Сеанс устарел. Авторизуйтесь снова."
            };
        }
        else{
            try{
                const playerData = this.createPlayerData(auth.getPlayerId(), lobbyData.faction)
                const response = await fetch(`${serverConfig.getUrl()}${serverConfig.getEndpoints().lobby.get}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + auth.getToken(),
                    },
                    body: JSON.stringify({
                        hostPlayerId: +auth.getPlayerId(),
                        ...playerData,
                        meetingPlace: lobbyData.place,
                        matchSize: lobbyData.size,
                        isRanked: lobbyData.ranked
                    })               
                })

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Ошибка при отправке запроса о создании лобби');
                }
                const data = await response.json();
                return {
                    success: true,
                    data: data
                };                
            }
            catch(error){
                console.error('Ошибка до отправки запроса о создании лобби:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    },
    
    async getLobbyById(inputLobbyId){
        if (!auth.isLoggedIn()) {
            alert('Авторизуйтесь')
            console.error('Ошибка: пользователь не авторизован');
            return {
                success: false,
                error: "Сеанс устарел. Авторизуйтесь снова."
            };
        }
        else{
            try{
                console.log(`Запрашиваем лобби ${inputLobbyId} с сервера`);
                const response = await fetch(`${serverConfig.getUrl()}${serverConfig.getEndpoints().lobby.get}/${inputLobbyId}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    }            
                })

                if (!response.ok) {
                    const errorData = await response.json();
                    alert('Ошибка: не найдено')
                    throw new Error(errorData.message || 'Ошибка: не найдено');
                }
                const data = await response.json();
                console.log(`Получены данные лобби ${inputLobbyId}:`, data);
                return {
                    success: true,
                    data: data
                };                
            }
            catch(error){
                console.error('Ошибка входа:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        } 
    },

    async joinLobbyById(inputLobbyId, faction){
        if (!auth.isLoggedIn()) {
            alert('Авторизуйтесь');
            console.error('Ошибка: пользователь не авторизован');
            return {
                success: false,
                error: "Сеанс устарел. Авторизуйтесь снова."
            };
        }

        try{
            // Получаем текущее состояние лобби
            const lobbyCheck = await this.getLobbyById(inputLobbyId);

            if (!lobbyCheck.success) {
                return {
                    success: false,
                    error: "Не удалось проверить состояние лобби"
                };
            }

            const parsedLobby = lobbyDataParser.parse(lobbyCheck.data);
            const currentPlayerId = parseInt(auth.getPlayerId());
            const isPlayerInLobby = parsedLobby.isPlayerInLobby(currentPlayerId);

            // Если игрок НЕ в лобби И лобби заполнено
            if (!isPlayerInLobby && parsedLobby.isFull()) {
                alert('Лобби заполнено! Нет свободных мест.');
                return {
                    success: false,
                    error: "Лобби заполнено"
                };
            }

            // Если игрок уже в лобби, просто перенаправляем на страницу лобби
            if (isPlayerInLobby) {
                console.log('Игрок уже в лобби, перенаправляем...');
                return {
                    success: true,
                    data: { id: inputLobbyId },
                    alreadyInLobby: true
                };
            }

            // Игрок не в лобби и есть свободное место - присоединяемся
            const playerData = this.createPlayerData(auth.getPlayerId(), faction);
            const response = await fetch(`${serverConfig.getUrl()}${serverConfig.getEndpoints().lobby.get}/${inputLobbyId}/${serverConfig.getEndpoints().lobby.join}`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + auth.getToken(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    playerId: +auth.getPlayerId(),
                    ...playerData,
                })               
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Ошибка: не удалось присоединиться к лобби');
            }

            const data = await response.json();
            return {
                success: true,
                data: data
            };                
        }
        catch(error){
            console.error('Ошибка присоединения:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },


    async playerReadyInLobbyById(inputLobbyId){
        if (!auth.isLoggedIn()) {
            alert('Авторизуйтесь')
            console.error('Ошибка: пользователь не авторизован');
            return {
                success: false,
                error: "Сеанс устарел. Авторизуйтесь снова."
            };
        }
        else{
            try{
                const response = await fetch(`${serverConfig.getUrl()}${serverConfig.getEndpoints().lobby.get}/${inputLobbyId}/${serverConfig.getEndpoints().lobby.ready}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + auth.getToken(),
                    },
                    body: JSON.stringify({
                        playerId: +auth.getPlayerId(),
                    })            
                })
                
                if (!response.ok) {
                    const errorData = await response.json();
                    alert('Ошибка подтверждения готовности')
                    throw new Error(errorData.message || 'Ошибка подтверждения готовности');
                }
                const data = await response.json();
                return {
                    success: true,
                    data: data
                };                
            }
            catch(error){
                console.error('Ошибка подтверждения готовности:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        } 
          
    },
    
    async playerReadyToEndInLobbyById(inputLobbyId){
        if (!auth.isLoggedIn()) {
            alert('Авторизуйтесь')
            console.error('Ошибка: пользователь не авторизован');
            return {
                success: false,
                error: "Сеанс устарел. Авторизуйтесь снова."
            };
        }
        else{
            try{
                const response = await fetch(`${serverConfig.getUrl()}${serverConfig.getEndpoints().lobby.get}/${inputLobbyId}/${serverConfig.getEndpoints().lobby.matchfinished}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + auth.getToken(),
                    },
                    body: JSON.stringify({
                        playerId: +auth.getPlayerId(),
                    })            
                })
                
                if (!response.ok) {
                    const errorData = await response.json();
                    alert('Ошибка подтверждения готовности')
                    throw new Error(errorData.message || 'Ошибка подтверждения готовности');
                }
                const data = await response.json();
                return {
                    success: true,
                    data: data
                };                
            }
            catch(error){
                console.error('Ошибка подтверждения готовности:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        } 
          
    },

};

async function handleLobbyCreation() {

    const placeInput = document.getElementById('place');
    const sizeInput = document.getElementById('size');
    const factionInput = document.getElementById('factionSelector');
    const rankedInput = document.getElementById('ranked')

    const createLobbyButton = document.getElementById('createLobbyButton');


    const place = placeInput?.value || '';
    const size = sizeInput?.value || '';
    const faction = factionInput?.value || '';
    const ranked = rankedInput?.checked || false;


    // Валидация полей
    if (!place || !size || size <= 0 || !faction) {
        alert('Заполните данные о лобби');
        return;
    }

    const lobbyData = {
        place: place,
        size: parseInt(size),  // Преобразуем строку в число
        faction: faction,
        ranked: ranked
    };

    // Показываем индикатор загрузки
    if (createLobbyButton) {
        createLobbyButton.disabled = true;
        createLobbyButton.textContent = 'Создаём...';
    }
    
    // Вызываем функцию создания лобби
    const result = await lobbyManager.createLobby(lobbyData);
    
    // Восстанавливаем кнопку
    if (createLobbyButton) {
        createLobbyButton.disabled = false;
        createLobbyButton.textContent = 'Создать лобби!';
    }

    if (result.success) {
        window.location.href = `../html/alphastriker-lobby.html?id=${result.data.id}`;
    } else {
        alert('Ошибка: ' + result.error);
    }
}

function getLobbyIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const lobbyId = urlParams.get('id');
    return lobbyId ? Number(lobbyId) : null;
}


// Функция обновления интерфейса после перехода на страницу 
// Функция обновления интерфейса после перехода на страницу лобби
async function updateUIAfterLoadingLobby() {
    try {
        const currentPlayerId = auth.getPlayerId();
        
        // Проверяем авторизацию
        if (!currentPlayerId) {
            console.error('Пользователь не авторизован');
            return;
        }
        
        const availableFactions = await playerop.getFactionsByPlayerId(currentPlayerId);
        
        // Получаем данные лобби
        const lobbyId = getLobbyIdFromUrl();
        if (!lobbyId) {
            console.error('ID лобби не найден в URL');
            return;
        }
        
        const result = await lobbyManager.getLobbyById(lobbyId);
        if (!result.success) {
            console.error('Не удалось загрузить лобби:', result.error);
            return;
        }
        
        const lobbyData = lobbyDataParser.parse(result.data);
        
        // Проверяем, есть ли текущий игрок в лобби
        const isPlayerInLobby = lobbyData.isPlayerInLobby(parseInt(currentPlayerId));
        
        const lobbyInfo = document.getElementById('lobbyInfo');
        if(lobbyInfo) {
            lobbyInfo.innerHTML = `<div>Бой номер ${lobbyData.id} в <a href="https://yandex.ru/maps/-/CPrXAW1r" class="alpha-rules">${lobbyData.meetingPlace}</a></div>
                                   <div>Условия: Размер - ${lobbyData.matchSize}</div>
                                   <div>Игроков: ${lobbyData.playerCount}/2</div>`;
        }
        
        const lobbyContainer = document.getElementById('lobbyContainer');
        if (!lobbyContainer) return;
        
        lobbyContainer.innerHTML = '';
        
        // Рендерим карточки игроков (всегда 2 слота)
        for (let i = 0; i < 2; i++) {
            const player = lobbyData.players[i];
            const isCurrentPlayer = player?.id == currentPlayerId;
            
            const card = new playerCard(
                player,
                i,
                isCurrentPlayer,
                getLobbyIdFromUrl(),
                lobbyData,
                availableFactions || []
            );
            
            lobbyContainer.appendChild(card.render());
        }
        
    } catch (error) {
        console.error('Ошибка вывода:', error);
    }
}

async function handleGetLobbyById() {

    const lobbyIdInput = document.getElementById('lobbyIdInput');
    const getLobbyByIdButton = document.getElementById('getLobbyByIdButton');

    const inputLobbyId = lobbyIdInput?.value || '';

    // Валидация полей
    if (!inputLobbyId) {
        alert('Заполните данные о лобби');
        return;
    }

    // Показываем индикатор загрузки
    if (getLobbyByIdButton) {
        getLobbyByIdButton.disabled = true;
        getLobbyByIdButton.textContent = 'Смотрим...';
    }
    
    // Вызываем функцию поиска лобби по айди
    const result = await lobbyManager.getLobbyById(inputLobbyId);
    
    // Восстанавливаем кнопку
    if (getLobbyByIdButton) {
        getLobbyByIdButton.disabled = false;
        getLobbyByIdButton.textContent = 'Найти лобби!';
    }
    
    if (result.success) {
        window.location.href = `../html/alphastriker-lobby.html?id=${result.data.id}`;
    } else {
        alert('Ошибка: ' + result.error);
    }
}

async function handlejoinLobbyById() {
    const factionInput = document.getElementById('factionSelector');
    const lobbyIdInput = document.getElementById('lobbyIdInput');
    const joinLobbyByIdButton = document.getElementById('joinLobbyByIdButton');

    const faction = factionInput?.value || '';
    const inputLobbyId = lobbyIdInput?.value || '';

    // Валидация полей
    if (!inputLobbyId || !faction) {
        alert('Заполните данные о лобби');
        return;
    }

    // Показываем индикатор загрузки
    if (joinLobbyByIdButton) {
        joinLobbyByIdButton.disabled = true;
        joinLobbyByIdButton.textContent = 'Заходим...';
    }
    
    // Вызываем функцию захода в лобби
    const result = await lobbyManager.joinLobbyById(inputLobbyId, faction);
    
    // Восстанавливаем кнопку
    if (joinLobbyByIdButton) {
        joinLobbyByIdButton.disabled = false;
        joinLobbyByIdButton.textContent = 'Зайти в лобби!';
    }
    
    if (result.success) {
        window.location.href = `../html/alphastriker-lobby.html?id=${inputLobbyId}`;
    } else {
        alert('Ошибка: ' + result.error);
    }
}

document.addEventListener('DOMContentLoaded', () => {

    // Навешиваем обработчики на кнопки
    const createLobbyButton = document.getElementById('createLobbyButton');
    const joinLobbyByIdButton = document.getElementById('joinLobbyByIdButton');
    const getLobbyByIdButton = document.getElementById('getLobbyByIdButton');
    
    if (createLobbyButton) {
        createLobbyButton.addEventListener('click', handleLobbyCreation);
    }
    if (joinLobbyByIdButton) {
        joinLobbyByIdButton.addEventListener('click', handlejoinLobbyById);
    }
    if (getLobbyByIdButton) {
        getLobbyByIdButton.addEventListener('click', handleGetLobbyById);
    }

    // Для обновления страницы лобби
    const lobbyContainer = document.getElementById('lobbyContainer');
    const playersList = document.getElementById('playersList');
    
    if (lobbyContainer || playersList) {
        console.log('Обнаружена страница лобби, загружаем данные...');
        updateUIAfterLoadingLobby();
    } else {
        //console.log('Не страница лобби, пропускаем загрузку');
    }

});