(function () {
  // 通过 DS 的 nginx 反向代理访问后端，避免跨域问题
  const API_BASE_URL = window.location.origin;

  const state = {
    selectedText: "",
    resultText: "",
    lastAction: ""
  };

  const el = {};

  function getEditorSelectionOptions() {
    return {
      Numbering: false,
      Math: false,
      TableCellSeparator: "\n",
      ParaSeparator: "\n",
      TabSymbol: String.fromCharCode(9)
    };
  }

  function setStatus(message) {
    if (el.statusText) {
      el.statusText.textContent = message;
    }
  }

  function setBusy(isBusy) {
    const buttons = document.querySelectorAll("button");
    buttons.forEach((button) => {
      button.disabled = isBusy;
    });
  }

  function readSelectionFromTextarea() {
    const text = (el.selectedText.value || "").trim();
    state.selectedText = text;
    return text;
  }

  function readResultFromTextarea() {
    const text = (el.resultText.value || "").trim();
    state.resultText = text;
    return text;
  }

  function executeMethod(name, params) {
    return new Promise((resolve) => {
      window.Asc.plugin.executeMethod(name, params, function (result) {
        resolve(result);
      });
    });
  }

  async function fetchSelection() {
    setStatus("读取选中文本中...");
    const text = await executeMethod("GetSelectedText", [getEditorSelectionOptions()]);
    state.selectedText = (text || "").trim();
    el.selectedText.value = state.selectedText;
    setStatus(state.selectedText ? "已读取选中文本" : "未读取到选中文本");
    return state.selectedText;
  }

  function buildActionPayload(action, text) {
    const payload = {
      text,
      options: {}
    };

    if (action === "translate") {
      payload.options.targetLanguage = el.targetLanguage.value || "中文";
    }

    return payload;
  }

  async function requestAi(action) {
    const selectedText = readSelectionFromTextarea();
    if (!selectedText) {
      setStatus("请先输入或读取选中文本");
      return;
    }

    setBusy(true);
    setStatus(`正在执行${action}...`);
    state.lastAction = action;

    try {
      const response = await fetch(`${API_BASE_URL}/api/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildActionPayload(action, selectedText))
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "AI 请求失败");
      }

      state.resultText = (data.result || "").trim();
      el.resultText.value = state.resultText;
      setStatus("AI 处理完成");
    } catch (error) {
      setStatus(`请求失败：${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function replaceSelectedText() {
    const sourceText = readSelectionFromTextarea();
    const resultText = readResultFromTextarea();

    if (!sourceText) {
      setStatus("没有可替换的原文，请先读取或输入选中文本");
      return;
    }
    if (!resultText) {
      setStatus("没有可写回的结果，请先执行 AI 操作");
      return;
    }

    await executeMethod("InputText", [resultText, sourceText]);
    setStatus("已替换选中文本");
  }

  async function insertAtCursor() {
    const resultText = readResultFromTextarea();
    if (!resultText) {
      setStatus("没有可插入的结果，请先执行 AI 操作");
      return;
    }

    await executeMethod("PasteText", [resultText]);
    setStatus("已插入到光标处");
  }

  // --- 图片上传 + 插入文档 ---

  function showImagePreview(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      el.previewImg.src = e.target.result;
      el.imagePreview.style.display = "block";
    };
    reader.readAsDataURL(file);
  }

  async function uploadAndInsertImage() {
    const file = el.imageFileInput.files[0];
    if (!file) {
      setStatus("请先选择一张图片");
      return;
    }

    setBusy(true);
    setStatus("正在上传图片...");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch(`${API_BASE_URL}/api/upload-image`, {
        method: "POST",
        body: formData
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "图片上传失败");
      }

      setStatus("上传成功，正在插入文档...");

      const fullUrl = data.url.startsWith("http")
        ? data.url
        : `${API_BASE_URL}${data.url}`;
      const imgHtml =
        `<p><img src="${fullUrl}" alt="${file.name}" ` +
        `style="max-width:600px;" /></p>`;
      await executeMethod("PasteHtml", [imgHtml]);

      setStatus("图片已插入文档");
    } catch (error) {
      setStatus(`图片上传失败：${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  // --- 获取远程数据 + 插入表格 ---

  function buildTableHtml(title, columns, rows) {
    let html = `<h3>${title}</h3>`;
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

  async function fetchDataAndInsertTable() {
    setBusy(true);
    setStatus("正在从服务器获取数据...");

    try {
      const response = await fetch(`${API_BASE_URL}/api/data-table`);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "获取数据失败");
      }

      setStatus("数据已获取，正在插入表格...");

      const tableHtml = buildTableHtml(data.title, data.columns, data.rows);
      await executeMethod("PasteHtml", [tableHtml]);

      setStatus("数据表格已插入文档");
    } catch (error) {
      setStatus(`获取数据失败：${error.message}`);
    } finally {
      setBusy(false);
    }
  }

  // --- 事件绑定 ---

  function bindActions() {
    el.refreshSelectionBtn.addEventListener("click", () => {
      fetchSelection();
    });

    el.replaceBtn.addEventListener("click", () => {
      replaceSelectedText();
    });

    el.insertBtn.addEventListener("click", () => {
      insertAtCursor();
    });

    document.querySelectorAll(".action-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;
        requestAi(action);
      });
    });

    el.imageFileInput.addEventListener("change", () => {
      const file = el.imageFileInput.files[0];
      if (file) {
        showImagePreview(file);
      }
    });

    el.uploadAndInsertBtn.addEventListener("click", () => {
      uploadAndInsertImage();
    });

    el.fetchDataBtn.addEventListener("click", () => {
      fetchDataAndInsertTable();
    });
  }

  function bindElements() {
    el.refreshSelectionBtn = document.getElementById("refreshSelectionBtn");
    el.selectedText = document.getElementById("selectedText");
    el.targetLanguage = document.getElementById("targetLanguage");
    el.resultText = document.getElementById("resultText");
    el.replaceBtn = document.getElementById("replaceBtn");
    el.insertBtn = document.getElementById("insertBtn");
    el.statusText = document.getElementById("statusText");
    el.imageFileInput = document.getElementById("imageFileInput");
    el.imagePreview = document.getElementById("imagePreview");
    el.previewImg = document.getElementById("previewImg");
    el.uploadAndInsertBtn = document.getElementById("uploadAndInsertBtn");
    el.fetchDataBtn = document.getElementById("fetchDataBtn");
  }

  window.Asc.plugin.init = function () {
    bindElements();
    bindActions();
    setStatus("插件已加载，先读取选中文本再执行 AI 操作");
  };

  window.Asc.plugin.button = function () {
    window.Asc.plugin.executeCommand("close", "");
  };
})();
