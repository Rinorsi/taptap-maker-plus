# Round 4 Preflight

Date: 2026-06-23
Workspace: `G:\TapTap_Maker\MCP`

Round 4 is desktopization. It must preserve the existing chain:

```text
Workbench UI -> Fastify Local Server -> Project MCP Runtime -> @taptap/maker stdio MCP server
```

It must not repaint the Web UI, replace Fastify with a browser-side runtime, or move MCP execution into Codex.

## Mature Product References

### MCP Tool Center

Use MCP Inspector and the MCP tools specification as the pattern: tools are displayed from real `tools/list` results, with schema, description, raw result, connection state, and error evidence. Maker++ remains project-scoped; it is not a generic MCP chat client.

Round 4 adoption: keep existing project tool storage and shared Fastify execution path. Do not hand-write tool names or infer unknown schema fields.

### Node Flow

Use ComfyUI and Blender Geometry Nodes as references for node libraries, typed ports, parameter panels, preview nodes, and execution traces. Maker++ already uses `@xyflow/react`.

Round 4 adoption: no graph engine change. Any workflow execution must continue through Fastify shared tool execution.

### Asset Governance

Use Unreal Content Browser / Reference Viewer and Unity AssetDatabase as references for evidence-based dependency handling.

Round 4 adoption: keep reference decisions evidence-based. Supported evidence remains `.project/resources.json`, `scripts/**/*.lua`, and `assets/flows/**/*.json`. Do not infer runtime usage from folder location alone.

### Desktop App

Use Tauri sidecar/resource/lifecycle guidance as the reference, but prove the local implementation from this repo. The first proof is lifecycle, not installer polish.

Round 4 adoption:

- Tauri starts Fastify.
- Fastify receives app data paths through environment variables.
- The desktop window loads the Fastify-served Web UI, preserving relative `/api` calls.
- Desktop exit stops Fastify, and Fastify exit stops project MCP child runtimes.

### Agent Workbench

Use VS Code Copilot agent tools as a safety reference: context first, execution after confirmation.

Round 4 adoption: document only. Mastra and agent execution are Round 5 work.

## Library Decisions

| Library | Round 4 decision | Reason |
| --- | --- | --- |
| `@tanstack/react-query` | Defer | Useful for server-state caching later, but Round 4 is desktop lifecycle and packaging proof. |
| `@dnd-kit/core` | Reject for Round 4 | Would change asset/file/canvas drag behavior and risks UI churn. |
| `@tanstack/react-virtual` | Defer | Useful for large logs/assets later; no current Round 4 blocker requires it. |
| `monaco-editor` / `@monaco-editor/react` | Reject for Round 4 | Adds editor UI and worker/bundle work outside desktopization. |
| `sonner` | Defer | Toast feedback is useful later, but visible UI behavior is not the current desktop proof. |

No new frontend libraries are adopted in Round 4.

## Round 4 Implementation Scope

- Add Tauri-owned Fastify lifecycle.
- Set `TAPTAP_DATA_DIR`, `TAPTAP_MAKER_NPM_CACHE_DIR`, and `TAPTAP_MCP_LOG_DIR` under Tauri app data.
- Keep SQLite at `dataDir/taptap-maker-plus.sqlite`.
- Keep npm cache at `dataDir/npm-cache`.
- Persist MCP stderr logs at `dataDir/mcp-logs`.
- Stop Fastify on desktop exit.
- Stop all project MCP runtime clients when Fastify exits.
- Add a desktop readiness endpoint for app data verification.
- Update `verify:desktop`.
- Run typecheck, build, desktop readiness verification, and desktop build where the local toolchain permits.

## Non-Goals

- No React Query migration.
- No drag/drop rewrite.
- No Monaco/raw-result editor rewrite.
- No Mastra runtime.
- No UI repaint.
- No independent Maker API.
