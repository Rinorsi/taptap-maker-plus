# TapTap Maker Plus Productization Round 1 Result

Date: 2026-06-23
Workspace: `G:\TapTap_Maker\MCP`

This document records the result of the first controlled parallel implementation round.

## 1. Completed Steps

The following requested steps are complete for this first round:

1. Main control wrote productization plan, interface boundaries, and UI rules.
2. Five agents audited their assigned areas and produced change lists.
3. Main control confirmed conflict files and write boundaries.
4. Five implementation workers ran with scoped ownership.
5. Main control reviewed and verified the combined result.

## 2. Worker Results

### Web Workbench Closure

Changed:

- `apps/web/src/app/AppShell.tsx`
- `apps/web/src/components/layout/ProjectSidebar.tsx`
- `apps/web/src/components/layout/WorkbenchViewport.tsx`
- `apps/web/src/features/projects/WelcomeView.tsx`

Result:

- Empty project selection no longer calls `selectProject("")`.
- Project exit clears local selected project state and returns to `home`.
- Existing selected project defaults to the project workbench module.
- `ProjectOverview` is used when `home` has a selected project.
- `project.iconUrl` uses the real typed field instead of `as any`.

### MCP Capability Center

Changed:

- `apps/server/src/services/mcpRuntime.ts`
- `apps/server/src/routes/api.ts`
- `apps/web/src/features/generation/ToolStudio.tsx`
- `apps/web/src/features/tools/toolDisplay.ts`

Result:

- MCP tool normalization no longer fabricates `unknown_tool`.
- Direct tool calls verify the selected project's stored tool before calling MCP.
- `maker_status_lite` verifies the real tool exists before execution.
- Generation records are only created for explicit generation tool names:
  - `generate_image`
  - `batch_generate_images`
  - `edit_image`
  - `create_video_task`
  - `text_to_music`
  - `create_3d_model_task`
- Generic `ToolStudio` filters submitted keys to the current schema properties.
- Fallback tool copy tells the user raw MCP description/schema remains available.

### Asset Governance

Changed:

- `apps/server/src/services/assetReferenceScanner.ts`
- `apps/server/src/types.ts`
- `apps/server/src/routes/api.ts`
- `apps/web/src/api.ts`
- `docs/asset-management-governance.md`
- `scripts/verify-asset-governance.ts`

Result:

- Added read-only reference scanning for ordinary asset paths.
- New API:

```text
POST /api/projects/:projectId/assets/references/scan
```

- Scans literal path evidence in:
  - `.project/resources.json`
  - `scripts/**/*.lua`
  - `assets/flows/**/*.json`
- Does not parse or assume JSON field meaning.
- Does not rewrite references.
- Does not change delete/move/rename behavior yet.
- Verification now covers that unrelated `assets/notes.json` is not scanned.

### Desktop App

Changed:

- `docs/desktop-app-plan.md`

Result:

- Captures the first Tauri path without installing dependencies.
- Documents current Web + Fastify startup facts.
- Defines production static serving requirement.
- Defines desktop app data plan for SQLite, npm cache, logs, and temp files.
- Marks Tauri config fields as unverified until package setup and real docs/exports are read.

### Embedded Agent

Changed:

- `docs/agent-integration-plan.md`

Result:

- Captures Mastra integration direction without installing dependencies.
- Confirms Mastra is not currently installed.
- Defines agent as assistant/planner first, not autonomous executor.
- Requires all actions to go through existing Fastify/MCP chains.
- Requires human confirmation for MCP calls and filesystem operations.

## 3. Conflict Review

The highest-risk shared file was `apps/server/src/routes/api.ts`, touched by both MCP and Asset Governance workers.

Reviewed result:

- MCP changes were limited to status/tool call execution paths.
- Asset changes were limited to a read-only asset reference scan endpoint.
- The two edits do not overlap in route path or state mutation.

Other shared files:

- `apps/web/src/api.ts` only received additive asset reference scan types/client.
- `apps/server/src/types.ts` only received additive asset reference scan types.
- No package dependencies were added.
- No Tauri or Mastra runtime code was introduced.

## 4. Verification

Commands run by main control:

```powershell
npm run typecheck
npm run verify:assets
npm run build
```

Results:

- `npm run typecheck`: passed.
- `npm run verify:assets`: passed.
- `npm run build`: passed.

Build note:

- Vite still reports chunk size warnings over 500 kB. This is not introduced as a functional failure in this round.

## 5. Remaining Risks

- No browser manual validation was performed in this result pass.
- `ToolStudio` schema-key filtering assumes top-level object properties. Tools with deliberate dynamic top-level keys would need a schema-supported exception after reading real schema evidence.
- Generation tool allowlist is explicit. New generation tools from future `tools/list` must be deliberately added.
- Asset reference scanner is literal text evidence only. It does not infer aliases, shortened paths, backslash variants, or semantic JSON references.
- Ordinary asset delete/move/rename still do not call reference scan automatically.
- Desktop app remains a plan only; no Tauri shell exists yet.
- Mastra agent remains a plan only; no package is installed.

## 6. Not Included

The following worktree items remain outside this round:

- `tools.json`
- `3d_tools.json`
- `output/`
- Existing runtime data under `data/`

## 7. Next Round

Recommended next controlled batch:

1. Wire the asset reference scanner into delete/move/rename confirmation UI.
2. Extract task/error raw-result parsing into a shared frontend helper.
3. Extract server `executeToolCall` into a service so API, workflow, and future agent actions share one path.
4. Add production static serving for `apps/web/dist`.
5. Install Tauri only after reading the real package-generated config.
6. Install Mastra only after the tool execution service boundary is stable.

