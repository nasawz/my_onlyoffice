const { Router } = require("express");
const { callLlm } = require("../services/llm");

const router = Router();

router.post("/table", async (req, res) => {
  try {
    const { description, data } = req.body || {};

    if (!description && !data) {
      return res.status(400).json({ ok: false, error: "description or data is required" });
    }

    let html;
    if (data && data.columns && data.rows) {
      html = buildTableHtml(data.title || "", data.columns, data.rows);
    } else {
      const result = await callLlm({
        systemPrompt: "你是表格生成助手。根据用户描述生成HTML表格代码。只返回完整的<table>标签HTML，不要包含其他内容。表格需要包含border=\"1\" cellpadding=\"6\" cellspacing=\"0\" style=\"border-collapse:collapse;width:100%;\"属性。表头使用<th>标签并设置背景色。",
        userPrompt: description,
        temperature: 0.5
      });
      html = result;
    }

    res.json({ ok: true, html });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.post("/diagram", async (req, res) => {
  try {
    const { description, type } = req.body || {};

    if (!description) {
      return res.status(400).json({ ok: false, error: "description is required" });
    }

    const diagramType = type || "flowchart";
    const result = await callLlm({
      systemPrompt: `你是图表生成助手。根据用户描述生成Mermaid ${diagramType}代码。只返回Mermaid代码，不要包含\`\`\`mermaid标记或其他文字。`,
      userPrompt: description,
      temperature: 0.5
    });

    res.json({ ok: true, mermaidCode: result, type: diagramType });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

function buildTableHtml(title, columns, rows) {
  let html = "";
  if (title) html += `<h3>${title}</h3>`;
  html += '<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;">';
  html += "<tr>";
  for (const col of columns) {
    html += `<th style="background:#4a67ff;color:#fff;text-align:center;padding:8px;">${col}</th>`;
  }
  html += "</tr>";
  for (const row of rows) {
    html += "<tr>";
    for (let i = 0; i < row.length; i++) {
      const align = i === 0 ? "left" : "right";
      html += `<td style="text-align:${align};padding:6px;">${row[i]}</td>`;
    }
    html += "</tr>";
  }
  html += "</table>";
  return html;
}

module.exports = router;
