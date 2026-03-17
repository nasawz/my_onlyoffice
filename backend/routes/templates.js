const { Router } = require("express");
const store = require("../services/template-store");

const router = Router();

router.get("/", (_req, res) => {
  try {
    const list = store.listTemplates();
    res.json({ ok: true, templates: list });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/:id", (req, res) => {
  try {
    const template = store.getTemplate(req.params.id);
    if (!template) {
      return res.status(404).json({ ok: false, error: "Template not found" });
    }
    res.json({ ok: true, template });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

router.post("/", (req, res) => {
  try {
    const template = store.createTemplate(req.body);
    res.status(201).json({ ok: true, template });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.put("/:id", (req, res) => {
  try {
    const template = store.updateTemplate(req.params.id, req.body);
    if (!template) {
      return res.status(404).json({ ok: false, error: "Template not found" });
    }
    res.json({ ok: true, template });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
});

router.delete("/:id", (req, res) => {
  try {
    const deleted = store.deleteTemplate(req.params.id);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "Template not found" });
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;
