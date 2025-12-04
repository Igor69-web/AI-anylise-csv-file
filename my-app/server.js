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
    const { messages } = req.body; // массив сообщений от фронтенда

    const body = {
      model: "deepseek-chat",
      messages
    };

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.REACT_APP_DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    // безопасно выбираем текст
    let text = "";
    if (typeof data === "string") {
      text = data;
    } else if (data.text) {
      text = data.text;
    } else if (data.choices?.[0]?.message?.content) {
      text = data.choices[0].message.content;
    }

    res.json({ text });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(5001, () => console.log("DeepSeek Proxy running on port 5001"));
