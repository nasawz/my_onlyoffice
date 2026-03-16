#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# 颜色 — 用 $'...' 语法确保转义序列被正确解析
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'
BOLD=$'\033[1m'
NC=$'\033[0m'

print_header() {
  printf "\n%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n" "$CYAN" "$NC"
  printf "%s  %s%s\n" "$BOLD" "$1" "$NC"
  printf "%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n" "$CYAN" "$NC"
}

print_ok()   { printf "  %s✔%s %s\n" "$GREEN" "$NC" "$1"; }
print_warn() { printf "  %s⚠%s %s\n" "$YELLOW" "$NC" "$1"; }
print_err()  { printf "  %s✘%s %s\n" "$RED" "$NC" "$1"; }

# ─── 给插件静态资源加时间戳，破浏览器缓存 ───
bust_plugin_cache() {
  local html="$PROJECT_DIR/plugins/ai-writer/index.html"
  if [ ! -f "$html" ]; then
    return
  fi
  local ts
  ts=$(date +%s)
  # 替换已有的 ?v=... 或首次添加
  if grep -q '?v=' "$html"; then
    sed -i '' -E "s/\?v=[0-9]+/?v=${ts}/g" "$html"
  else
    sed -i '' -E "s/(styles\/style\.css)/\1?v=${ts}/" "$html"
    sed -i '' -E "s/(scripts\/code\.js)/\1?v=${ts}/" "$html"
  fi
  print_ok "插件缓存已刷新 (v=${ts})"
}

# ─── 等待 Document Server 就绪 ───
wait_for_ds() {
  local max_wait=120
  local elapsed=0
  printf "  等待 Document Server 就绪（最多 %ds）...\n" "$max_wait"
  while [ $elapsed -lt $max_wait ]; do
    if curl -sf http://localhost/healthcheck > /dev/null 2>&1; then
      print_ok "Document Server 已就绪（${elapsed}s）"
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
    printf "\r  %ds / %ds ..." "$elapsed" "$max_wait"
  done
  printf "\n"
  print_warn "Document Server 未在 ${max_wait}s 内就绪，可能仍在启动中"
  return 1
}

# ─── 等待后端就绪 ───
wait_for_backend() {
  local max_wait=30
  local elapsed=0
  while [ $elapsed -lt $max_wait ]; do
    if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
      print_ok "后端服务已就绪（${elapsed}s）"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  print_warn "后端服务未在 ${max_wait}s 内就绪"
  return 1
}

# ─── 命令：启动全部服务 ───
cmd_up() {
  print_header "启动全部服务"
  docker compose up -d --build
  printf "\n"
  wait_for_backend
  wait_for_ds
  printf "\n"
  print_ok "编辑器地址: http://localhost/example/"
  print_ok "后端健康检查: http://localhost:3000/health"
}

# ─── 命令：仅重启后端 ───
cmd_backend() {
  print_header "重建并重启后端服务"
  docker compose up -d --build --force-recreate backend
  printf "\n"
  wait_for_backend
  cmd_test_backend
}

# ─── 命令：重启 Document Server ───
cmd_ds() {
  print_header "重启 Document Server"
  docker compose restart documentserver
  printf "\n"
  wait_for_ds
}

# ─── 命令：刷新插件缓存 ───
cmd_plugin() {
  print_header "刷新插件缓存"
  bust_plugin_cache
  printf "\n"
  printf "  现在回到浏览器按 %sCmd+Shift+R%s（硬刷新）即可看到最新插件。\n" "$BOLD" "$NC"
  printf "  或者直接普通刷新也行，资源版本号已更新。\n"
}

# ─── 命令：查看服务状态 ───
cmd_status() {
  print_header "服务状态"
  docker compose ps
  printf "\n"

  if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
    print_ok "后端服务: 运行中"
  else
    print_err "后端服务: 不可达"
  fi

  if curl -sf http://localhost/healthcheck > /dev/null 2>&1; then
    print_ok "Document Server: 运行中"
  else
    print_warn "Document Server: 不可达（可能仍在启动）"
  fi
}

# ─── 命令：快速验证后端接口 ───
cmd_test_backend() {
  print_header "验证后端接口"

  printf "\n%s[1/3] GET /health%s\n" "$BOLD" "$NC"
  curl -s http://localhost:3000/health | python3 -m json.tool 2>/dev/null || print_err "请求失败"

  printf "\n%s[2/3] POST /api/polish%s\n" "$BOLD" "$NC"
  local resp http_code body
  resp=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/polish \
    -H "Content-Type: application/json" \
    -d '{"text":"这个东西很好用"}')
  http_code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [ "$http_code" = "200" ]; then
    print_ok "润色接口正常 (HTTP $http_code)"
    echo "$body" | python3 -m json.tool 2>/dev/null | head -5
  else
    print_warn "润色接口返回 HTTP $http_code（可能是 API Key 未配置，不影响其他功能）"
  fi

  printf "\n%s[3/3] GET /api/data-table%s\n" "$BOLD" "$NC"
  resp=$(curl -s -w "\n%{http_code}" http://localhost:3000/api/data-table)
  http_code=$(echo "$resp" | tail -1)
  body=$(echo "$resp" | sed '$d')
  if [ "$http_code" = "200" ]; then
    print_ok "数据查询接口正常 (HTTP $http_code)"
    echo "$body" | python3 -m json.tool 2>/dev/null | head -8
    echo "    ..."
  else
    print_err "数据查询接口失败 (HTTP $http_code)"
  fi
}

# ─── 命令：查看日志 ───
cmd_logs() {
  local service="${1:-}"
  if [ -z "$service" ]; then
    print_header "查看全部日志（Ctrl+C 退出）"
    docker compose logs -f --tail=50
  else
    print_header "查看 ${service} 日志（Ctrl+C 退出）"
    docker compose logs -f --tail=50 "$service"
  fi
}

# ─── 命令：停止全部服务 ───
cmd_down() {
  print_header "停止全部服务"
  docker compose down
  print_ok "已停止"
}

# ─── 命令：完全清理 ───
cmd_clean() {
  print_header "停止并清理全部数据"
  docker compose down -v
  print_ok "已停止并删除 volumes"
}

# ─── 帮助 ───
cmd_help() {
  printf "\n"
  printf "%sOnlyOffice 插件开发脚本%s\n" "$BOLD" "$NC"
  printf "\n"
  printf "%s用法:%s  ./dev.sh <命令> [参数]\n" "$CYAN" "$NC"
  printf "\n"
  printf "%s常用命令:%s\n" "$BOLD" "$NC"
  printf "  %sup%s            启动全部服务（含构建）\n" "$GREEN" "$NC"
  printf "  %sbackend%s       重建并重启后端（改了 server.js / package.json 后用）\n" "$GREEN" "$NC"
  printf "  %splugin%s        刷新插件缓存（改了 HTML/JS/CSS 后用）\n" "$GREEN" "$NC"
  printf "  %sds%s            重启 Document Server\n" "$GREEN" "$NC"
  printf "  %sstatus%s        查看服务运行状态\n" "$GREEN" "$NC"
  printf "  %stest%s          快速验证后端全部接口\n" "$GREEN" "$NC"
  printf "  %slogs%s [服务]   查看日志（可选: backend / documentserver）\n" "$GREEN" "$NC"
  printf "  %sdown%s          停止全部服务\n" "$GREEN" "$NC"
  printf "  %sclean%s         停止并清理全部数据（含 volumes）\n" "$GREEN" "$NC"
  printf "\n"
  printf "%s典型开发流程:%s\n" "$BOLD" "$NC"
  printf "  %s改了插件 HTML/JS/CSS%s  → ./dev.sh plugin  然后刷新浏览器\n" "$YELLOW" "$NC"
  printf "  %s改了 server.js%s        → ./dev.sh backend\n" "$YELLOW" "$NC"
  printf "  %s改了 package.json%s     → ./dev.sh backend\n" "$YELLOW" "$NC"
  printf "  %s改了 docker-compose%s   → ./dev.sh up\n" "$YELLOW" "$NC"
  printf "  %s想看接口是否正常%s      → ./dev.sh test\n" "$YELLOW" "$NC"
  printf "  %s排查问题%s              → ./dev.sh logs backend\n" "$YELLOW" "$NC"
  printf "\n"
}

# ─── 入口 ───
case "${1:-help}" in
  up)       cmd_up ;;
  backend)  cmd_backend ;;
  plugin)   cmd_plugin ;;
  ds)       cmd_ds ;;
  status)   cmd_status ;;
  test)     cmd_test_backend ;;
  logs)     cmd_logs "${2:-}" ;;
  down)     cmd_down ;;
  clean)    cmd_clean ;;
  help|-h|--help) cmd_help ;;
  *)
    print_err "未知命令: $1"
    cmd_help
    exit 1
    ;;
esac
