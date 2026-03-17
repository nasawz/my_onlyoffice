const { Router } = require("express");
const { callAction } = require("../services/llm");

const router = Router();

function createHandler(action) {
  return async (req, res) => {
    try {
      const { text, options = {} } = req.body || {};
      const result = await callAction({ action, text, options });
      res.json({ ok: true, action, result });
    } catch (error) {
      res.status(400).json({
        ok: false,
        action,
        error: error.message || "Unexpected error"
      });
    }
  };
}

router.post("/expand", createHandler("expand"));
router.post("/rewrite", createHandler("rewrite"));
router.post("/polish", createHandler("polish"));
router.post("/translate", createHandler("translate"));
router.post("/summarize", createHandler("summarize"));
router.post("/continue", createHandler("continue"));
router.post("/proofread", async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ ok: false, error: "text is required" });
    }
    const { proofread } = require("../services/llm");
    const result = await proofread(String(text));
    res.json({ ok: true, action: "proofread", result });
  } catch (error) {
    res.status(400).json({
      ok: false,
      action: "proofread",
      error: error.message || "Unexpected error"
    });
  }
});

module.exports = router;
