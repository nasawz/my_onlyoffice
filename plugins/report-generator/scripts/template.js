(function () {
  "use strict";

  let templates = [];

  function init() {
    document.getElementById("refreshTemplatesBtn").addEventListener("click", loadTemplates);
    document.getElementById("saveAsTemplateBtn").addEventListener("click", saveCurrentAsTemplate);
    loadTemplates();
  }

  async function loadTemplates() {
    RG.setStatus("加载模板列表...");
    try {
      const data = await RG.apiGet("/api/templates");
      templates = data.templates || [];
      renderTemplateList();
      RG.setStatus("模板加载完成");
    } catch (error) {
      RG.setStatus("加载模板失败：" + error.message);
    }
  }

  function renderTemplateList() {
    const container = document.getElementById("templateList");
    container.innerHTML = "";

    if (templates.length === 0) {
      container.innerHTML = '<p class="hint">暂无可用模板</p>';
      return;
    }

    templates.forEach((t) => {
      const card = document.createElement("div");
      card.className = "template-card";

      const header = document.createElement("div");
      header.className = "template-card-header";

      const name = document.createElement("strong");
      name.textContent = t.name;
      header.appendChild(name);

      if (t.category) {
        const badge = document.createElement("span");
        badge.className = "category-badge";
        badge.textContent = t.category;
        header.appendChild(badge);
      }

      card.appendChild(header);

      if (t.description) {
        const desc = document.createElement("p");
        desc.className = "template-desc";
        desc.textContent = t.description;
        card.appendChild(desc);
      }

      const meta = document.createElement("div");
      meta.className = "template-meta";
      meta.textContent = `${t.sectionCount || 0} 个章节`;
      card.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "template-actions";

      const useBtn = document.createElement("button");
      useBtn.className = "btn btn--sm";
      useBtn.textContent = "使用此模板";
      useBtn.addEventListener("click", () => applyTemplate(t.id));
      actions.appendChild(useBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "btn btn--sm btn--danger";
      deleteBtn.textContent = "删除";
      deleteBtn.addEventListener("click", () => deleteTemplate(t.id));
      actions.appendChild(deleteBtn);

      card.appendChild(actions);
      container.appendChild(card);
    });
  }

  async function applyTemplate(id) {
    RG.setStatus("加载模板详情...");
    try {
      const data = await RG.apiGet(`/api/templates/${id}`);
      const sections = data.template.sections || [];

      RG.outline.loadOutline(sections);

      document.querySelector('[data-tab="outline"]').click();
      RG.setStatus(`已加载模板「${data.template.name}」到大纲编辑器`);
    } catch (error) {
      RG.setStatus("加载模板失败：" + error.message);
    }
  }

  async function deleteTemplate(id) {
    if (!confirm("确定要删除此模板吗？")) return;
    try {
      await RG.apiDelete(`/api/templates/${id}`);
      RG.setStatus("模板已删除");
      loadTemplates();
    } catch (error) {
      RG.setStatus("删除失败：" + error.message);
    }
  }

  async function saveCurrentAsTemplate() {
    const outline = RG.outline.getOutline();
    if (!outline || outline.length === 0) {
      RG.setStatus("当前没有大纲内容，无法保存为模板");
      return;
    }

    const name = prompt("请输入模板名称：", "自定义模板");
    if (!name) return;

    const description = prompt("请输入模板描述（可选）：", "");

    RG.setStatus("保存模板中...");
    try {
      await RG.apiPost("/api/templates", {
        name,
        description: description || "",
        category: "自定义",
        sections: outline
      });
      RG.setStatus("模板保存成功");
      loadTemplates();
    } catch (error) {
      RG.setStatus("保存失败：" + error.message);
    }
  }

  window.RG = window.RG || {};
  window.RG.template = { init, loadTemplates };
})();
