(function () {
  "use strict";

  let currentOutline = [];

  function init() {
    document.getElementById("generateOutlineBtn").addEventListener("click", generateOutline);
    document.getElementById("applyOutlineBtn").addEventListener("click", applyOutlineToDocument);
    document.getElementById("addSectionBtn").addEventListener("click", () => addSection());
  }

  async function generateOutline() {
    const projectName = document.getElementById("projectName").value.trim();
    if (!projectName) {
      RG.setStatus("请输入项目名称");
      return;
    }

    RG.setBusy(true);
    RG.setStatus("正在生成报告大纲...");

    try {
      const data = await RG.apiPost("/api/outline/generate", {
        projectName,
        reportType: document.getElementById("reportType").value,
        productDesc: document.getElementById("productDesc").value.trim(),
        targetMarket: document.getElementById("targetMarket").value.trim(),
        coreTech: document.getElementById("coreTech").value.trim(),
        investment: document.getElementById("investment").value.trim(),
        teamConfig: document.getElementById("teamConfig").value.trim()
      });

      currentOutline = data.outline.sections || [];
      renderOutlineTree();
      RG.setStatus("大纲生成完成，可编辑后应用到文档");
    } catch (error) {
      RG.setStatus("大纲生成失败：" + error.message);
    } finally {
      RG.setBusy(false);
    }
  }

  function renderOutlineTree() {
    const container = document.getElementById("outlineTree");
    container.innerHTML = "";
    if (currentOutline.length === 0) {
      container.innerHTML = '<p class="hint">暂无大纲内容</p>';
      return;
    }
    container.appendChild(buildTreeDom(currentOutline, 0));
  }

  function buildTreeDom(sections, depth) {
    const ul = document.createElement("ul");
    ul.className = "outline-list";
    ul.dataset.depth = depth;

    sections.forEach((section, index) => {
      const li = document.createElement("li");
      li.className = "outline-item";
      li.dataset.index = index;

      const row = document.createElement("div");
      row.className = "outline-row";

      const levelBadge = document.createElement("span");
      levelBadge.className = "level-badge";
      levelBadge.textContent = "H" + (section.level || depth + 1);
      row.appendChild(levelBadge);

      const titleInput = document.createElement("input");
      titleInput.type = "text";
      titleInput.className = "outline-title-input";
      titleInput.value = section.title || "";
      titleInput.addEventListener("input", () => {
        section.title = titleInput.value;
      });
      row.appendChild(titleInput);

      const actions = document.createElement("span");
      actions.className = "outline-actions";

      const addChildBtn = document.createElement("button");
      addChildBtn.className = "btn-icon";
      addChildBtn.textContent = "+";
      addChildBtn.title = "添加子节点";
      addChildBtn.addEventListener("click", () => {
        if (!section.children) section.children = [];
        section.children.push({
          title: "新章节",
          level: (section.level || depth + 1) + 1,
          description: ""
        });
        renderOutlineTree();
      });
      actions.appendChild(addChildBtn);

      const removeBtn = document.createElement("button");
      removeBtn.className = "btn-icon btn-icon--danger";
      removeBtn.textContent = "×";
      removeBtn.title = "删除";
      removeBtn.addEventListener("click", () => {
        sections.splice(index, 1);
        renderOutlineTree();
      });
      actions.appendChild(removeBtn);

      row.appendChild(actions);
      li.appendChild(row);

      if (section.description) {
        const desc = document.createElement("div");
        desc.className = "outline-desc";
        desc.textContent = section.description;
        li.appendChild(desc);
      }

      if (section.children && section.children.length > 0) {
        li.appendChild(buildTreeDom(section.children, depth + 1));
      }

      ul.appendChild(li);
    });

    return ul;
  }

  function addSection() {
    currentOutline.push({
      title: "新章节",
      level: 1,
      description: ""
    });
    renderOutlineTree();
  }

  async function applyOutlineToDocument() {
    if (currentOutline.length === 0) {
      RG.setStatus("没有大纲内容可应用");
      return;
    }

    RG.setBusy(true);
    RG.setStatus("正在将大纲插入文档...");

    try {
      Asc.scope.sections = flattenForInsert(currentOutline);

      await RG.callCommand(function () {
        var sections = Asc.scope.sections;
        var doc = Api.GetDocument();

        for (var i = 0; i < sections.length; i++) {
          var s = sections[i];
          var para = Api.CreateParagraph();
          para.AddText(s.title);

          var styleName = "Heading " + Math.min(s.level, 3);
          var style = doc.GetStyle(styleName);
          if (style) para.SetStyle(style);

          doc.InsertContent([para], true);

          if (s.description) {
            var descPara = Api.CreateParagraph();
            descPara.AddText(s.description);
            doc.InsertContent([descPara], true);
          }
        }

        doc.AddTableOfContents({
          ShowPageNums: true,
          RightAlgn: true,
          LeaderType: "dot",
          FormatAsLinks: true,
          BuildFrom: { OutlineLvls: 3 },
          TocStyle: "standard"
        });
      }, false, true);

      RG.setStatus("大纲已插入文档（含目录）");
    } catch (error) {
      RG.setStatus("插入失败：" + error.message);
    } finally {
      RG.setBusy(false);
    }
  }

  function flattenForInsert(sections) {
    const result = [];
    for (const s of sections) {
      result.push({ title: s.title, level: s.level || 1, description: s.description || "" });
      if (s.children && s.children.length > 0) {
        result.push(...flattenForInsert(s.children));
      }
    }
    return result;
  }

  function loadOutline(sections) {
    currentOutline = sections || [];
    renderOutlineTree();
  }

  function getOutline() {
    return currentOutline;
  }

  window.RG = window.RG || {};
  window.RG.outline = { init, loadOutline, getOutline, renderOutlineTree };
})();
