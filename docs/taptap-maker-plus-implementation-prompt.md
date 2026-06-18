# TapTap Maker Plus / 制造++ 开发提示词

版本：0.1  
日期：2026-06-17  
工作目录：`G:\TapTap_Maker\MCP`

## 1. 角色与目标

你是 TapTap Maker Plus / 制造++ 的开发执行 agent。你的任务是在 `G:\TapTap_Maker\MCP` 内实现一个本地桌面级 Maker MCP 工作台。

产品方向已经确定：

- 第一阶段做本地 Web 内核。
- 第一阶段直接做 MCP client。
- Fastify server 内嵌 MCP client，直接连接 `@taptap/maker` stdio MCP server。
- Web UI 只调用本地 Fastify API，不直接连接 stdio。
- 不通过 Codex 对话作为工具调用中转。
- Agent / 智能编排是后期扩展，不进入第一阶段主链路。
- 不实现 TapTap 官方发布、上传、审核、商店后台替代功能。

第一阶段目标闭环：

```text
Workbench UI
  -> Fastify Local Server
    -> MCP Client
      -> @taptap/maker stdio MCP server
        -> Maker MCP tools
          -> selected local TapTap Maker project
```

## 2. 必须先读的文件

开始编码前必须读取：

- `G:\TapTap_Maker\MCP\docs\taptap-maker-plus-development-plan.md`
- `G:\TapTap_Maker\MCP\docs\taptap-maker-plus-visual-system.md`
- `G:\TapTap_Maker\MCP\docs\参考.html`
- `G:\TapTap_Maker\MCP\package.json`
- `G:\TapTap_Maker\MCP\apps\web\package.json`
- `G:\TapTap_Maker\MCP\apps\server\package.json`

读取后再实现，不允许只凭记忆或截图印象改 UI。

## 3. 当前技术栈

现有 package 文件显示：

- monorepo workspaces：`apps/*`
- Web：Vite + React + TypeScript
- Server：Fastify + TypeScript
- 数据层：better-sqlite3、Drizzle ORM
- 校验：zod
- 进程与文件：execa、chokidar

需要补充：

- 在 `apps/server` 添加 `@modelcontextprotocol/sdk`。
- 如果实际 SDK 的导入路径、类名、传输类名与文档不一致，必须读取已安装包的真实导出和示例后再写代码，不允许猜 API 名称。

## 4. MCP 启动方式

本地 Maker MCP server 入口按当前已验证配置执行：

```text
command = "cmd.exe"
args = ["/d", "/s", "/c", "npx.cmd", "-y", "-p", "@taptap/maker", "taptap-maker"]
env.TAPTAP_MCP_ENV = "production"
cwd = selectedProjectRoot
```

要求：

- 每个 TapTap Maker 项目使用独立 MCP runtime。
- `cwd` 必须是当前选择项目的根目录。
- 不允许用一个 MCP runtime 横跨多个项目。
- 不允许前端传入任意本地绝对输出路径。
- 后端必须校验所有项目文件写入目标位于当前项目目录内。

## 5. 第一阶段 API

优先实现这些本地 API：

```text
GET  /api/mcp/status
GET  /api/mcp/tools
POST /api/mcp/call
POST /api/projects/:projectId/mcp/start
POST /api/projects/:projectId/mcp/stop
GET  /api/projects/:projectId/mcp/status
GET  /api/projects/:projectId/tools
POST /api/projects/:projectId/tools/:toolName/call
GET  /api/tasks
GET  /api/tasks/:taskId
```

接口要求：

- `tools/list` 的 raw result 必须保存。
- `tools/call` 的 raw result 必须保存。
- UI 表单只能由真实 `tools/list` schema 生成或由已读 schema 明确映射。
- 不允许手写猜测工具参数结构。
- 工具调用必须进入任务队列。
- 任务失败必须保留错误、输入摘要、项目、工具名、raw result。

## 6. 第一阶段优先闭环

按这个顺序实现：

1. 启动 Fastify server。
2. 建立 MCP runtime manager。
3. 使用所选项目 `cwd` 启动 `@taptap/maker`。
4. 完成 MCP initialize。
5. 调用 `tools/list`。
6. 持久化工具列表和 schema raw result。
7. 在 Web UI 展示 MCP 状态和工具列表。
8. 先调用安全状态工具，例如 `maker_status_lite`。
9. 再接入 `generate_image`，但参数必须来自真实 schema。
10. 将调用记录写入任务队列。
11. 将生成结果纳入资产索引。

## 7. UI 方向

UI 必须是专业本地工作台，不是调试页，不是聊天页，不是营销 landing page。

桌面端固定五区结构：

```text
TopBar
ProjectSidebar
WorkbenchViewport
Inspector / 后期智能编排扩展位
TaskQueue
```

硬规则：

- 顶栏、左栏、右栏、底部任务队列常驻。
- 只有中央 WorkbenchViewport 滚动。
- 切换模块不重置当前项目、右侧 Inspector、任务队列。
- 节点流画布 pan/zoom 不影响外层 shell。
- 第一阶段右侧默认是 Inspector / MCP 状态 / 任务详情。
- 后期智能编排 tab 可以占位，但不能承担第一阶段 MCP 调用。
- 参考 TapTap 视觉，但不能照搬官方发布页功能。
- TapTap 参考里的 `发布到 TapTap`、`发布物料`、`确认发布` 必须转译为 `写入项目`、`保存资产`、`加入工作流`、`构建`。
- 参考 TapTap 里的上传卡在制造++里命名为素材导入，不做官方平台上传。
- 避免黑色赛博风、泛紫色渐变、半亮半暗混搭。

## 8. 禁止事项

禁止：

- 把 Codex 对话当第一阶段工具调用中转。
- 在 React 组件里 spawn MCP。
- 前端直接读写任意文件系统路径。
- 前端拼接最终输出路径。
- 把 React Flow nodes 当业务图唯一真值。
- 把生成历史当资产系统。
- 实现 TapTap 官方发布、上传、审核、商店后台替代功能。
- 未读取 `tools/list` 就手写工具参数 schema。
- 用移动端单列页面替代桌面五区工作台。

## 9. 代码边界

推荐目录职责：

```text
apps/web/src/components      只关心显示
apps/web/src/routes          只关心页面组合
apps/web/src/stores          只关心 UI 状态
apps/web/src/queries         只关心本地服务请求
apps/server/src/routes       只关心 HTTP 边界
apps/server/src/services     只关心业务动作
apps/server/src/mcp          只关心 MCP 协议和进程
apps/server/src/assets       只关心资产索引和路径安全
apps/server/src/tasks        只关心任务状态和事件
apps/server/src/db           只关心持久化
```

## 10. 验收命令

完成后必须执行：

```text
npm run typecheck
npm run build
```

如果改动 UI，必须用 Playwright 检查至少：

- `1440x900`
- `390x844`

检查内容：

- 五区结构存在。
- 中央滚动不带走顶栏、左栏、右栏、任务队列。
- 文本不重叠、不溢出。
- 亮色/暗色不混搭。
- 工具列表来自真实 MCP `tools/list`。
- `maker_status_lite` 调用结果能在 UI 或任务详情中看到。

## 11. 第一阶段交付标准

第一阶段完成时必须做到：

- 能选择本地 TapTap Maker 项目。
- 能为所选项目启动独立 MCP runtime。
- 能展示 MCP 连接状态。
- 能展示真实工具列表。
- 能调用 `maker_status_lite`。
- 能保存 raw result。
- 能把 MCP 调用纳入任务队列。
- 能展示基础资产库。
- 能通过 UI 发起一次图片生成闭环。

如果任何 MCP 字段、工具参数、返回结构、项目配置结构不明确，先读取真实文件、日志、`tools/list` 或 raw result。读不到就停止并要求补证据，不允许猜。
