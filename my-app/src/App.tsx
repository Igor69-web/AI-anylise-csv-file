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

export default function App() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [analysisText, setAnalysisText] = useState("");
  const [charts, setCharts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCsvFile(e.target.files[0]);
    }
  };

  async function callDeepSeek(messages: any[]) {
    const response = await fetch("http://localhost:5001/api/deepseek", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error("DeepSeek server error: " + err);
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
      complete: async (results) => {
        try {
          const prompt = [
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

          let raw = await callDeepSeek(prompt);

          const match = raw.match(/\{[\s\S]*\}/);
          if (!match) throw new Error("AI вернул не JSON:\n" + raw);

          const parsed = JSON.parse(match[0]);

          setAnalysisText(parsed.analysis ?? "");

          const chartsClean = (parsed.charts ?? []).map((c: any) => ({
            title: c.title ?? "Chart",
            type: c.type ?? "bar",
            labels: c.labels ?? [],
            values: c.values?.map((v: any) => Number(v)) ?? [],
            colors: c.colors ?? []
          }));

          setCharts(chartsClean);
        } catch (e: any) {
          alert("Ошибка анализа: " + e.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // =============================
  // 📄 ЭКСПОРТ PDF
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

    const chartBlocks = document.querySelectorAll(".chart-card");

    for (const block of Array.from(chartBlocks)) {
      const canvas = await html2canvas(block as HTMLElement, { scale: 2 });
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

  const renderChart = (chart: any, index: number) => {
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

        {/* NEW: экспорт PDF */}
        <button onClick={exportPDF} disabled={!analysisText}>
          Экспорт в PDF
        </button>
      </div>

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
