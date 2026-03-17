(function () {
  "use strict";

  function initTabs() {
    const tabs = document.querySelectorAll("[data-tab]");
    const panels = document.querySelectorAll("[data-panel]");

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("tab--active"));
        tab.classList.add("tab--active");

        const target = tab.dataset.tab;
        panels.forEach((p) => {
          p.classList.toggle("panel-hidden", p.dataset.panel !== target);
        });
      });
    });
  }

  window.Asc.plugin.init = function () {
    initTabs();

    if (RG.outline && RG.outline.init) RG.outline.init();
    if (RG.template && RG.template.init) RG.template.init();
    if (RG.writer && RG.writer.init) RG.writer.init();
    if (RG.tools && RG.tools.init) RG.tools.init();
    if (RG.export && RG.export.init) RG.export.init();
    if (RG.proofread && RG.proofread.init) RG.proofread.init();

    RG.setStatus("插件已加载");
  };

  window.Asc.plugin.button = function () {
    window.Asc.plugin.executeCommand("close", "");
  };
})();
