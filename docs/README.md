# TapTap Maker Plus Docs

Date: 2026-06-23
Workspace: `G:\TapTap_Maker\MCP`

This is the documentation entry point for TapTap Maker Plus / Maker++.

## 1. Current Product Goal

TapTap Maker Plus / Maker++ is a local desktop-capable Maker MCP workbench.

The product must keep this call chain:

```text
Workbench UI
  -> Fastify Local Server
    -> Project MCP Runtime
      -> @taptap/maker stdio MCP server
        -> Maker MCP tools
          -> selected local TapTap Maker project
```

It is not a replacement Maker API, not a TapTap official publishing backend, and not a Codex conversation relay.

## 2. Authoritative Reading Order

Use these documents first in a new conversation or new development round:

1. `docs/NEXT_THREAD_HANDOFF.md`
2. `docs/productization-round-1-result.md`
3. `docs/productization-orchestration-plan.md`
4. `docs/frontend-implementation-standard.md`
5. `docs/asset-management-governance.md`
6. `docs/productization-graph.md`
7. `docs/desktop-app-plan.md`
8. `docs/agent-integration-plan.md`

## 3. Current Baseline Docs

| Document | Status | Purpose |
| --- | --- | --- |
| `docs/NEXT_THREAD_HANDOFF.md` | Current | Fastest handoff for a new chat or agent. |
| `docs/productization-round-1-result.md` | Current | Verified result of the first productization round. |
| `docs/productization-orchestration-plan.md` | Current | Agent split, interface boundaries, and conflict rules. |
| `docs/frontend-implementation-standard.md` | Current | Frontend UI/UX and component reuse rules. |
| `docs/asset-management-governance.md` | Current | Asset manager and 3D package governance rules. |
| `docs/productization-graph.md` | Current | Architecture and productization graph. |
| `docs/desktop-app-plan.md` | Current plan | Tauri shell/config and static web serving exist; sidecar lifecycle and desktop packaging completion are not proven. |
| `docs/agent-integration-plan.md` | Current plan | Shared tool execution and read-only context exist; Mastra runtime is not implemented. |

## 4. Historical Docs

These files are useful for background, but they are not the latest implementation contract:

| Document | Status | Note |
| --- | --- | --- |
| `docs/taptap-maker-plus-development-plan.md` | Historical baseline | Early product plan from 2026-06-17. Keep for intent. |
| `docs/taptap-maker-plus-visual-system.md` | Historical visual baseline | Keep for visual direction and reference translation. |
| `docs/current-implementation-audit.md` | Superseded audit | Superseded by `productization-round-1-result.md` for latest state. |
| `docs/archive/taptap-maker-plus-implementation-prompt.md` | Archived prompt | Old execution prompt; no longer the active contract. |
| `docs/参考.html` | Visual reference | Keep as source reference, not implementation code. |

## 5. Cleanup Rule

Do not delete historical docs just because they are old. First classify them as:

- Current
- Current plan
- Historical baseline
- Superseded audit
- Archived prompt
- Visual reference

Delete only duplicate generated output or files that have no unique product, architecture, or evidence value.

## 6. Verification Rule

Before claiming implementation status, verify with current files and commands. For finished code rounds, run:

```powershell
npm run typecheck
npm run verify:assets
npm run build
```

For UI-only doc work, a build is not required unless code changed.

## 7. Current Round 3 Baseline

Verified from current files:

- Root `package.json` includes `dev`, `dev:browser`, `desktop:dev`, `desktop:build`, and `verify:desktop`; `npm run dev` now starts the desktop development shell.
- `src-tauri/tauri.conf.json` exists with `build.frontendDist: "../apps/web/dist"`, `build.devUrl: "http://localhost:5173"`, `build.beforeDevCommand: "npm run dev:web"`, and `build.beforeBuildCommand: "npm run build:desktop"`.
- `apps/server/src/services/staticWeb.ts` serves `apps/web/dist` in production and preserves `/api` JSON behavior.
- `apps/server/src/services/toolExecution.ts` is the shared server-side MCP tool execution service.
- `apps/server/src/agent/contextBuilder.ts` and `/api/agent/context` provide read-only agent context.
- `@mastra/core` is installed, but no current server file imports it.

Do not claim desktop packaging is complete unless `npm run desktop:build` and the produced artifacts are verified. Do not claim Mastra runtime is implemented until current server code imports and uses the installed Mastra exports.

## 8. Round 4 Focus

Recommended next round:

- Desktop lifecycle: Fastify sidecar or verified runtime launch, `TAPTAP_DATA_DIR` app-data wiring, shutdown cleanup, and packaging verification.
- Agent safety: confirmation policy and runtime routes that keep all MCP actions on the Fastify -> Project MCP Runtime -> `@taptap/maker` stdio chain.
- Tests and smoke checks: agent context shape, shared tool execution, production static serving, and desktop readiness.
