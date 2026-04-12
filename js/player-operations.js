import { auth } from './authorization.js';
import { serverConfig } from './authorization.js';
import { lobbyDataParser } from './lobby-operations.js';

export const playerop = {
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

        try {
            const result = await this.getPlayerData(playerId);

            if (result.success && result.data) {
                const playerFaction = result.data.factions; 

                console.log(`Найдены фракции игрока ${playerId}: ${playerFaction}`);
                return playerFaction;
            } else {
                console.error(`Не удалось получить фракции игрока ${playerId}:`, result.error);
                return `Игрок ${playerId}`; // Возвращаем ID как имя по умолчанию
            }

        } catch (error) {
            console.error(`Ошибка в getNameById для ${playerId}:`, error);
            return `Игрок ${playerId}`;
        }
    },
};

export const playercard = {
    async constructor(playerId, isCurrentPlayer, onReadyChange){
        const data = await playerop.getPlayerData(playerId)
        const playerNickname = data.nickname;
        const playerFactions = data.factions || [];
        const playerFactionExperience = data.factionExperience || [];
        this.isCurrentPlayer = isCurrentPlayer;
    }
};