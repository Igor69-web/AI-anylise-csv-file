import './App.css';
import React, { useState } from "react";
import Papa from "papaparse";
import { Bar, Pie, Line } from "react-chartjs-2";
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
              content: "Ты — ИИ для анализа CSV. Отвечай строго JSON без текста вокруг."
            },
            {
              role: "user",
              content: `
Проанализируй этот CSV и верни **ТОЛЬКО JSON** строго в формате:

{
  "analysis": "текст анализа",
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

Никаких дополнительных пояснений, только JSON.
`
            }
          ];

          let raw = await callDeepSeek(prompt);
          console.log("AI ответ:", raw);

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
          console.error("Ошибка анализа:", e);
          alert("Ошибка анализа: " + e.message);
        } finally {
          setLoading(false);
        }
      }
    });
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
          {loading ? "Анализирую..." : "Анализировать (AI: DeepSeek)"}
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
