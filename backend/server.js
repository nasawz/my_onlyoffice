const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("仅支持图片文件 (jpg/png/gif/webp/svg/bmp)"));
    }
  }
});

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(UPLOADS_DIR));

const ACTION_PROMPTS = {
  expand: "你是中文写作助手。请在不改变核心观点的前提下扩写文本，使其更完整、更有细节。",
  rewrite: "你是中文改写助手。请保持原意，改写为更自然、流畅、专业的表达。",
  polish: "你是中文润色助手。请修正语法与措辞，让表达更准确、简洁、有可读性。",
  translate:
    "你是专业翻译助手。请根据目标语言进行忠实翻译，保留原文术语与结构层次。",
  summarize: "你是总结助手。请提炼核心观点并输出结构清晰的简要总结。",
  continue:
    "你是写作续写助手。请根据已有内容在相同语气和风格下继续写作，保持连贯。"
};

function buildUserPrompt(action, text, options = {}) {
  const cleanText = (text || "").trim();
  const extra = [];

  if (action === "translate" && options.targetLanguage) {
    extra.push(`目标语言：${options.targetLanguage}`);
  }
  if (options.style) {
    extra.push(`风格要求：${options.style}`);
  }
  if (options.audience) {
    extra.push(`目标读者：${options.audience}`);
  }
  if (options.lengthHint) {
    extra.push(`长度要求：${options.lengthHint}`);
  }

  if (extra.length === 0) {
    return cleanText;
  }
  return `${extra.join("\n")}\n\n原文：\n${cleanText}`;
}

function resolveProviderConfig() {
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    throw new Error("LLM_API_KEY is required");
  }

  if (provider === "deepseek") {
    return {
      provider,
      apiKey,
      model: process.env.LLM_MODEL || "deepseek-chat",
      url:
        process.env.LLM_BASE_URL ||
        "https://api.deepseek.com/chat/completions"
    };
  }

  return {
    provider: "openai",
    apiKey,
    model,
    url:
      process.env.LLM_BASE_URL ||
      "https://api.openai.com/v1/chat/completions"
  };
}

async function callLlm({ action, text, options }) {
  const providerConfig = resolveProviderConfig();
  const systemPrompt = ACTION_PROMPTS[action];

  if (!systemPrompt) {
    throw new Error(`Unsupported action: ${action}`);
  }
  if (!text || !String(text).trim()) {
    throw new Error("text is required");
  }

  const payload = {
    model: providerConfig.model,
    temperature: Number(options?.temperature ?? 0.7),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildUserPrompt(action, String(text), options) }
    ]
  };

  const response = await fetch(providerConfig.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${providerConfig.apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content =
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    "";

  return String(content).trim();
}

function createHandler(action) {
  return async (req, res) => {
    try {
      const { text, options = {} } = req.body || {};
      const result = await callLlm({ action, text, options });
      res.json({ ok: true, action, result });
    } catch (error) {
      res.status(400).json({
        ok: false,
        action,
        error: error.message || "Unexpected error"
      });
    }
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "onlyoffice-ai-backend" });
});

app.post("/api/expand", createHandler("expand"));
app.post("/api/rewrite", createHandler("rewrite"));
app.post("/api/polish", createHandler("polish"));
app.post("/api/translate", createHandler("translate"));
app.post("/api/summarize", createHandler("summarize"));
app.post("/api/continue", createHandler("continue"));

// --- 图片上传接口 ---
app.post("/api/upload-image", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: "未收到图片文件" });
  }
  // 返回相对路径，由前端拼接 origin，确保走同源的 nginx 反向代理
  res.json({
    ok: true,
    url: `/uploads/${req.file.filename}`,
    filename: req.file.filename,
    size: req.file.size
  });
});

// --- 模拟数据查询接口 ---
app.get("/api/data-table", (_req, res) => {
  const data = {
    ok: true,
    title: "2025年Q4季度销售报告",
    columns: ["产品", "Q1 销售额", "Q2 销售额", "Q3 销售额", "Q4 销售额", "年度合计"],
    rows: [
      ["智能手表 Pro",  "¥128,000", "¥156,000", "¥189,000", "¥245,000", "¥718,000"],
      ["无线耳机 Air",  "¥86,000",  "¥92,000",  "¥105,000", "¥138,000", "¥421,000"],
      ["平板电脑 Lite", "¥210,000", "¥198,000", "¥225,000", "¥312,000", "¥945,000"],
      ["智能音箱 Mini", "¥45,000",  "¥52,000",  "¥61,000",  "¥89,000",  "¥247,000"],
      ["运动手环 Fit",  "¥32,000",  "¥38,000",  "¥42,000",  "¥56,000",  "¥168,000"]
    ]
  };
  res.json(data);
});

app.listen(port, () => {
  console.log(`AI backend listening on http://localhost:${port}`);
});
