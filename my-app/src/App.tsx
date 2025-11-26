import React, { useState } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import './App.css';

// Регистрируем компоненты Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

// Типы
interface CSVData {
  headers: string[];
  rows: string[][];
}

interface ChartData {
  type: 'bar' | 'line';
  title: string;
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor: string;
      borderColor?: string;
    }[];
  };
}

const App: React.FC = () => {
  const [csvData, setCsvData] = useState<CSVData | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [analysisResult, setAnalysisResult] = useState<string>('');

  // Обработчик загрузки файла
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      alert('Пожалуйста, выберите CSV файл');
      return;
    }

    setIsLoading(true);
    setFileName(file.name);
    setCharts([]);
    setAnalysisResult('');

    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = parseCSV(content);
        setCsvData(parsedData);
      } catch (error) {
        alert('Ошибка при чтении файла');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    reader.readAsText(file);
  };

  // Парсинг CSV
  const parseCSV = (content: string): CSVData => {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split(',').map(header => header.trim());
    const rows = lines.slice(1).map(line => 
      line.split(',').map(cell => cell.trim())
    );

    return { headers, rows };
  };

  // Анализ данных с помощью AI
  const analyzeWithAI = async () => {
    if (!csvData) return;

    setIsAnalyzing(true);
    try {
      // Здесь будет вызов OpenAI API
      const analysis = await analyzeData(csvData);
      setAnalysisResult(analysis.insights);
      
      // Создаем графики на основе анализа
      const generatedCharts = generateCharts(csvData, analysis.recommendations);
      setCharts(generatedCharts);
    } catch (error) {
      console.error('Ошибка анализа:', error);
      alert('Ошибка при анализе данных');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Функция анализа данных (заглушка - замените на реальный вызов API)
  const analyzeData = async (data: CSVData): Promise<{ insights: string; recommendations: string[] }> => {
    // Имитация задержки API
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Простой анализ на основе данных
    const numericColumns = data.headers.filter((header, index) => {
      return data.rows.some(row => !isNaN(parseFloat(row[index])) && row[index].trim() !== '');
    });

    const insights = `Найдено ${data.rows.length} строк и ${data.headers.length} колонок. 
    Числовые колонки: ${numericColumns.join(', ')}. 
    Рекомендуется построить графики для анализа распределения данных.`;

    return {
      insights,
      recommendations: numericColumns.slice(0, 3) // Берем первые 3 числовые колонки
    };
  };

  // Генерация графиков на основе данных
  const generateCharts = (data: CSVData, recommendations: string[]): ChartData[] => {
    const charts: ChartData[] = [];

    // Находим числовые колонки
    const numericColumns = data.headers.filter((header, index) => {
      return data.rows.some(row => !isNaN(parseFloat(row[index])) && row[index].trim() !== '');
    });

    numericColumns.slice(0, 3).forEach((column, columnIndex) => {
      const columnIndexInData = data.headers.indexOf(column);
      
      // Собираем данные для графика
      const values = data.rows
        .map(row => parseFloat(row[columnIndexInData]))
        .filter(value => !isNaN(value));

      // Гистограмма распределения
      charts.push({
        type: 'bar',
        title: `Распределение: ${column}`,
        data: {
          labels: ['0-25%', '25-50%', '50-75%', '75-100%'],
          datasets: [{
            label: `Количество значений`,
            data: calculateDistribution(values),
            backgroundColor: `rgba(54, 162, 235, 0.6)`,
          }]
        }
      });

      // Линейный график тренда
      if (values.length > 10) {
        charts.push({
          type: 'line',
          title: `Тренд: ${column}`,
          data: {
            labels: values.slice(0, 20).map((_, i) => `Запись ${i + 1}`),
            datasets: [{
              label: column,
              data: values.slice(0, 20),
              borderColor: `rgba(255, 99, 132, 1)`,
              backgroundColor: `rgba(255, 99, 132, 0.2)`,
              // tension: 0.1
            }]
          }
        });
      }
    });

    return charts;
  };

  // Расчет распределения данных для гистограммы
  const calculateDistribution = (values: number[]): number[] => {
    if (values.length === 0) return [0, 0, 0, 0];
    
    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const range = max - min;

    const buckets = [0, 0, 0, 0];
    
    values.forEach(value => {
      const position = (value - min) / range;
      if (position < 0.25) buckets[0]++;
      else if (position < 0.5) buckets[1]++;
      else if (position < 0.75) buckets[2]++;
      else buckets[3]++;
    });

    return buckets;
  };

  // Очистить данные
  const handleClear = () => {
    setCsvData(null);
    setFileName('');
    setCharts([]);
    setAnalysisResult('');
  };

  return (
    <div className="app">
      <h1>📊 CSV Analyzer with AI</h1>
      
      {/* Загрузка файла */}
      <div className="upload-section">
        <h2>Загрузить CSV файл</h2>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          className="file-input"
        />
        {isLoading && <p>📥 Загрузка...</p>}
      </div>

      {/* Информация о файле */}
      {fileName && (
        <div className="file-info">
          <h3>📄 Загруженный файл: {fileName}</h3>
          <p>📏 Строк: {csvData ? csvData.rows.length : 0}</p>
          <p>📊 Колонок: {csvData ? csvData.headers.length : 0}</p>
          
          <button 
            onClick={analyzeWithAI} 
            disabled={isAnalyzing || !csvData}
            className="btn btn-analyze"
          >
            {isAnalyzing ? '🔍 Анализ...' : '🤖 Проанализировать с AI'}
          </button>
        </div>
      )}

      {/* Результаты анализа */}
      {analysisResult && (
        <div className="analysis-result">
          <h2>💡 Анализ AI</h2>
          <p>{analysisResult}</p>
        </div>
      )}

      {/* Графики */}
      {charts.length > 0 && (
        <div className="charts-section">
          <h2>📈 Графики</h2>
          <div className="charts-grid">
            {charts.map((chart, index) => (
              <div key={index} className="chart-container">
                <h3>{chart.title}</h3>
                <div className="chart">
                  {chart.type === 'bar' ? (
                    <Bar data={chart.data} options={{
                      responsive: true,
                      plugins: {
                        title: { display: true, text: chart.title },
                        legend: { position: 'top' }
                      }
                    }} />
                  ) : (
                    <Line data={chart.data} options={{
                      responsive: true,
                      plugins: {
                        title: { display: true, text: chart.title },
                        legend: { position: 'top' }
                      }
                    }} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Предпросмотр данных */}
      {csvData && !isAnalyzing && (
        <div className="preview-section">
          <h2>👀 Предпросмотр данных</h2>
          <div className="table-container">
            <table className="csv-table">
              <thead>
                <tr>
                  {csvData.headers.map((header, index) => (
                    <th key={index}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.rows.slice(0, 5).map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {csvData.rows.length > 5 && (
              <p>Показано первые 5 строк из {csvData.rows.length}</p>
            )}
          </div>
        </div>
      )}

      {/* Кнопки действий */}
      <div className="actions">
        {csvData && (
          <button onClick={handleClear} className="btn btn-clear">
            🗑️ Очистить
          </button>
        )}
      </div>
    </div>
  );
};

export default App;