# TapTap Maker Plus Current Implementation Audit

Date: 2026-06-18
Workspace: `G:\TapTap_Maker\MCP`

## Scope

This audit records the current implementation state after the MCP workbench modernization pass. It is based on the current React + Vite frontend, Fastify server, SQLite data, and real `@taptap/maker` MCP `tools/list` schema already persisted by the local runtime.

## Implemented

### MCP Runtime And Server Path

- Browser UI calls the local Fastify API.
- Fastify starts a per-project stdio MCP runtime with `@taptap/maker`.
- Runtime cwd is the selected Maker project root.
- `tools/list` is fetched through the MCP client and persisted in SQLite.
- `tools/call` results, input JSON, raw result JSON, and error messages are stored as task and generation records.
- Workflow graphs are persisted locally in SQLite as `MakerWorkflowGraph` records under the selected project.
- Workflow runs are persisted locally with node-level results. A run only executes explicitly selected tool nodes whose inputs are already present in the graph data.
- Asset scanning indexes files under the selected project's `assets` directory.
- Asset provenance is indexed locally by matching real asset `relativePath` / `absolutePath` text against stored task, generation, and workflow run JSON evidence.
- Build/runtime diagnostics expose a read-only API for fixed Maker log paths under `.maker/logs/runtime` and `.maker/logs/build`; the API does not accept arbitrary filesystem paths.

### Workspace Shell

- The desktop shell has top bar, project sidebar, central workbench, right MCP control panel, and conditional bottom error panel.
- Right panel modes are MCP status, MCP tools, task logs, and error details.
- Bottom panel appears only when failed tasks exist.
- Bottom panel groups errors by timeout, schema, MCP runtime, network, or tool error and supports copying raw/error content.
- Top bar command search uses loaded projects, MCP tools, indexed assets, and task records; selecting a result opens the corresponding project, Studio page, Asset Hub, or Runs view.

### Pages

- Home: project workflow entry and feature preview.
- Asset Hub: grid and table views, type filter, provenance filter, search, bulk move/delete, image preview, and provenance badges; table view uses `@tanstack/react-table`.
- Image Studio: schema-driven tool UI for image tools.
- Video Studio: schema-driven tool UI for video tools.
- Music Studio: schema-driven tool UI for music tools.
- 3D Studio: schema-driven tool UI for 3D model tools.
- Workflow: React Flow canvas using real MCP tools as nodes, with local save/load/delete for the current graph, schema-driven node input editing, selected-node execution, and local run history.
- Build Center: schema-driven UI for `maker_build_current_directory`, plus structured local evidence panels for `state.json`, `runtime.log`, watcher logs, and recent build attempt text files.
- Runs: task list, status filtering, raw/error detail, copy raw/error.
- Settings: project binding, MCP runtime, tools/schema overview, and local workbench dependencies.

### External Libraries Added

- `@rjsf/core`
- `@rjsf/validator-ajv8`
- `@xyflow/react`
- `@tanstack/react-table`
- `autoprefixer`

## Important Boundaries

- Studio forms are generated from `ToolSummary.inputSchema`, which comes from real MCP `tools/list`.
- The frontend does not handwrite Maker tool parameter names as product truth.
- The frontend does not spawn MCP processes.
- The app still uses the existing local Fastify server and `@modelcontextprotocol/sdk` path.
- The app does not implement TapTap official publishing, store upload, review, or private remote APIs.

## Not Fully Completed

These are not finished enough to claim "all pages and all functions are complete":

- Workflow execution now supports selected-node MCP execution from explicitly saved node inputs, but it does not yet provide cross-node output mapping, manual review gates, pause/resume, or replay of failed nodes.
- Long-task polling UX is still basic. Video and 3D tools can be called through schema forms, but dedicated polling panels and phase-confirmation flows are not fully productized.
- Asset provenance now links assets to task, generation, and workflow run records when their stored JSON contains the real asset path. It does not yet model full cross-node output mapping, manual provenance annotations, or a complete graph/DAG of derived assets.
- Build Center now reads local Maker log files and extracts visible `key: value` lines from recent build attempt logs, but it does not yet turn remote build phases into a resumable lifecycle with stage polling and recovery actions.
- Right panel resize exists, but there is no full inspector model for every workflow node type.
- Full API response examples and schema snapshots are still incomplete.
- Chunk splitting remains intentionally unoptimized for now because preserving the current UI/layout baseline has higher priority than changing page loading structure.

## Verification Commands

Current checks:

```powershell
npm run typecheck
npm run build
```


Browser checks used local `http://localhost:5173` with Playwright screenshots under `data/qa/`.

Latest browser smoke also verified that top bar search returns real `generate_image` tool and task records from the loaded `Azure Mirage` project.

## Current Answer To "Is Everything Complete?"

No. The core local MCP workbench is modernized and all primary pages now have functional surfaces, including selected-node workflow execution and path-evidence asset provenance, but full product completion still requires a richer workflow engine, long-task lifecycle UX, full provenance DAG support, remote build lifecycle handling, and more complete API documentation.
