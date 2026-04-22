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
            
            // Есть ли игрок в лоббы
            isPlayerInLobby(playerId) {
                return this.players.some(p => p.id === playerId);
            },
            
            // 
            getPlayerById(playerId) {
                return this.players.find(p => p.id === playerId);
            },
            
            areAllPlayersReady() {
                return this.players.every(p => p.isReady);
            },
            
            // Чтобы случайно не начать начатую игру 
            canStartGame() {
                return this.status === 'open' && 
                       this.players.length >= 2 && 
                       this.areAllPlayersReady();
            }
        };
        
    }
}

export const lobbyManager = {
    createPlayerData(playerId, faction){
        const playerKey = `player${playerId}`;
        return {
            [playerKey]: { faction: faction }
        };
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
            alert('Авторизуйтесь')
            console.error('Ошибка: пользователь не авторизован');
            return {
                success: false,
                error: "Сеанс устарел. Авторизуйтесь снова."
            };
        }
        else{
            try{
                const playerData = this.createPlayerData(auth.getPlayerId(), faction)
                const response = await fetch(`${serverConfig.getUrl()}${serverConfig.getEndpoints().lobby.get}/${inputLobbyId}/${serverConfig.getEndpoints().lobby.join}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + auth.getToken(),
                    },
                    body: JSON.stringify({
                        playerId: +auth.getPlayerId(),
                        ...playerData,
                    })               
                })

                if (!response.ok) {
                    const errorData = await response.json();
                    alert('Ошибка: лобби уже заполнено')
                    throw new Error(errorData.message || 'Ошибка: лобби уже заполнено');
                }
                const data = await response.json();
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
async function updateUIAfterLoadingLobby() {
    try {

        const currentPlayerId = auth.getPlayerId();
        const availableFactions = await playerop.getFactionsByPlayerId(currentPlayerId);
        
        // Получаем данные лобби
        const lobbyId =  getLobbyIdFromUrl();
        const result = await lobbyManager.getLobbyById(lobbyId);
        const lobbyData = lobbyDataParser.parse(result.data);

        const lobbyInfo = document.getElementById('lobbyInfo');
        if(!lobbyInfo) return;

        lobbyInfo.innerHTML = `<div>Бой номер ${lobbyData.id} в <a href="https://yandex.ru/maps/-/CPrXAW1r" class="alpha-rules">${lobbyData.meetingPlace}</a></div><div>Условия: Размер - ${lobbyData.matchSize}</div>`;

        
        
        const lobbyContainer = document.getElementById('lobbyContainer');
        if (!lobbyContainer) return;
        
        lobbyContainer.innerHTML = '';
        
        // Рендерим карточки игроков
        for (let i = 0; i < 2; i++) {
            const player = lobbyData.players[i];
            const isCurrentPlayer = player?.id == currentPlayerId;            
            const card = new playerCard(
                player,
                i,
                isCurrentPlayer,
                getLobbyIdFromUrl(),
                lobbyData,
                availableFactions
            );
            
            lobbyContainer.appendChild(card.render());
        }
        
    } catch (error) {
        console.error('Ошибка вывода:', error);
        return { success: false, error: error.message };
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
    const result = await lobbyManager.joinLobbyById(inputLobbyId,faction);
    
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
        console.log('Не страница лобби, пропускаем загрузку');
    }

});