import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/api/deepseek", async (req, res) => {
  try {
    const { messages } = req.body;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.REACT_APP_DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",    // рабочая модель
        messages
      })
    });

    const data = await response.json();

    // === Нормализация ответа DeepSeek ===
    let text = "";

    if (typeof data === "string") {
      text = data;
    }

    if (data?.choices?.[0]?.message?.content) {
      text = data.choices[0].message.content;
    }

    if (data?.text && !text) {
      text = data.text;
    }

    // Если пришёл JSON — удаляем форматирование
    if (typeof text !== "string") {
      text = JSON.stringify(text);
    }

    // === Убираем лишние JSON-блоки, кодовые блоки и "```json" ===
    text = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    res.json({ text });

  } catch (e) {
    console.error("DeepSeek Error:", e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(5001, () =>
  console.log("✅ DeepSeek Proxy running at http://localhost:5001")
);
