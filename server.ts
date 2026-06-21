import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables (.env) if present
dotenv.config();

const app = express();
const PORT = 3000;

// Body parser
app.use(express.json());

// Initialize Gemini Client safely
// Will only fail at query time if API key is missing
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("⚠️ Warning: GEMINI_API_KEY is not defined. AI interpretations will fail.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "PLACEHOLDER_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// REST API endpoint for ECG interpretations and questions
app.post("/api/gemini/interpret", async (req, res) => {
  try {
    const { message, history } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Message parameter is required" });
    }

    const ai = getGeminiClient();
    
    // System instruction for professional Persian cardiologist guide
    const systemInstruction = `شما یک دستیار متخصص الکتروکاردیولوژیست (پزشک نوار قلب) با دانش فوق‌العاده بالا هستید.
پاسخ‌های شما باید کاملاً علمی، دقیق، شمرده، و به زبان فارسی روان باشد.
دستورالعمل‌ها:
۱. تمام سوالات پزشکی و آریتمی قلبی را با استفاده از برچسب‌های خوانا، بولتن و پاراگراف‌های متوالی ساختاربندی کنید تا خواندن آن مانیتور گوشی یا لپ‌تاپ بسیار راحت باشد.
۲. از اصطلاحات پزشکی انگلیسی در پرانتز برای درک بهتر استفاده کنید (مانند Atrial Fibrillation برای فیبریلاسیون دهلیزی).
۳. اگر کاربر درخواست کرد "یک سناریوی بالینی تصادفی اورژانس قلبی" ایجاد کنید، یک بیمار خیالی اورژانسی با علائم بالینی (مانند درد جناغ سینه، انتشار به کتف، تعریق سرد) و معیارهای نوار قلب مشخص تولید کنید. سپس از کاربر بخواهید حدس بزند آریتمی او چیست و اقدام مناسب اولیه را پاسخ دهد.
۴. در انتهای هر پاسخ به صورت کادر یا متنی واضح هشدار دهید که این سیستم صرفاً برای اهداف آموزشی طراحی شده و در شرایط حساس واقعی حتماً باید با اورژانس ۱۱۵ تماس گرفته شود.`;

    // Map history to Google GenAI format if history is present
    const contents: any[] = [];
    if (history && Array.isArray(history)) {
      history.forEach((h: any) => {
        contents.push({
          role: h.role === "user" ? "user" : "model",
          parts: [{ text: h.text }]
        });
      });
    }

    // Push the current latest message
    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    // Invoke Gemini Content stream or single call using the correct gemini-3.5-flash model
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    const reply = response.text;
    res.json({ reply });

  } catch (err: any) {
    console.error("Gemini API Error details:", err);
    res.status(500).json({ 
      error: "خطا در پردازش هوش مصنوعی", 
      details: err.message || "Unknown error"
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", time: new Date() });
});

// Setup Express development or production routing
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Development fallback using Vite server middleware
    console.log("Starting server in development mode with HMR disabled...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static builds serving
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 ECG Simulator & Interpreter Server running at http://0.0.0.0:${PORT}`);
  });
}

if (process.env.VERCEL !== "1") {
  startServer();
}

export default app;
