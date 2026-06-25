# Canvas And Multimodal Plan

## 1. Direction

The canvas should become a global capability, not a single page implementation. Both the video-focused multimodal canvas and the all-in-one node canvas should call the same shared canvas capability layer.

Development order:

1. Complete the video-focused multimodal reference canvas.
2. Extract shared canvas capability into reusable modules.
3. Rewire the all-in-one node canvas to the shared capability.
4. Add 3D canvas nodes after shared compile and result contracts are ready.

This keeps the product usable while preventing another half-finished parallel canvas.

## 2. Current State

Current shared files already exist under:

- `apps/web/src/features/canvas-core/types.ts`
- `apps/web/src/features/canvas-core/assetReferences.ts`
- `apps/web/src/features/canvas-core/compiler.ts`
- `apps/web/src/features/canvas-core/toolRegistry.ts`
- `apps/web/src/features/canvas-core/resultExtraction.ts`
- `apps/web/src/features/canvas-core/templates.ts`

Current all-in-one canvas entry:

- `apps/web/src/features/generation/UniversalCanvas.tsx`

Current first-stage global tool list:

```text
generate_image
edit_image
create_video_task
text_to_music
```

Current missing from shared canvas:

```text
create_3d_model_task
query_3d_model_task
query_video_task
batch_generate_images
```

`create_3d_model_task` is a real Maker MCP tool in `tools.json`, but it is not yet part of `CanvasToolName`.

## 3. Shared Canvas Capability Layer

The global layer should own these concepts:

- canvas graph snapshot;
- node type registry;
- material reference registry;
- alias allocation;
- structured mention tokens;
- field-source tracking;
- validation issues;
- payload compile result;
- execution adapter;
- result extraction;
- result-to-node conversion;
- Inspector view model;
- persistence format and version migration.

The global layer should not own page chrome, sidebars, homepage, or settings. Those stay in app shell modules.

## 4. Material Nodes

Required node kinds:

- image node;
- video node;
- audio node;
- 3D model node;
- text node;
- raw JSON node;
- result node.

Material node requirements:

- Keep exact backend identity such as `relativePath`.
- Do not match by display name.
- Generate stable alias labels such as `@图1`, `@视频1`, `@音频1`, `@模型1`.
- Show usage labels:
  - role;
  - scene;
  - style;
  - composition;
  - action;
  - camera;
  - rhythm;
  - background music;
  - first frame;
  - last frame.
- Show preview:
  - image thumbnail;
  - video thumbnail or playable preview;
  - audio waveform or compact player;
  - 3D thumbnail or model-viewer preview;
  - clear fallback only when preview loading fails or type is unsupported.
- Support drag from asset library to canvas.
- Support result node conversion back to material node.

## 5. Director Prompt Node

This is the most important interaction model.

Requirements:

- Typing `@` opens a material picker.
- Picker includes current canvas materials and project assets.
- Inserted token binds material node ID and material identity.
- Token displays as readable alias, such as `@图1`.
- A prompt can reference multiple material tokens.
- Clicking a token locates the material node.
- Clicking a material node shows prompt nodes that reference it.
- Deleting a material node marks dependent tokens as broken.
- Broken tokens remain visible until the user removes or rebinds them.

Recommended editor:

- First implementation: Tiptap Mention.
- Alternative: Lexical if lower-level control becomes necessary.

Do not store only plain text. Store both text and token metadata.

## 6. Payload Node

The Payload node should not occupy a large permanent panel. It should contain compact tabs and let the Inspector show details when needed.

Required tabs:

- `JSON`: exact MCP payload to submit.
- `Sources`: where each payload field came from.
- `Issues`: errors and warnings.
- `Raw`: raw execution result after run.

Layout rules:

- Long field source values must be truncated.
- Long lists must use internal scrolling.
- The node should keep stable size and not expand the whole canvas.
- A button in each issue/source row locates the source node.
- Credit-spending execution requires a confirmation step.

This directly addresses the current UX issue where payload/source display takes too much space.

## 7. Inspector

The right Inspector should own detail density. Nodes stay light; details live in Inspector.

For selected node, Inspector shows:

- preview;
- exact MCP field mapping;
- references in and out;
- generation history;
- validation issues;
- raw result;
- reusable actions.

For canvas-level selection, Inspector shows:

- current compile result;
- active tool schema;
- task status;
- runtime status;
- logs and errors.

Homepage and settings should default to collapsed right Inspector. Canvas should collapse sidebars when entering focus mode, then reopen Inspector only on errors, node detail, schema, or logs.

## 8. Frame / Scheme Groups

Use React Flow group/sub-flow to represent creative frames.

A frame represents one方案:

- materials;
- prompt;
- params;
- payload;
- result;
- raw result;
- notes.

Required actions:

- duplicate frame;
- compare A/B frames;
- save frame as template;
- restore frame from template;
- export frame as shareable JSON;
- mark frame result as accepted or discarded.

First templates:

- character video template;
- first-frame video template;
- first-last-frame video template;
- multimodal reference video template;
- music rhythm video template;
- image edit template;
- text-to-music template;
- text-to-3D multiview template.

## 9. Result Backflow

Every MCP execution should create result nodes:

- image result node;
- video result node;
- audio/music result node;
- 3D model result node;
- raw JSON result node.

Reuse chains:

- generated image -> video first frame;
- video last frame -> next video first frame;
- generated image -> `edit_image`;
- multiple images -> `create_video_task`;
- music -> audio reference for `create_video_task`;
- 3D multiview images -> `create_3d_model_task` phase 2;
- model result -> preview/package/governance node.

The current `resultExtraction.ts` already recognizes workspace paths for image, video, audio, model, and last-frame assets. The missing product behavior is complete result-to-node interaction for all asset kinds.

## 10. Video Canvas Requirements

The video canvas should focus on `create_video_task`.

Real schema modes:

- `text_to_video`;
- `first_frame`;
- `first_last_frame`;
- `multi_modal_reference`.

Current compiler already enforces:

- `text_to_video` has no image/video/audio reference;
- `first_frame` has exactly 1 image;
- `first_last_frame` has exactly 2 images;
- `multi_modal_reference` has at least one reference;
- audio reference cannot be used alone;
- image reference maximum is 9;
- video reference maximum is 3;
- audio reference maximum is 3.

P0 polish:

- Make these rules visible before execution.
- Turn mode switching into clear segmented controls.
- Convert connected image roles automatically but visibly.
- Show `return_last_frame` as a first-class continuation control.
- When result contains `workspace_last_frame_path`, expose "continue from last frame" directly.
- Show query fallback for `task_id` and `query_video_task`, with no continuous polling.

## 11. All-In-One Canvas Requirements

The all-in-one canvas should call the same global capability layer.

First-stage tools:

- `generate_image`;
- `edit_image`;
- `create_video_task`;
- `text_to_music`.

Second-stage tools:

- `create_3d_model_task`;
- `query_3d_model_task`;
- `query_video_task`;
- `batch_generate_images` if batch UI is designed as a group node, not just many duplicated image nodes.

The all-in-one canvas should not become a generic raw MCP graph. It should expose production-grade creative nodes with exact schema-backed payloads.

## 12. Schema-Gated Future Capabilities

These are user-facing goals but not current `edit_image` schema capabilities:

- mask-based local repaint;
- outpaint with explicit extension rectangle;
- remove-object with explicit region;
- layer-aware image editing;
- image cutout as a standalone structured tool.

First implementation can store local artifacts:

- original image;
- mask image;
- editor state;
- prompt;
- preview;
- local metadata.

It must not submit mask/outpaint/remove-object fields until real Maker MCP schema exposes exact fields.

## 13. Implementation Notes

Use existing dependencies first:

- `@xyflow/react` for graph;
- `@dnd-kit` for asset/library drag behavior;
- `@tanstack/react-query` for server data;
- `zustand` if shared client state is needed;
- `sonner` for non-blocking feedback;
- `@monaco-editor/react` for JSON/raw schema views when needed.

Do not switch canvas foundation in stage one.

