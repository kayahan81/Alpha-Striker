import { auth } from './authorization.js';
import { serverConfig } from './authorization.js';
import { lobbyDataParser, lobbyManager } from './lobby-operations.js';

export const playerop = {
    cache: new Map(),
    setPlayerData(playerId, data) {
        const key = String(playerId);
        this.cache.set(key, {
            ...data,
            cachedAt: Date.now()
        });
    },
    async getPlayerData(playerId)
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
            if (this.cache.has(String(playerId))) {
                const cached = this.cache.get(String(playerId));
                console.log(`Данные игрока ${playerId} взяты из кэша`);
                return {
                    success: true,
                    data: cached,
                    fromCache: true 
                };
            }
            try{
                const response = await fetch(`${serverConfig.getUrl()}${serverConfig.getEndpoints().getplayer}${playerId}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },               
                })

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Ошибка получения данных пользователя');
                }
                const data = await response.json();
                this.setPlayerData(playerId, data);
                return {
                    success: true,
                    data: data
                };                
            }
            catch(error){
                console.error('Ошибка получения данных пользователя:', error);
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    },
    
    // Получить имя игрока по ID
    async getNameById(playerId) {
        if (!playerId) {
            console.error('ID игрока не указан');
            return null;
        }
        if (this.cache.has(String(playerId))) {
            const cached = this.cache.get(String(playerId));
            console.log(`Имя игрока ${playerId} взято из кэша`);
            return cached.nickname;
        }
        console.log(`Запрашиваем имя игрока ${playerId} с сервера`);
        try {
            const result = await this.getPlayerData(playerId);

            if (result.success && result.data) {
                const playerName = result.data.nickname; 

                console.log(`Найдено имя для игрока ${playerId}: ${playerName}`);
                return playerName;
            } else {
                console.error(`Не удалось получить имя для игрока ${playerId}:`, result.error);
                return `Игрок ${playerId}`; // Возвращаем ID как имя по умолчанию
            }

        } catch (error) {
            console.error(`Ошибка в getNameById для ${playerId}:`, error);
            return `Игрок ${playerId}`;
        }
    },

    async getFactionsByPlayerId(playerId){
        if (!playerId) {
            console.error('ID игрока не указан');
            return null;
        }
        if (this.cache.has(String(playerId))) {
            const cached = this.cache.get(String(playerId));
            console.log(`Фракции игрока ${playerId} взяты из кэша`);
            return cached.factions;
        }
        try {
            const result = await this.getPlayerData(playerId);

            if (result.success && result.data && result.data.factions.length) {
                const playerFactions = result.data.factions; 

                console.log(`Найдены фракции игрока ${playerId}: ${playerFactions}`);
                return playerFactions;
            } else {
                console.error(`Не удалось получить фракции игрока ${playerId}: игрок не выбирал фракций раньше`, result.error);
                return `Игрок ${playerId} не выбирал фракций раньше`; // Возвращаем ID как имя по умолчанию
            }

        } catch (error) {
            console.error(`Ошибка в getFactionsByPlayerId для ${playerId}:`, error);
            return `Игрок ${playerId}`;
        }
    },
    // Очистка кэша
    clearCache() {
        this.cache.clear();
        console.log('Кэш игроков очищен');
    },
    // Очистка конкретного игрока
    clearPlayerCache(playerId) {
        this.cache.delete(playerId);
    },
    // Обновление данных в кэше
    updatePlayerData(playerId, newData) {
        if (this.cache.has(playerId)) {
            const existing = this.cache.get(playerId);
            this.cache.set(playerId, { ...existing, ...newData });
        }
    }
};

export class playerCard{
    constructor(playerData, index, isCurrentPlayer, lobbyId, lobbyData, availableFactions) {
        this.playerData = playerData; //GET /player/id
        this.index = index; //Место в лобби (0 хост, 1 не хост)
        this.isCurrentPlayer = isCurrentPlayer; 
        this.lobbyId = lobbyId;
        this.lobbyData = lobbyData || [];
        this.availableFactions = availableFactions || [];
    }
    
    render() {
        const container = document.createElement('div');
        container.className = 'player-card';
        container.id = `player${this.index + 1}Card`;
        
        if (!this.playerData) {
            // Пустой слот
            container.innerHTML = `
                <h3>Игрок ${this.index + 1}</h3>
                <div class="empty-slot">
                    ${this.index === 1 ? this.renderEmptySlot() : '<p>Слот свободен</p>'}
                </div>
            `;
            
            if (this.index === 1) {
                this.attachEmptySlotHandlers(container);
            }
        } else {
            // Занятый слот
            container.innerHTML = this.renderPlayerCard();
            this.attachPlayerHandlers(container);
        }
        
        return container;
    }
    
    renderEmptySlot() {
        const currentPlayerId = auth.getPlayerId();
        const isCurrentPlayerInLobby = this.isCurrentPlayerInLobby();
        
        console.log('Рендер пустого слота:', {
            currentPlayerId,
            isCurrentPlayerInLobby,
            lobbyPlayers: this.lobbyData?.players
        });
        
        if (isCurrentPlayerInLobby) {
            console.log('Показываем форму ПРИГЛАШЕНИЯ');
            return this.renderInviteForm();
        } 
        else {
            console.log('Показываем форму ПРИСОЕДИНЕНИЯ');
            return this.renderJoinForm();
        }
    }
    
    isCurrentPlayerInLobby() {
        const currentPlayerId = auth.getPlayerId();
        if (!currentPlayerId || !this.lobbyData?.players) return false;
        
        return this.lobbyData.players.some(player => 
            player && player.id === parseInt(currentPlayerId)
        );
    }
    
    // Форма ПРИГЛАШЕНИЯ (для создателя лобби)
    renderInviteForm() {
        const lobbyUrl = `${window.location.origin}/lobby/${this.lobbyId}`;
        
        return `
            <div class="invite-form">
                <div class="invite-header">
                    <span class="invite-icon">👥</span>
                    <span>Пригласить игрока</span>
                </div>
                
                <div class="invite-link-box">
                    <input type="text" 
                           id="inviteLink" 
                           class="invite-link-input" 
                           value="${lobbyUrl}" 
                           readonly>
                    <button id="copyLinkBtn" class="copy-button" title="Копировать ссылку">
                    </button>
                </div>
                
                <div class="waiting-status">
                    <div class="status-indicator waiting"></div>
                    <span>Ожидание подключения второго игрока...</span>
                </div>
            </div>
        `;
    }
    
    renderJoinForm() {
        const options = this.generateFactionOptions();
        return `
            <div class="join-form">
                <div class="join-header">
                    <span class="join-icon">🎮</span>
                    <span>Присоединиться к игре</span>
                </div>
                
                <div class="faction-selector-wrapper">
                    <label>Выберите фракцию:</label>
                    <select id="factionSelector" class="faction-selector">
                        ${options}
                    </select>
                </div>
                
                <div id="newFactionContainer" style="display: none; margin-top: 10px;">
                    <input type="text" id="newFactionName" 
                           placeholder="Название новой фракции">
                    <button id="addFactionBtn" class="add-faction-btn">Добавить</button>
                </div>
                
                <button id="joinLobbyBtn" class="join-button">
                    Присоединиться
                </button>
            </div>
        `;
    }
    
    generateFactionOptions() {
        let options = '';
        
        if (this.availableFactions.length){
            this.availableFactions.forEach(faction => {
                options += `<option value="${faction.name}">${faction.name}</option>`;
            });
        }  
        // Добавляем опцию "Добавить фракцию"
        options += `<option value="AddNewFaction">Добавить новую фракцию</option>`;
        
        return options;
    }
    
    // Навешиваем обработчики для пустого слота
    attachEmptySlotHandlers(container) {
        const isCurrentPlayerInLobby = this.isCurrentPlayerInLobby();
        
        if (isCurrentPlayerInLobby) {
            // Обработчики для формы ПРИГЛАШЕНИЯ
            this.attachInviteHandlers(container);
        } else {
            // Обработчики для формы ПРИСОЕДИНЕНИЯ
            this.attachJoinHandlers(container);
        }
    }
    
    // Обработчики для формы приглашения
    attachInviteHandlers(container) {
        const copyBtn = container.querySelector('#copyLinkBtn');
        const inviteInput = container.querySelector('#inviteLink');
        
        if (copyBtn && inviteInput) {
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(inviteInput.value);
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = '✅';
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                    }, 1500);
                } catch (err) {
                    inviteInput.select();
                    document.execCommand('copy');
                    alert('Ссылка скопирована!');
                }
            });
        }
    }
    
    // Обработчики для формы присоединения
    attachJoinHandlers(container) {
        const selector = container.querySelector('#factionSelector');
        const inputContainer = container.querySelector('#newFactionContainer');
        const newFactionInput = container.querySelector('#newFactionName');
        const addFactionBtn = container.querySelector('#addFactionBtn');
        const joinBtn = container.querySelector('#joinLobbyBtn');
        
        if (!selector || !joinBtn) return;
        
        // Показываем/скрываем поле ввода новой фракции
        const toggleNewFactionInput = () => {
            if (selector.value === 'AddNewFaction') {
                inputContainer.style.display = 'block';
                if (newFactionInput) newFactionInput.focus();
            } else {
                inputContainer.style.display = 'none';
            }
        };
        
        selector.addEventListener('change', toggleNewFactionInput);
        
        // Добавление новой фракции
        if (addFactionBtn && newFactionInput) {
            addFactionBtn.addEventListener('click', async () => {
                const newFactionName = newFactionInput.value.trim();
                if (!newFactionName) {
                    alert('Введите название фракции');
                    return;
                }
                
                // Добавляем в select
                const newOption = document.createElement('option');
                newOption.value = newFactionName;
                newOption.textContent = newFactionName;
                selector.insertBefore(newOption, selector.querySelector('option[value="AddNewFaction"]'));
                
                selector.value = newFactionName;
                inputContainer.style.display = 'none';
                newFactionInput.value = '';
            });
            
            newFactionInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addFactionBtn.click();
            });
        }
        
        // Присоединение к лобби
        joinBtn.addEventListener('click', async () => {
            let selectedFaction = selector.value;
            
            if (selectedFaction === 'AddNewFaction') {
                selectedFaction = newFactionInput?.value.trim();
                if (!selectedFaction) {
                    alert('Введите название фракции');
                    return;
                }
            }
            
            await lobbyManager.joinLobbyById(this.lobbyId, selectedFaction);
        });
        
        // Инициализация
        toggleNewFactionInput();
    }

    renderPlayerCard() {
        const allready = this.lobbyData.areAllPlayersReady()
        if (!allready){
            return `
            <div class="player-info">
                <div class="player-avatar">
                    ${this.isCurrentPlayer ? '👤' : '🎮'}
                </div>
                <h3>Игрок ${this.index + 1} ${this.isCurrentPlayer ? '-- ВЫ!' : ''}</h3>
                <div class="player-details">
                    <p><strong>Имя:</strong> <span class="player-name" data-player-id="${this.playerData.id}">${this.playerData.name || 'Загрузка...'}</span>#${this.playerData.id}</p>
                    <p><strong>Фракция:</strong> <span class="player-faction">${this.playerData.faction || 'Не выбрана'}</span></p>
                </div>
                <label class="ready-checkbox-label">
                    <input type="checkbox" class="ready-checkbox" 
                        ${this.playerData.isReady ? 'checked' : ''}
                        ${!this.isCurrentPlayer ? 'disabled' : ''}>
                    <span>Готов</span>
                </label>
            </div>
            `;
        }
        else{
            return `
                <div class="player-info">
                    <div class="player-avatar">
                        ${this.isCurrentPlayer ? '👤' : '🎮'}
                    </div>
                    <h3>Игрок ${this.index + 1} ${this.isCurrentPlayer ? '-- ВЫ!' : ''}</h3>
                    <div class="player-details">
                        <p><strong>Имя:</strong> <span class="player-name" data-player-id="${this.playerData.id}">${this.playerData.name || 'Загрузка...'}</span>#${this.playerData.id}</p>
                        <p><strong>Фракция:</strong> <span class="player-faction">${this.playerData.faction || 'Не выбрана'}</span></p>
                    </div>
                    <label class="ready-checkbox-label">
                        <input type="checkbox" class="ready-checkbox" 
                            ${this.playerData.isReady ? 'checked' : ''}
                            ${!this.isCurrentPlayer ? 'disabled' : ''}>
                        <span>Готов</span>
                        <input type="checkbox" class="finish-checkbox" 
                            ${this.playerData.isFinished ? 'checked' : ''}
                            ${!this.isCurrentPlayer ? 'disabled' : ''}>
                        <span>Закончить бой?</span>
                    </label>
                </div>
            `;
        }
    }
    
    attachInviteFormHandlers(container) {
        const copyBtn = container.querySelector('#copyLinkBtn');
        const inviteInput = container.querySelector('#inviteLink');
        
        // Копирование ссылки
        if (copyBtn && inviteInput) {
            copyBtn.addEventListener('click', async () => {
                await this.copyToClipboard(inviteInput.value, copyBtn);
            });
        }    
    }
    
    async copyToClipboard(text, buttonElement) {
        try {
            await navigator.clipboard.writeText(text);
            
            // Визуальная обратная связь
            const originalText = buttonElement.textContent;
            buttonElement.textContent = '✅';
            buttonElement.style.transform = 'scale(1.1)';
            
            setTimeout(() => {
                buttonElement.textContent = originalText;
                buttonElement.style.transform = '';
            }, 1500);
            
        } catch (err) {
            alert('Ошибка копирования !', err)
        }
    }
    
    attachPlayerHandlers(container) {
        // Загружаем имя асинхронно
        if (this.playerData.id && !this.playerData.name) {
            playerop.getNameById(this.playerData.id).then(name => {
                const nameSpan = container.querySelector('.player-name');
                if (nameSpan) nameSpan.textContent = name;
            });
        }
        
        // Навешиваем обработчик на чекбокс
        const checkbox = container.querySelector('.ready-checkbox');
        const finishbox = container.querySelector('.finish-checkbox');

        if (checkbox && this.isCurrentPlayer) {
            if (checkbox.checked) checkbox.disabled = true;
            checkbox.addEventListener('change', () => {
                lobbyManager.playerReadyInLobbyById(this.lobbyId);
                if (checkbox.checked) checkbox.disabled = true;
            });
        }
        if (finishbox && this.isCurrentPlayer) {

            if (finishbox.checked) finishbox.disabled = true;
            finishbox.addEventListener('change', () => {
                lobbyManager.playerReadyToEndInLobbyById(this.lobbyId);
                if (finishbox.checked) finishbox.disabled = true;
            });
        }
    }
}