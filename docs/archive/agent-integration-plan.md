# TapTap Maker++ Mastra/Agent Integration Plan

## 0. Current Ground Truth

This plan is based on the current repository files below:

- `apps/server/src/routes/api.ts`
- `apps/server/src/services/mcpRuntime.ts`
- `apps/server/src/services/toolExecution.ts`
- `apps/server/src/agent/contextBuilder.ts`
- `apps/server/src/lib/db.ts`
- `apps/web/src/api.ts`
- `apps/web/src/app/AppShell.tsx`
- `apps/web/src/components/layout/AgentInspectorPanel.tsx`

Mastra is installed as a root devDependency, but the current server implementation still does not import `@mastra/core`. Do not record Mastra runtime, agent execution, constructor options, tool schema fields, storage adapters, memory adapters, or runtime fields as implemented until the code imports and uses the real installed package exports.

Round 2 package inspection notes:

- `@mastra/core` installed version: `1.45.0`; local `node_modules/@mastra/core/package.json` declares package type `module`, main `dist/index.js`, types `dist/index.d.ts`, and engine `node >=22.13.0`.
- `@mastra/core` peer dependency for `zod` is `^3.25.0 || ^4.0.0`; this repo currently uses `zod` through `apps/server/package.json`.
- `node_modules/@mastra/core/dist/index.d.ts` exports `Mastra` and type `Config` from `./mastra/index.js`.
- `node_modules/@mastra/core/dist/agent/index.d.ts` re-exports `./agent.js`, `./types.js`, `./signals.js`, and related agent utilities.
- `node_modules/@mastra/core/dist/tools/index.d.ts` re-exports `./tool.js`, `./types.js`, `./ui-types.js`, `ToolStream`, built-in ask-user, submit-plan, and task tools.
- `node_modules/@mastra/core/dist/mastra/index.d.ts` defines `Config` with `agents`, `workflows`, `mcpServers`, `tools`, `processors`, `memory`, and other top-level properties, and declares class `Mastra` with `constructor(config?: Config<...>)`, `getTool(name)`, `getToolById(id)`, `listTools()`, and `addTool(tool, key?)`.
- Round 3 server implementation still does not import `@mastra/core`; the implemented endpoint is read-only context plumbing for a later agent runtime pass.
- `apps/server/src/services/toolExecution.ts` now owns shared MCP tool execution behavior: task creation, running status, optional generation creation for explicit generation tools, `runtimeManager.callTool(project, tool.name, args)`, task/generation finish, credit extraction, asset path extraction, and asset rescanning.
- `apps/server/src/routes/api.ts` imports `executeToolCall` from `../services/toolExecution.js`; workflow runs and existing tool-call routes use that shared service.
- `apps/server/src/agent/contextBuilder.ts` now builds a read-only `AgentContextSnapshot` from current project, projects, runtime, tools, tools list snapshot, tasks, generations, assets, workflows, workflow runs, credits, and build logs.
- `/api/agent/context` exists in `apps/server/src/routes/api.ts`; it validates query params with `agentContextQuerySchema` and returns `{ context: buildAgentContext(...) }`.
- `apps/server/src/types.ts` defines `AgentRightPanelTab`, `AgentSelectionReference`, `AgentPageState`, and `AgentContextSnapshot`.

## 1. First Version Positioning

The first embedded agent should be an assistant inside the Maker++ workbench, not an autonomous operator.

Its first role is:

- Explain current project/runtime/tool/task/asset state in plain language.
- Complete missing tool arguments by reading the selected tool schema and visible project context.
- Suggest the next low-risk action and explain why.
- Summarize failures from task logs, MCP errors, and build logs.
- Draft workflow steps from selected tools without running them automatically.

Its first version must not:

- Start long-running tool calls without user confirmation.
- Modify files without user confirmation.
- Delete, move, rename, import, or organize assets without user confirmation.
- Call MCP tools directly through stdio.
- Invent Mastra API fields or local data fields not present in the current repository.
- Create a separate service path that bypasses the existing Fastify and MCP runtime tracking.

## 2. Required Agent Context

The agent context must be built from existing server and web state. The context builder should use current repository APIs and database access patterns, then expose a compact, typed snapshot to the agent.

### Project Context

Source of truth:

- `listProjects()`, `getProject()`, `getSelectedProjectId()`, and `setSelectedProject()` in `apps/server/src/lib/db.ts`.
- `ProjectSummary` in `apps/web/src/api.ts`.
- Project selection flow in `apps/web/src/app/AppShell.tsx`.

Include:

- `id`
- `name`
- `rootPath`
- `makerProjectId`
- `configPath`
- `selected`
- `runtime`

Do not add project fields unless they are first added to the server type and returned by the existing project routes.

### Runtime Context

Source of truth:

- `runtimeManager.getSummary(project.id)` and `runtimeManager.listSummaries()` in `apps/server/src/services/mcpRuntime.ts`.
- Runtime routes in `apps/server/src/routes/api.ts`: `/api/projects/:projectId/mcp/start`, `/api/projects/:projectId/mcp/stop`, `/api/projects/:projectId/mcp/status`, `/api/mcp/status`.
- `RuntimeSummary` in `apps/web/src/api.ts`.

Include:

- `projectId`
- `status`
- `processId`
- `toolCount`
- `startedAt`
- `cwd`
- `toolsListUpdatedAt`
- `lastError`

The agent should treat `status !== "ready"` as a blocking runtime condition for MCP execution suggestions.

### Tools Context

Source of truth:

- `saveTools()`, `listTools()`, `getTool()`, and `getToolsListSnapshot()` in `apps/server/src/lib/db.ts`.
- `runtimeManager.refreshTools(project)` and `runtimeManager.callTool(project, toolName, args)` in `apps/server/src/services/mcpRuntime.ts`.
- Tool routes in `apps/server/src/routes/api.ts`: `/api/projects/:projectId/tools`, `/api/projects/:projectId/tools/refresh`, `/api/projects/:projectId/tools/list/raw`, `/api/projects/:projectId/tools/:toolName/schema`.
- `ToolSummary` in `apps/web/src/api.ts`.

Include:

- `name`
- `description`
- `category`
- `required`
- `inputSchema`
- `toolsListSnapshot.updatedAt`

Argument completion must use `inputSchema` and `required` from the current `tools` table or current `toolsListSnapshot`. It must not infer renamed keys, casing, or nested paths.

### Tasks And Generations Context

Source of truth:

- `createTask()`, `updateTaskStatus()`, `finishTask()`, `getTask()`, `listTasks()`, `createGeneration()`, `finishGeneration()`, and `listGenerations()` in `apps/server/src/lib/db.ts`.
- `executeToolCall()` in `apps/server/src/routes/api.ts`.
- Task routes in `apps/server/src/routes/api.ts`: `/api/tasks`, `/api/tasks/:taskId`.
- `TaskRecord` and `GenerationRecord` in `apps/web/src/api.ts`.
- Logs/errors panel behavior in `apps/web/src/components/layout/AgentInspectorPanel.tsx`.

Include:

- `taskId`
- `projectId`
- `toolName`
- `status`
- `inputSummary`
- `inputJson`
- `rawResultJson`
- `errorMessage`
- `startedAt`
- `finishedAt`

The agent should summarize task outcomes from these exact fields. It should not parse `rawResultJson` into new permanent shapes unless the parser is explicitly implemented and tested.

### Assets Context

Source of truth:

- `listAssets()`, `getAssetByRelativePath()`, `listAssetProvenance()`, and `listAssetProvenanceForAsset()` in `apps/server/src/lib/db.ts`.
- Asset routes in `apps/server/src/routes/api.ts`: `/api/projects/:projectId/assets`, `/api/projects/:projectId/assets/tree`, `/api/projects/:projectId/assets/provenance`, `/api/projects/:projectId/assets/preview`.
- Mutating asset routes in `apps/server/src/routes/api.ts`: `/api/projects/:projectId/assets/delete`, `/api/projects/:projectId/assets/move`, `/api/projects/:projectId/assets/import`, `/api/projects/:projectId/assets/rename`.
- `AssetSummary` and `AssetProvenanceSummary` in `apps/web/src/api.ts`.
- Asset selection view in `AgentInspectorPanel`.

Include:

- `id`
- `projectId`
- `absolutePath`
- `relativePath`
- `fileName`
- `extension`
- `assetType`
- `sizeBytes`
- `mtimeMs`
- `status`
- `updatedAt`
- `provenance`

For the first version, the agent can explain and suggest asset actions. Any route that writes to disk must require explicit user confirmation.

### Workflow Context

Source of truth:

- `saveWorkflowGraph()`, `listWorkflowGraphs()`, `getWorkflowGraph()`, `deleteWorkflowGraph()`, `createWorkflowRun()`, `finishWorkflowRun()`, `listWorkflowRuns()`, and `deleteWorkflowRun()` in `apps/server/src/lib/db.ts`.
- Workflow routes in `apps/server/src/routes/api.ts`: `/api/projects/:projectId/workflows`, `/api/projects/:projectId/workflows/:workflowId`, `/api/projects/:projectId/workflow-runs`, `/api/projects/:projectId/workflow-runs/:runId`.
- `MakerWorkflowGraph`, `WorkflowGraphRecord`, `WorkflowRunRecord`, and `WorkflowNodeRunResult` in `apps/web/src/api.ts`.

Include:

- Saved workflow graph metadata.
- Selected workflow nodes when the UI provides them.
- Previous run status and node results.
- Missing required fields from `executeWorkflowRun()` validation.

The first version should draft or review workflow graphs. It should not run workflow nodes until the user confirms the exact node set.

### Build Logs Context

Source of truth:

- `getProjectBuildLogs(project)` used by `/api/projects/:projectId/build/logs` in `apps/server/src/routes/api.ts`.
- `getBuildLogs(projectId)` and `ProjectBuildLogsSummary` in `apps/web/src/api.ts`.

Include:

- `projectId`
- `projectName`
- `projectRoot`
- `generatedAt`
- `runtime`
- `buildLogs`

The agent should use build logs for diagnosis and explanation. It must distinguish build logs from MCP task logs.

### Selection Context

Source of truth:

- `InspectorSelection` in `apps/web/src/components/layout/AgentInspectorPanel.tsx`.
- `selection`, `rightPanelTab`, and `handleSelectSelection()` in `apps/web/src/app/AppShell.tsx`.

Include:

- selected project
- selected tool
- selected task
- selected asset
- active right panel tab: `"status"`, `"tools"`, `"logs"`, or `"errors"`

This is the most important UI-local context for the embedded agent. Suggestions should be anchored to the current selection before falling back to global project state.

## 3. Action Routing Rule

All agent actions must enter through the existing Fastify API and existing MCP runtime chain.

Required route for MCP tool execution:

1. Web UI asks the server to perform an action.
2. Fastify route validates the request body with the existing route schema.
3. Shared tool execution creates a task and generation record.
4. Shared tool execution calls `runtimeManager.callTool(project, toolName, args)`.
5. `runtimeManager` starts or reuses the project-scoped MCP client.
6. `SdkMcpClient.callTool()` calls the MCP SDK client.
7. Server records success or failure and refreshes asset indexing when applicable.
8. Web UI refreshes tasks/assets/runtime state.

The agent must not create its own `StdioClientTransport`, must not call `Client.callTool()` directly, and must not spawn `taptap-maker` outside `runtimeManager`.

Round 3 moved the shared tool execution behavior out of `apps/server/src/routes/api.ts` without intentionally changing the route boundary:

- Shared service: `apps/server/src/services/toolExecution.ts`.
- The shared service preserves task creation, task status transition, generation creation for explicit generation tools, MCP error handling, credit recording, asset path extraction, and asset rescanning.
- Existing routes `/api/projects/:projectId/tools/:toolName/call`, `/api/mcp/call`, `/api/projects/:projectId/mcp/status-lite`, and workflow execution use the shared service.
- Future agent-run MCP actions must use the same shared service.

## 4. Suggested Server Structure

Keep agent-specific context and policy code under `apps/server/src/agent/`, while shared MCP execution remains under `apps/server/src/services/`.

Recommended files:

- `apps/server/src/agent/contextBuilder.ts`
- `apps/server/src/agent/confirmationPolicy.ts`
- `apps/server/src/agent/routes.ts`
- `apps/server/src/agent/types.ts`
- `apps/server/src/services/toolExecution.ts`

### `contextBuilder.ts`

Responsibilities:

- Build a compact context snapshot for the selected `projectId`.
- Read project, runtime, tools, tool schema, tasks, assets, workflows, workflow runs, build logs, and optional UI selection.
- Limit large lists before sending to the model.
- Preserve exact field names from repository types.
- Return enough evidence for explanations, not raw full-database dumps.

### `toolExecution.ts`

Responsibilities:

- Own the extracted behavior currently inside `executeToolCall()`.
- Provide one server-side entry point for MCP tool execution.
- Keep task/generation/credit/asset-index side effects identical to current route behavior.
- Be used by existing routes and future agent routes.

### `confirmationPolicy.ts`

Responsibilities:

- Classify actions as explain-only, confirmation-required, or blocked.
- Gate dangerous operations before they reach `toolExecution.ts`.
- Return a confirmation payload that can be displayed by the web UI.

### `routes.ts`

Responsibilities:

- Register agent-specific Fastify routes.
- Keep Mastra-specific runtime calls inside the server process.
- Reuse `contextBuilder.ts`, `confirmationPolicy.ts`, and `toolExecution.ts`.
- Defer exact route body and response shapes until implementation reads the installed Mastra exports and local type definitions.

### `types.ts`

Responsibilities:

- Define repository-owned types for agent context, confirmation requests, and action results.
- Re-export existing repository types only when needed.
- Avoid mirroring Mastra package internals.

## 5. Human Confirmation Boundary

The first version should be conservative. The agent may explain, draft, and suggest without confirmation. It must ask for explicit confirmation before any operation with external side effects, project mutation, or credit cost.

### Always Allowed Without Confirmation

- Explain selected project/runtime/tool/task/asset state.
- Summarize task logs, error logs, and build logs.
- Suggest next actions.
- Draft tool arguments without executing them.
- Draft workflow graph edits without saving or running them.
- Explain required fields from `ToolSummary.required` and `ToolSummary.inputSchema`.

### Confirmation Required

- MCP calls through `/api/projects/:projectId/tools/:toolName/call`.
- MCP calls through `/api/mcp/call`.
- `maker_status_lite` through `/api/projects/:projectId/mcp/status-lite`.
- Starting or stopping MCP runtime through `/api/projects/:projectId/mcp/start` and `/api/projects/:projectId/mcp/stop`.
- Refreshing tools through `/api/projects/:projectId/tools/refresh`.
- Asset write routes: delete, move, import, rename.
- Model package write routes: organize, bind, discard, restore, resource update, batch action.
- Model conversion routes that write generated preview assets.
- Saving or deleting workflows.
- Running workflow nodes.
- Clearing tasks.
- Any action that can spend credits, start remote generation, build, push, or write files.

### Blocked In First Version

- Direct stdio MCP access from agent code.
- Direct filesystem writes from agent code outside existing route handlers.
- Direct database writes from agent code outside existing repository functions.
- Package installation or dependency changes.
- Background autonomous loops that continue acting after the user leaves the current confirmation flow.

## 6. Round 3 Implemented State

Verified from current files:

- Shared server tool execution exists at `apps/server/src/services/toolExecution.ts`.
- Existing direct tool-call routes and workflow execution call `executeToolCall(project, tool, args)`.
- Read-only agent context builder exists at `apps/server/src/agent/contextBuilder.ts`.
- Read-only agent context route exists at `/api/agent/context`.
- Agent context types exist in `apps/server/src/types.ts`.
- Mastra package inspection notes exist in this document, but no server file currently imports `@mastra/core`.
- No confirmation policy file is present in the current server source.
- No agent runtime route that executes model actions is proven by current files.

## 7. Round 4 Recommendation

Recommended next work after Round 3:

1. Add `apps/server/src/agent/confirmationPolicy.ts`.
   - Classify explain-only, confirmation-required, and blocked actions using the boundary in section 5.
   - Cover MCP calls, runtime start/stop, tool refresh, asset writes, workflow saves/runs, model package writes, task clearing, build/push/remote generation, and file writes.
   - Keep the policy independent from Mastra package internals.
2. Add tests or smoke checks for read-only context.
   - Verify `/api/agent/context` returns the exact `AgentContextSnapshot` keys defined in `apps/server/src/types.ts`.
   - Verify project selection, active tab, and selection query params are preserved without inferring field names.
   - Verify list limits from `contextBuilder.ts` keep large state compact.
3. Add tests or smoke checks for shared execution behavior.
   - Verify direct tool calls and workflow tool nodes both use the shared execution path.
   - Verify task/generation/credit/asset rescanning behavior remains intact.
   - Verify no route creates an independent stdio MCP client.
4. Only after the above, integrate Mastra runtime.
   - Re-read installed `@mastra/core` files before writing imports.
   - Add model/agent execution behind Fastify routes.
   - Route any MCP action through `executeToolCall`, not through direct stdio.
   - Require explicit user confirmation before any external side effect.
5. Add web UI wiring after the server route contract exists.
   - Pass current project/page selection into `/api/agent/context`.
   - Show confirmation payloads before executing tool, asset, workflow, runtime, build, push, or file-writing actions.
   - Keep the right Inspector state scoped to the active tab and selection.

### Round 4 Acceptance Criteria

- Existing MCP runtime start/stop/status behavior is unchanged.
- Existing tool calls still create task and generation records.
- Existing workflow runs still execute tool nodes through the shared execution path.
- Agent MCP actions and manual MCP actions share one server-side execution service.
- No agent code opens its own stdio transport.
- Asset mutation, workflow run, MCP call, runtime start/stop, and file-writing actions require confirmation.
- The agent context can answer from selected project, selected tool, selected task, selected asset, active tab, tools, tasks, assets, workflows, credits, and build logs.
- The implementation never invents Mastra fields; it uses exact exports and types read from installed files.
