# TapTap Maker Plus Productization Round 1 Audit

Date: 2026-06-23
Workspace: `G:\TapTap_Maker\MCP`

This is the main-control summary for the first parallel-agent audit round. All five agents were read-only. No sub-agent code changes were accepted.

## 1. Audit Coverage

| Agent | Status | Primary scope |
| --- | --- | --- |
| Web Workbench Closure | Complete | Shell, Inspector, shared UI, navigation, theme |
| MCP Capability Center | Complete | MCP runtime/tools/schema/tool call/history |
| Asset Governance | Complete | Asset manager, provenance, model package governance |
| Desktop App | Complete | Tauri path, startup/build/data directory |
| Embedded Agent | Complete | Mastra readiness, agent context, action boundary |

Additional evidence:

- Asset Governance ran `npm run verify:assets`; result passed.
- Current worktree still has unrelated untracked runtime/temp files: `3d_tools.json`, `tools.json`, `output/`.

## 2. Main Findings

### 2.1 Shared Architecture Is Usable

The current architecture already supports productization:

- React + Vite Web shell.
- Fastify local server.
- Per-project MCP runtime.
- SQLite persistence for tools, raw results, tasks, generations, workflow runs, assets, provenance, credits.
- Shared `AssetManagerPanel` for ordinary assets.
- Separate 3D model package governance.
- Schema-driven generic `ToolStudio` and workflow node forms.

### 2.2 High-Risk Shared Files

These files must be controlled by main-control sequencing:

| File | Why high risk |
| --- | --- |
| `apps/web/src/app/AppShell.tsx` | Project state, module routing, right panel tab state, tool calls |
| `apps/web/src/components/layout/AgentInspectorPanel.tsx` | MCP status, tools, logs, errors, future agent tab |
| `apps/web/src/api.ts` | All frontend/server contracts and shared Web types |
| `apps/server/src/routes/api.ts` | All API domains currently share one route file |
| `apps/server/src/types.ts` | Shared server response types |
| `apps/server/src/lib/db.ts` | SQLite schema and persistence |
| `apps/server/src/services/mcpRuntime.ts` | MCP runtime lifecycle and tool normalization |
| `apps/web/src/features/assets/AssetManagerPanel.tsx` | Shared ordinary asset UI |
| `apps/web/src/features/generation/Model3DStudio.tsx` | 3D generation, preview, model package governance |
| `package.json` / `package-lock.json` | Desktop and agent dependencies/scripts |

No two implementation agents should edit the same high-risk file in the same integration batch.

## 3. Confirmed Issues By Domain

### 3.1 Web Workbench

- `AppShell` initializes to `home` even when `taptap.selectedProjectId` exists.
- Project exit currently calls `onSelectProject("")`, which can flow into project selection logic with an empty id.
- `ProjectOverview` is imported but not rendered by `WorkbenchViewport`.
- `TaskQueue` exists but is not wired into the current shell.
- Unneeded `(project as any).iconUrl` appears even though `ProjectSummary.iconUrl?: string` exists.
- Error detection is duplicated through raw string matching.
- `AgentInspectorPanel.tsx` is too broad and should be split.
- Some visual styles still bypass semantic tokens and shared components.

### 3.2 MCP Capability Center

- `normalizeTool` currently creates fallback names such as `unknown_tool`; this should become invalid-tool evidence, not a fabricated identifier.
- Tool category is inferred from tool-name string rules. It can remain a UI grouping hint, but not a tool semantics source.
- Direct tool call endpoint should verify that `toolName` exists for the selected project before calling MCP.
- `GenerationRecord` is created for status/query/build calls; generation history should be limited to generation tools.
- Some specialized studios build payloads manually; they need a submit-time schema-key guard against the current `inputSchema.properties`.
- Tool descriptions are mixed between local translated copy and raw MCP descriptions; raw description must remain visible.
- Error detection should parse stored raw JSON instead of string matching.

### 3.3 Asset Governance

- Ordinary asset delete is hard delete. It lacks a trash/restore path.
- Move/rename does not scan or report project references before changing files.
- Provenance is path-evidence matching, not a full provenance DAG.
- Ordinary assets only have `available/missing`, not lifecycle states like discarded/restored/ready.
- 3D discard intentionally leaves runtime MDL/material/texture files, so UI must show remaining runtime evidence clearly.
- `delete_package` appears as a possible model package action type but no backend API implements it.

### 3.4 Desktop App

- No Tauri project/config exists yet.
- Fastify does not currently serve `apps/web/dist` in production.
- Runtime data lives in repo-local `data/`; desktop distribution needs user app data paths.
- MCP runtime depends on `npx.cmd` and npm cache; offline behavior is not proven.
- Tauri config field names are unverified and must not be guessed before package setup and doc/export inspection.

### 3.5 Embedded Agent

- Mastra is not installed.
- Agent work must not call MCP stdio directly.
- `routes/api.ts` is already too concentrated; agent routes should be thin and delegate to services.
- Tool execution should be extracted to a shared service so API, workflow, and agent actions use one task/raw-result/asset-provenance path.
- First version should add read-only context and proposed actions before adding autonomous execution.

## 4. Conflict Decision

The five implementation tracks are not safe to run as five uncontrolled code-writing agents yet. They are safe if split into two batches.

### Batch A: Foundation and De-Risking

Order:

1. Main control extracts or centralizes shared helpers.
2. Web Workbench performs small shell/Inspector cleanup.
3. MCP Capability Center adds validation and raw/schema safety.
4. Asset Governance adds verification and reference-scan planning, but avoids DB lifecycle schema until API boundaries are fixed.

Desktop and Embedded Agent should stay in documentation/prototype mode during Batch A.

Reason:

- Desktop needs stable server startup/data-dir boundaries.
- Embedded agent needs a stable tool execution service and context endpoint.

### Batch B: Product Expansion

Order:

1. Desktop App adds Tauri shell and app data path after Batch A build passes.
2. Embedded Agent adds Mastra package after reading installed exports and wiring through existing Fastify services.
3. Asset Governance expands soft-delete/restore if API and DB boundaries are stable.
4. MCP Capability Center refines tool metadata and schema guard UI.
5. Web Workbench integrates new tabs/drawers only through shared components.

## 5. First Implementation Slices

These are the smallest safe slices from the audit.

### Slice 1: Web Shell Hygiene

Owner: Web Workbench

Allowed files:

- `apps/web/src/app/AppShell.tsx`
- `apps/web/src/components/layout/ProjectSidebar.tsx`
- `apps/web/src/components/layout/WorkbenchViewport.tsx`
- `apps/web/src/features/projects/WelcomeView.tsx`
- `apps/web/src/features/projects/ProjectOverview.tsx`

Tasks:

- Fix empty project selection path.
- Use `project.iconUrl` without `as any`.
- Decide and wire `ProjectOverview` or remove dead import.
- Do not touch server or asset manager.

### Slice 2: Shared Error/Task Parsing

Owner: Main control or Web Workbench

Allowed files:

- New `apps/web/src/features/runs/taskState.ts`
- `apps/web/src/app/AppShell.tsx`
- `apps/web/src/components/layout/AgentInspectorPanel.tsx`
- `apps/web/src/features/runs/RunsView.tsx`

Tasks:

- Add a structured raw-result parser for `isError`.
- Replace duplicated string checks.
- Keep right-panel tab isolation intact.

### Slice 3: MCP Tool Safety

Owner: MCP Capability Center

Allowed files:

- `apps/server/src/services/mcpRuntime.ts`
- `apps/server/src/routes/api.ts`
- `apps/server/src/lib/db.ts`
- `apps/web/src/features/tools/toolDisplay.ts`
- `apps/web/src/features/generation/ToolStudio.tsx`

Tasks:

- Stop fabricating `unknown_tool`.
- Validate direct tool call against selected project tools.
- Keep raw description visible beside local translated copy.
- Add schema-key guard for manually assembled studio payloads only after reading current tool schema.

### Slice 4: Asset Reference Scan Design

Owner: Asset Governance

Allowed files:

- New `apps/server/src/services/assetReferenceScanner.ts`
- `apps/server/src/routes/api.ts` asset route section only
- `apps/server/src/types.ts`
- `apps/web/src/api.ts`
- `docs/asset-management-governance.md`
- `scripts/verify-asset-governance.ts`

Tasks:

- Add read-only reference scan before destructive ordinary asset operations.
- Do not auto-rewrite Lua/JSON references in this slice.
- Do not introduce ordinary asset lifecycle DB state until reference evidence is stable.

### Slice 5: Desktop Plan Before Code

Owner: Desktop App

Allowed files:

- `docs/desktop-app-plan.md`
- Later: root scripts and new Tauri directory only after package setup is approved.

Tasks:

- Document production serving strategy.
- Document app data directory migration.
- Document npm cache/MCP logs/SQLite desktop paths.
- Do not guess Tauri config keys before installing/reading actual package docs.

### Slice 6: Agent Plan Before Mastra

Owner: Embedded Agent

Allowed files:

- `docs/agent-integration-plan.md`
- Later: `apps/server/src/agent/` only after Mastra is installed and exports are inspected.

Tasks:

- Define read-only context endpoint shape.
- Define proposed action and human confirmation shape.
- Define tool execution service extraction plan.
- Do not install or code Mastra in the same batch as shell/MCP/asset refactors.

## 6. Implementation Rules

- No agent may edit `tools.json`, `3d_tools.json`, `output/`, `data/`, or generated `dist/` files.
- Any change to `apps/web/src/api.ts`, `apps/server/src/types.ts`, `apps/server/src/routes/api.ts`, or `apps/server/src/lib/db.ts` requires main-control sequencing.
- Any dependency addition requires reading installed package exports/docs before writing imports.
- Any MCP field, tool parameter, JSON path, or config key must come from real local files, persisted `tools/list`, schema, logs, or raw result.
- UI work must follow `docs/frontend-implementation-standard.md`.
- Asset work must follow `docs/asset-management-governance.md`.

## 7. Verification For Batch A

Required commands:

```powershell
npm run typecheck
npm run build
npm run verify:assets
```

Manual checks:

- Project selection and project exit do not call APIs with an empty project id.
- Right Inspector status/tools/logs/errors still return correctly.
- Tools list and schema still come from selected project data.
- Asset tree scoped folders still show subdirectories.
- Failed task copy still works.

## 8. Current Decision

First-round audit is complete.

Implementation should start with Batch A, not all five full feature tracks at once.

The safe first coding target is:

1. Web Shell Hygiene.
2. Shared Error/Task Parsing.
3. MCP Tool Safety.

Asset reference scan can begin in parallel only if it avoids the shared route/type files until the first three slices land, or works in a separate branch for later main-control integration.

Desktop App and Embedded Agent should produce plan docs first, then wait for Batch A to stabilize shared startup/API/tool execution boundaries.

