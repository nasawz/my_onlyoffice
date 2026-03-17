const ACTION_PROMPTS = {
  expand: "你是中文写作助手。请在不改变核心观点的前提下扩写文本，使其更完整、更有细节。",
  rewrite: "你是中文改写助手。请保持原意，改写为更自然、流畅、专业的表达。",
  polish: "你是中文润色助手。请修正语法与措辞，让表达更准确、简洁、有可读性。",
  translate:
    "你是专业翻译助手。请根据目标语言进行忠实翻译，保留原文术语与结构层次。",
  summarize: "你是总结助手。请提炼核心观点并输出结构清晰的简要总结。",
  continue:
    "你是写作续写助手。请根据已有内容在相同语气和风格下继续写作，保持连贯。",
  proofread:
    "你是专业校稿助手。请检查文本中的语法错误、拼写错误、用词不当、格式问题，并给出修改建议。请以JSON格式返回结果，包含corrected（修正后全文）和issues数组（每项含position、original、suggestion、type字段）。",
  generateSection:
    "你是专业报告撰写助手。请根据提供的章节标题、描述和项目背景信息，撰写该章节的正文内容。要求：语言规范、逻辑清晰、数据翔实、符合公文写作标准。",
  generateOutline:
    "你是报告大纲生成助手。请根据提供的项目信息生成报告大纲。以JSON格式返回，结构为sections数组，每个section包含title(标题)、level(层级1-3)、description(简短描述)，可包含children子节点。只返回JSON，不要其他文字。"
};

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

async function callLlm({ systemPrompt, userPrompt, temperature = 0.7, responseFormat }) {
  const providerConfig = resolveProviderConfig();

  const payload = {
    model: providerConfig.model,
    temperature: Number(temperature),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  };

  if (responseFormat) {
    payload.response_format = responseFormat;
  }

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

async function callAction({ action, text, options = {} }) {
  const systemPrompt = ACTION_PROMPTS[action];
  if (!systemPrompt) {
    throw new Error(`Unsupported action: ${action}`);
  }
  if (!text || !String(text).trim()) {
    throw new Error("text is required");
  }

  const userPrompt = buildUserPrompt(action, String(text), options);
  return callLlm({ systemPrompt, userPrompt, temperature: options.temperature });
}

async function generateOutline({ projectName, reportType, productDesc, targetMarket, coreTech, investment, teamConfig }) {
  const systemPrompt = ACTION_PROMPTS.generateOutline;

  const parts = [`报告类型：${reportType || "可行性研究报告"}`, `项目名称：${projectName}`];
  if (productDesc) parts.push(`产品描述：${productDesc}`);
  if (targetMarket) parts.push(`目标市场：${targetMarket}`);
  if (coreTech) parts.push(`核心技术：${coreTech}`);
  if (investment) parts.push(`预估投资：${investment}`);
  if (teamConfig) parts.push(`团队配置：${teamConfig}`);

  const userPrompt = parts.join("\n");
  const result = await callLlm({
    systemPrompt,
    userPrompt,
    temperature: 0.7,
    responseFormat: { type: "json_object" }
  });

  try {
    return JSON.parse(result);
  } catch {
    return { sections: [], raw: result };
  }
}

async function generateSection({ title, description, parentTitle, projectInfo, existingContent }) {
  const systemPrompt = ACTION_PROMPTS.generateSection;

  const parts = [`章节标题：${title}`];
  if (parentTitle) parts.push(`上级章节：${parentTitle}`);
  if (description) parts.push(`章节说明：${description}`);
  if (projectInfo) parts.push(`项目背景：${projectInfo}`);
  if (existingContent) parts.push(`已有内容上下文：\n${existingContent}`);

  const userPrompt = parts.join("\n");
  return callLlm({ systemPrompt, userPrompt, temperature: 0.7 });
}

async function proofread(text) {
  const systemPrompt = ACTION_PROMPTS.proofread;
  const result = await callLlm({
    systemPrompt,
    userPrompt: text,
    temperature: 0.3,
    responseFormat: { type: "json_object" }
  });

  try {
    return JSON.parse(result);
  } catch {
    return { corrected: text, issues: [], raw: result };
  }
}

module.exports = {
  callAction,
  callLlm,
  generateOutline,
  generateSection,
  proofread,
  ACTION_PROMPTS
};
