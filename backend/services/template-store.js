const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const TEMPLATES_DIR = path.join(__dirname, "..", "data", "templates");

function ensureDir() {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  }
}

function templatePath(id) {
  return path.join(TEMPLATES_DIR, `${id}.json`);
}

function listTemplates() {
  ensureDir();
  const files = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".json"));
  return files.map((f) => {
    const data = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, f), "utf-8"));
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      category: data.category || "",
      sectionCount: countSections(data.sections || [])
    };
  });
}

function countSections(sections) {
  let count = 0;
  for (const s of sections) {
    count += 1;
    if (s.children) count += countSections(s.children);
  }
  return count;
}

function getTemplate(id) {
  const fp = templatePath(id);
  if (!fs.existsSync(fp)) return null;
  return JSON.parse(fs.readFileSync(fp, "utf-8"));
}

function createTemplate(data) {
  ensureDir();
  const id = data.id || `custom-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const template = {
    id,
    name: data.name || "未命名模板",
    description: data.description || "",
    category: data.category || "自定义",
    sections: data.sections || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(templatePath(id), JSON.stringify(template, null, 2), "utf-8");
  return template;
}

function updateTemplate(id, data) {
  const existing = getTemplate(id);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...data,
    id,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(templatePath(id), JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

function deleteTemplate(id) {
  const fp = templatePath(id);
  if (!fs.existsSync(fp)) return false;
  fs.unlinkSync(fp);
  return true;
}

module.exports = {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate
};
