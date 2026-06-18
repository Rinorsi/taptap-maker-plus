# TapTap Maker Plus

TapTap Maker Plus 是围绕 TapTap Maker MCP 的本地 Web 管理台。它不绕过 Maker MCP，不直接调用 Maker 私有远端接口；所有生成、状态、构建相关能力都通过已登录的 `@taptap/maker` MCP runtime 执行。

## 当前阶段

当前已经完成本地 MCP 工作台的现代化基础：

- 扫描本机 `G:\TapTap_Maker` 下已绑定的 Maker 项目。
- 读取每个项目的 `.maker-mcp\config.json`。
- 为选中项目启动独立 `taptap-maker` stdio runtime。
- 读取 MCP `tools/list` 并保存 raw snapshot 和工具 schema。
- 所有 Studio 表单由真实 MCP `inputSchema` 渲染。
- 覆盖 Image / Video / Music / 3D / Build 的 schema-driven tool UI。
- 展示项目、runtime、工具、资产、任务、错误和 raw result。
- 顶栏命令搜索支持项目、MCP 工具、资产、任务的真实搜索和跳转。
- 资产库支持网格和表格视图，并可用真实路径证据把资产关联到 task / generation / workflow run 来源。
- 节点流页面使用 React Flow 展示真实 MCP tools，支持本地保存、加载、删除当前工具图，并可对已配置真实 schema 输入的节点发起 MCP 执行。
- 右栏是 MCP 状态、工具分类、日志、错误详情控制面板。
- 底部错误栏只在失败任务出现时展示，并支持错误分类与复制 raw/error。
- 构建中心保留真实 `maker_build_current_directory` schema 表单，并结构化展示 `.maker\logs\runtime` 与 `.maker\logs\build` 的本地证据。

当前状态审计见：

```text
docs/current-implementation-audit.md
```

## 启动

```powershell
cd G:\TapTap_Maker\MCP
npm install
npm run dev
```

默认地址：

- Web: `http://localhost:5173`
- API: `http://127.0.0.1:8787`

## 常用检查

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/health
Invoke-RestMethod http://127.0.0.1:8787/api/projects
```

启动指定项目 MCP runtime：

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8787/api/projects/a5e910f9-6b08-4d15-aee7-aa56da73464e/mcp/start" `
  -ContentType "application/json" `
  -Body "{}"
```

查询 runtime 状态：

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/projects/a5e910f9-6b08-4d15-aee7-aa56da73464e/mcp/status
```

读取 Maker MCP 轻量状态：

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8787/api/projects/a5e910f9-6b08-4d15-aee7-aa56da73464e/mcp/status-lite" `
  -ContentType "application/json" `
  -Body '{"skip_remote_sync":true}'
```

扫描资产：

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8787/api/projects/a5e910f9-6b08-4d15-aee7-aa56da73464e/assets/scan" `
  -ContentType "application/json" `
  -Body "{}"
```

## 项目边界

每个 Maker 项目必须使用独立 MCP runtime。当前本地证据表明，单个 MCP 进程跨项目传 `target_dir` 会出现 cwd 与工具注册不一致的问题，因此 TapTap Maker Plus 按项目 root 启动独立 `taptap-maker` 进程。

浏览器不直接连接 MCP stdio。结构为：

```text
Browser UI -> Local Node Server -> Project MCP Runtime -> @taptap/maker
```

## 尚未完成

目前不能声称所有页面和所有功能都完整完成。仍需继续补：

- Workflow 已支持显式输入的节点级 MCP 执行和本地 run 记录，但还不是完整编排引擎；仍缺少跨节点输出映射、人工确认节点、暂停/恢复和失败重放。
- 视频 / 3D 长任务轮询、阶段确认和任务恢复体验。
- 资产来源已能通过真实 `relativePath` / `absolutePath` 在 task、generation、workflow run 的存储 JSON 中建立路径证据关联；仍缺少跨节点输出映射和人工标注级别的完整 provenance DAG。
- Build Center 已能读取本地日志证据，但远端同步、远端构建阶段与 watcher 事件还没有完整编排成可恢复的生命周期视图。
- API 示例、schema 快照、页面验收截图的完整文档。
