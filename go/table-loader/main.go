package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/tealeg/xlsx"
)

// Структура для ответа API
type CellData struct {
	Row    int    `json:"row"`
	Column int    `json:"column"`
	Value  string `json:"value"`
}

type TableResponse struct {
	Data  [][]string `json:"data"`  // Двумерный массив с данными
	Range string     `json:"range"` // Диапазон ячеек
	Sheet string     `json:"sheet"` // Имя листа
}

func main() {
	// Раздаем статические файлы (HTML, CSS, JS)
	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))

	// API эндпоинт для получения данных из Excel
	http.HandleFunc("/api/excel-data", excelDataHandler)

	// Перенаправление корня на index.html
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, "./static/index.html")
	})

	fmt.Println("Сервер запущен на http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func excelDataHandler(w http.ResponseWriter, r *http.Request) {
	// Настройки CORS для разработки (чтобы браузер не блокировал запросы)
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Content-Type", "application/json")

	// Указываем путь к вашему Excel файлу
	filePath := "../../assets/Российская Лига BattleTech Alpha Strike.xlsx" // ЗДЕСЬ УКАЖИТЕ ВАШ ФАЙЛ

	// Открываем Excel файл
	xlFile, err := xlsx.OpenFile(filePath)
	if err != nil {
		sendError(w, "Не удалось открыть файл: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Берем первый лист
	if len(xlFile.Sheets) == 0 {
		sendError(w, "Файл не содержит листов", http.StatusInternalServerError)
		return
	}

	sheet := xlFile.Sheets[0]

	// Нам нужны ячейки B1:E11
	// B = колонка 1 (0 - A, 1 - B)
	// E = колонка 4
	// Строки 1-11 (индексы 0-10)

	startRow := 0 // Строка 1 (индекс 0)
	endRow := 10  // Строка 11 (индекс 10)
	startCol := 1 // Колонка B (индекс 1)
	endCol := 4   // Колонка E (индекс 4)

	// Извлекаем данные
	var tableData [][]string

	for rowIdx := startRow; rowIdx <= endRow; rowIdx++ {
		var rowData []string

		for colIdx := startCol; colIdx <= endCol; colIdx++ {
			var cellValue string

			if rowIdx < len(sheet.Rows) {
				row := sheet.Rows[rowIdx]
				if colIdx < len(row.Cells) {
					cell := row.Cells[colIdx]
					cellValue = cell.String()
				}
			}

			// Если ячейка пустая, ставим пустую строку
			if cellValue == "" {
				cellValue = ""
			}

			rowData = append(rowData, cellValue)
		}

		tableData = append(tableData, rowData)
	}

	// Формируем ответ
	response := TableResponse{
		Data:  tableData,
		Range: "B1:E11",
		Sheet: sheet.Name,
	}

	// Отправляем JSON
	json.NewEncoder(w).Encode(response)
}

func sendError(w http.ResponseWriter, message string, status int) {
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
