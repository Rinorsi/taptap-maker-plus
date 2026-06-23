# TapTap Maker Plus Next Thread Handoff

Date: 2026-06-23
Workspace: `G:\TapTap_Maker\MCP`

Use this file first when opening a new conversation about this repo.

## 1. Final Goal

Build TapTap Maker Plus / Maker++ into a polished local Maker MCP workbench that can later be packaged as a desktop app.

The workbench manages local TapTap Maker projects, starts a project-bound MCP runtime, shows real `tools/list`, runs Maker tools through the local server, records raw results, manages generated assets, and gives the user a unified production UI for image, video, music, 3D, workflows, tasks, logs, and errors.

## 2. Non-Negotiable Boundary

Keep the call chain:

```text
Workbench UI
  -> Fastify Local Server
    -> Project MCP Runtime
      -> @taptap/maker stdio MCP server
        -> Maker MCP tools
          -> selected local TapTap Maker project
```

Rules:

- Do not build an independent Maker API.
- Do not use Codex as the tool-call middle layer.
- Do not let the browser spawn MCP.
- Do not guess MCP fields, JSON paths, config keys, or tool parameters.
- Read local files, persisted `tools/list`, real schemas, logs, or raw results before changing behavior.
- Preserve the user's UI work. Make small scoped changes instead of repainting whole pages.

## 3. Current Stack

Root package:

- Monorepo workspaces under `apps/*`
- Web: React 19, Vite 6, TypeScript
- Server: Fastify, TypeScript, better-sqlite3, Drizzle ORM, zod, execa, chokidar
- MCP SDK is used by the server runtime layer.

Current important commands:

```powershell
npm run dev
npm run dev:browser
npm run typecheck
npm run verify:assets
npm run build
```

## 4. Current Product State

Round 1 productization is complete and verified in `docs/productization-round-1-result.md`.

Verified commands from Round 1:

- `npm run typecheck`: passed
- `npm run verify:assets`: passed
- `npm run build`: passed

Build still reports Vite chunk-size warnings. That warning was not treated as a functional failure in Round 1.

Round 4 desktop lifecycle work is now reflected in:

- `docs/desktop-app-plan.md`
- `docs/agent-integration-plan.md`
- `docs/README.md`
- `docs/NEXT_THREAD_HANDOFF.md`
- `docs/round-4-preflight.md`

Verified from current files:

- Root `package.json` contains `dev`, `dev:browser`, `desktop:dev`, `desktop:build`, `prepare:desktop`, `build:desktop`, and `verify:desktop`; `npm run dev` starts Tauri desktop development, while `npm run dev:browser` keeps the old browser-only Web + Fastify mode available.
- `src-tauri/tauri.conf.json` uses bundle identifier `com.taptap.makerplus`, points `build.frontendDist` to `../apps/web/dist`, `build.devUrl` to `http://localhost:5173`, `build.beforeDevCommand` to `npm run dev:web`, `build.beforeBuildCommand` to `npm run build:desktop`, bundles `../desktop-dist` as resources, targets `nsis`, disables native decorations, starts the main window at `1280x960`, and the main window starts from `desktop-loading.html`.
- `scripts/prepare-desktop-resources.mjs` prepares `desktop-dist` with `apps/server/dist`, `apps/server/package.json`, `apps/web/dist`, and the server production dependency graph.
- `src-tauri/src/lib.rs` now owns a `DesktopServer` lifecycle: dev mode starts `npm run dev:server`; production mode starts `node apps/server/dist/index.js` from Tauri resource dir; both inject `TAPTAP_WORKSPACE_ROOT`, `TAPTAP_WEB_DIST_DIR`, `TAPTAP_MAKER_PROJECTS_ROOT`, `TAPTAP_DESKTOP_PARENT_PID`, `TAPTAP_DATA_DIR`, `TAPTAP_MAKER_NPM_CACHE_DIR`, `TAPTAP_MCP_LOG_DIR`, `TAPTAP_SERVER_HOST`, `TAPTAP_SERVER_PORT`, and `TAPTAP_MCP_ENV`; after Fastify is reachable it navigates the main window to `http://127.0.0.1:8787`; app exit stops the Fastify child process; on Windows the spawned Fastify command uses `CREATE_NO_WINDOW` so the Node console window is hidden.
- `apps/web/src/components/layout/TopBar.tsx` owns desktop-only custom window controls in the existing top bar and enforces a 4:3 window ratio while not fullscreen or maximized.
- `apps/server/src/services/staticWeb.ts` serves `config.webDistDir` only when `NODE_ENV === "production"` and keeps `/api` responses separate from frontend fallback.
- `apps/server/src/lib/config.ts` reads `TAPTAP_WORKSPACE_ROOT`, `TAPTAP_WEB_DIST_DIR`, `TAPTAP_DATA_DIR`, `TAPTAP_MAKER_NPM_CACHE_DIR`, `TAPTAP_MCP_LOG_DIR`, and `TAPTAP_MAKER_PROJECTS_ROOT`.
- `apps/server/src/services/mcpRuntime.ts` exposes `stopAll()` and appends MCP stderr to `config.mcpLogDir`.
- `apps/server/src/index.ts` handles `SIGINT` and `SIGTERM`, closes all MCP runtimes, closes Fastify, stops runtimes on Fastify `onClose`, and exits when `TAPTAP_DESKTOP_PARENT_PID` disappears.
- `GET /api/desktop/readiness` reports server host/port, app data paths, database path, npm cache path, MCP log path, and relevant environment values.
- `apps/server/src/services/toolExecution.ts` is the shared server-side MCP tool execution path.
- `apps/server/src/agent/contextBuilder.ts` and `/api/agent/context` provide read-only agent context.
- `@mastra/core` is installed, but current server files do not import it; Mastra runtime is not implemented.
- `npm run typecheck`, `npm run build`, `npm run verify:assets`, and `npm run verify:desktop` passed after the Round 4 lifecycle changes. A Fastify app-data smoke test also proved `TAPTAP_DATA_DIR`, `TAPTAP_MAKER_NPM_CACHE_DIR`, and `TAPTAP_MCP_LOG_DIR` point to the injected data directory.
- `cargo check` passed in `src-tauri` after fixing the Tauri main-thread navigation handle clone.
- `npm run desktop:build` passed and generated:
  - `G:\TapTap_Maker\MCP\src-tauri\target\release\bundle\nsis\TapTap Maker Plus_0.1.0_x64-setup.exe`
- Release smoke passed from `src-tauri\target\release\app.exe`: `/api/desktop/readiness` returned `mode: "production"`, app data under `C:\Users\Administrator\AppData\Roaming\com.taptap.makerplus`, `webDistDir` under Tauri release resources, `makerProjectsRoot: "G:\TapTap_Maker"`, and after forced desktop process exit the Fastify/Node child exited via `desktop-parent-exit`.

## 5. Current Worktree Caution

There are Round 1 productization edits in the worktree. Preserve user changes and do not revert unrelated files.

Known generated/temp files that should not be included unless explicitly requested:

- `tools.json`
- `3d_tools.json`
- `output/`

## 6. Current Docs To Read

Read in this order:

1. `docs/README.md`
2. `docs/productization-round-1-result.md`
3. `docs/productization-orchestration-plan.md`
4. `docs/frontend-implementation-standard.md`
5. `docs/asset-management-governance.md`
6. `docs/productization-graph.md`
7. `docs/desktop-app-plan.md`
8. `docs/agent-integration-plan.md`

## 7. Round 1 Implemented

Web shell:

- Empty project selection no longer calls `selectProject("")`.
- Project exit clears selected project state and local storage.
- Existing selected project defaults to the project workbench module.
- `ProjectOverview` renders when `home` has a selected project.

MCP safety:

- Invalid tool names are skipped instead of normalized into a fabricated tool name.
- Direct tool calls verify the selected project's stored tool before execution.
- `maker_status_lite` verifies the real tool exists before execution.
- Generic `ToolStudio` submits only keys allowed by the current schema properties.
- Generation records are limited to explicit generation tool names.

Asset governance:

- Added read-only asset reference scanner:
  - `apps/server/src/services/assetReferenceScanner.ts`
  - `POST /api/projects/:projectId/assets/references/scan`
- It scans literal path evidence in:
  - `.project/resources.json`
  - `scripts/**/*.lua`
  - `assets/flows/**/*.json`
- It does not infer fields, rewrite references, or mutate files.

Desktop and agent:

- Tauri dependencies, scripts, and `src-tauri` files exist, but desktop sidecar/lifecycle/packaging completion is not proven by current files.
- Mastra dependency exists and package exports were inspected in docs, but no Mastra runtime is implemented.
- The non-bypass chain remains mandatory: Workbench UI -> Fastify Local Server -> Project MCP Runtime -> `@taptap/maker` stdio MCP server.

## 8. Round 4 Status And Remaining Work

Round 4 desktopization is implemented and Windows packaging has produced an NSIS installer artifact. The remaining release risk is distribution robustness on machines where `node` is not already available in PATH.

1. Desktop lifecycle and app data.
   - Implemented: Tauri starts Fastify, injects app data env, navigates to Fastify after port readiness, and stops the Fastify child on app exit.
   - Implemented: Fastify closes all Project MCP Runtime clients on server shutdown.
   - Implemented: SQLite, npm cache, and MCP stderr log paths are tied to `TAPTAP_DATA_DIR`, `TAPTAP_MAKER_NPM_CACHE_DIR`, and `TAPTAP_MCP_LOG_DIR`.
   - Verified: `npm run typecheck`, `npm run build`, `npm run verify:assets`, `npm run verify:desktop`, `cargo check`, `npm run desktop:build`, and release `app.exe` smoke.
   - Implemented: user-confirmed final bundle identifier is `com.taptap.makerplus`.
   - Produced: NSIS installer artifact under `src-tauri\target\release\bundle\nsis`.
2. Agent confirmation and runtime boundary.
   - Add confirmation policy before any agent action route that can mutate files, spend credits, start runtime, call MCP, refresh tools, run workflows, build, push, or clear tasks.
   - Keep agent MCP execution routed through Fastify and `executeToolCall`.
   - Re-read installed `@mastra/core` types before writing imports; do not write Mastra runtime from memory.
3. Test coverage.
   - Add coverage or smoke checks for `/api/agent/context` shape and selection query behavior.
   - Add coverage or smoke checks that direct tool calls and workflow tool nodes share `executeToolCall`.
   - Add coverage or smoke checks for production static serving fallback and `/api` 404 separation.
   - Add desktop readiness checks around Tauri config, server/web dist, cache presence, and environment versions.
4. UI continuation.
   - Wire existing asset reference scan into delete, move, and rename confirmation UI if not already covered by current files.
   - Extract frontend task/error raw-result parser shared by Inspector, Runs, and error panels.
   - Keep Inspector detail state scoped by tab and selection.

## 8.1 External Reference And Library Gate

Before the next implementation round, run a short external-reference pass. The goal is not to copy another product, but to avoid hand-rolling mature product patterns.

Current installed libraries already verified from `apps/web/package.json`:

- `@xyflow/react`: workflow and multimodal node canvas.
- `@tanstack/react-table`: dense asset/task/tool tables.
- `@google/model-viewer`: browser 3D model preview.
- Radix primitives: dialog, label, select, switch, tooltip.
- `@rjsf/core` and `@rjsf/validator-ajv8`: schema-driven forms.
- `framer-motion`: restrained motion and transitions.

Current installed server libraries already verified from `apps/server/package.json`:

- `fastify`
- `@modelcontextprotocol/sdk`
- `better-sqlite3`
- `drizzle-orm`
- `zod`
- `execa`
- `chokidar`
- `file-type`

Recommended mature references to evaluate:

1. MCP client and tool center products.
   - Inspect how tools, schemas, raw results, connection state, and errors are presented.
   - Keep Maker++ project-scoped; do not turn it into a generic MCP chat client.
2. ComfyUI / Blender Geometry Nodes style production graph UX.
   - Use as reference for node libraries, typed ports, parameter panels, preview nodes, and execution traces.
   - Keep implementation on `@xyflow/react` unless a verified blocker appears.
3. VS Code / JetBrains style workbench UX.
   - Use as reference for sidebars, detail panes, command search, file tree, logs, and scoped back behavior.
   - Do not make each page a separate visual system.
4. Bridge / game asset manager style asset governance.
   - Use as reference for folder tree, metadata, previews, batch operations, orphan detection, adopt/discard/restore, and path cleanup.
   - Do not infer Maker runtime usage without real resource/reference evidence.
5. Tauri desktop sidecar examples.
   - Use official sidecar docs and Node sidecar docs before implementing production lifecycle.
   - Must prove server startup, port health, data path, child cleanup, and packaging.
6. Mastra agent/workflow docs.
   - Use agents for open-ended assistance and workflows for predetermined multi-step operations.
   - Agent must assist first and execute only after explicit user confirmation.

Possible extra libraries to evaluate before adding:

- `@tanstack/react-query`: server state caching, polling, invalidation, and mutation states.
- `@tanstack/react-virtual`: large asset/file/log list virtualization.
- `@dnd-kit/core`: consistent drag/drop for asset cards, file tree moves, and canvas asset drops.
- `monaco-editor` or `@monaco-editor/react`: JSON schema/raw result/log editor panels.
- `zustand`: small global UI state when React local state becomes too tangled.
- `sonner` or an existing toast alternative: consistent async action feedback.
- `@gltf-transform/core` and related packages: GLB/glTF inspection and optimization, only after verifying the 3D pipeline need.

Do not add these libraries automatically. First verify the exact current need, package API, bundle impact, and overlap with existing components.

## 9. UI Direction

The UI should feel like a professional desktop workbench:

- Unified shell and components.
- No per-page visual reinvention.
- No native browser selects where shared Select exists.
- No debug-dashboard look.
- No black cyber style or large neon gradients.
- Right Inspector, drawers, logs, and details must have scoped back behavior.
- Do not let detail state leak between MCP tools, MCP status, logs, errors, assets, and runs.

## 10. 3D Boundary

Current verified 3D preview path is:

```text
.mdl -> parsed static mesh -> self-contained .gltf -> model-viewer preview
```

Do not claim GLB to MDL export/import is supported unless a real Maker/UrhoX entrypoint is found and verified.

## 11. Answering Style For This Project

When unsure:

- Read the real file.
- Read the schema.
- Read logs or raw result.
- Ask the user for evidence if the repo does not contain it.

Do not guess identifiers, field names, JSON paths, config keys, tool parameter names, or filesystem conventions.
