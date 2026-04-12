import { auth } from './authorization.js';
import { serverConfig } from './authorization.js';
import { playerop } from './player-operations.js';


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

export const lobbyop = {
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
    
    async lookUpLobbyById(inputLobbyId){
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

    async playerReadyInLobbyById(playerId, inputLobbyId){
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
                    body: {
                        "playerId": auth.getPlayerId(),
                    }            
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
          
    }

};

async function handleLobbyCreation() {

    const placeInput = document.getElementById('place');
    const sizeInput = document.getElementById('size');
    const factionInput = document.getElementById('faction');
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
    const result = await lobbyop.createLobby(lobbyData);
    
    // Восстанавливаем кнопку
    if (createLobbyButton) {
        createLobbyButton.disabled = false;
        createLobbyButton.textContent = 'Создать лобби!';
    }
}

function getLobbyIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const lobbyId = urlParams.get('id');
    return lobbyId ? Number(lobbyId) : null;
}


// Функция обновления интерфейса после перехода на страницу
async function updateUIAfterLoadingLobby() {
    const result = await lobbyop.lookUpLobbyById(getLobbyIdFromUrl());
    const lobbyData = lobbyDataParser.parse(result.data);

    const joinForm = document.getElementById('joinForm');
    const playerForm = document.getElementById('playerForm');
    const inviteForm = document.getElementById('inviteForm');

    const user1ReadyFlag = document.getElementById('user1ReadyFlag');
    const user1IdSpan = document.getElementById('user1IdSpan');
    const user1NameSpan = document.getElementById('user1NameSpan');
    const user1FactionSpan = document.getElementById('user1FactionSpan');

    const user2ReadyFlag = document.getElementById('user2ReadyFlag');
    const user2IdSpan = document.getElementById('user2IdSpan');
    const user2NameSpan = document.getElementById('user2NameSpan');
    const user2FactionSpan = document.getElementById('user2FactionSpan');
    const user2FactionSelector = document.getElementById('user2FactionSelector');
    const user2FactionSelectorNameInput = document.getElementById('user2FactionSelectorNameInput');

    try{
        if (user1ReadyFlag) user1ReadyFlag.checked = lobbyData.players[0].isReady;
        if (lobbyData.players[0].isReady || auth.getPlayerId() != lobbyData.players[0].id) user1ReadyFlag.disabled = true;
        if (user1IdSpan) user1IdSpan.textContent = '#'+lobbyData.players[0].id;
        if (user1NameSpan) user1NameSpan.textContent = await playerop.getNameById(lobbyData.players[0].id);
        if (user1FactionSpan) user1FactionSpan.textContent = 'Фракция: '+lobbyData.players[0].faction;
        if (lobbyData.players[1]){
            if (joinForm) joinForm.style.display = 'none';
            if (playerForm) playerForm.style.display = 'block';
            if (inviteForm) inviteForm.style.display = 'none';      
            if (user2ReadyFlag) user2ReadyFlag.checked = lobbyData.players[1].isReady;
            if (lobbyData.players[1].isReady || auth.getPlayerId() != lobbyData.players[1].id) user2ReadyFlag.disabled = true;
            if (user2IdSpan) user2IdSpan.textContent = '#'+lobbyData.players[1].id;
            if (user2NameSpan) user2NameSpan.textContent = await playerop.getNameById(lobbyData.players[1].id);
            if (user2FactionSpan) user2FactionSpan.textContent = 'Фракция: '+lobbyData.players[1].faction;
        }
        else if (lobbyData.hostPlayerId == auth.getPlayerId()){
            if (joinForm) joinForm.style.display = 'none';
            if (playerForm) playerForm.style.display = 'none';      
            if (inviteForm) inviteForm.style.display = 'block';      
            
        }
        else{
            if (joinForm) joinForm.style.display = 'block';
            if (playerForm) playerForm.style.display = 'none';
            user2FactionSelector.addEventListener('change', ()=>user2FactionSelectorNameInput.style.display = user2FactionSelector.value === 'AddNewFaction' ? 'block' : 'none');
        }
    }
    catch(error){
        console.error('Ошибка вывода:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

function updateUIAfterReady(){
    const lobbyData = lobbyDataParser.parse(result.data);
    if(lobbyData.players[0].id == auth.getPlayerId) {const userReadyFlag = document.getElementById('user1ReadyFlag')}
    else if (lobbyData.players[1].id == auth.getPlayerId){const userReadyFlag = document.getElementById('user2ReadyFlag')}
    playerReadyInLobbyById(userReadyFlag);
}

function updateUIAfterJoiningLobby() {
    const loginForm = document.getElementById('loginForm');
    const userGreeting = document.getElementById('userGreeting');
    const usernameSpan = document.getElementById('username');
    
    if (loginForm) loginForm.style.display = 'none';
    if (userGreeting) userGreeting.style.display = 'block';
    if (usernameSpan) usernameSpan.textContent = userData.playerId || auth.getPlayerId();
}


async function handlelookUpLobbyById() {

    const lobbyIdInput = document.getElementById('lobbyIdInput');
    const lookUpLobbyByIdButton = document.getElementById('lookUpLobbyByIdButton');

    const inputLobbyId = lobbyIdInput?.value || '';

    // Валидация полей
    if (!inputLobbyId) {
        alert('Заполните данные о лобби');
        return;
    }

    // Показываем индикатор загрузки
    if (lookUpLobbyByIdButton) {
        lookUpLobbyByIdButton.disabled = true;
        lookUpLobbyByIdButton.textContent = 'Смотрим...';
    }
    
    // Вызываем функцию поиска лобби по айди
    const result = await lobbyop.lookUpLobbyById(inputLobbyId);
    
    // Восстанавливаем кнопку
    if (lookUpLobbyByIdButton) {
        lookUpLobbyByIdButton.disabled = false;
        lookUpLobbyByIdButton.textContent = 'Найти лобби!';
    }
    
    if (result.success) {
        window.location.href = `../html/alphastriker-lobby.html?id=${result.data.id}`;
        // window.location.href = `lobby.html?id=${inputLobbyId}`;
    } else {
        alert('Ошибка: ' + result.error);
    }
}

async function handlejoinLobbyById() {

    const factionInput = document.getElementById('faction');
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
    const result = await lobbyop.joinLobbyById(inputLobbyId,faction);
    
    // Восстанавливаем кнопку
    if (joinLobbyByIdButton) {
        joinLobbyByIdButton.disabled = false;
        joinLobbyByIdButton.textContent = 'Зайти в лобби!';
    }
    
    /*
    if (result.success) {
        // Успешный вход - обновляем интерфейс
        updateUIAfterLogin(result.data);
    } else {
        // Ошибка - показываем сообщение
        alert('Ошибка: ' + result.error);
    }
    */
}

document.addEventListener('DOMContentLoaded', () => {

    // Навешиваем обработчики на кнопки
    const createLobbyButton = document.getElementById('createLobbyButton');
    const joinLobbyByIdButton = document.getElementById('joinLobbyByIdButton');
    const lookUpLobbyByIdButton = document.getElementById('lookUpLobbyByIdButton');
    
    if (createLobbyButton) {
        createLobbyButton.addEventListener('click', handleLobbyCreation);
    }
    if (joinLobbyByIdButton) {
        joinLobbyByIdButton.addEventListener('click', handlejoinLobbyById);
    }
    if (lookUpLobbyByIdButton) {
        lookUpLobbyByIdButton.addEventListener('click', handlelookUpLobbyById);
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