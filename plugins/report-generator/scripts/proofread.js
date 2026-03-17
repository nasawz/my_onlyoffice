(function () {
  "use strict";

  let lastProofreadResult = null;

  function init() {
    document.getElementById("proofreadBtn").addEventListener("click", runProofread);
    document.getElementById("applyProofreadBtn").addEventListener("click", applyCorrection);
    document.getElementById("proofreadRefreshBtn").addEventListener("click", fetchTextForProofread);
  }

  async function fetchTextForProofread() {
    RG.setStatus("读取选中文本...");
    const text = await RG.getSelectedText();
    document.getElementById("proofreadInput").value = text;
    RG.setStatus(text ? "已读取文本" : "未读取到选中文本");
  }

  async function runProofread() {
    const text = document.getElementById("proofreadInput").value.trim();
    if (!text) {
      RG.setStatus("请先输入或读取需要校稿的文本");
      return;
    }

    RG.setBusy(true);
    RG.setStatus("正在智能校稿...");

    try {
      const data = await RG.apiPost("/api/proofread", { text });
      lastProofreadResult = data.result;

      document.getElementById("proofreadCorrected").value = data.result.corrected || text;

      const issuesList = document.getElementById("proofreadIssues");
      issuesList.innerHTML = "";

      const issues = data.result.issues || [];
      if (issues.length === 0) {
        issuesList.innerHTML = '<li class="hint">未发现问题</li>';
      } else {
        issues.forEach((issue) => {
          const li = document.createElement("li");
          li.className = "proofread-issue";

          const typeSpan = document.createElement("span");
          typeSpan.className = "issue-type";
          typeSpan.textContent = issueTypeLabel(issue.type);
          li.appendChild(typeSpan);

          const content = document.createElement("span");
          if (issue.original && issue.suggestion) {
            content.innerHTML = `<del>${escapeHtml(issue.original)}</del> → <ins>${escapeHtml(issue.suggestion)}</ins>`;
          } else {
            content.textContent = issue.suggestion || issue.original || "";
          }
          li.appendChild(content);

          issuesList.appendChild(li);
        });
      }

      RG.setStatus(`校稿完成，发现 ${issues.length} 处问题`);
    } catch (error) {
      RG.setStatus("校稿失败：" + error.message);
    } finally {
      RG.setBusy(false);
    }
  }

  async function applyCorrection() {
    const corrected = document.getElementById("proofreadCorrected").value.trim();
    if (!corrected) {
      RG.setStatus("没有修正结果可应用");
      return;
    }

    const original = document.getElementById("proofreadInput").value.trim();
    if (original) {
      await RG.executeMethod("InputText", [corrected, original]);
      RG.setStatus("已用修正文本替换选中内容");
    } else {
      await RG.executeMethod("PasteText", [corrected]);
      RG.setStatus("已插入修正文本");
    }
  }

  function issueTypeLabel(type) {
    const map = {
      grammar: "语法",
      spelling: "拼写",
      punctuation: "标点",
      style: "文风",
      consistency: "一致性",
      format: "格式"
    };
    return map[type] || type || "其他";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  window.RG = window.RG || {};
  window.RG.proofread = { init };
})();
