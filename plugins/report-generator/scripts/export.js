(function () {
  "use strict";

  function init() {
    document.getElementById("exportPdfBtn").addEventListener("click", exportPdf);
    document.getElementById("exportDocxBtn").addEventListener("click", exportDocx);
    document.getElementById("exportMdBtn").addEventListener("click", exportMarkdown);
    document.getElementById("previewMdBtn").addEventListener("click", previewMarkdown);
  }

  async function exportPdf() {
    RG.setBusy(true);
    RG.setStatus("正在导出 PDF...");

    try {
      const url = await RG.executeMethod("GetFileToDownload", ["pdf"]);
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = "report.pdf";
        a.target = "_blank";
        a.click();
        RG.setStatus("PDF 导出完成");
      } else {
        RG.setStatus("PDF 导出失败：未获取到下载链接");
      }
    } catch (error) {
      RG.setStatus("PDF 导出失败：" + error.message);
    } finally {
      RG.setBusy(false);
    }
  }

  async function exportDocx() {
    RG.setBusy(true);
    RG.setStatus("正在导出 DOCX...");

    try {
      const url = await RG.executeMethod("GetFileToDownload", ["docx"]);
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = "report.docx";
        a.target = "_blank";
        a.click();
        RG.setStatus("DOCX 导出完成");
      } else {
        RG.setStatus("DOCX 导出失败：未获取到下载链接");
      }
    } catch (error) {
      RG.setStatus("DOCX 导出失败：" + error.message);
    } finally {
      RG.setBusy(false);
    }
  }

  async function exportMarkdown() {
    RG.setBusy(true);
    RG.setStatus("正在导出 Markdown...");

    try {
      const md = await RG.executeMethod("ConvertDocument", ["markdown", false, false, true, false]);
      if (md) {
        const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "report.md";
        a.click();
        URL.revokeObjectURL(url);
        RG.setStatus("Markdown 导出完成");
      } else {
        RG.setStatus("Markdown 导出失败：未获取到内容");
      }
    } catch (error) {
      RG.setStatus("Markdown 导出失败：" + error.message);
    } finally {
      RG.setBusy(false);
    }
  }

  async function previewMarkdown() {
    RG.setBusy(true);
    RG.setStatus("正在生成 Markdown 预览...");

    try {
      const md = await RG.executeMethod("ConvertDocument", ["markdown", false, false, true, false]);
      const preview = document.getElementById("mdPreview");
      if (md) {
        preview.textContent = md;
        preview.style.display = "block";
        RG.setStatus("Markdown 预览已生成");
      } else {
        preview.textContent = "（未获取到内容）";
        preview.style.display = "block";
        RG.setStatus("未获取到 Markdown 内容");
      }
    } catch (error) {
      RG.setStatus("预览失败：" + error.message);
    } finally {
      RG.setBusy(false);
    }
  }

  window.RG = window.RG || {};
  window.RG.export = { init };
})();
