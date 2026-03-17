const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const { router: uploadRouter, UPLOADS_DIR } = require("./routes/upload");
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "onlyoffice-ai-backend" });
});

app.use("/api", require("./routes/writer"));
app.use("/api", uploadRouter);
app.use("/api/outline", require("./routes/outline"));
app.use("/api/templates", require("./routes/templates"));
app.use("/api/tools", require("./routes/tools"));

app.get("/api/data-table", (_req, res) => {
  res.json({
    ok: true,
    title: "2025年Q4季度销售报告",
    columns: ["产品", "Q1 销售额", "Q2 销售额", "Q3 销售额", "Q4 销售额", "年度合计"],
    rows: [
      ["智能手表 Pro", "¥128,000", "¥156,000", "¥189,000", "¥245,000", "¥718,000"],
      ["无线耳机 Air", "¥86,000", "¥92,000", "¥105,000", "¥138,000", "¥421,000"],
      ["平板电脑 Lite", "¥210,000", "¥198,000", "¥225,000", "¥312,000", "¥945,000"],
      ["智能音箱 Mini", "¥45,000", "¥52,000", "¥61,000", "¥89,000", "¥247,000"],
      ["运动手环 Fit", "¥32,000", "¥38,000", "¥42,000", "¥56,000", "¥168,000"]
    ]
  });
});

app.listen(port, () => {
  console.log(`AI backend listening on http://localhost:${port}`);
});
