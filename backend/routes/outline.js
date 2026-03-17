const { Router } = require("express");
const { generateOutline } = require("../services/llm");

const router = Router();

router.post("/generate", async (req, res) => {
  try {
    const { projectName, reportType, productDesc, targetMarket, coreTech, investment, teamConfig } = req.body || {};

    if (!projectName) {
      return res.status(400).json({ ok: false, error: "projectName is required" });
    }

    const outline = await generateOutline({
      projectName,
      reportType,
      productDesc,
      targetMarket,
      coreTech,
      investment,
      teamConfig
    });

    res.json({ ok: true, outline });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message || "Unexpected error" });
  }
});

router.post("/generate-section", async (req, res) => {
  try {
    const { title, description, parentTitle, projectInfo, existingContent } = req.body || {};

    if (!title) {
      return res.status(400).json({ ok: false, error: "title is required" });
    }

    const { generateSection } = require("../services/llm");
    const content = await generateSection({ title, description, parentTitle, projectInfo, existingContent });

    res.json({ ok: true, content });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message || "Unexpected error" });
  }
});

router.post("/generate-report", async (req, res) => {
  try {
    const { sections, projectInfo } = req.body || {};

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({ ok: false, error: "sections array is required" });
    }

    const { generateSection } = require("../services/llm");
    const results = [];

    for (const section of flattenSections(sections)) {
      const content = await generateSection({
        title: section.title,
        description: section.description,
        parentTitle: section.parentTitle,
        projectInfo,
        existingContent: results.map((r) => `## ${r.title}\n${r.content}`).join("\n\n")
      });
      results.push({ title: section.title, level: section.level, content });
    }

    res.json({ ok: true, results });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message || "Unexpected error" });
  }
});

function flattenSections(sections, parentTitle = "") {
  const flat = [];
  for (const s of sections) {
    flat.push({
      title: s.title,
      level: s.level || 1,
      description: s.description || "",
      parentTitle
    });
    if (s.children && s.children.length > 0) {
      flat.push(...flattenSections(s.children, s.title));
    }
  }
  return flat;
}

module.exports = router;
