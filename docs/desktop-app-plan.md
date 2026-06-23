# TapTap Maker++ 桌面 App 化计划

## 0. 当前依据

本文记录桌面 App 化计划和 Round 4 当前可验证状态。Round 4 已把 Tauri 壳从“配置存在”推进到“生命周期可验证”，并已成功生成 Windows 安装包。

已核对的当前文件和状态：

- 根 `package.json` 脚本：
  - `dev`: `npm run desktop:dev`
  - `dev:browser`: `npm-run-all --parallel dev:web dev:server`
  - `dev:web`: `npm run dev --workspace @taptap/web`
  - `dev:server`: `npm run dev --workspace @taptap/server`
  - `build`: `npm run build --workspace @taptap/server && npm run build --workspace @taptap/web`
  - `typecheck`: `npm run typecheck --workspace @taptap/server && npm run typecheck --workspace @taptap/web`
  - `lint`: `npm run lint --workspace @taptap/server && npm run lint --workspace @taptap/web`
  - `verify:assets`: `tsx scripts/verify-asset-governance.ts`
  - `prepare:desktop`: `node scripts/prepare-desktop-resources.mjs`
  - `build:desktop`: `npm run build && npm run prepare:desktop`
  - `desktop:dev`: `tauri dev`
  - `desktop:build`: `tauri build`
  - `verify:desktop`: `tsx scripts/verify-desktop-readiness.ts`
- `apps/server/src/index.ts` 当前启动 Fastify，注册 CORS、API routes 和生产静态 Web 托管，执行 `scanMakerProjects()`，然后监听 `config.port` 和 `config.host`。收到 `SIGINT` 或 `SIGTERM` 时会关闭全部 MCP runtimes 并关闭 Fastify。
- `apps/server/src/lib/config.ts` 当前默认：
  - `TAPTAP_SERVER_PORT` 未设置时端口为 `8787`
  - `TAPTAP_SERVER_HOST` 未设置时 host 为 `127.0.0.1`
  - `dataDir` 为 `TAPTAP_DATA_DIR` 或仓库根目录下 `data`
  - `databasePath` 为 `data/taptap-maker-plus.sqlite`
  - `workspaceRoot` 为 `TAPTAP_WORKSPACE_ROOT` 或从当前 server 模块路径推导
  - `webDistDir` 为 `TAPTAP_WEB_DIST_DIR` 或 `workspaceRoot/apps/web/dist`
  - `makerNpmCacheDir` 为 `TAPTAP_MAKER_NPM_CACHE_DIR` 或 `data/npm-cache`
  - `mcpLogDir` 为 `TAPTAP_MCP_LOG_DIR` 或 `data/mcp-logs`
  - `makerProjectsRoot` 为 `TAPTAP_MAKER_PROJECTS_ROOT` 或 `workspaceRoot` 的父目录
  - `makerPackage` 为 `TAPTAP_MAKER_PACKAGE` 或 `@taptap/maker`
  - `makerEnv` 为 `TAPTAP_MCP_ENV` 或 `production`
- `apps/web/vite.config.ts` 当前 Vite 开发服务器端口为 `5173`，并把 `/api` 代理到 `http://127.0.0.1:8787`。
- `apps/server/src/services/mcpRuntime.ts` 当前 Windows MCP 启动链路为 `cmd.exe /d /s /c npx.cmd -y -p <makerPackage> taptap-maker`，cwd 为项目根目录，并向子进程环境写入 `TAPTAP_MCP_ENV`、`npm_config_cache`、`NPM_CONFIG_CACHE`。它现在会把 MCP stderr 追加到 `config.mcpLogDir`，并提供 `stopAll()` 供 Fastify 退出时统一关闭 runtimes。
- `apps/server/src/services/staticWeb.ts` 当前在 `NODE_ENV === "production"` 时注册 `@fastify/static`，静态根目录为 `apps/web/dist`，并让非 `/api` 路由回退到 `index.html`。
- `apps/server/src/index.ts` 当前先注册 API routes，再调用 `registerStaticWeb(app)`。
- `src-tauri/tauri.conf.json` 当前存在，`identifier` 为 `com.taptap.makerplus`，`build.frontendDist` 为 `../apps/web/dist`，`build.devUrl` 为 `http://localhost:5173`，`build.beforeDevCommand` 为 `npm run dev:web`，`build.beforeBuildCommand` 为 `npm run build:desktop`，`bundle.targets` 为 `nsis`，`bundle.resources` 打包 `../desktop-dist`，主窗口从 `desktop-loading.html` 启动，窗口初始尺寸为 `1280x960`，并关闭原生窗口装饰。
- `src-tauri/src/lib.rs` 当前创建 `DesktopServer` 生命周期：dev 模式启动 `npm run dev:server`，production 模式从 Tauri resource dir 启动 `node apps/server/dist/index.js`；启动 server 时注入 `TAPTAP_WORKSPACE_ROOT`、`TAPTAP_WEB_DIST_DIR`、`TAPTAP_MAKER_PROJECTS_ROOT`、`TAPTAP_DESKTOP_PARENT_PID`、`TAPTAP_DATA_DIR`、`TAPTAP_MAKER_NPM_CACHE_DIR`、`TAPTAP_MCP_LOG_DIR`、`TAPTAP_SERVER_HOST`、`TAPTAP_SERVER_PORT`、`TAPTAP_MCP_ENV`；等 Fastify 端口可连后把主窗口导航到 `http://127.0.0.1:8787`；Tauri exit 时关闭 Fastify 子进程；Windows 下启动 Fastify 子进程时隐藏 Node 控制台窗口。
- `scripts/verify-desktop-readiness.ts` 当前检查 Tauri 配置、server/web 构建输出、`desktop-loading.html`、server app-data env 支持、MCP log dir env 支持、`data/npm-cache`、缓存中的 `@taptap/maker`、Node/npm/npx/Rust/Cargo/Tauri 版本。
- 当前 `data/npm-cache/_npx/b65342bb843ad6a2/node_modules/@taptap/maker/package.json` 存在，版本为 `0.0.20`，bin 为 `taptap-maker`。
- 当前 `data` 中已存在 `taptap-maker-plus.sqlite`、`taptap-maker-plus.sqlite-shm`、`taptap-maker-plus.sqlite-wal`、`npm-cache`、`qa` 和开发日志文件。

Tauri 已在根 devDependencies 中安装，并已初始化 `src-tauri`。当前能从文件和命令证明的是桌面生命周期、app data env 注入、Fastify 静态托管、MCP runtime 退出清理、desktop readiness 检查、release `app.exe` smoke 和 Windows NSIS 安装包产出。当前仍未证明的是普通用户机器无 Node 时可直接启动；production 启动命令仍依赖 `node` 可执行文件存在于运行环境 PATH。

Round 2 package inspection notes:

- `@tauri-apps/cli` installed version: `2.11.3`; local `node_modules/@tauri-apps/cli/package.json` declares bin `tauri: ./tauri.js`, package type `commonjs`, and optional platform CLI packages including `@tauri-apps/cli-win32-x64-msvc`.
- `node_modules/@tauri-apps/cli/main.d.ts` exposes `run(args: Array<string>, binName?: string | undefined | null): Promise<void>`.
- `@tauri-apps/api` installed version: `2.11.1`; local `package.json` exports `"."`, `"./*"`, and `"./package.json"` with import, require, and types entries.
- `node_modules/@tauri-apps/api/index.d.ts` exports modules named `app`, `core`, `dpi`, `event`, `image`, `menu`, `mocks`, `path`, `tray`, `webview`, `webviewWindow`, and `window`.
- `node_modules/@tauri-apps/api/path.d.ts` exposes `appDataDir()`, `appLocalDataDir()`, `appCacheDir()`, `appLogDir()`, `resourceDir()`, and `resolveResource(resourcePath: string)`. The file documents that `appDataDir()` resolves under the configured bundle identifier from `tauri.conf.json`, so bundle identifier and resource wiring still require generated config inspection.
- `node_modules/@tauri-apps/api/core.d.ts` exposes `invoke<T>(cmd: string, args?: InvokeArgs, options?: InvokeOptions): Promise<T>` and `convertFileSrc(filePath: string, protocol?: string): string`. It also documents that asset protocol usage needs `app.security.assetProtocol` and CSP configuration, so those fields remain deferred until real Tauri config exists.

## 1. 第一版桌面壳目标

第一版目标是把现有 Web 工作台和本地 Fastify 服务包进桌面壳，保持现有产品边界：

- 桌面壳只承载现有 `apps/web` UI，不重写前端主流程。
- 桌面壳启动或连接本机 Fastify 服务，Fastify 继续负责项目扫描、SQLite、MCP runtime、资产索引、任务记录和工具调用。
- Fastify 继续通过当前 MCP SDK stdio client 启动 `@taptap/maker`，不绕开现有 Maker MCP 服务另写一套 Maker API。
- 第一版不引入 Codex CLI，不把桌面壳做成通用 Agent 容器。
- 第一版优先解决可安装、可离线启动到主界面、可连接本机 API、可使用当前 `@taptap/maker` cache 的闭环。

第一版不处理：

- 自动更新、签名、安装器美化。
- 多平台打包。当前风险和验收先按 Windows。
- 服务端代码拆分为独立二进制。若后续需要，再基于真实打包结果决定。
- 生产 Node runtime 内置。当前 Tauri release 会从资源目录启动 Fastify，但仍依赖系统 PATH 中存在 `node`。

## 2. 开发模式启动链路

当前开发链路已经由根脚本定义：

1. 执行 `npm run dev`。
2. 根脚本启动 `desktop:dev`，由 Tauri 打开桌面壳。
3. Tauri 的 `beforeDevCommand` 启动 `npm run dev:web`，Web 运行 Vite，端口 `5173`。
4. Tauri 壳启动 Fastify 子进程，dev 模式命令为 `npm run dev:server`。
5. Vite 把 `/api` 转发到 `http://127.0.0.1:8787`。
6. Fastify API 收到 MCP start 或 tool call 后，通过 `mcpRuntime.ts` 启动 `@taptap/maker`。

桌面开发模式计划：

1. 保持现有 `npm run dev:browser` 作为 Web + Fastify 的浏览器备用入口。
2. 默认使用 `npm run dev` 进入桌面壳开发。桌面壳开发时加载 Vite 开发地址。当前 `src-tauri/tauri.conf.json` 中 `build.devUrl` 为 `http://localhost:5173`。
3. 桌面壳不另行实现 API 代理，开发期仍由 Vite proxy 处理 `/api`。
4. Fastify 仍监听 `127.0.0.1:8787`，除非后续真实冲突要求引入端口协商。
5. MCP runtime 继续使用当前 `cmd.exe /d /s /c npx.cmd -y -p @taptap/maker taptap-maker` 路径。

开发模式验收重点：

- 桌面窗口可打开现有 Web UI。
- UI 请求 `/api/health` 能返回 `{ ok: true, name: "taptap-maker-plus" }`。
- 项目扫描、选中项目、MCP start 仍走 Fastify API。
- `data/npm-cache` 被继续复用，不把 cache 写到随机临时目录。

## 3. 生产模式启动链路

当前根 `build` 脚本先构建 server，再构建 web：

1. `npm run build --workspace @taptap/server`
2. `npm run build --workspace @taptap/web`

生产模式计划：

1. 构建 `apps/server`，得到可由 Node 运行的服务端输出。当前 `scripts/verify-desktop-readiness.ts` 检查 `apps/server/dist/index.js`。
2. 构建 `apps/web`，得到 `apps/web/dist`。
3. 桌面 App 启动时先启动本机 Fastify。
4. Fastify 提供 API，并静态托管 `apps/web/dist`。
5. 桌面窗口加载本机 Fastify 地址，而不是加载 Vite dev server。当前 Tauri 配置的生产前端入口仍是 `build.frontendDist: "../apps/web/dist"`；是否改为加载本机 Fastify 地址，需要在 sidecar/lifecycle 实施时验证。

需要查证后再落地的部分：

- Tauri 如何启动 Node/Fastify：当前 `src-tauri/src/lib.rs` 未实现。
- Fastify 服务端输出是否直接作为资源打包，还是通过 sidecar 或外部 Node runtime 启动：当前 Tauri 配置未声明 sidecar。
- 生产 app 内 Node 可执行文件来源、路径、权限和生命周期：当前文件未证明。
- Windows 关闭窗口时如何停止 Fastify 和 MCP 子进程：当前 Tauri 代码未证明。

## 4. Fastify 静态托管 web/dist 计划

当前 `apps/server/src/index.ts` 只注册 CORS 和 API routes，没有托管静态 Web 资源。生产桌面模式需要让 Fastify 同时服务 UI 和 API。

Round 3 已实现状态：

1. Server 侧已引入 Fastify 静态资源托管能力，`apps/server/package.json` 依赖 `@fastify/static@^9.1.3`。
2. `apps/server/src/services/staticWeb.ts` 仅在 `NODE_ENV === "production"` 时启用静态托管。
3. 静态根目录指向 `apps/web/dist`。
4. `apps/server/src/index.ts` 先注册 `registerApiRoutes(app)`，再注册 `registerStaticWeb(app)`。
5. 非 `/api` 的前端路由回退到 `index.html`，`/api` 未命中时返回 JSON 404。
6. `index.html` 响应设置 `Cache-Control: no-cache`，其他静态资源使用 `maxAge: "30d"` 和 `immutable: true`。

静态托管验收：

- 执行现有 `npm run build` 后存在 `apps/web/dist/index.html`。
- 启动生产 Fastify 后访问根路径能返回 Web UI。
- 访问 `/api/health` 仍返回 API JSON，不被 `index.html` fallback 吞掉。
- 直接刷新前端子路由时仍返回 `index.html`。

## 5. App data 目录计划

当前配置把数据写入仓库根目录 `data`。桌面 App 需要迁移到系统 app data 目录，避免安装目录、源码目录、临时目录混用。

计划中的 app data 结构：

```text
<app-data>/
  taptap-maker-plus.sqlite
  taptap-maker-plus.sqlite-shm
  taptap-maker-plus.sqlite-wal
  npm-cache/
  logs/
    mcp/
    server/
  qa/
  tmp/
```

目录职责：

- SQLite：保存项目、工具列表、任务、生成记录、资产索引、workflow、credits。对应当前 `databasePath`。
- `npm-cache`：保存 `@taptap/maker` 的 npm/npx cache。对应当前 `makerNpmCacheDir`、`npm_config_cache`、`NPM_CONFIG_CACHE`。
- `logs/mcp`：保存 MCP 子进程 stderr、启动失败信息、tool call 关键日志。当前 `mcpRuntime.ts` 只在内存中累积 `stderrBuffer`，落盘方案需要实施时补。
- `logs/server`：保存 Fastify 服务启动、端口、静态托管、崩溃日志。当前开发日志在 `data/dev-server*.log`，桌面版应迁移。
- `qa`：保存桌面 UI 验收截图、Playwright 或后续桌面自动化产物。当前已有 `data/qa`。
- `tmp`：保存导入、转换、下载、预览等临时文件，定期清理。

配置计划：

- 开发模式继续允许使用仓库 `data`，避免影响现有开发流。
- 桌面生产模式通过环境变量或启动参数把 `dataDir` 指向 app data。当前 `config.ts` 已读取 `TAPTAP_DATA_DIR`；如何由 Tauri 注入该变量仍需在 sidecar/lifecycle 实施时验证。
- 不把 SQLite、npm cache、QA 截图写入安装目录。
- 不把用户项目文件复制进 app data；项目根目录仍由项目扫描和用户选择决定。

## 6. Windows 打包风险

### 6.1 `npx.cmd`

当前 MCP runtime 依赖 Windows shell 命令：

```text
cmd.exe /d /s /c npx.cmd -y -p @taptap/maker taptap-maker
```

风险：

- 打包后的桌面 App 环境中 `npx.cmd` 可能不在 PATH。
- Node/npm 可能不存在，或版本不满足 `@taptap/maker` 的 `engines.node >=18.14.1`。
- Windows shell、PowerShell 执行策略、PATH 污染会影响启动稳定性。

第一轮策略：

- 先保留当前启动命令，不在文档阶段改代码。
- 实施时增加启动前诊断：记录 `cmd.exe`、`npx.cmd`、Node/npm 版本、实际 cache 路径。
- 若 `npx.cmd` 不稳定，再评估固定 Node/npm runtime 或直接定位 cache 中的 `taptap-maker` bin。

### 6.2 `@taptap/maker` cache

当前 cache 现状：

- `data/npm-cache/_npx/b65342bb843ad6a2/package.json` 记录依赖 `@taptap/maker` 为 `^0.0.20`。
- `data/npm-cache/_npx/b65342bb843ad6a2/node_modules/@taptap/maker/package.json` 实际版本为 `0.0.20`。
- 存在 `.bin/taptap-maker`、`.bin/taptap-maker.cmd`、`.bin/taptap-maker.ps1`。

风险：

- `npx -y -p @taptap/maker` 默认可能访问网络。
- cache 缺失时离线启动 MCP 会失败。
- cache 命中策略、hash 目录名和 npm 版本有关，不应硬编码 `_npx/b65342bb843ad6a2`。

第一轮策略：

- app data 中保留 `npm-cache` 作为可迁移目录。
- 不硬编码 `_npx` hash 路径。
- 启动失败时把 npm stderr 展示到诊断面板或日志。
- 离线能力先定义为“已有 cache 时可启动 MCP”，不是“首次安装后无网络也能获取 `@taptap/maker`”。

### 6.3 离线能力

第一版离线边界：

- Web UI、Fastify、SQLite、本地项目扫描应离线可用。
- MCP 工具列表和工具调用依赖 `@taptap/maker` cache、登录态、远端服务能力；离线时不保证所有工具可用。
- 生成图片、视频、音乐、3D 等远端工具不纳入离线验收。

### 6.4 权限

风险：

- App 需要读写用户项目目录。
- App 需要在项目目录 cwd 下启动 `@taptap/maker`。
- App 需要写 app data、npm cache、SQLite、日志和临时文件。
- Windows 安全软件可能拦截子进程、npm cache 写入或网络访问。

第一轮策略：

- 安装目录只读，所有运行态写入都进 app data 或用户项目目录。
- 工具调用前明确使用项目根目录作为 cwd。
- 记录每次 MCP start 的 cwd、cache 目录、env 中关键 TapTap 配置名和值来源。
- Tauri 权限配置：当前 `src-tauri/capabilities/default.json` 存在，但本轮未把它作为 sidecar/runtime 权限完成证据；实施时必须读取真实配置后再改。

## 7. Round 4 当前状态

当前文件能证明：

1. 桌面壳工程已存在。
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/src/lib.rs`
2. 根脚本已存在。
   - `desktop:dev`
   - `desktop:build`
   - `verify:desktop`
3. 开发模式配置已存在。
   - `build.devUrl` 为 `http://localhost:5173`
   - `build.beforeDevCommand` 为 `npm run dev:web`
4. 生产 Web 构建配置已存在。
   - `build.frontendDist` 为 `../apps/web/dist`
   - `build.beforeBuildCommand` 为 `npm run build:desktop`
   - `bundle.resources` 为 `../desktop-dist`
   - `bundle.targets` 为 `nsis`
5. Fastify 生产静态托管已存在。
   - `apps/server/src/services/staticWeb.ts`
   - `apps/server/src/index.ts` 已调用 `registerStaticWeb(app)`
6. `TAPTAP_DATA_DIR` 已接入 server 配置。
   - `apps/server/src/lib/config.ts` 使用 `process.env.TAPTAP_DATA_DIR ?? path.join(workspaceRoot, "data")`
7. `TAPTAP_MAKER_NPM_CACHE_DIR` 和 `TAPTAP_MCP_LOG_DIR` 已接入 server 配置。
   - `makerNpmCacheDir` 默认 `path.join(dataDir, "npm-cache")`
   - `mcpLogDir` 默认 `path.join(dataDir, "mcp-logs")`
8. Tauri 已接入 Fastify lifecycle。
   - `src-tauri/src/lib.rs` 中 `DesktopServer` 启动 Fastify 子进程。
   - dev 模式命令是 `npm run dev:server`。
   - production 模式命令是从 Tauri resource dir 执行 `node apps/server/dist/index.js`。
   - 启动环境写入 `TAPTAP_WORKSPACE_ROOT`、`TAPTAP_WEB_DIST_DIR`、`TAPTAP_MAKER_PROJECTS_ROOT`、`TAPTAP_DESKTOP_PARENT_PID`、`TAPTAP_DATA_DIR`、`TAPTAP_MAKER_NPM_CACHE_DIR`、`TAPTAP_MCP_LOG_DIR`、`TAPTAP_SERVER_HOST`、`TAPTAP_SERVER_PORT`、`TAPTAP_MCP_ENV`。
   - Fastify 端口可连后主窗口导航到 `http://127.0.0.1:8787`。
   - Tauri `RunEvent::Exit` 和 `RunEvent::ExitRequested` 会停止 Fastify 子进程。
   - Fastify 监控 `TAPTAP_DESKTOP_PARENT_PID`，桌面父进程消失时通过 `desktop-parent-exit` 自行退出。
9. Fastify 已接入 MCP runtime 退出清理。
   - `apps/server/src/services/mcpRuntime.ts` 提供 `stopAll()`。
   - `apps/server/src/index.ts` 在 `SIGINT`、`SIGTERM` 和 Fastify `onClose` 时调用 runtime 清理。
10. 桌面 readiness 脚本已存在并覆盖 Round 4 关键点。
   - `scripts/verify-desktop-readiness.ts`

当前文件不能证明：

- 生产安装包内 Node runtime 已内置；当前 production 启动命令依赖 `node` 可执行文件存在于运行环境 PATH。

已验证命令：

```powershell
npm run typecheck
npm run build
npm run verify:assets
npm run verify:desktop
cargo check
npm run desktop:build
```

补充验证：

- 启动生产 Fastify smoke，通过 `TAPTAP_DATA_DIR`、`TAPTAP_MAKER_NPM_CACHE_DIR`、`TAPTAP_MCP_LOG_DIR` 指向临时目录。
- 请求 `/api/desktop/readiness` 返回了对应的 `dataDir`、`databasePath`、`makerNpmCacheDir` 和 `mcpLogDir`。
- `src-tauri/tauri.conf.json` 的正式 bundle identifier 已由用户确认为 `com.taptap.makerplus`。
- `npm run desktop:build` 已成功，产物为：
  - `G:\TapTap_Maker\MCP\src-tauri\target\release\bundle\nsis\TapTap Maker Plus_0.1.0_x64-setup.exe`
- release `app.exe` smoke 已通过：`/api/desktop/readiness` 返回 `mode: "production"`，`dataDir` 在 `C:\Users\Administrator\AppData\Roaming\com.taptap.makerplus`，`webDistDir` 在 Tauri release resources，`makerProjectsRoot` 为 `G:\TapTap_Maker`。
- 强制关闭 release 桌面壳后，Fastify 通过 `desktop-parent-exit` 退出；验收时 `portAfterStop` 为空，`nodeAfterStop` 为空。

## 8. Round 4 剩余工作

1. 人工安装包验收。
   - 安装 `TapTap Maker Plus_0.1.0_x64-setup.exe`。
   - 启动 App，确认窗口从 loading 进入现有工作台。
   - 访问或观察 `/api/desktop/readiness` 对应状态，确认 app data、SQLite、npm cache、MCP logs 路径进入系统 app data。
   - 关闭 App 后确认 Fastify 和 MCP 子进程退出。
2. 评估生产 Node runtime。
   - 当前 production 启动命令为 `node apps/server/dist/index.js`。
   - 这证明了本机有 Node 时的桌面链路，不证明普通用户机器无 Node 时可直接启动。
   - 后续若要发布给普通用户，需要选择 bundled Node runtime、Tauri sidecar binary，或把 server 编成独立 Windows 可执行文件。

保留通用验证命令：

```powershell
npm run typecheck
npm run lint
npm run build
npm run verify:assets
npm run verify:desktop
```

开发模式人工验收：

- 浏览器或桌面 dev 窗口打开 Web UI。
- 请求 `http://127.0.0.1:8787/api/health` 返回 `{ ok: true, name: "taptap-maker-plus" }`。
- Vite UI 请求 `/api` 能通过 proxy 到 Fastify。
- 选择项目后 MCP start 能继续使用当前 `npx.cmd` 链路。

生产模式验收命令：

```powershell
npm run build
```

生产模式补充验收：

- `apps/web/dist/index.html` 存在。
- 生产 Fastify 能返回 Web UI。
- `http://127.0.0.1:8787/api/health` 仍返回 API JSON。
- 静态托管不影响 `/api/projects`、`/api/mcp/status`、`/api/tasks`。

桌面打包验收命令：

```powershell
npm run desktop:build
```

桌面安装包验收：

- 首次打开能显示现有 Web 工作台。
- Fastify 能随桌面 App 启动。
- App data 下能看到 SQLite、npm-cache、logs、qa、tmp。
- `@taptap/maker` cache 存在时，MCP start 可成功列出工具。
- 无网络但 cache 已存在时，至少能打开 UI、读取 SQLite、显示项目和历史任务。
- 退出桌面 App 后 Fastify 和 MCP 子进程不残留。

## 9. 当前仍不宣称

不要在没有新验证前宣称：

- 生产 app 内 Node runtime 完成。
- 无网络首次安装可自动获得 `@taptap/maker`。
