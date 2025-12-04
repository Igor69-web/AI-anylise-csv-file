import "./App.css";
import React, { useState } from "react";
import Papa from "papaparse";
import { Bar, Pie, Line } from "react-chartjs-2";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

// =====================
// TYPES
// =====================
interface CsvRow {
  [key: string]: any;
}

interface ChartItem {
  title: string;
  type: "bar" | "line" | "pie";
  labels: string[];
  values: number[];
  colors: string[];
}

interface DeepSeekMessage {
  role: "system" | "user";
  content: string;
}

export default function App() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const [analysisText, setAnalysisText] = useState("");
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setCsvFile(e.target.files[0]);
    }
  };

  async function callDeepSeek(messages: DeepSeekMessage[]) {
    const response = await fetch("http://localhost:5001/api/deepseek", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();
    return data.text ?? "";
  }

  const analyze = () => {
    if (!csvFile) {
      alert("Выберите CSV файл");
      return;
    }

    setLoading(true);
    setAnalysisText("");
    setCharts([]);

    Papa.parse(csvFile, {
      header: true,
      dynamicTyping: true,
      complete: async (results: Papa.ParseResult<CsvRow>) => {
        try {
          setCsvRows(results.data);
          setCurrentPage(1);

          const prompt: DeepSeekMessage[] = [
            {
              role: "system",
              content: "Ты — ИИ для анализа CSV. Отвечай строго JSON без пояснений."
            },
            {
              role: "user",
              content: `
Проанализируй CSV и верни строго JSON:
{
  "analysis": "",
  "charts": [
    {
      "title": "",
      "type": "bar|line|pie",
      "labels": [],
      "values": [],
      "colors": []
    }
  ]
}
CSV данные:
${JSON.stringify(results.data, null, 2)}
`
            }
          ];

          const raw = await callDeepSeek(prompt);
          const match = raw.match(/\{[\s\S]*\}/);
          if (!match) throw new Error("AI вернул не JSON:\n" + raw);

          const parsed = JSON.parse(match[0]);

          setAnalysisText(parsed.analysis ?? "");

          const chartsClean: ChartItem[] = (parsed.charts ?? []).map((c: any) => ({
            title: c.title ?? "Chart",
            type: c.type ?? "bar",
            labels: c.labels ?? [],
            values: c.values?.map((v: any) => Number(v)) ?? [],
            colors: c.colors ?? []
          }));

          setCharts(chartsClean);
        } catch (err: unknown) {
          if (err instanceof Error) {
            alert("Ошибка анализа: " + err.message);
          } else {
            alert("Неизвестная ошибка");
          }
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // =============================
  // PDF EXPORT
  // =============================
  const exportPDF = async () => {
    const pdf = new jsPDF("p", "mm", "a4");
    let yOffset = 10;

    pdf.setFontSize(18);
    pdf.text("AI CSV Анализ", 10, yOffset);
    yOffset += 12;

    pdf.setFontSize(12);
    const wrapped = pdf.splitTextToSize(analysisText, 180);
    pdf.text(wrapped, 10, yOffset);
    yOffset += wrapped.length * 7 + 10;

    const elements = document.querySelectorAll(".chart-card");

    for (const el of Array.from(elements)) {
      const block = el as HTMLElement; // <-- FIX TS error
      const canvas = await html2canvas(block, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = 180;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      if (yOffset + pdfHeight > 280) {
        pdf.addPage();
        yOffset = 10;
      }

      pdf.addImage(imgData, "PNG", 10, yOffset, pdfWidth, pdfHeight);
      yOffset += pdfHeight + 10;
    }

    pdf.save("analysis.pdf");
  };

  // =============================
  // PAGINATION
  // =============================
  const indexOfLast = currentPage * rowsPerPage;
  const indexOfFirst = indexOfLast - rowsPerPage;
  const paginatedRows = csvRows.slice(indexOfFirst, indexOfLast);

  const nextPage = () => {
    if (indexOfLast < csvRows.length) setCurrentPage((p) => p + 1);
  };

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };

  // =============================
  // RENDER CHARTS
  // =============================
  const renderChart = (chart: ChartItem, index: number) => {
    const data = {
      labels: chart.labels,
      datasets: [
        {
          label: chart.title,
          data: chart.values,
          backgroundColor: chart.colors,
          borderColor: chart.colors,
          borderWidth: 2
        }
      ]
    };

    return (
      <div key={index} className="chart-card">
        <h3>{chart.title}</h3>
        {chart.type === "bar" && <Bar data={data} />}
        {chart.type === "pie" && <Pie data={data} />}
        {chart.type === "line" && <Line data={data} />}
      </div>
    );
  };

  return (
    <div className="app-container">
      <h1 className="title">AI CSV Analyzer</h1>

      <div className="upload-block">
        <input type="file" accept=".csv" onChange={handleFileUpload} />

        <button onClick={analyze} disabled={loading}>
          {loading ? "Анализирую..." : "Анализировать"}
        </button>

        <button onClick={exportPDF} disabled={!analysisText}>
          Экспорт в PDF
        </button>
      </div>

      {/* TABLE */}
      {csvRows.length > 0 && (
        <div className="table-container">
          <h2>CSV Таблица</h2>

          <table>
            <thead>
              <tr>
                {Object.keys(csvRows[0]).map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {paginatedRows.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((val, j) => (
                    <td key={j}>{String(val)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pagination">
            <button onClick={prevPage} disabled={currentPage === 1}>
              ← Назад
            </button>

            <span>{currentPage}</span>

            <button
              onClick={nextPage}
              disabled={indexOfLast >= csvRows.length}
            >
              Вперёд →
            </button>
          </div>
        </div>
      )}

      {analysisText && (
        <div className="analysis-card">
          <h2>AI Анализ</h2>
          <p>{analysisText}</p>
        </div>
      )}

      <div className="charts-grid">{charts.map(renderChart)}</div>
    </div>
  );
}
