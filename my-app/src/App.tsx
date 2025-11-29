// src/App.tsx
import React, { useState } from "react";
import Papa from "papaparse";
import { Bar, Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import "./App.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend
);

// ENV keys
const DEEPSEEK_KEY = process.env.REACT_APP_DEEPSEEK_API_KEY;
const OPENAI_KEY = process.env.REACT_APP_OPENAI_API_KEY;
const GEMINI_KEY = process.env.REACT_APP_GEMINI_API_KEY;

const detectProvider = () => {
  if (DEEPSEEK_KEY) return "deepseek";
  if (OPENAI_KEY) return "openai";
  if (GEMINI_KEY) return "gemini";
  return "none";
};

// extract safe json
function extractFirstJSONChunk(text: string): string | null {
  if (!text) return null;

  try {
    JSON.parse(text);
    return text;
  } catch {}

  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth === 0) {
      const candidate = text.slice(start, i + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {}
    }
  }

  return null;
}

async function callDeepSeek(prompt: string) {
  const url = "https://api.deepseek.com/chat/completions";
  const body = {
    model: "deepseek-chat",
    messages: [
      { role: "system", content: "Ты — ИИ для анализа таблиц. Отвечай строго JSON." },
      { role: "user", content: prompt }
    ]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_KEY}`
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();

  if (!res.ok) {
    try {
      const j = JSON.parse(text);
      throw new Error(j.message || JSON.stringify(j));
    } catch {
      throw new Error(`DeepSeek error: ${res.status}`);
    }
  }

  try {
    const j = JSON.parse(text);
    return j?.choices?.[0]?.message?.content ?? text;
  } catch {
    return text;
  }
}

async function callOpenAI(prompt: string) {
  const url = "https://api.openai.com/v1/chat/completions";
  const body = {
    model: "gpt-4o-mini",
    temperature: 0.0,
    messages: [{ role: "user", content: prompt }]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify(body)
  });

  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message);

  return j.choices?.[0]?.message?.content ?? "";
}

async function callGemini(prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });

  const text = await res.text();
  if (!res.ok) throw new Error("Gemini error " + res.status);

  try {
    const j = JSON.parse(text);
    return j?.candidates?.[0]?.content?.parts?.[0]?.text ?? text;
  } catch {
    return text;
  }
}

const App: React.FC = () => {
  const [csvData, setCsvData] = useState<any[]>([]);
  const [analysisText, setAnalysisText] = useState("");
  const [charts, setCharts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState(detectProvider());

  // upload CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalysisText("");
    setCharts([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setCsvData(res.data as any[]);
      }
    });
  };

  // Prompt with AI-colors support
  const buildPrompt = (data: any[]) => {
    return `
Проанализируй таблицу (JSON-массив объектов). 
Верни строго JSON:

{
 "analysis": "текст",
 "charts": [
   { 
     "title": "string",
     "type": "bar|line|pie",
     "labels": [...],
     "values": [...],
     "colors": ["#HEX","#HEX", ...]  // цвета для каждого значения
   }
 ]
}

Важно:
- "colors" должен быть массивом HEX цветовых кодов.
- Палитра должна быть визуально гармоничной (pastel / neon / ocean / warm).
- Длина colors = длине values.

Данные:
${JSON.stringify(data, null, 2)}
`;
  };

  const analyze = async () => {
    if (!csvData.length) return alert("Загрузите CSV");

    setLoading(true);
    setAnalysisText("");
    setCharts([]);

    try {
      const prompt = buildPrompt(csvData);

      let raw = "";
      if (provider === "deepseek") raw = await callDeepSeek(prompt);
      else if (provider === "openai") raw = await callOpenAI(prompt);
      else if (provider === "gemini") raw = await callGemini(prompt);
      else throw new Error("Нет AI ключей");

      const chunk = extractFirstJSONChunk(raw);
      if (!chunk) throw new Error("AI вернул не JSON:\n" + raw);

      const parsed = JSON.parse(chunk);

      setAnalysisText(parsed.analysis ?? "");
      const chartsParsed = (parsed.charts ?? []).map((c: any) => ({
        title: c.title ?? "Chart",
        type: c.type ?? "bar",
        labels: c.labels ?? [],
        values: c.values?.map((v: any) => Number(v)) ?? [],
        colors: c.colors ?? []
      }));

      setCharts(chartsParsed);
    } catch (err: any) {
      setAnalysisText("Ошибка анализа: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // PDF Export
  const exportPDF = async () => {
    const pdf = new jsPDF("p", "pt", "a4");

    pdf.setFontSize(16);
    pdf.text("AI Анализ", 20, 30);

    const lines = pdf.splitTextToSize(analysisText, 550);
    pdf.setFontSize(12);
    pdf.text(lines, 20, 55);

    let y = 55 + lines.length * 15 + 30;

    const canvases = document.querySelectorAll("canvas");

    for (let i = 0; i < canvases.length; i++) {
      const canvas = canvases[i];

      const img = await html2canvas(canvas).then((cnv) =>
        cnv.toDataURL("image/png")
      );

      pdf.addImage(img, "PNG", 40, y, 520, 300);
      y += 320;

      if (y > 750) {
        pdf.addPage();
        y = 40;
      }
    }

    pdf.save("analysis.pdf");
  };

  // Render Chart
  const renderChart = (c: any, idx: number) => {
    const colors = c.colors?.length ? c.colors : c.labels.map(() => "#4ea1ff");

    const data = {
      labels: c.labels,
      datasets: [
        {
          label: c.title,
          data: c.values,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 2
        }
      ]
    };

    if (c.type === "pie") return <Pie key={idx} data={data} />;
    if (c.type === "line") return <Line key={idx} data={data} />;
    return <Bar key={idx} data={data} />;
  };

  return (
    <div className="app-layout app-container app">
      <h1>📊 AI CSV Analyzer</h1>

      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <input type="file" accept=".csv" onChange={handleFileUpload} />
      </div>

      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <button className="analyze-button" disabled={loading} onClick={analyze}>
          {loading ? "Анализ..." : `Анализировать (AI: ${provider})`}
        </button>

        {analysisText && (
          <button className="export-button" onClick={exportPDF}>
            Экспорт в PDF
          </button>
        )}
      </div>

      {analysisText && (
        <div className="analysis-block">
          <h2>AI Анализ</h2>
          <pre className="analysis-text">{analysisText}</pre>
        </div>
      )}

      {charts.length > 0 && (
        <div className="charts-container">
          {charts.map((c, i) => (
            <div className="chart-wrapper" key={i}>
              <h3>{c.title}</h3>
              {renderChart(c, i)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
