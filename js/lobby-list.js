import { auth } from './authorization.js';
import { serverConfig } from './authorization.js';
import { playerop } from './player-operations.js';
import { lobbyManager } from './lobby-operations.js'; 

// Класс для управления списком лобби
export const lobbyListManager = {
    // Получение списка лобби с сервера
    async getLobbies(params = {}) {
        const {
            status = 'open',
            sort = 'created_desc',
            limit = 10,
            offset = 0
        } = params;
        
        try {
            const queryParams = new URLSearchParams();
            if (status) queryParams.append('status', status);
            if (sort) queryParams.append('sort', sort);
            if (limit) queryParams.append('limit', limit);
            if (offset) queryParams.append('offset', offset);
            
            const url = `${serverConfig.getUrl()}${serverConfig.getEndpoints().lobby.get}?${queryParams.toString()}`;
            
            console.log('Запрос списка лобби:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Ошибка получения списка лобби');
            }
            
            const data = await response.json();
            console.log('Получены лобби:', data);
            
            return {
                success: true,
                data: data
            };
            
        } catch (error) {
            console.error('Ошибка получения списка лобби:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    // Парсинг данных лобби для отображения
    parseLobbyItem(lobby) {
        // Находим имя хоста (первый игрок в лобби)
        let hostName = 'Неизвестный';
        let hostId = null;
        
        // Ищем игрока с hostPlayerId
        for (const key in lobby) {
            if (key.startsWith('player') && lobby[key].playerId === lobby.hostPlayerId) {
                hostId = lobby[key].playerId;
                break;
            }
        }
        
        return {
            id: lobby.id,
            hostId: hostId,
            hostName: hostName,
            matchSize: lobby.matchSize,
            meetingPlace: lobby.meetingPlace,
            isRanked: lobby.isRanked,
            status: lobby.status,
            createdAt: new Date(lobby.createdAt),
            playerCount: Object.keys(lobby).filter(key => key.startsWith('player')).length
        };
    },

    // Получение деталей лобби
    async getLobbyDetails(lobbyId) {
        try {
            const response = await fetch(`${serverConfig.getUrl()}${serverConfig.getEndpoints().lobby.get}/${lobbyId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                return null;
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Ошибка получения деталей лобби ${lobbyId}:`, error);
            return null;
        }
    },

    // Проверить, находится ли игрок в лобби
    async isPlayerInLobby(lobbyId, playerId) {
        const lobbyDetails = await this.getLobbyDetails(lobbyId);
        if (!lobbyDetails) return false;
        
        for (const key in lobbyDetails) {
            if (key.startsWith('player') && lobbyDetails[key].playerId === parseInt(playerId)) {
                return true;
            }
        }
        return false;
    },

    // Фильтрация лобби на клиенте
    filterLobbies(lobbies, currentPlayerId) {
        return lobbies.filter(lobby => {
            let playerCount = 0;
            for (const key in lobby) {
                if (key.startsWith('player')) {
                    playerCount++;
                }
            }
            
            let isPlayerInLobby = false;
            for (const key in lobby) {
                if (key.startsWith('player') && lobby[key].playerId === parseInt(currentPlayerId)) {
                    isPlayerInLobby = true;
                    break;
                }
            }
            
            const hasFreeSlot = playerCount < 2;
            return isPlayerInLobby || hasFreeSlot;
        });
    },

    // Обогащение лобби данными
    async enrichLobbiesWithNames(lobbies, currentPlayerId) {
        const enrichedLobbies = [];
        
        for (const lobby of lobbies) {
            // Используем this.parseLobbyItem
            const parsedLobby = this.parseLobbyItem(lobby);
            
            // Получаем имя хоста
            if (parsedLobby.hostId) {
                const name = await playerop.getNameById(parsedLobby.hostId);
                parsedLobby.hostName = name || `Игрок ${parsedLobby.hostId}`;
            }
            
            // Проверяем, есть ли текущий игрок в этом лобби
            const isPlayerInThisLobby = await this.isPlayerInLobby(lobby.id, currentPlayerId);
            parsedLobby.isCurrentPlayerInLobby = isPlayerInThisLobby;
            
            // Получаем количество игроков в лобби
            let playerCount = 0;
            for (const key in lobby) {
                if (key.startsWith('player')) {
                    playerCount++;
                }
            }
            parsedLobby.playerCount = playerCount;
            
            enrichedLobbies.push(parsedLobby);
        }
        
        return enrichedLobbies;
    }
};
// Функция для форматирования даты
function formatDate(date) {
    if (!date) return '—';
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

// Функция для отображения статуса лобби на русском
function getStatusText(status) {
    const statusMap = {
        'open': 'Открыто',
        'started': 'В процессе',
        'finished': 'Завершено'
    };
    return statusMap[status] || status;
}

// Функция для отображения статуса с цветом
function getStatusColor(status) {
    const colorMap = {
        'open': '#4CAF50',    // зеленый
        'started': '#FF9800',  // оранжевый
        'finished': '#9E9E9E'  // серый
    };
    return colorMap[status] || '#2196F3';
}

// Функция для отображения типа игры
function getGameTypeText(isRanked) {
    return isRanked ? 'Рейтинговый' : 'Обычный';
}

// Рендер таблицы с лобби
function renderLobbiesTable(lobbies, currentPlayerId, currentStatus = 'open') {
    if (!lobbies || lobbies.length === 0) {
        return `
            <div style="text-align: center; padding: 40px; color: #666;">
                😕 Нет лобби с выбранным статусом<br>
                <small>Попробуйте изменить фильтр</small>
            </div>
        `;
    }
    
    let tableHtml = `
        <table class="table-lobby" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
                <tr style="background-color: #333; color: white;">
                    <th style="padding: 12px; border: 1px solid #444;">Имя Игрока</th>
                    <th style="padding: 12px; border: 1px solid #444;">Размер</th>
                    <th style="padding: 12px; border: 1px solid #444;">Тип игры</th>
                    <th style="padding: 12px; border: 1px solid #444;">Место</th>
                    <th style="padding: 12px; border: 1px solid #444;">Игроков</th>
                    <th style="padding: 12px; border: 1px solid #444;">Статус</th>
                    <th style="padding: 12px; border: 1px solid #444;">Дата и время</th>
                    <th style="padding: 12px; border: 1px solid #444;">Действие</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    for (const lobby of lobbies) {
        const isFull = lobby.playerCount >= 2;
        const isPlayerInThisLobby = lobby.isCurrentPlayerInLobby;
        
        // Статус для отображения в таблице
        let displayStatus = '';
        let statusColor = '';
        
        switch (lobby.status) {
            case 'open':
                if (isFull && !isPlayerInThisLobby) {
                    displayStatus = 'Заполнено';
                    statusColor = '#f44336';
                } else {
                    displayStatus = 'Открыто';
                    statusColor = '#4CAF50';
                }
                break;
            case 'started':
                displayStatus = 'В процессе';
                statusColor = '#FF9800';
                break;
            case 'finished':
                displayStatus = 'Завершено';
                statusColor = '#9E9E9E';
                break;
            default:
                displayStatus = lobby.status;
                statusColor = '#2196F3';
        }
        
        // Кнопка действия
        let buttonText = '';
        let buttonDisabled = false;
        let buttonColor = '#4CAF50';
        
        if (lobby.status === 'finished') {
            buttonText = 'Просмотр';
            buttonColor = '#9E9E9E';
            buttonDisabled = false; // Можно смотреть завершённые бои
        } else if (isPlayerInThisLobby) {
            buttonText = 'Войти в лобби';
            buttonColor = '#2196F3';
        } else if (lobby.status === 'open' && !isFull) {
            buttonText = 'Подробнее';
            buttonColor = '#4CAF50';
        } else if (lobby.status === 'open' && isFull) {
            buttonText = 'Мест нет';
            buttonDisabled = true;
            buttonColor = '#ccc';
        } else if (lobby.status === 'started') {
            buttonText = 'Идёт игра';
            buttonDisabled = true;
            buttonColor = '#ccc';
        } else {
            buttonText = 'Недоступно';
            buttonDisabled = true;
            buttonColor = '#ccc';
        }
        
        const playersDisplay = `${lobby.playerCount}/2`;
        
        tableHtml += `
            <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 12px; border: 1px solid #ddd;">
                    ${escapeHtml(lobby.hostName)}
                    ${isPlayerInThisLobby ? '<span style="margin-left: 8px; font-size: 12px; color: #4CAF50;">✓ Вы здесь</span>' : ''}
                </td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${lobby.matchSize}</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${getGameTypeText(lobby.isRanked)}</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${escapeHtml(lobby.meetingPlace)}</td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">${playersDisplay}</td>
                <td style="padding: 12px; border: 1px solid #ddd;">
                    <span style="background-color: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                        ${displayStatus}
                    </span>
                </td>
                <td style="padding: 12px; border: 1px solid #ddd;">${formatDate(lobby.createdAt)}</td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: center;">
                    <button class="join-lobby-btn" 
                            data-lobby-id="${lobby.id}" 
                            ${buttonDisabled ? 'disabled' : ''}
                            style="background-color: ${buttonColor}; 
                                   color: ${buttonDisabled ? '#666' : 'white'}; 
                                   border: none; 
                                   padding: 6px 12px; 
                                   border-radius: 4px; 
                                   cursor: ${buttonDisabled ? 'not-allowed' : 'pointer'};
                                   transition: all 0.3s;">
                        ${buttonText}
                    </button>
                </td>
            </tr>
        `;
    }
    
    tableHtml += `
            </tbody>
        </table>
    `;
    
    return tableHtml;
}

// Простая функция для экранирования HTML
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Пагинация
function renderPagination(total, limit, offset, onPageChange) {
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;
    
    if (totalPages <= 1) return '';
    
    let paginationHtml = '<div class="pagination" style="display: flex; justify-content: center; gap: 10px; margin-top: 20px; flex-wrap: wrap;">';
    
    // Кнопка "Первая"
    if (currentPage > 1) {
        paginationHtml += `<button class="page-btn" data-offset="0" style="padding: 8px 12px; background-color: #333; color: white; border: none; border-radius: 4px; cursor: pointer; transition: all 0.3s;">
            ⏮ Первая
        </button>`;
    }
    
    // Кнопка "Назад"
    if (currentPage > 1) {
        const prevOffset = (currentPage - 2) * limit;
        paginationHtml += `<button class="page-btn" data-offset="${prevOffset}" style="padding: 8px 12px; background-color: #333; color: white; border: none; border-radius: 4px; cursor: pointer; transition: all 0.3s;">
            ← Назад
        </button>`;
    }
    
    // Номера страниц
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    // Корректировка для отображения большего диапазона на больших страницах
    if (totalPages > 7) {
        if (currentPage <= 3) {
            endPage = 5;
        } else if (currentPage >= totalPages - 2) {
            startPage = totalPages - 4;
        }
    }
    
    if (startPage > 1) {
        paginationHtml += `<button class="page-btn" data-offset="0" style="padding: 8px 12px; background-color: #333; color: white; border: none; border-radius: 4px; cursor: pointer;">1</button>`;
        if (startPage > 2) {
            paginationHtml += `<span style="padding: 8px; color: #666;">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage;
        const pageOffset = (i - 1) * limit;
        paginationHtml += `<button class="page-btn" data-offset="${pageOffset}" style="padding: 8px 12px; background-color: ${isActive ? '#4CAF50' : '#333'}; color: white; border: none; border-radius: 4px; cursor: pointer; transition: all 0.3s; ${isActive ? 'font-weight: bold;' : ''}">
            ${i}
        </button>`;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHtml += `<span style="padding: 8px; color: #666;">...</span>`;
        }
        const lastOffset = (totalPages - 1) * limit;
        paginationHtml += `<button class="page-btn" data-offset="${lastOffset}" style="padding: 8px 12px; background-color: #333; color: white; border: none; border-radius: 4px; cursor: pointer;">${totalPages}</button>`;
    }
    
    // Кнопка "Вперед"
    if (currentPage < totalPages) {
        const nextOffset = currentPage * limit;
        paginationHtml += `<button class="page-btn" data-offset="${nextOffset}" style="padding: 8px 12px; background-color: #333; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Вперед →
        </button>`;
    }
    
    // Кнопка "Последняя"
    if (currentPage < totalPages) {
        const lastOffset = (totalPages - 1) * limit;
        paginationHtml += `<button class="page-btn" data-offset="${lastOffset}" style="padding: 8px 12px; background-color: #333; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Последняя ⏭
        </button>`;
    }
    
    // Информация о текущей странице
    const startItem = offset + 1;
    const endItem = Math.min(offset + limit, total);
    paginationHtml += `<div style="margin-left: 15px; padding: 8px 12px; color: #f0f0f0; font-size: 14px;">
        ${startItem} - ${endItem} из ${total}
    </div>`;
    
    paginationHtml += '</div>';
    
    return paginationHtml;
}

// Фильтры для списка лобби
function renderFilters(currentFilters) {
    return `
        <div class="lobby-filters" style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; justify-content: center;">
            <div class="filter-group">
                <label style="margin-right: 8px;">Статус:</label>
                <select id="filterStatus" class="filter-select" style="padding: 6px 12px; border-radius: 4px; border: 1px solid #ddd;">
                    <option value="open" ${currentFilters.status === 'open' ? 'selected' : ''}>Открытые</option>
                    <option value="started" ${currentFilters.status === 'started' ? 'selected' : ''}>В процессе</option>
                    <option value="finished" ${currentFilters.status === 'finished' ? 'selected' : ''}>Завершённые</option>
                    <option value="" ${currentFilters.status === '' ? 'selected' : ''}>Все</option>
                </select>
            </div>
            
            <div class="filter-group">
                <label style="margin-right: 8px;">Сортировка:</label>
                <select id="filterSort" class="filter-select" style="padding: 6px 12px; border-radius: 4px; border: 1px solid #ddd;">
                    <option value="created_desc" ${currentFilters.sort === 'created_desc' ? 'selected' : ''}>Новые сначала</option>
                    <option value="created_asc" ${currentFilters.sort === 'created_asc' ? 'selected' : ''}>Старые сначала</option>
                    <option value="id_desc" ${currentFilters.sort === 'id_desc' ? 'selected' : ''}>ID (убыв.)</option>
                    <option value="id_asc" ${currentFilters.sort === 'id_asc' ? 'selected' : ''}>ID (возр.)</option>
                </select>
            </div>
            
            <button id="refreshLobbiesBtn" style="padding: 6px 16px; background-color: rgba(194, 118, 47, 0.9); color: white; border: none; border-radius: 4px; cursor: pointer;">
                Обновить
            </button>
        </div>
    `;
}
// Основная функция загрузки и отображения лобби
async function loadAndDisplayLobbies(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Контейнер с id "${containerId}" не найден`);
        return;
    }
    
    // Проверяем авторизацию
    const currentPlayerId = auth.getPlayerId();
    if (!currentPlayerId) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                Авторизуйтесь, чтобы просмотреть список лобби
            </div>
        `;
        return;
    }
    
    // Состояние фильтров
    let currentFilters = {
        status: options.status || 'open',
        sort: options.sort || 'created_desc',
        limit: options.limit || 10,
        offset: options.offset || 0
    };
    
    let currentTotal = 0;
    let currentLobbies = [];
    
    // Функция загрузки
    async function load() {
        try {
            // Показываем загрузку
            container.innerHTML = '<div style="text-align: center; padding: 40px;">Загрузка списка боев...</div>';
            
            // Получаем данные с сервера с пагинацией
            const result = await lobbyListManager.getLobbies(currentFilters);
            
            if (!result.success) {
                container.innerHTML = `<div style="text-align: center; padding: 40px; color: red;">Ошибка: ${result.error}</div>`;
                return;
            }
            
            // Сохраняем общее количество
            currentTotal = result.data.total || 0;
            
            // Получаем все лобби с текущей страницы
            const lobbies = result.data.items || [];
            
            if (lobbies.length === 0 && currentTotal === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        Нет лобби с выбранным статусом<br>
                        <small>Попробуйте изменить фильтр или создайте новое лобби!</small>
                    </div>
                `;
                return;
            }
            
            // Обогащаем лобби данными
            const enrichedLobbies = await lobbyListManager.enrichLobbiesWithNames(lobbies, currentPlayerId);
            currentLobbies = enrichedLobbies;
            
            // Рендерим
            const filtersHtml = renderFilters(currentFilters);
            const tableHtml = renderLobbiesTable(enrichedLobbies, currentPlayerId, currentFilters.status);
            
            // Рендерим пагинацию
            const paginationHtml = renderPagination(
                currentTotal, 
                currentFilters.limit, 
                currentFilters.offset,
                (newOffset) => {
                    currentFilters.offset = newOffset;
                    load();
                }
            );
            
            // Подсказка в зависимости от выбранного статуса
            let hintText = '';
            if (currentFilters.status === 'open') {
                hintText = 'Показаны только открытые лобби со свободными местами и ваши активные';
            } else if (currentFilters.status === 'started') {
                hintText = 'Показаны лобби, где игра уже началась';
            } else if (currentFilters.status === 'finished') {
                hintText = 'Показаны завершённые бои (только для просмотра)';
            } else {
                hintText = 'Показаны все лобби';
            }
            
            container.innerHTML = `
                <div style="align-self: center; justify-self: center; width: 100%; overflow-x: auto;">
                    <div style="font-size: 20px; font-weight: bold; margin-bottom: 15px; text-align: center;">
                        🎮 Список лобби (${currentTotal})
                    </div>
                    <div style="font-size: 14px; color: #e4e4e4; text-align: center; margin-bottom: 10px;">
                        ${hintText}
                    </div>
                    ${filtersHtml}
                    <div style="overflow-x: auto;">
                        ${tableHtml}
                    </div>
                    ${paginationHtml}
                </div>
            `;
            
            // Навешиваем обработчики
            attachEventHandlers(container);
            
        } catch (error) {
            console.error('Ошибка загрузки лобби:', error);
            container.innerHTML = `<div style="text-align: center; padding: 40px; color: red;">Ошибка: ${error.message}</div>`;
        }
    }
    
    function attachEventHandlers(containerElement) {
        // Обработчики фильтров
        const statusSelect = containerElement.querySelector('#filterStatus');
        const sortSelect = containerElement.querySelector('#filterSort');
        const refreshBtn = containerElement.querySelector('#refreshLobbiesBtn');
        
        if (statusSelect) {
            statusSelect.addEventListener('change', (e) => {
                currentFilters.status = e.target.value;
                currentFilters.offset = 0; // Сбрасываем страницу при смене фильтра
                load();
            });
        }
        
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                currentFilters.sort = e.target.value;
                currentFilters.offset = 0; // Сбрасываем страницу при смене сортировки
                load();
            });
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                load();
            });
        }
        
        // Обработчики кнопок пагинации
        const pageButtons = containerElement.querySelectorAll('.page-btn');
        pageButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const newOffset = parseInt(btn.dataset.offset);
                if (!isNaN(newOffset)) {
                    currentFilters.offset = newOffset;
                    load();
                }
            });
        });
        
        // Обработчики кнопок перехода в лобби
        const viewButtons = containerElement.querySelectorAll('.join-lobby-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const lobbyId = btn.dataset.lobbyId;
                const lobby = currentLobbies.find(l => l.id == lobbyId);
                
                // Для завершённых лобби - только просмотр
                if (lobby && lobby.status === 'finished') {
                    alert('Это завершённый бой. Вы можете только просмотреть его результаты.');
                } else {
                    window.location.href = `../html/alphastriker-lobby.html?id=${lobbyId}`;
                }
            });
        });
    }
    
    // Начинаем загрузку
    await load();
}
// Экспортируем функцию для использования в других файлах
export { loadAndDisplayLobbies };