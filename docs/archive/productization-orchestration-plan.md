# TapTap Maker Plus Productization Orchestration Plan

Date: 2026-06-23
Workspace: `G:\TapTap_Maker\MCP`

This document is the main-control contract for the first productization round. It does not replace `docs/frontend-implementation-standard.md`, `docs/asset-management-governance.md`, or `docs/current-implementation-audit.md`. It freezes the work split so five agents can audit and then implement without rewriting each other's work.

## 1. Product Boundary

TapTap Maker Plus / Maker++ is a local Maker MCP workbench.

It is:

- A multi-project local workbench for TapTap Maker projects.
- A visual client for the existing `@taptap/maker` MCP tools.
- A project-aware asset, task, workflow, build, and error console.
- A future desktop app shell around the current Web + Fastify kernel.
- A future assisted-agent workspace where agent actions go through local API and MCP.

It is not:

- A TapTap official publishing backend.
- A replacement Maker API.
- A Codex conversation relay.
- A frontend that spawns MCP directly.
- A fully autonomous agent that can perform destructive actions without review.

The required call chain remains:

```text
Workbench UI
  -> Fastify Local Server
    -> Project MCP Runtime
      -> @taptap/maker stdio MCP server
        -> Maker MCP tools
          -> selected local TapTap Maker project
```

## 2. First Productization Round

The first round has five development domains and one main-control integration role.

### 2.1 Main Control

Main control owns:

- Interface contracts.
- Directory and write-scope boundaries.
- Cross-agent conflict review.
- Integration sequencing.
- Typecheck/build/asset verification.
- UI baseline preservation.
- Final acceptance report.

Main control does not own large feature rewrites.

### 2.2 Web Workbench Closure Agent

Scope:

- Permanent workbench shell behavior.
- Right Inspector behavior.
- Return navigation.
- List/detail/drawer patterns.
- Top bar, sidebar, dark theme.
- Shared UI primitives and studio kit.

Allowed write area for implementation round:

- `apps/web/src/components/layout/`
- `apps/web/src/components/ui/`
- `apps/web/src/components/studio/`
- `apps/web/src/styles.css`
- `apps/web/src/lib/`
- Small call-site migrations in `apps/web/src/features/*` only when replacing copied UI with shared components.

Not allowed:

- Server MCP runtime.
- Asset filesystem services.
- MCP tool call API behavior.
- 3D model package state machine.

### 2.3 MCP Capability Center Agent

Scope:

- MCP tools center productization.
- `tools/list` display and Chinese/original descriptions.
- Tool schema display.
- Schema-driven form generation.
- `maker_status_lite`.
- Existing image/video/music/3D/build tool entrances.
- Raw result, error classification, tool history.

Allowed write area for implementation round:

- `apps/web/src/features/tools/`
- `apps/web/src/features/generation/ToolStudio.tsx`
- MCP-related parts of `apps/web/src/components/layout/AgentInspectorPanel.tsx`
- `apps/web/src/api.ts` only for existing MCP API client additions.
- `apps/server/src/routes/api.ts` only for project-level MCP API endpoints.
- `apps/server/src/services/mcpRuntime.ts`
- `apps/server/src/lib/db.ts` only for tools/tasks/generations schema used by MCP history.

Not allowed:

- Frontend direct stdio spawn.
- New independent Maker API.
- Hardcoded Maker tool parameter names unless read from persisted `inputSchema` or verified mapping code.
- Ordinary asset manager UI.

### 2.4 Asset Governance Agent

Scope:

- Shared ordinary asset manager.
- Image/video/audio/other file tree.
- Batch selection, select all, invert selection, clear selection.
- Delete, move, rename, import.
- Preview and copy project-relative path.
- Provenance from task/generation/workflow evidence.
- 3D package governance, discarded/restore/adopt/resource actions, runtime MDL/material/texture evidence.

Allowed write area for implementation round:

- `apps/web/src/features/assets/`
- `apps/web/src/features/generation/Model3DStudio.tsx`
- Asset-manager call sites in Image/Video/Music/Asset Hub only when using `AssetManagerPanel`.
- `apps/server/src/services/asset*.ts`
- `apps/server/src/services/modelPackage.ts`
- `apps/server/src/services/urhoMdl.ts`
- Asset/model routes in `apps/server/src/routes/api.ts`
- `scripts/verify-asset-governance.ts`
- `docs/asset-management-governance.md`

Not allowed:

- MCP runtime implementation.
- Tauri shell.
- Mastra/agent runtime.
- Page-level duplicate file managers.

### 2.5 Desktop App Agent

Scope:

- Tauri feasibility and first shell.
- Desktop lifecycle for existing Fastify server.
- Fixed app data paths.
- npm cache, MCP logs, SQLite path strategy.
- Windows packaging.
- First-run environment checks.

Allowed write area for implementation round:

- Root package scripts needed for desktop commands.
- New desktop shell directory, to be named after verifying Tauri file requirements.
- Desktop-specific config files after reading installed Tauri docs/package exports.
- Server startup wrapper only if it preserves current `npm run dev` behavior.
- `docs/desktop-app-plan.md`

Not allowed:

- Replacing Fastify.
- Rewriting MCP runtime.
- Rewriting Web UI.
- Guessing Tauri config field names before adding/reading the actual package docs.

### 2.6 Embedded Agent Agent

Scope:

- Mastra integration plan.
- Project context tool.
- Page/context handoff shape.
- MCP tool explanation.
- Error explanation.
- Generation parameter assistance.
- Asset cleanup suggestions.
- Human confirmation before tool calls or filesystem changes.

Allowed write area for implementation round:

- New `apps/server/src/agent/` after package selection is verified.
- Agent-facing API routes in `apps/server/src/routes/api.ts`.
- Agent API client additions in `apps/web/src/api.ts`.
- Right-panel agent tab/entry only through existing layout components.
- `docs/agent-integration-plan.md`

Not allowed:

- Direct MCP stdio access from the agent outside server-owned runtime manager.
- Destructive filesystem actions without explicit confirmation API.
- Guessing Mastra API imports before package installation and reading real exports.

## 3. Existing Interface Contract

The current frontend API client in `apps/web/src/api.ts` is the authoritative first-pass contract for the productization round.

### 3.1 Project and Runtime

- `GET /api/projects`
- `POST /api/projects/scan`
- `POST /api/projects/:projectId/select`
- `POST /api/projects/:projectId/mcp/start`
- `POST /api/projects/:projectId/mcp/stop`
- `GET /api/projects/:projectId/mcp/status`
- `POST /api/projects/:projectId/mcp/status-lite`

Types currently used by Web:

- `ProjectSummary`
- `RuntimeSummary`
- `StatusLiteResponse`

### 3.2 MCP Tools

- `GET /api/projects/:projectId/tools`
- `POST /api/projects/:projectId/tools/refresh`
- `POST /api/projects/:projectId/tools/:toolName/call`

Types currently used by Web:

- `ToolSummary`
- `ToolsListSnapshot`
- `TaskRecord`
- `GenerationRecord`

Rules:

- Tool forms must use `ToolSummary.inputSchema`.
- Raw `tools/list` and raw `tools/call` results remain persisted.
- UI may translate tool descriptions, but original description must remain visible.

### 3.3 Assets

- `GET /api/projects/:projectId/assets`
- `GET /api/projects/:projectId/assets/tree`
- `POST /api/projects/:projectId/assets/scan`
- `POST /api/projects/:projectId/assets/provenance/rebuild`
- `POST /api/projects/:projectId/assets/delete`
- `POST /api/projects/:projectId/assets/move`
- `POST /api/projects/:projectId/assets/rename`
- `POST /api/projects/:projectId/assets/import`
- `GET /api/projects/:projectId/assets/preview`

Types currently used by Web:

- `AssetSummary`
- `AssetDirectoryNode`
- `AssetProvenanceSummary`

Rules:

- Frontend passes project-relative paths.
- Backend resolves paths under the selected project root.
- Shared asset manager owns ordinary file management.

### 3.4 3D Model Packages

- `GET /api/projects/:projectId/model-packages`
- `POST /api/projects/:projectId/model-packages/:packageId/organize`
- `POST /api/projects/:projectId/model-packages/:packageId/bind`
- `POST /api/projects/:projectId/model-packages/:packageId/discard`
- `POST /api/projects/:projectId/model-packages/:packageId/restore`
- `POST /api/projects/:projectId/model-packages/:packageId/resource`
- `POST /api/projects/:projectId/model-packages/batch`
- `POST /api/projects/:projectId/model-convert/mdl-to-gltf`
- `POST /api/projects/:projectId/model-convert/mdl-info`

Types currently used by Web:

- `ModelPackageSummary`
- `MdlModelInfo`
- `MdlToGltfResult`

Rules:

- Runtime usage is not inferred from source GLB existence.
- Discarded packages stay out of normal issue filters.
- Package state must be derived from real resource/reference evidence.

### 3.5 Tasks, Workflows, Build Logs, Credits

- `GET /api/tasks`
- `DELETE /api/tasks`
- `GET /api/projects/:projectId/generations`
- `GET /api/projects/:projectId/workflows`
- `POST /api/projects/:projectId/workflows`
- `DELETE /api/projects/:projectId/workflows/:workflowId`
- `GET /api/projects/:projectId/workflow-runs`
- `POST /api/projects/:projectId/workflow-runs`
- `DELETE /api/projects/:projectId/workflow-runs/:runId`
- `GET /api/projects/:projectId/build/logs`
- `GET /api/projects/:projectId/flows`
- `GET /api/projects/:projectId/flows/:name`
- `POST /api/projects/:projectId/flows`
- `POST /api/projects/:projectId/flows/auto-save`
- `DELETE /api/projects/:projectId/flows/:name`
- `GET /api/credits`

Rules:

- Workflow graph view must not become the only business truth.
- Task and error detail belongs in the right panel without leaking between tabs.
- Credit ledger is local evidence only unless a real MCP/cloud balance endpoint is verified.

## 4. UI Component Contract

`docs/frontend-implementation-standard.md` is the active UI rulebook. The first productization round adds these enforcement rules:

- New page-level controls must first look for an existing shared component.
- Shared controls live in `apps/web/src/components/ui/` or `apps/web/src/components/studio/`.
- Feature pages may compose, not re-skin, shared controls.
- No page creates a new native select if `Select` or `SelectField` can represent it.
- List/detail pages use the same pattern: list view, detail view, compact return button, optional drawer only when detail should overlay.
- Destructive actions must show scope in the label or title: current item, selected items, or all records.
- Internal values are not shown directly when `assetGovernance.ts`, `toolDisplay.ts`, or a shared label mapping exists.
- Right Inspector tabs must not share stale detail state across status, tools, logs, and errors.

## 5. Conflict Matrix

| File or area | Primary owner | Secondary readers | Conflict rule |
| --- | --- | --- | --- |
| `apps/web/src/app/AppShell.tsx` | Main control / Web | MCP, Agent | Changes require main-control review. |
| `apps/web/src/components/layout/AgentInspectorPanel.tsx` | Web | MCP, Agent | Do not mix unrelated UI and API changes in one patch. |
| `apps/web/src/api.ts` | Main control | MCP, Asset, Agent | Additive API client changes only; shared types must match server `types.ts`. |
| `apps/server/src/routes/api.ts` | Main control | MCP, Asset, Agent, Desktop | Route additions must stay domain-scoped and validated. |
| `apps/server/src/types.ts` | Main control | All | Type additions require source evidence and matching Web type update. |
| `apps/server/src/lib/db.ts` | Main control | MCP, Asset, Agent | Schema changes require migration notes and verification command. |
| `apps/web/src/features/generation/Model3DStudio.tsx` | Asset | Web, MCP | UI-only cleanup and model-governance logic must not be mixed. |
| `apps/web/src/features/assets/AssetManagerPanel.tsx` | Asset | Web | Web agent may only touch shared visual primitives used by this panel. |
| `apps/server/src/services/mcpRuntime.ts` | MCP | Agent, Desktop | Agent and Desktop do not bypass this service. |
| Desktop shell directory | Desktop | Main control | New directory only; no Web rewrite. |
| `apps/server/src/agent/` | Agent | MCP | New directory; all tool execution goes through existing local API/services. |

## 6. First Round Audit Deliverables

Each agent must return:

1. Current related directories and key files.
2. Existing implemented abilities.
3. Concrete problems.
4. First-round implementation checklist.
5. Write boundary.
6. Likely conflict files.

No code changes are accepted from the first audit round.

## 7. First Round Implementation Gate

Implementation starts only after main control confirms:

- The five write scopes do not overlap except for explicitly reviewed shared files.
- API additions are additive and project-scoped.
- UI changes reuse shared components.
- Asset governance follows `docs/asset-management-governance.md`.
- Desktop work does not replace the current dev workflow.
- Agent work does not bypass local Fastify/MCP runtime.

## 8. Verification Gate

Before the first productization round can be marked complete:

```powershell
npm run typecheck
npm run build
npm run verify:assets
```

Manual validation must cover:

- Web shell opens at `http://localhost:5173`.
- API health and project list respond from `http://127.0.0.1:8787`.
- Right Inspector tab switching does not leak stale detail.
- Asset tree shows scoped subdirectories.
- MCP tools list comes from the selected project's stored/runtime `tools/list`.
- A failed task can be copied from the right error panel.

