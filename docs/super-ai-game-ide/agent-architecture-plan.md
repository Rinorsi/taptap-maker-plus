# Agent Architecture Plan

## 1. Boundary

Agent assistance must not bypass the local product chain:

```text
Workbench UI
  -> Fastify Local Server
    -> Project MCP Runtime
      -> @taptap/maker stdio MCP server
        -> Maker MCP tools
          -> selected local TapTap Maker project
```

The model must not call Maker MCP tools directly from the browser. All execution must route through Fastify and the existing audited tool execution path.

## 2. Current Repo State

Current local evidence:

- `@mastra/core` exists in root `devDependencies`.
- Server runtime uses Fastify, MCP TypeScript SDK, SQLite, Drizzle, zod, execa, and chokidar.
- `apps/server/src/agent/contextBuilder.ts` is a read-only context aggregator.
- `/api/agent/context` is read-only.
- `apps/server/src/services/toolExecution.ts` is the shared MCP call audit path.
- Current UI Agent context view is read-only and does not execute MCP tools.

Therefore the repo does not yet have:

- Agent sessions;
- Agent message persistence;
- approval queue;
- memory store;
- runtime model integration;
- sub-agent execution;
- action preview schema.

## 3. Modes

Agent cooperation should have three modes.

### Observe

Read-only:

- project status;
- selected project;
- assets;
- tasks;
- generations;
- tools/list;
- raw results;
- runtime logs;
- build logs;
- asset reference scans.

No mutation.

### Draft

Produces:

- plan;
- prompt;
- canvas template proposal;
- asset cleanup proposal;
- generation parameter proposal;
- context pack;
- risk list.

No mutation.

### Execute

Creates `ActionPreview` and waits for user confirmation before action.

Execution can call:

- Fastify action routes;
- existing `executeToolCall`;
- existing asset operations after confirmation;
- workflow run routes after confirmation;
- runtime start/stop/refresh routes after confirmation.

## 4. Action Preview

Any action that can mutate state, spend credits, or start work requires preview.

Action preview must show:

- action kind;
- exact `toolName` when MCP is involved;
- exact args JSON;
- project ID;
- affected file paths;
- affected asset paths;
- expected credit/cost risk if known;
- expected runtime duration if known;
- task/log location;
- confirmation controls.

Actions requiring confirmation:

- write files;
- move files;
- rename files;
- delete files;
- import assets;
- call MCP tools;
- spend credits;
- start runtime;
- stop runtime;
- restart runtime;
- refresh `tools/list`;
- run workflow;
- build;
- push;
- clear tasks;
- adopt/discard/restore generated assets.

## 5. Context Pack

Every Agent response should be based on a visible context pack.

Context pack should include:

- selected project;
- project root;
- runtime status;
- tools/list snapshot hash or timestamp;
- selected module;
- selected asset or node;
- relevant tasks;
- raw result references;
- log tail references;
- file references and line numbers when code is involved;
- user request;
- pending approvals.

Long conversation compression must preserve:

- path;
- line number;
- tool name;
- task ID;
- raw result ID or raw result JSON reference;
- user approval decisions.

## 6. Runtime Library Recommendation

Recommended priority:

1. Mastra for TypeScript/Node product Agent runtime.
2. LangGraph.js if state-machine, checkpoint, and human interrupt semantics become the primary requirement.
3. Vercel AI SDK for streaming UI and tool-calling UI layer, not as the sole orchestrator.
4. OpenAI Agents SDK TS for OpenAI-first handoff, tracing, sessions, and human-in-the-loop support.

Do not choose CrewAI or AutoGen as first implementation layer for this TS/Fastify workbench.

Before importing any runtime library:

- read installed package exports and types;
- write a minimal server-side spike;
- keep MCP execution routed through Fastify and `executeToolCall`.

## 7. Agent UI

Add an Agent management surface:

- sessions;
- messages;
- context pack viewer;
- pending approvals;
- executed actions;
- raw result links;
- logs;
- sub-agent list;
- permission mode;
- model/runtime status.

Add right Inspector tabs or panes for:

- current MCP schema;
- raw result;
- Maker docs/reference;
- Agent context.

Docs/reference and real schema must stay separate. Docs can guide behavior; schema decides fields.

## 8. Sub-Agents

Allowed sub-agent types:

- art prompt reviewer;
- video continuity reviewer;
- 3D multiview reviewer;
- Lua/build diagnostics reviewer;
- asset reference auditor;
- log analyst;
- schema diff reviewer.

Default mode for sub-agents:

- observe or draft.

Sub-agent execution must return to main approval queue.

## 9. Data Model P0

Add persistent records before runtime integration:

- agent session;
- agent message;
- context snapshot;
- action preview;
- approval decision;
- tool audit entry;
- model trace pointer if supported.

## 10. Implementation Stages

### Stage 0 - Contract

- Define schemas for Agent action, approval, context pack, and audit.
- Add smoke test for `/api/agent/context` shape.
- No model runtime.

### Stage 1 - Control Surface

- Add sessions and messages.
- Add approval queue.
- Add context pack viewer.
- No automatic execution.

### Stage 2 - Confirmed Execution

- Agent suggests action.
- User confirms.
- Fastify executes through existing paths.
- Raw results and task IDs are recorded.

### Stage 3 - Runtime

- Add Mastra or selected runtime.
- Keep execution gated.
- Add tracing and persistence.

### Stage 4 - Sub-Agents

- Add narrow scoped sub-agents.
- Keep write/spend/build operations routed through main approvals.

## 11. Risks

- Tool schema drift.
- Agent tool-call bypass.
- Long-running tasks without task IDs.
- Memory pollution.
- Desktop release machines without Node path readiness.
- Users trusting draft output as executed work.

Each risk must have UI evidence and audit evidence before launch.

