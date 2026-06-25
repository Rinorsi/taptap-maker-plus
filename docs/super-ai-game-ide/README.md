# Super Aggregated AI Game IDE Docs

Date: 2026-06-25
Workspace: `G:\TapTap_Maker\MCP`
Scope: documentation only. This folder does not implement product code.

## 1. Product Target

The target is a local Maker MCP workbench that behaves like a super aggregated AI game IDE:

- one global multimodal canvas capability layer;
- a polished video-focused multimodal reference canvas;
- an all-in-one node canvas that calls the same global capability layer;
- image, video, audio, and 3D generation/editing chains;
- project home, settings, runtime status, logs, and MCP schema visibility;
- auditable Agent assistance that never bypasses the local Fastify and Project MCP Runtime chain;
- a future plugin ecosystem for canvas nodes, tool adapters, importers, templates, inspectors, Agent skills, and exporters.

The non-negotiable call chain remains:

```text
Workbench UI
  -> Fastify Local Server
    -> Project MCP Runtime
      -> @taptap/maker stdio MCP server
        -> Maker MCP tools
          -> selected local TapTap Maker project
```

## 2. Read Order

1. `GOALS.md`
2. `research-sources.md`
3. `canvas-and-multimodal-plan.md`
4. `media-editing-libraries.md`
5. `3d-and-model-pipeline.md`
6. `home-settings-runtime-plan.md`
7. `agent-architecture-plan.md`
8. `plugin-ecosystem-plan.md`
9. `implementation-roadmap.md`
10. `quality-gates.md`
11. `open-questions.md`

## 3. Key Decisions

- Keep `@xyflow/react` as the first-stage canvas foundation. The repo already has `@xyflow/react`, `@dnd-kit`, `@monaco-editor/react`, `@tanstack/react-query`, `zustand`, and `sonner`.
- Treat `@图1`, `@视频1`, `@音频1`, `@模型1` as local structured material tokens. Public official pages checked in this research did not prove that Jimeng uses the exact `@素材` syntax.
- The first implementation stage should finish the video-focused multimodal canvas. Then extract shared canvas capability. Then revive the all-in-one canvas through the shared layer.
- `generate_image`, `edit_image`, `create_video_task`, and `text_to_music` already form the first all-in-one canvas scope. `create_3d_model_task` exists in real Maker MCP schema but is not yet part of `CanvasToolName`.
- Local image mask, outpaint, remove-object, and layer editing must be schema-gated. Current `edit_image` schema has no mask/outpaint/remove-object field.
- Payload UI should not occupy a large independent region. It belongs inside the Payload node/Inspector with tabs, truncation, and internal scrolling.
- Results must flow back into the canvas as reusable nodes, not only as task history.

## 4. Current Repo Evidence

The current all-in-one canvas white list is:

- `generate_image`
- `edit_image`
- `create_video_task`
- `text_to_music`

Evidence:

- `apps/web/src/features/generation/UniversalCanvas.tsx`
- `apps/web/src/features/canvas-core/types.ts`
- `apps/web/src/features/canvas-core/toolRegistry.ts`
- `apps/web/src/features/canvas-core/compiler.ts`
- `tools.json`

The 3D tool exists in `tools.json` as `create_3d_model_task`, and the dedicated 3D studio already uses it through `Model3DStudio.tsx`, but the shared canvas type does not yet include it.

## 5. This Folder Is The Development Contract

Before changing code for the next stage:

- read `docs/README.md`;
- read `docs/NEXT_THREAD_HANDOFF.md`;
- read this folder;
- check real `tools/list` or persisted `tools.json` before adding or mapping any MCP field;
- do not infer JSON paths, field names, path names, config keys, or tool parameters.

