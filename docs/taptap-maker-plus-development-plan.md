# TapTap Maker Plus 开发文档

版本：0.1  
日期：2026-06-17  
目标目录：`G:\TapTap_Maker\MCP`

## 1. 项目定位

TapTap Maker Plus / 制造++ 是一个围绕 TapTap Maker MCP 的本地桌面级工作台。第一阶段先实现本地 Web 内核，后续可封装为 Electron 或 Tauri 桌面 App。它不绕过 Maker MCP，不自建独立 Maker API，不把 Codex 对话作为前期工具调用中转。它的职责是把 Maker MCP 已经提供的能力做成可视化、项目化、节点化、可追踪、可维护的本地生产工作台。

核心定位：

```text
TapTap Maker Plus
  = 本地桌面级工作台
  + Fastify 内置 MCP client
  + 多项目绑定管理
  + 资产库
  + 生成任务中心
  + 节点流编排器
  + 后期智能编排扩展位
```

现有 Maker MCP 继续负责：

- TapTap / PAT 登录后的远端能力调用。
- 图片、视频、音乐、3D 生成。
- Maker 项目状态检查。
- 提交、push、远端构建。
- 生成资产落盘到项目目录。

TapTap Maker Plus 负责：

- 发现本地 Maker 项目。
- 在本地 Fastify server 内启动或连接独立 MCP runtime。
- 读取 `tools/list` 并生成工具面板。
- 通过 MCP client 直接调用 `tools/call`。
- 管理生成参数、历史、失败记录、任务状态。
- 管理项目内图片、视频、音频、模型文件。
- 提供节点流，把参考图、参考视频、提示词、生成工具、人工确认、构建串起来。
- 给后期智能编排层提供扩展 API，但第一阶段不依赖 Agent 执行 MCP 调用。

## 2. 已验证本地事实

当前机器已经存在 4 个 TapTap Maker 绑定项目：

| 项目 | 路径 | project_id |
| --- | --- | --- |
| Azure Mirage | `G:\TapTap_Maker\Azure Mirage` | `a5e910f9-6b08-4d15-aee7-aa56da73464e` |
| BlockyCars | `G:\TapTap_Maker\BlockyCars` | `e4ecd5c5-a168-4e7e-bf32-24d12010fdc0` |
| BlockyCraft | `G:\TapTap_Maker\BlockyCraft` | `3243aed1-0c2f-404f-9479-ac39f393f921` |
| Paper Line | `G:\TapTap_Maker\Paper Line` | `55f882ce-9607-4455-87fd-df0313ce635a` |

当前 Codex MCP 配置里注册的 `taptap-maker` 入口使用：

```text
command = "cmd.exe"
args = ["/d", "/s", "/c", "npx.cmd", "-y", "-p", "@taptap/maker", "taptap-maker"]
cwd = "G:\TapTap_Maker\BlockyCraft"
TAPTAP_MCP_ENV = "production"
```

本地包信息：

```text
package: @taptap/maker
version: 0.0.18
bin: taptap-maker -> bin/taptap-maker
```

当前 npm 可用 MCP TypeScript SDK：

```text
package: @modelcontextprotocol/sdk
version: 1.29.0
```

本地 MCP 工具实测 `tools/list` 返回 10 个工具：

| 工具 | 类别 | 说明 |
| --- | --- | --- |
| `maker_status_lite` | 状态 | 读取项目、认证、Python、Lua LSP、MCP 工具状态 |
| `maker_build_current_directory` | 构建 | 提交、push、远端构建、启动 runtime watcher |
| `generate_image` | 图片 | 单张图片生成 |
| `batch_generate_images` | 图片 | 批量图片生成 |
| `edit_image` | 图片 | 图片编辑 |
| `create_video_task` | 视频 | 视频生成任务 |
| `query_video_task` | 视频 | 视频任务查询 |
| `text_to_music` | 音乐 | 音乐生成 |
| `create_3d_model_task` | 3D | 3D 模型生成任务 |
| `query_3d_model_task` | 3D | 3D 模型任务查询 |

当前没有在本地包中命中 `query_music_task`。音乐生成工具说明里提到超时后查询任务，但当前 `tools/list` 未暴露音乐查询工具。因此第一版必须把音乐生成按“同步成功或超时返回 task_id 的特殊长任务”处理，并保留 raw result。

## 3. 架构原则

### 3.1 不绕过 Maker MCP

所有 Maker 能力通过 `@taptap/maker` MCP 调用。TapTap Maker Plus 不直接调用 Maker 私有远端接口，不自行保存或拼装 Maker token，不替代 Maker CLI 的登录和初始化流程。

### 3.2 每项目独立 MCP runtime

当前实测表明：非当前 `cwd` 项目虽然可以用 `target_dir` 读取状态，但会出现：

```text
MCP tool registration cwd: mismatch
```

这说明 `tools/list` 与 proxy tool 暴露和 MCP 进程 `cwd` 有关系。正式架构必须按项目维护独立 MCP runtime：

```text
Project A -> MCP Process A cwd = Project A
Project B -> MCP Process B cwd = Project B
Project C -> MCP Process C cwd = Project C
```

不要用一个 MCP 进程承载所有项目。

### 3.3 浏览器不直接连接 stdio

浏览器不能直接连接 stdio MCP。正确结构是：

```text
Browser UI
  -> Local Node Server
    -> MCP Bridge
      -> spawn taptap-maker
        -> stdio MCP
```

### 3.4 第一阶段直接做 MCP client

第一阶段的工具调用路径必须是：

```text
Workbench UI
  -> Fastify Local Server
    -> MCP Client
      -> @taptap/maker stdio MCP server
        -> Maker MCP tools
```

网页或桌面壳里的前端不直接连接 stdio，也不通过 Codex 对话中转。Codex/Agent 只属于后期智能编排层，不是第一阶段调用链路。

后期如果接入 Agent，连接状态不能由 UI 凭空判断，必须由 Agent 主动向本地服务发送 heartbeat：

```text
POST /api/agent/sessions/heartbeat
```

本地服务根据最后心跳时间显示：

- `connected`
- `idle`
- `disconnected`

### 3.5 文件写入受项目边界约束

所有生成结果必须写入当前选择项目的资产目录。前端不能直接传任意输出路径。后端必须验证最终路径位于项目根目录或项目 `assets` 目录内。

## 4. 总体架构

```text
apps/
  web/
    Vite + React + TypeScript
    工作台 UI
    未来可被 Electron / Tauri 复用

  server/
    Node.js + TypeScript
    Fastify
    @modelcontextprotocol/sdk
    MCP client / process manager
    SQLite task worker
    asset indexer
    workflow executor
    SSE / WebSocket events
```

## 5. 技术选型

### 5.1 前端

| 能力 | 选型 | 理由 |
| --- | --- | --- |
| 框架 | Vite + React + TypeScript | 本地工具，不需要 SSR，启动快，结构轻 |
| 路由 | TanStack Router | 类型化路由、搜索参数、工具页面清晰 |
| 服务状态 | TanStack Query | MCP 状态、任务、日志、项目刷新都属于服务状态 |
| UI 状态 | Zustand | 当前项目、面板布局、筛选器、临时 UI 状态 |
| 样式 | Tailwind CSS | 适合自定义设计语言 |
| 组件 | shadcn/ui + Radix UI | 可访问性好，可控源码，不被大组件库风格锁死 |
| 图标 | Lucide React | 工具类图标齐全 |
| 动效 | Motion | React 状态驱动，适合抽屉、列表、节点状态 |
| 画布 | @xyflow/react | 现代 React 节点流底座 |
| 3D 预览 | Three.js | GLB/GLTF 预览能力成熟 |

不首选 Next.js。这个项目核心是本地工具，不是公开网站，也不需要服务端渲染。后端由独立 Node 服务承担。

### 5.2 后端

| 能力 | 选型 | 理由 |
| --- | --- | --- |
| 运行时 | Node.js + TypeScript | 与 MCP SDK、前端类型共享 |
| HTTP API | Fastify | 本地 API、schema 校验、插件生态清晰 |
| MCP | @modelcontextprotocol/sdk | 官方 MCP TypeScript SDK |
| 进程管理 | execa / node child_process | 启动 `taptap-maker` stdio 进程 |
| 数据库 | SQLite | 本地单机工具，易备份、可迁移 |
| ORM | Drizzle ORM | 轻量、类型清晰、迁移可控 |
| SQLite 驱动 | better-sqlite3 | 简单稳定，适合本地服务 |
| 文件监听 | chokidar | 跨平台监听项目 assets |
| MIME 探测 | file-type | 二进制文件类型识别 |
| 媒体信息 | ffprobe / exiftool | 音视频、图片、模型辅助元数据 |

### 5.3 不直接采用的项目

| 项目 | 用法 |
| --- | --- |
| ComfyUI | 只学习媒体节点流和任务队列体验，不嵌入代码 |
| n8n | 只学习执行记录、节点模板、自动化体验，不作为底座 |
| Flowise | 学习 Agent 工具流，不直接使用其 LangChain 结构 |
| Langflow | 学习 flow 与 MCP 的关系，不引入 Python 服务栈 |
| Rete.js | 作为复杂执行图备选，第一版不采用 |
| LiteGraph.js | 学习高密度 Canvas 节点体验，第一版不采用 |

## 6. 产品信息架构

主导航：

```text
Workspace
Asset Hub
Studio
Workflow
Build Center
Runs
Settings
```

### 6.1 Workspace

管理本地 Maker 项目：

- 项目列表。
- 项目根目录。
- `.maker-mcp/config.json` 状态。
- `project_id`。
- 当前 MCP runtime 状态。
- 当前 MCP client 连接状态。
- 当前 `tools/list` 工具暴露状态。
- Python / Lua LSP / PAT / TapTap auth 状态。
- 构建可用性。

### 6.2 Asset Hub

统一资产库：

- Images
- Videos
- Audio
- Models
- Prefabs / Materials / Textures
- Generated History
- References
- Ready for Build

资产不是简单文件列表。每个资产应记录：

- 文件路径。
- 项目内相对路径。
- 类型。
- 来源工具。
- 生成参数。
- 引用关系。
- 被哪些 workflow 使用。
- 是否已接入游戏。
- 是否可提交构建。

### 6.3 Studio

面向普通使用的任务式工作台：

- Image Studio
- Video Studio
- Music Studio
- 3D Studio

Studio 比节点流更简单，适合快速生成。所有 Studio 的结果都进入 Asset Hub。

### 6.4 Workflow

高级节点流：

- 参考图节点。
- 参考视频节点。
- 文本提示词节点。
- 图片生成节点。
- 视频生成节点。
- 音乐生成节点。
- 3D 生成节点。
- 人工确认节点。
- 构建节点。

Workflow 不直接存 React Flow 的 nodes/edges 作为业务真值，而是存自己的 `MakerWorkflowGraph`。

### 6.5 Build Center

对接 `maker_build_current_directory`：

- 本地改动摘要。
- 远端同步状态。
- 构建参数。
- 构建日志。
- runtime watcher 文件入口。
- 构建失败详情。
- 预览链接。

### 6.6 Runs

所有执行记录：

- 单工具调用。
- Studio 生成。
- Workflow 执行。
- 构建。
- 文件索引。
- 失败重试。

Runs 是故障复盘和可维护性的核心。

## 7. 视觉与交互方向

目标风格：米游社式轻社区感 + 即梦式创作入口 + 专业工具驾驶舱。

不采用：

- 黑色赛博风。
- 泛紫渐变。
- 纯后台灰表格。
- 营销落地页。

色彩方向：

```text
background.soft = #F7F4EC
background.main = #FFFDF8
text.primary    = #24313A
accent.teal     = #2C8C7C
accent.amber    = #D99732
accent.coral    = #D96B5F
line.soft       = #E5DED1
```

布局：

```text
左侧：项目与主导航
顶部：当前项目、MCP client 状态、工具暴露状态、快速命令
中间：主工作区
右侧：任务详情、日志、参数、资产信息
底部：运行状态与队列简报
```

交互原则：

- 第一屏直接进入可用控制台。
- 状态优先用图标、色点、进度、时间轴表达。
- 动效只服务反馈，不抢信息层级。
- 页面切换 120-180ms。
- 抽屉和命令面板 160-220ms。
- 节点执行状态要有明确的 pending/running/succeeded/failed/canceled。

## 8. MCP Bridge 设计

### 8.1 Runtime 数据结构

```ts
type McpRuntimeStatus =
  | "starting"
  | "ready"
  | "disconnected"
  | "error";

type McpProjectRuntime = {
  projectId: string;
  projectRoot: string;
  configPath: string;
  processId?: number;
  status: McpRuntimeStatus;
  tools: McpToolSummary[];
  lastStartedAt?: string;
  lastHeartbeatAt?: string;
  lastError?: string;
};
```

### 8.2 启动流程

```text
1. 扫描配置的项目目录。
2. 验证 `.maker-mcp/config.json` 存在。
3. 读取 `project_id`。
4. 以项目根目录为 cwd 启动 `taptap-maker`。
5. 建立 MCP stdio client。
6. 调用 initialize。
7. 调用 tools/list。
8. 保存 tool schema。
9. 标记 runtime ready。
```

### 8.3 调用流程

```text
Browser -> POST /api/projects/:projectId/tools/:toolName/call
Server -> load project runtime
Server -> validate inputSchema
Server -> client.callTool
Server -> persist task/generation/result
Server -> stream events to browser
```

### 8.4 工具分类

```ts
type MakerToolCategory =
  | "status"
  | "build"
  | "image"
  | "video"
  | "music"
  | "model3d";
```

映射：

```text
maker_status_lite              -> status
maker_build_current_directory  -> build
generate_image                 -> image
batch_generate_images          -> image
edit_image                     -> image
create_video_task              -> video
query_video_task               -> video
text_to_music                  -> music
create_3d_model_task           -> model3d
query_3d_model_task            -> model3d
```

## 9. 数据模型

### 9.1 projects

```ts
type Project = {
  id: string;
  name: string;
  rootPath: string;
  makerProjectId: string;
  configPath: string;
  enabled: boolean;
  lastScannedAt?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 9.2 assets

```ts
type Asset = {
  id: string;
  projectId: string;
  absolutePath: string;
  relativePath: string;
  fileName: string;
  extension: string;
  mediaType?: string;
  assetType: "image" | "video" | "audio" | "model3d" | "other";
  sizeBytes: number;
  sha256?: string;
  status: "available" | "missing" | "deleted";
  createdAt: string;
  updatedAt: string;
};
```

### 9.3 generations

```ts
type Generation = {
  id: string;
  projectId: string;
  toolName: string;
  workflowRunId?: string;
  prompt?: string;
  inputJson: unknown;
  rawResultJson?: unknown;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  errorMessage?: string;
  startedAt?: string;
  finishedAt?: string;
};
```

### 9.4 tasks

```ts
type Task = {
  id: string;
  projectId: string;
  taskType: string;
  payloadJson: unknown;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  priority: number;
  retryCount: number;
  lockedBy?: string;
  heartbeatAt?: string;
  nextRunAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 9.5 workflow graph

```ts
type MakerWorkflowGraph = {
  id: string;
  projectId: string;
  name: string;
  version: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

type WorkflowNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  params: unknown;
  inputs: WorkflowPort[];
  outputs: WorkflowPort[];
};

type WorkflowEdge = {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
  valueType: "text" | "json" | "fileRef" | "imageRef" | "videoRef" | "audioRef" | "model3dRef";
};
```

## 10. 本地 API 设计

### 10.1 项目

```text
GET  /api/projects
POST /api/projects/scan
GET  /api/projects/:projectId
POST /api/projects/:projectId/select
POST /api/projects/:projectId/mcp/start
POST /api/projects/:projectId/mcp/stop
GET  /api/projects/:projectId/mcp/status
```

### 10.2 工具

```text
GET  /api/projects/:projectId/tools
GET  /api/projects/:projectId/tools/:toolName/schema
POST /api/projects/:projectId/tools/:toolName/call
```

### 10.3 资产

```text
GET  /api/projects/:projectId/assets
POST /api/projects/:projectId/assets/scan
GET  /api/assets/:assetId
POST /api/assets/:assetId/tags
POST /api/assets/:assetId/mark-ready
```

### 10.4 任务

```text
GET  /api/tasks
GET  /api/tasks/:taskId
POST /api/tasks/:taskId/cancel
POST /api/tasks/:taskId/retry
GET  /api/tasks/:taskId/events
```

### 10.5 MCP Client

```text
GET  /api/mcp/status
GET  /api/mcp/tools
POST /api/mcp/call
POST /api/projects/:projectId/mcp/start
POST /api/projects/:projectId/mcp/stop
```

Agent API 属于后期智能编排扩展，不进入第一阶段主链路。

### 10.6 Workflow

```text
GET  /api/projects/:projectId/workflows
POST /api/projects/:projectId/workflows
GET  /api/workflows/:workflowId
PUT  /api/workflows/:workflowId
POST /api/workflows/:workflowId/run
GET  /api/workflow-runs/:runId
```

## 11. 执行器设计

执行器不依赖 React Flow。React Flow 只负责 UI。

执行器流程：

```text
1. 加载 MakerWorkflowGraph。
2. 校验节点和边。
3. 校验每个工具节点的 inputSchema。
4. 根据边解析输入。
5. 遇到人工确认节点则暂停。
6. 调用 MCP tool。
7. 保存 raw result。
8. 抽取 assetRef/taskRef/logRef。
9. 更新节点状态。
10. 继续下一个节点。
```

长任务策略：

- 视频任务必须保存 `task_id`。
- 3D 任务必须支持 Phase 1 多视图确认。
- 音乐任务必须保存 raw result，并处理缺少 `query_music_task` 的情况。
- 构建任务必须保存 runtime log 文件路径。

## 12. 文件安全

所有文件操作必须遵守：

```text
resolvedPath startsWith selectedProjectRoot
```

生成输出不得接受前端传入的任意绝对路径。前端只传：

```text
projectId
assetType
suggestedName
toolArgs
```

后端负责生成安全路径。

文件名净化规则：

- 移除路径分隔符。
- 移除控制字符。
- 限制长度。
- 避免 Windows 保留设备名。
- 对同名文件追加序号或时间戳。

## 13. 阶段规划

### 阶段 0：调研、证据与架构确认

目标：确认 TapTap Maker Plus 的方向可行，并把本地 Maker MCP 的真实边界写入文档。

完成内容：

- 核验当前 Maker MCP 的项目绑定、工具列表和包入口。
- 确认不绕过 Maker MCP，不自建独立 Maker API。
- 确认浏览器通过本地 Node server 转接 MCP stdio。
- 确认每个 Maker 项目使用独立 MCP runtime。
- 确认多项目、资产库、生成记录、节点流、MCP client 直连的总路线。
- 形成 `docs/taptap-maker-plus-development-plan.md`。

验收标准：

- 文档能说明本地 4 个 Maker 项目和各自 `project_id`。
- 文档能说明已验证的 10 个 MCP 工具。
- 文档能说明为什么不能用一个 MCP runtime 管所有项目。
- 文档能说明阶段 1 到阶段 4 的实现边界。

### 阶段 1：MCP 与资产底座

目标：打通最小可用闭环。

完成内容：

- 初始化 monorepo。
- 建立 `apps/web`。
- 建立 `apps/server`。
- 建立 MCP runtime manager。
- 扫描本地 Maker 项目。
- 读取 `.maker-mcp/config.json`。
- 每项目启动独立 `taptap-maker` stdio runtime。
- 调用 `tools/list`。
- 展示项目状态。
- 展示工具列表。
- 提供 runtime 状态查询接口。
- 调用 `generate_image` 做首个生成闭环。
- 保存 generation 记录。
- 扫描 `assets`。
- 展示 Asset Hub 基础列表。

验收标准：

- 能看到 4 个本地 Maker 项目。
- 能选择项目。
- 能启动对应 MCP runtime。
- 能看到 10 个工具。
- 能通过工作台 UI 发起一次图片生成。
- 生成结果能在所选项目资产中被索引。

### 阶段 2：Studio 工作台

目标：把主要 Maker proxy tools 做成高可用工具界面。

完成内容：

- Image Studio。
- Batch Image Studio。
- Image Edit Studio。
- Video Studio。
- Music Studio。
- 3D Studio。
- 任务中心。
- 资产详情页。
- 失败记录。
- raw result 查看。
- 参数模板。
- 最近使用参数。
- 引用资产选择器。

验收标准：

- 图片、视频、音乐、3D 都能从工作台 UI 发起。
- 视频与 3D 长任务有状态记录。
- 3D Phase 1 多视图确认能在工作台 UI 完成。
- 生成结果全部进入 Asset Hub。
- 每个生成记录可追溯 prompt、参数、工具、输出文件。

### 阶段 3：节点流

目标：实现可复用的 Maker 创作图。

完成内容：

- 接入 `@xyflow/react`。
- 节点 palette。
- `MakerWorkflowGraph` 存储。
- MCP Schema Compiler。
- 工具节点自动生成表单。
- 资产引用节点。
- 人工确认节点。
- 节点执行状态。
- Workflow run。
- 失败重试。
- 模板保存。

验收标准：

- 能搭建 `参考图 -> 图片生成 -> 视频生成` 工作流。
- 能搭建 `文本 -> 多视图 -> 人工确认 -> 3D 模型` 工作流。
- 每个节点有输入快照、输出快照、耗时、错误。
- Workflow 可保存、复制、再次运行。

### 阶段 4：构建、模板与生态

目标：从生成工具升级为 Maker 项目生产中心。

完成内容：

- Build Center。
- 接入 `maker_build_current_directory`。
- 展示构建日志和 runtime watcher 文件。
- ready for build 标记。
- 工作流模板库。
- 项目模板。
- 配方导入导出。
- 简单权限和设置。
- 后期智能编排扩展位。

验收标准：

- 能从工作台 UI 触发 Maker 构建。
- 能看到构建结果和日志入口。
- 能标记哪些资产已准备接入游戏。
- 能保存和复用工作流模板。
- MCP client 调用结果能同步到任务队列、资产库和 raw result 记录。

## 14. 风险清单

| 风险 | 影响 | 处理方式 |
| --- | --- | --- |
| 单 MCP 进程跨项目 cwd mismatch | 工具暴露和落盘项目不稳定 | 每项目独立 MCP runtime |
| `maker_status_lite` 输出是文本 | 解析不稳定 | 保留 raw text，逐步做结构化解析 |
| `query_music_task` 缺失 | 音乐长任务回查困难 | 保存 raw result，等待 MCP 补工具或做工作台侧状态兜底 |
| 大文件 data URL 限制 | 素材导入或引用失败 | 前端预检查大小，优先项目内文件或远端 URL |
| 长任务阻塞 HTTP 请求 | UI 卡死或超时 | 后端任务队列 + 事件流 |
| 直接暴露文件路径 | 安全风险 | 后端统一路径校验 |
| 过度依赖画布库数据结构 | 后期难维护 | 业务图自定义，React Flow 只做视图 |
| UI 变成灰后台 | 体验不符合目标 | 设计 token、动效规范、首屏工作台 |
| 直接嵌入 ComfyUI/n8n | license 和体量风险 | 学习交互，不嵌入代码 |

## 15. 代码风格要求

### 15.1 优雅优先

这里的“优雅”指：

- 模块边界清楚。
- 类型清楚。
- 数据流清楚。
- UI 状态和服务状态分离。
- 画布视图和执行语义分离。
- 原始 MCP 结果可追溯。
- 错误路径可恢复。

### 15.2 禁止混乱边界

禁止：

- 在 React 组件里直接 spawn MCP。
- 在画布节点里直接写数据库。
- 在前端拼接文件系统路径。
- 在 UI store 里保存服务端权威任务状态。
- 把 React Flow nodes 当业务图真值。
- 把生成历史当资产系统。
- 把 Codex 聊天当唯一操作入口。

### 15.3 推荐模块边界

```text
web/components 只关心显示
web/routes 只关心页面组合
web/stores 只关心 UI 状态
web/queries 只关心服务请求
server/routes 只关心 HTTP 边界
server/services 只关心业务动作
server/mcp 只关心 MCP 协议
workflow 只关心图与执行
db 只关心持久化
asset 只关心文件和元数据
```

## 16. 下一步执行建议

下一步先做一阶段，不要马上做完整节点流。

最小任务顺序：

1. 初始化 monorepo。
2. 建立本地 server。
3. 建立项目扫描。
4. 建立 MCP runtime manager。
5. 跑通 `tools/list`。
6. 建立 SQLite。
7. 建立 web shell。
8. 展示项目列表。
9. 展示工具列表。
10. 跑通 `generate_image`。
11. 建立 Asset Hub 基础索引。

一阶段跑通后，再进入 Studio 和 Workflow。这样不会一开始陷进画布和动效细节里，也不会偏离 Maker MCP 的真实能力边界。
