// Ждем загрузки всей страницы
document.addEventListener('DOMContentLoaded', function() {
    
    // Находим элементы на странице
    const fileInput = document.getElementById('excelInput');
    const loadButton = document.getElementById('loadBtn');
    const outputDiv = document.getElementById('output');
    
    // Что должно произойти при клике на кнопку
    loadButton.addEventListener('click', function() {
        
        // Проверяем, выбран ли файл
        if (!fileInput.files || fileInput.files.length === 0) {
            outputDiv.innerHTML = '<p style="color: red;">Пожалуйста, выберите Excel файл</p>';
            return;
        }
        
        // Получаем выбранный файл
        const file = fileInput.files[0];
        
        // Создаем объект для чтения файла
        const reader = new FileReader();
        
        // Что делать, когда файл загрузится
        reader.onload = function(e) {
            try {
                // Получаем данные файла
                const data = new Uint8Array(e.target.result);
                
                // Читаем Excel файл
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Получаем первый лист
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                
                // Преобразуем лист в JSON (массив объектов)
                const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
                    header: 1,  // header: 1 значит вернуть как массив массивов
                    defval: ""  // пустые ячейки заполнять пустой строкой
                });
                
                // Теперь jsonData - это массив строк и столбцов
                // jsonData[0] - первая строка, jsonData[0][0] - ячейка A1
                // Нам нужны ячейки B1:E11
                // B - это столбец 2 (индекс 1, так как счет с 0)
                // E - это столбец 5 (индекс 4)
                // Строки с 1 по 11 (индексы 0-10)
                
                let resultHtml = '<h2>Данные из диапазона B1:E11</h2>';
                resultHtml += '<table>';
                
                // Создаем заголовки таблицы (B1, C1, D1, E1)
                resultHtml += '<thead><tr>';
                resultHtml += '<th>Столбец B</th>';
                resultHtml += '<th>Столбец C</th>';
                resultHtml += '<th>Столбец D</th>';
                resultHtml += '<th>Столбец E</th>';
                resultHtml += '</tr></thead>';
                
                resultHtml += '<tbody>';
                
                // Проходим по строкам с 1 по 11 (индексы 0-10)
                for (let rowIndex = 0; rowIndex <= 10; rowIndex++) {
                    // Проверяем, существует ли такая строка
                    if (jsonData[rowIndex]) {
                        resultHtml += '<tr>';
                        
                        // Берем ячейки B (индекс 1), C (2), D (3), E (4)
                        for (let colIndex = 1; colIndex <= 4; colIndex++) {
                            let cellValue = jsonData[rowIndex][colIndex];
                            
                            // Если ячейка пустая, показываем пустоту
                            if (cellValue === undefined || cellValue === '') {
                                cellValue = '—';
                            }
                            
                            resultHtml += `<td>${cellValue}</td>`;
                        }
                        
                        resultHtml += '</tr>';
                    } else {
                        // Если строки нет, добавляем пустую строку
                        resultHtml += '<tr>';
                        for (let i = 0; i < 4; i++) {
                            resultHtml += '<td>—</td>';
                        }
                        resultHtml += '</tr>';
                    }
                }
                
                resultHtml += '</tbody></table>';
                
                // Показываем результат
                outputDiv.innerHTML = resultHtml;
                
                // Выводим в консоль для отладки
                console.log('Все данные из файла:', jsonData);
                console.log('Нужный диапазон:');
                for (let i = 0; i <= 10; i++) {
                    if (jsonData[i]) {
                        console.log(`Строка ${i+1}: B=${jsonData[i][1]}, C=${jsonData[i][2]}, D=${jsonData[i][3]}, E=${jsonData[i][4]}`);
                    }
                }
                
            } catch (error) {
                console.error('Ошибка:', error);
                outputDiv.innerHTML = `<p style="color: red;">Ошибка при чтении файла: ${error.message}</p>`;
            }
        };
        
        // Что делать при ошибке чтения
        reader.onerror = function() {
            outputDiv.innerHTML = '<p style="color: red;">Ошибка при чтении файла</p>';
        };
        
        // Начинаем чтение файла
        reader.readAsArrayBuffer(file);
    });
});