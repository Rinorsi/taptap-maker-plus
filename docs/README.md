# TapTap Maker Plus Docs

Date: 2026-06-25 (Simplified)
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

## 2. Active Documentation

**Start here for any new work:**

1. **`NEXT_THREAD_HANDOFF.md`** - Project current status, tech stack, constraints, and next steps
2. **`frontend-implementation-standard.md`** - UI/UX development rules (when changing frontend)
3. **`asset-management-governance.md`** - Asset/file operation rules (when changing asset features)

**Archived documentation:**
- See `docs/archive/` for historical Round 1-4 planning documents (multi-agent coordination, completed)

## 3. Verification Commands

Before claiming implementation is complete, run:

```powershell
npm run typecheck
npm run verify:assets
npm run build
```

## 4. Current Status (Round 4 Completed)

Verified baseline:
- Desktop app lifecycle implemented (Tauri + Fastify sidecar)
- NSIS installer packaging works
- App data paths configured
- MCP runtime management operational
- Asset governance and reference scanning active

See `NEXT_THREAD_HANDOFF.md` for detailed current state and remaining work.