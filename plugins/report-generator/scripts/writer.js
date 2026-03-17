(function () {
  "use strict";

  const state = {
    selectedText: "",
    resultText: ""
  };

  function init() {
    document.getElementById("writerRefreshBtn").addEventListener("click", fetchSelection);
    document.getElementById("writerReplaceBtn").addEventListener("click", replaceSelectedText);
    document.getElementById("writerInsertBtn").addEventListener("click", insertAtCursor);

    document.querySelectorAll(".writer-action-btn").forEach((btn) => {
      btn.addEventListener("click", () => requestAi(btn.dataset.action));
    });

    document.getElementById("generateSectionBtn").addEventListener("click", generateSection);
  }

  async function fetchSelection() {
    RG.setStatus("读取选中文本中...");
    const text = await RG.getSelectedText();
    state.selectedText = text;
    document.getElementById("writerSelectedText").value = text;
    RG.setStatus(text ? "已读取选中文本" : "未读取到选中文本");
  }

  async function requestAi(action) {
    const text = document.getElementById("writerSelectedText").value.trim();
    if (!text) {
      RG.setStatus("请先输入或读取选中文本");
      return;
    }

    RG.setBusy(true);
    RG.setStatus(`正在执行${actionLabel(action)}...`);

    try {
      const payload = { text, options: {} };
      if (action === "translate") {
        payload.options.targetLanguage = document.getElementById("writerTargetLang").value;
      }

      const data = await RG.apiPost(`/api/${action}`, payload);
      state.resultText = (data.result || "").trim();
      document.getElementById("writerResultText").value = state.resultText;
      RG.setStatus("AI 处理完成");
    } catch (error) {
      RG.setStatus("请求失败：" + error.message);
    } finally {
      RG.setBusy(false);
    }
  }

  async function generateSection() {
    const title = document.getElementById("sectionTitle").value.trim();
    if (!title) {
      RG.setStatus("请输入章节标题");
      return;
    }

    RG.setBusy(true);
    RG.setStatus("正在生成章节内容...");

    try {
      const data = await RG.apiPost("/api/outline/generate-section", {
        title,
        description: document.getElementById("sectionDesc").value.trim(),
        projectInfo: document.getElementById("projectName")
          ? document.getElementById("projectName").value.trim()
          : ""
      });

      state.resultText = (data.content || "").trim();
      document.getElementById("writerResultText").value = state.resultText;
      RG.setStatus("章节内容生成完成");
    } catch (error) {
      RG.setStatus("章节生成失败：" + error.message);
    } finally {
      RG.setBusy(false);
    }
  }

  async function replaceSelectedText() {
    const source = document.getElementById("writerSelectedText").value.trim();
    const result = document.getElementById("writerResultText").value.trim();
    if (!source) { RG.setStatus("没有可替换的原文"); return; }
    if (!result) { RG.setStatus("没有可写回的结果"); return; }
    await RG.executeMethod("InputText", [result, source]);
    RG.setStatus("已替换选中文本");
  }

  async function insertAtCursor() {
    const result = document.getElementById("writerResultText").value.trim();
    if (!result) { RG.setStatus("没有可插入的结果"); return; }
    await RG.executeMethod("PasteText", [result]);
    RG.setStatus("已插入到光标处");
  }

  function actionLabel(action) {
    const map = {
      expand: "扩写", rewrite: "改写", polish: "润色",
      translate: "翻译", summarize: "总结", continue: "续写"
    };
    return map[action] || action;
  }

  window.RG = window.RG || {};
  window.RG.writer = { init };
})();
