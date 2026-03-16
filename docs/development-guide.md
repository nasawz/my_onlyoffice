# OnlyOffice AI Writer 插件开发指南

## 目录

- [OnlyOffice AI Writer 插件开发指南](#onlyoffice-ai-writer-插件开发指南)
  - [目录](#目录)
  - [项目概述](#项目概述)
  - [整体架构](#整体架构)
  - [项目目录结构](#项目目录结构)
  - [环境准备](#环境准备)
  - [快速启动](#快速启动)
    - [1. 配置 API Key](#1-配置-api-key)
    - [2. 启动服务](#2-启动服务)
    - [3. 等待 Document Server 初始化](#3-等待-document-server-初始化)
    - [4. 访问编辑器](#4-访问编辑器)
    - [5. 使用插件](#5-使用插件)
    - [6. 验证后端服务](#6-验证后端服务)
  - [后端 API 代理服务](#后端-api-代理服务)
    - [接口说明](#接口说明)
    - [切换 AI 提供商](#切换-ai-提供商)
    - [请求与响应格式](#请求与响应格式)
    - [图片上传接口](#图片上传接口)
    - [数据查询接口](#数据查询接口)
  - [插件开发详解](#插件开发详解)
    - [config.json 配置说明](#configjson-配置说明)
    - [插件 UI (index.html)](#插件-ui-indexhtml)
    - [插件核心逻辑 (code.js)](#插件核心逻辑-codejs)
    - [关键 API 方法](#关键-api-方法)
  - [Docker 环境变量说明](#docker-环境变量说明)
  - [踩坑记录与注意事项](#踩坑记录与注意事项)
    - [坑 1：端口映射必须内外一致（80:80）](#坑-1端口映射必须内外一致8080)
    - [坑 2：私网地址回调被拦截](#坑-2私网地址回调被拦截)
    - [坑 3：不要直接挂载覆盖 local.json](#坑-3不要直接挂载覆盖-localjson)
    - [坑 4：Example 服务默认不启动](#坑-4example-服务默认不启动)
    - [坑 5：插件配置文件是 config.json 不是 manifest.json](#坑-5插件配置文件是-configjson-不是-manifestjson)
    - [坑 6：插件中不要直接调用 AI API](#坑-6插件中不要直接调用-ai-api)
    - [坑 7：Document Server 启动需要较长时间](#坑-7document-server-启动需要较长时间)
  - [调试技巧](#调试技巧)
    - [查看容器日志](#查看容器日志)
    - [查看容器内部配置](#查看容器内部配置)
    - [插件热更新](#插件热更新)
    - [浏览器开发者工具](#浏览器开发者工具)
    - [手动安装插件（开发模式）](#手动安装插件开发模式)
  - [后续扩展方向](#后续扩展方向)

---

## 项目概述

本项目是一个 OnlyOffice Document Server 的 AI 写作插件，通过侧边面板的形式嵌入编辑器，支持对文档中选中的文本进行扩写、改写、润色、翻译、总结、续写等 AI 操作。

后端采用 Node.js + Express 搭建轻量代理服务，将 AI API 调用封装在服务端，避免在前端暴露 API Key。

---

## 整体架构

```
用户浏览器
    │
    │  http://localhost/example/
    ▼
┌─────────────────────────────────────────┐
│  OnlyOffice Document Server (Docker)    │
│  ┌───────────────────────────────────┐  │
│  │  编辑器 (Word / Excel / PPT)      │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  AI Writer 插件 (侧边面板)  │  │  │
│  │  └──────────┬──────────────────┘  │  │
│  └─────────────┼─────────────────────┘  │
└────────────────┼────────────────────────┘
                 │  HTTP (fetch)
                 ▼
┌─────────────────────────────────────────┐
│  AI Backend (Docker, port 3000)         │
│  Node.js + Express                      │
│  POST /api/expand|rewrite|polish|...    │
└────────────────┬────────────────────────┘
                 │  HTTPS
                 ▼
┌─────────────────────────────────────────┐
│  LLM API (DeepSeek / OpenAI / ...)      │
└─────────────────────────────────────────┘
```

---

## 项目目录结构

```
my_onlyoffice/
├── dev.sh                            # 开发辅助脚本（启动/重启/测试/日志）
├── docker-compose.yml                # Docker 编排文件
├── documentserver/
│   └── local.json                    # (可选) 自定义 DS 配置，见踩坑记录
├── backend/                          # 后端 AI 代理服务
│   ├── package.json                  # 依赖声明
│   ├── server.js                     # Express 服务主文件
│   ├── Dockerfile                    # 后端容器构建
│   └── .env                          # API Key 等敏感配置（不要提交到 Git）
├── plugins/
│   └── ai-writer/                    # AI 写作插件
│       ├── config.json               # 插件配置（OnlyOffice 要求此文件名）
│       ├── index.html                # 插件 UI 入口
│       ├── scripts/
│       │   └── code.js               # 插件核心逻辑
│       ├── styles/
│       │   └── style.css             # 自定义样式
│       └── resources/
│           └── img/
│               ├── icon.svg          # 插件图标
│               └── icon@2x.svg       # 高清图标
└── docs/
    └── development-guide.md          # 本文档
```

---

## 环境准备

| 依赖 | 最低版本 | 说明 |
|------|----------|------|
| Docker | 20+ | 需要 Docker Compose V2 |
| macOS / Linux | - | Windows 需使用 WSL2 |
| AI API Key | - | DeepSeek 或 OpenAI 的 API Key |

无需在本地安装 Node.js，后端服务完全运行在 Docker 容器中。

---

## 快速启动

### 1. 配置 API Key

编辑 `backend/.env`，填入你的 AI 服务密钥：

```env
PORT=3000
LLM_PROVIDER=deepseek
LLM_BASE_URL=https://api.deepseek.com/chat/completions
LLM_MODEL=deepseek-chat
LLM_API_KEY=sk-your-api-key-here
```

### 2. 启动服务（推荐使用 dev.sh）

```bash
cd my_onlyoffice
./dev.sh up
```

脚本会自动构建后端镜像、启动所有容器、等待服务就绪，并输出访问地址。

也可以用原始命令：

```bash
docker compose up -d --build
```

首次启动需要拉取镜像和构建后端，大约需要 2-5 分钟。

### 3. 等待 Document Server 初始化

OnlyOffice Document Server 内部需要启动 PostgreSQL、RabbitMQ、nginx 等多个服务，**首次启动约需 60-90 秒**。`./dev.sh up` 会自动等待就绪。也可以手动监控：

```bash
docker logs -f onlyoffice-documentserver
```

看到以下输出表示启动完成：

```
ds:docservice: started
ds:converter: started
Reloading nginx configuration nginx ...done.
```

### 4. 访问编辑器

打开浏览器访问：

```
http://localhost/example/
```

创建或打开一个文档，在编辑器顶部的 **Plugins** 标签页中找到 **AI Writer** 插件。

### 5. 使用插件

1. 在文档中选中一段文字
2. 点击插件面板中的「读取选中文本」按钮
3. 选择操作（扩写 / 改写 / 润色 / 翻译 / 总结 / 续写）
4. 在「AI 结果预览」区域查看结果
5. 点击「替换选中文本」或「插入到光标处」将结果写回文档

### 6. 验证后端服务

```bash
# 一键验证全部接口
./dev.sh test

# 或手动验证
curl http://localhost:3000/health
curl -X POST http://localhost:3000/api/polish \
  -H "Content-Type: application/json" \
  -d '{"text":"这个东西很好用，我觉得非常不错"}'
```

---

## 开发辅助脚本 (dev.sh)

项目根目录的 `dev.sh` 是日常开发的核心工具，封装了所有常用操作：

```bash
./dev.sh <命令> [参数]
```

### 命令一览

| 命令 | 说明 | 使用场景 |
|------|------|----------|
| `up` | 启动全部服务（含构建） | 首次启动或改了 docker-compose.yml |
| `backend` | 重建并重启后端 | 改了 server.js 或 package.json |
| `plugin` | 刷新插件缓存 | 改了插件 HTML/JS/CSS 后用 |
| `ds` | 重启 Document Server | DS 异常需要重启时 |
| `status` | 查看服务运行状态 | 检查各服务是否正常 |
| `test` | 快速验证后端全部接口 | 改完后端代码后验证 |
| `logs [服务]` | 查看日志 | 排查问题 |
| `down` | 停止全部服务 | 暂停开发 |
| `clean` | 停止并清理全部数据 | 需要完全重置时 |

### 典型开发流程

```
改了插件 HTML/JS/CSS  → ./dev.sh plugin  然后刷新浏览器
改了 server.js        → ./dev.sh backend
改了 package.json     → ./dev.sh backend
改了 docker-compose   → ./dev.sh up
想看接口是否正常      → ./dev.sh test
排查问题              → ./dev.sh logs backend
```

---

## 后端 API 代理服务

### 接口说明

所有接口均为 `POST` 方法，请求体为 JSON 格式。

| 接口 | 功能 | 说明 |
|------|------|------|
| `POST /api/expand` | 扩写 | 在不改变核心观点的前提下扩展文本 |
| `POST /api/rewrite` | 改写 | 保持原意，改写为更自然流畅的表达 |
| `POST /api/polish` | 润色 | 修正语法与措辞，提升可读性 |
| `POST /api/translate` | 翻译 | 翻译为指定目标语言 |
| `POST /api/summarize` | 总结 | 提炼核心观点，输出简要总结 |
| `POST /api/continue` | 续写 | 根据已有内容在相同风格下继续写作 |
| `POST /api/upload-image` | 图片上传 | 上传图片到服务器，返回可访问的 URL |
| `GET /api/data-table` | 数据查询 | 返回一组示例表格数据（模拟业务数据源） |
| `GET /health` | 健康检查 | 返回服务状态 |

### 切换 AI 提供商

通过修改 `backend/.env` 即可切换不同的 LLM 提供商：

**DeepSeek 配置：**

```env
LLM_PROVIDER=deepseek
LLM_BASE_URL=https://api.deepseek.com/chat/completions
LLM_MODEL=deepseek-chat
LLM_API_KEY=sk-xxx
```

**OpenAI 配置：**

```env
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-4o-mini
LLM_API_KEY=sk-xxx
```

**其他兼容 OpenAI 接口的服务（如 Ollama、vLLM）：**

```env
LLM_PROVIDER=openai
LLM_BASE_URL=http://host.docker.internal:11434/v1/chat/completions
LLM_MODEL=qwen2.5:7b
LLM_API_KEY=ollama
```

修改后需重启后端容器：

```bash
docker compose up -d --force-recreate backend
```

### 请求与响应格式

**请求体：**

```json
{
  "text": "需要处理的文本内容",
  "options": {
    "targetLanguage": "英文",
    "temperature": 0.7,
    "style": "正式",
    "audience": "技术人员",
    "lengthHint": "200字以内"
  }
}
```

`options` 中所有字段均为可选。`targetLanguage` 仅在翻译接口生效。

**成功响应：**

```json
{
  "ok": true,
  "action": "polish",
  "result": "AI 处理后的文本"
}
```

**失败响应：**

```json
{
  "ok": false,
  "action": "polish",
  "error": "错误信息"
}
```

### 图片上传接口

**请求：** `POST /api/upload-image`，使用 `multipart/form-data` 格式，字段名为 `image`。

支持格式：jpg、png、gif、webp、svg、bmp，最大 10MB。

**成功响应：**

```json
{
  "ok": true,
  "url": "http://localhost:3000/uploads/1710000000-abcd1234.png",
  "filename": "1710000000-abcd1234.png",
  "size": 102400
}
```

上传的图片通过 `http://localhost:3000/uploads/<filename>` 静态访问。

### 数据查询接口

**请求：** `GET /api/data-table`（无参数）

**成功响应：**

```json
{
  "ok": true,
  "title": "2025年Q4季度销售报告",
  "columns": ["产品", "Q1 销售额", "Q2 销售额", "Q3 销售额", "Q4 销售额", "年度合计"],
  "rows": [
    ["智能手表 Pro", "¥128,000", "¥156,000", "¥189,000", "¥245,000", "¥718,000"],
    ...
  ]
}
```

此接口返回模拟数据，实际项目中可替换为真实数据库查询。

---

## 插件开发详解

### config.json 配置说明

OnlyOffice 插件使用 **`config.json`**（不是 `manifest.json`）作为配置文件。

```json
{
  "name": "AI Writer",
  "guid": "asc.{7E976A8F-4A18-4D4A-8B8A-7F8B31A2C901}",
  "baseUrl": "",
  "version": "1.0.0",
  "minVersion": "8.0.0",
  "variations": [
    {
      "description": "AI writing assistant",
      "url": "index.html",
      "icons": ["resources/img/icon.svg", "resources/img/icon@2x.svg"],
      "isViewer": false,
      "EditorsSupport": ["word", "cell", "slide", "pdf"],
      "isVisual": true,
      "isModal": false,
      "isInsideMode": false,
      "initDataType": "none",
      "type": "panel",
      "buttons": [],
      "size": [360, 560]
    }
  ]
}
```

关键字段说明：

| 字段 | 说明 |
|------|------|
| `guid` | 插件唯一标识，格式为 `asc.{UUID}`，不能与其他插件重复 |
| `type` | `"panel"` 表示以右侧面板形式展示；也可用 `"window"` 弹窗形式 |
| `isVisual` | `true` 表示有 UI 界面；`false` 表示后台执行无界面 |
| `isModal` | `true` 时插件打开后会阻止编辑器交互 |
| `EditorsSupport` | 支持的编辑器类型：`word`、`cell`、`slide`、`pdf` |
| `size` | 面板尺寸 `[宽, 高]`，单位像素 |

### 插件 UI (index.html)

插件本质是一个嵌入编辑器的 HTML 页面。必须引入 OnlyOffice 的插件 SDK：

```html
<!-- 官方样式 -->
<link rel="stylesheet" href="https://onlyoffice.github.io/sdkjs-plugins/v1/plugins.css" />
<!-- 插件 JS SDK -->
<script src="https://onlyoffice.github.io/sdkjs-plugins/v1/plugins.js"></script>
<!-- 插件 UI 组件库 -->
<script src="https://onlyoffice.github.io/sdkjs-plugins/v1/plugins-ui.js"></script>
```

引入官方 `plugins.css` 可以让插件 UI 自动适配编辑器的亮色/暗色主题。

### 插件核心逻辑 (code.js)

插件的生命周期由两个核心回调驱动：

```javascript
// 插件初始化时调用（插件被激活时触发）
window.Asc.plugin.init = function () {
  // 绑定 UI 事件、初始化状态
};

// 插件按钮被点击时调用（关闭插件）
window.Asc.plugin.button = function () {
  window.Asc.plugin.executeCommand("close", "");
};
```

### 关键 API 方法

**1. 获取选中文本 — `GetSelectedText`**

```javascript
window.Asc.plugin.executeMethod("GetSelectedText", [
  {
    Numbering: false,
    Math: false,
    TableCellSeparator: "\n",
    ParaSeparator: "\n",
    TabSymbol: String.fromCharCode(9)
  }
], function (text) {
  console.log("选中的文本:", text);
});
```

**2. 替换选中文本 — `InputText`**

```javascript
// 参数: [新文本, 被替换的原文本]
window.Asc.plugin.executeMethod("InputText", [newText, oldText]);
```

**3. 在光标处插入文本 — `PasteText`**

```javascript
window.Asc.plugin.executeMethod("PasteText", [textToInsert]);
```

**4. 通过 PasteHtml 插入图片**

插件可以通过 `PasteHtml` 方法将包含 `<img>` 标签的 HTML 插入文档，从而实现图片插入：

```javascript
// 先上传图片到后端获取 URL，再插入文档
const formData = new FormData();
formData.append("image", file);
const response = await fetch("http://localhost:3000/api/upload-image", {
  method: "POST",
  body: formData
});
const data = await response.json();

// 通过 PasteHtml 插入图片
const imgHtml = `<p><img src="${data.url}" style="max-width:600px;" /></p>`;
window.Asc.plugin.executeMethod("PasteHtml", [imgHtml]);
```

**5. 通过 PasteHtml 插入表格**

同样可以用 `PasteHtml` 插入 HTML 表格，OnlyOffice 会自动将其转换为文档原生表格：

```javascript
// 从后端获取数据
const response = await fetch("http://localhost:3000/api/data-table");
const data = await response.json();

// 构建 HTML 表格
let html = '<table border="1" cellpadding="6" cellspacing="0">';
html += '<tr>';
for (const col of data.columns) {
  html += `<th>${col}</th>`;
}
html += '</tr>';
for (const row of data.rows) {
  html += '<tr>';
  for (const cell of row) {
    html += `<td>${cell}</td>`;
  }
  html += '</tr>';
}
html += '</table>';

window.Asc.plugin.executeMethod("PasteHtml", [html]);
```

**6. 封装为 Promise（推荐）**

原生 API 是回调风格，建议封装为 Promise 以便使用 `async/await`：

```javascript
function executeMethod(name, params) {
  return new Promise((resolve) => {
    window.Asc.plugin.executeMethod(name, params, function (result) {
      resolve(result);
    });
  });
}

// 使用
const text = await executeMethod("GetSelectedText", [options]);
```

---

## Docker 环境变量说明

`docker-compose.yml` 中 `documentserver` 服务的关键环境变量：

| 环境变量 | 值 | 说明 |
|----------|-----|------|
| `JWT_ENABLED` | `false` | 关闭 JWT 验证（开发环境使用） |
| `ALLOW_PRIVATE_IP_ADDRESS` | `true` | 允许回调私网地址（本地开发必须） |
| `ALLOW_META_IP_ADDRESS` | `true` | 允许回调元地址如 127.0.0.1 |
| `EXAMPLE_ENABLED` | `true` | 启用内置示例页面 |

完整的 `docker-compose.yml`：

```yaml
services:
  documentserver:
    image: onlyoffice/documentserver:latest
    container_name: onlyoffice-documentserver
    ports:
      - "80:80"
    environment:
      - JWT_ENABLED=false
      - ALLOW_PRIVATE_IP_ADDRESS=true
      - ALLOW_META_IP_ADDRESS=true
      - EXAMPLE_ENABLED=true
    volumes:
      - ./plugins/ai-writer:/var/www/onlyoffice/documentserver/sdkjs-plugins/ai-writer
    restart: unless-stopped

  backend:
    build:
      context: ./backend
    container_name: onlyoffice-ai-backend
    ports:
      - "3000:3000"
    env_file:
      - ./backend/.env
    restart: unless-stopped
```

---

## 踩坑记录与注意事项

### 坑 1：端口映射必须内外一致（80:80）

**现象：** 打开文档后报 "The document could not be saved" 或 "Download failed"。

**原因：** 如果使用 `8080:80` 映射，浏览器通过 `localhost:8080` 访问，example 服务会把 `Host: localhost:8080` 作为回调地址传给 docservice。但 docservice 在容器内部尝试请求 `http://localhost:8080/...` 时，容器内 nginx 监听的是 80 端口，8080 根本不存在，导致 `ECONNREFUSED`。

**解决：** 端口映射使用 `80:80`，保证内外端口一致。如果 80 端口被占用，可以考虑通过 nginx 反向代理来解决。

### 坑 2：私网地址回调被拦截

**现象：** 日志中出现 `DNS lookup 127.0.0.1(host:localhost) is not allowed. Because, It is private IP address.`

**原因：** OnlyOffice 7.2+ 版本默认禁止 docservice 向私网 IP 发起回调请求（安全策略）。本地开发时 `localhost` 属于私网地址，会被拦截。

**解决：** 在 `docker-compose.yml` 中设置环境变量：

```yaml
environment:
  - ALLOW_PRIVATE_IP_ADDRESS=true
  - ALLOW_META_IP_ADDRESS=true
```

**注意：** 生产环境不建议开启此配置，应使用正式域名和公网地址。

### 坑 3：不要直接挂载覆盖 local.json

**现象：** 容器启动后卡在 `Waiting for connection to the host on port`，host 和 port 都是空值，nginx 返回 `ERR_EMPTY_RESPONSE`。

**原因：** `/etc/onlyoffice/documentserver/local.json` 是容器启动时由 entrypoint 脚本自动生成的，包含 PostgreSQL 地址/端口/密码、RabbitMQ 连接、JWT 密钥等关键配置。如果用 volume 挂载一个只包含部分字段的文件去覆盖它，会导致数据库连接信息丢失，所有内部服务无法启动。

**解决：** 使用环境变量注入配置，不要挂载覆盖 `local.json`。OnlyOffice Docker 镜像的 entrypoint 脚本支持通过环境变量来修改配置（如 `ALLOW_PRIVATE_IP_ADDRESS`、`JWT_ENABLED` 等）。

### 坑 4：Example 服务默认不启动

**现象：** 访问 `http://localhost/example/` 提示 "Test example is not running"。

**原因：** 示例服务 `ds:example` 默认 `autostart=false`。

**解决：** 设置环境变量 `EXAMPLE_ENABLED=true`（注意不是 `DS_EXAMPLE_ENABLE`）。这个变量名可以在容器的 entrypoint 脚本中确认：

```bash
docker exec onlyoffice-documentserver grep "EXAMPLE_ENABLED" /app/ds/run-document-server.sh
```

### 坑 5：插件配置文件是 config.json 不是 manifest.json

OnlyOffice 插件系统使用 `config.json` 作为配置文件名。很多其他插件系统（如 Chrome 扩展）使用 `manifest.json`，容易混淆。如果文件名不对，插件不会被加载。

### 坑 6：插件中不要直接调用 AI API

**原因：** 在插件的 `callCommand` 或编辑器命令上下文中执行网络请求可能会冻结编辑器。

**解决：** 所有 AI API 调用应在插件 UI 层面（index.html 的 JS 上下文）通过 `fetch` 发起，拿到结果后再用 `executeMethod` 写回文档。本项目通过独立的后端代理服务来处理 AI 调用，插件只负责 UI 交互和文档操作。

### 坑 7：Document Server 启动需要较长时间

OnlyOffice Document Server 容器内部需要依次启动 PostgreSQL、RabbitMQ、supervisord、nginx，还要生成字体缓存和 JS 缓存。**首次启动通常需要 60-90 秒**，后续重启约 30-50 秒。

可以通过以下命令确认所有服务就绪：

```bash
docker exec onlyoffice-documentserver supervisorctl status
```

期望输出：

```
ds:converter    RUNNING
ds:docservice   RUNNING
ds:example      RUNNING
```

---

## 调试技巧

### 查看容器日志

```bash
# 实时查看 Document Server 日志
docker logs -f onlyoffice-documentserver

# 查看后端服务日志
docker logs -f onlyoffice-ai-backend
```

### 查看容器内部配置

```bash
# 查看生成的 local.json（含数据库、JWT 等配置）
docker exec onlyoffice-documentserver cat /etc/onlyoffice/documentserver/local.json

# 查看 example 服务配置
docker exec onlyoffice-documentserver cat /etc/onlyoffice/documentserver-example/local.json

# 查看 supervisor 服务状态
docker exec onlyoffice-documentserver supervisorctl status

# 查看 nginx 配置
docker exec onlyoffice-documentserver cat /etc/nginx/conf.d/ds.conf
```

### 插件热更新

插件目录通过 volume 挂载到容器中，修改本地 `plugins/ai-writer/` 下的文件后，**刷新浏览器页面即可看到变化**，无需重启容器。

### 浏览器开发者工具

在编辑器页面按 F12 打开开发者工具：
- 在 Console 中选择 `frameEditor` 上下文可以查看插件的日志输出
- Network 面板可以观察插件对后端 API 的请求

### 手动安装插件（开发模式）

除了 volume 挂载，也可以在浏览器控制台中动态安装插件：

```javascript
// 在 Console 中选择 frameEditor 上下文
Asc.editor.installDeveloperPlugin("http://your-server/ai-writer/config.json")
```

---

## 后续扩展方向

| 方向 | 状态 | 说明 |
|------|------|------|
| 图片上传与插入 | ✅ 已完成 | 通过插件上传图片到服务器，使用 `PasteHtml` 插入文档 |
| 远程数据插入表格 | ✅ 已完成 | 从后端 API 获取数据，以 HTML 表格形式插入文档 |
| SSE 流式输出 | 待实现 | 后端支持 Server-Sent Events，实现打字机效果的实时输出 |
| 保留原文插入 | 待实现 | 在原文下方插入 AI 结果而非替换，方便对比 |
| 自定义 Prompt | 待实现 | 在插件 UI 中增加自定义指令输入框 |
| 多轮对话 | 待实现 | 支持基于上下文的多轮 AI 对话 |
| 右键菜单集成 | 待实现 | 通过 `AddContextMenuItem` 将 AI 操作加入右键菜单 |
| 工具栏按钮 | 待实现 | 通过 `AddToolbarMenuItem` 在工具栏添加快捷按钮 |
| 批量处理 | 待实现 | 对整篇文档进行分段处理 |
| 生产部署 | 待实现 | 关闭 `ALLOW_PRIVATE_IP_ADDRESS`，启用 JWT，使用正式域名 |
