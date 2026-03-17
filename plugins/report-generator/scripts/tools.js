(function () {
  "use strict";

  function init() {
    document.getElementById("generateTableBtn").addEventListener("click", generateTable);
    document.getElementById("generateDiagramBtn").addEventListener("click", generateDiagram);
    document.getElementById("fetchDataTableBtn").addEventListener("click", fetchDataTable);
    document.getElementById("toolImageUploadBtn").addEventListener("click", uploadAndInsertImage);

    document.getElementById("toolImageInput").addEventListener("change", function () {
      const file = this.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          const preview = document.getElementById("toolImagePreview");
          preview.src = e.target.result;
          preview.style.display = "block";
        };
        reader.readAsDataURL(file);
      }
    });
  }

  async function generateTable() {
    const desc = document.getElementById("tableDescription").value.trim();
    if (!desc) {
      RG.setStatus("请输入表格描述");
      return;
    }

    RG.setBusy(true);
    RG.setStatus("正在生成表格...");

    try {
      const data = await RG.apiPost("/api/tools/table", { description: desc });
      await RG.executeMethod("PasteHtml", [data.html]);
      RG.setStatus("表格已插入文档");
    } catch (error) {
      RG.setStatus("表格生成失败：" + error.message);
    } finally {
      RG.setBusy(false);
    }
  }

  async function generateDiagram() {
    const desc = document.getElementById("diagramDescription").value.trim();
    if (!desc) {
      RG.setStatus("请输入图表描述");
      return;
    }

    RG.setBusy(true);
    RG.setStatus("正在生成图表...");

    try {
      const type = document.getElementById("diagramType").value;
      const data = await RG.apiPost("/api/tools/diagram", { description: desc, type });

      const codeEl = document.getElementById("mermaidCode");
      codeEl.value = data.mermaidCode || "";
      codeEl.style.display = "block";
      RG.setStatus("Mermaid代码已生成，可复制使用");
    } catch (error) {
      RG.setStatus("图表生成失败：" + error.message);
    } finally {
      RG.setBusy(false);
    }
  }

  async function fetchDataTable() {
    RG.setBusy(true);
    RG.setStatus("正在获取数据...");

    try {
      const data = await RG.apiGet("/api/data-table");
      const html = buildTableHtml(data.title, data.columns, data.rows);
      await RG.executeMethod("PasteHtml", [html]);
      RG.setStatus("数据表格已插入文档");
    } catch (error) {
      RG.setStatus("获取数据失败：" + error.message);
    } finally {
      RG.setBusy(false);
    }
  }

  async function uploadAndInsertImage() {
    const file = document.getElementById("toolImageInput").files[0];
    if (!file) {
      RG.setStatus("请先选择一张图片");
      return;
    }

    RG.setBusy(true);
    RG.setStatus("正在上传图片...");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(`${RG.API_BASE_URL}/api/upload-image`, {
        method: "POST",
        body: formData
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "图片上传失败");
      }

      const fullUrl = data.url.startsWith("http") ? data.url : `${RG.API_BASE_URL}${data.url}`;
      const imgHtml = `<p><img src="${fullUrl}" alt="${file.name}" style="max-width:600px;" /></p>`;
      await RG.executeMethod("PasteHtml", [imgHtml]);
      RG.setStatus("图片已插入文档");
    } catch (error) {
      RG.setStatus("图片上传失败：" + error.message);
    } finally {
      RG.setBusy(false);
    }
  }

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

  window.RG = window.RG || {};
  window.RG.tools = { init };
})();
