# Research Sources And Repo Evidence

This document separates public reference evidence from local repo evidence. Do not use public product descriptions as proof of local MCP fields.

## 1. External Product References

### Jimeng AI

- Source: [Jimeng AI official site](https://jimeng.jianying.com/)
- Relevant public product signals:
  - AI image creation.
  - AI video creation.
  - Intelligent canvas.
  - Multi-image fusion.
  - Local repaint.
  - One-click outpaint.
  - Image object removal.
  - Cutout.
  - Multi-layer editing.

Important boundary:

- Public pages checked in this research do not prove an exact Jimeng `@素材` syntax.
- The local `@图1`, `@视频1`, `@音频1`, `@模型1` design should be described as our local interaction model, not as a verified Jimeng field-level feature.

### Seedance

- Source: [Seedance 2.0 official launch](https://seed.bytedance.com/zh/blog/official-launch-of-seedance-2-0)
- Relevant public product signals:
  - Multimodal reference with text, image, video, and audio.
  - Reference dimensions include visual composition, camera language, motion rhythm, and audio characteristics.
  - Video editing and video continuation are part of the public direction.

## 2. External Library References

### Canvas And Structured Text

- [React Flow](https://reactflow.dev/) - node canvas, edges, drag, zoom, selection, custom nodes.
- [React Flow Sub Flows](https://reactflow.dev/examples/grouping/sub-flows) - group/sub-flow pattern for frames and方案 blocks.
- [Tiptap Mention](https://tiptap.dev/docs/editor/extensions/nodes/mention) - mention token editor reference.
- [Lexical](https://lexical.dev/docs/intro) - lower-level editor framework reference.

### Image Editing

- [Konva](https://konvajs.org/) and [react-konva](https://konvajs.org/docs/react/index.html) - interactive 2D canvas object layer.
- [Fabric.js](https://fabricjs.com/) - canvas object model and image/object editing foundation.
- [Pintura](https://pqina.nl/pintura/) - product-grade commercial image editor.
- [Filerobot Image Editor](https://github.com/scaleflex/filerobot-image-editor) - open-source image editor requiring React compatibility proof.
- [Photopea API](https://www.photopea.com/api/) - external professional editor integration.
- [OpenAI Image Edit API](https://developers.openai.com/api/reference/python/resources/images/methods/edit/) - reference for mask-style API design, not proof of Maker MCP fields.

### Video And Audio

- [Remotion](https://www.remotion.dev/docs) - React-based video composition and rendering.
- [ffmpeg.wasm](https://ffmpegwasm.netlify.app/docs/overview/) - FFmpeg compiled to WebAssembly for browser-side media processing.
- [MDN WebCodecs API](https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API) - low-level browser media encoding and decoding.
- [wavesurfer.js](https://wavesurfer.xyz/) - audio waveform visualization and region editing reference.
- [Peaks.js](https://github.com/bbc/peaks.js) - audio waveform and segment editing reference.
- [Tone.js](https://tonejs.github.io/) - Web Audio framework for interactive music timing and synthesis.
- [Video.js](https://videojs.com/) - web video player framework.
- [Media Chrome](https://www.media-chrome.org/) - media player web components.

### 3D

- [model-viewer](https://modelviewer.dev/docs/) - web component for model preview. Already installed in this repo.
- [three.js](https://threejs.org/docs/) and [React Three Fiber](https://r3f.docs.pmnd.rs/) - advanced 3D interactions.
- [glTF Transform](https://gltf-transform.dev/) - glTF inspection, optimization, and transform pipeline.
- [meshoptimizer / gltfpack](https://meshoptimizer.org/gltf/) - glTF optimization.
- [Khronos glTF Sample Viewer](https://github.khronos.org/glTF-Sample-Viewer-Release/) and [glTF Report](https://gltf.report/) - validation and material inspection.
- [Tencent Hunyuan 3D API](https://www.tencentcloud.com/document/product/1284/75540), [Tripo Generation](https://platform.tripo3d.ai/docs/generation), [Hyper3D Rodin API](https://developer.hyper3d.ai/api-specification/rodin-generation-gen2_reset_v) - external async 3D generation API references.

### Agent And Workflows

- [Mastra docs](https://mastra.ai/docs)
- [LangGraph.js overview](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [OpenAI Agents SDK JS](https://openai.github.io/openai-agents-js/)
- [Vercel AI SDK](https://ai-sdk.dev/docs)
- [Model Context Protocol](https://modelcontextprotocol.io/docs)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

### Plugin Ecosystem

- [VS Code Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
- [Obsidian Plugin Docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [ComfyUI Custom Nodes](https://docs.comfy.org/custom-nodes/overview)
- [Figma Plugin API](https://www.figma.com/plugin-docs/)
- [Tauri v2 Capabilities](https://v2.tauri.app/security/capabilities/)

### Settings And Project UX

- [Codex config](https://developers.openai.com/codex/config-basic)
- [Codex MCP](https://developers.openai.com/codex/mcp)
- [Codex app settings](https://developers.openai.com/codex/app/settings)
- [Claude Code MCP](https://docs.anthropic.com/en/docs/claude-code/mcp)
- [Claude Code settings](https://code.claude.com/docs/en/settings)
- [Cursor MCP](https://cursor.com/docs/context/mcp)
- [VS Code Workspaces](https://code.visualstudio.com/docs/editor/workspaces)
- [JetBrains projects](https://www.jetbrains.com/help/idea/open-close-and-move-projects.html)
- [Tauri configuration](https://v2.tauri.app/reference/config/)
- [Tauri path API](https://v2.tauri.app/reference/javascript/api/namespacepath/)

## 3. Local Repo Evidence

### Current Canvas Core

- `apps/web/src/features/generation/UniversalCanvas.tsx`
  - `canvasToolNames` currently includes `generate_image`, `edit_image`, `create_video_task`, `text_to_music`.
- `apps/web/src/features/canvas-core/types.ts`
  - `CanvasToolName` currently excludes `create_3d_model_task`.
  - `CanvasAssetKind` already includes `model`.
  - `CanvasAssetUse` includes first frame, last frame, character, scene, style, composition, action, camera, rhythm, background music, generic.
- `apps/web/src/features/canvas-core/toolRegistry.ts`
  - Required fields are defined for the four current canvas tools.
- `apps/web/src/features/canvas-core/compiler.ts`
  - `create_video_task` validation covers mode, image/video/audio counts, prompt, ratio, resolution, duration, seed, and `execution_expires_after`.
  - `text_to_music` custom mode requires `title` and `style`.
  - `edit_image` maps one image to `image` and remaining images to `reference_images`.
- `apps/web/src/features/canvas-core/assetReferences.ts`
  - Material aliases use `图`, `视频`, `音频`, `模型`.
- `apps/web/src/features/canvas-core/resultExtraction.ts`
  - Extracts `workspace_video_path`, `workspace_last_frame_path`, `workspace_image_path`, `workspace_audio_path`, `workspace_music_path`, `workspace_model_path`, `workspace_image_paths`, `workspace_audio_paths`.
- `apps/web/src/features/canvas-core/templates.ts`
  - Contains video reference template and all-in-one canvas template.

### Real MCP Tool Schema Snapshot

From `tools.json`:

- `generate_image`
  - Required: `prompt`, `name`, `target_size`.
  - Fields include `prompt`, `name`, `aspect_ratio`, `transparent`, `target_size`, `reference_image`, `reference_images`, `seed`, `thinking_level`, `resolution`, `model`.
- `edit_image`
  - Required: `image`, `prompt`, `name`, `target_size`.
  - Fields include `image`, `prompt`, `name`, `aspect_ratio`, `target_size`, `transparent`, `reference_images`, `seed`, `thinking_level`, `resolution`, `model`.
  - No `mask`, outpaint rectangle, remove-object region, or layer field is present.
- `create_video_task`
  - Required: `mode`.
  - Modes: `text_to_video`, `first_frame`, `first_last_frame`, `multi_modal_reference`.
  - Fields include `model`, `prompt`, `images`, `videos`, `audios`, `generate_audio`, `resolution`, `ratio`, `duration`, `seed`, `return_last_frame`, `enable_web_search`, `execution_expires_after`.
- `query_video_task`
  - Required: `task_id`.
  - Should not poll continuously; schema text says no sooner than 120 seconds.
- `text_to_music`
  - Required: `prompt`.
  - Fields include `customMode`, `instrumental`, `model`, `prompt`, `style`, `title`, `negativeTags`, `vocalGender`.
- `create_3d_model_task`
  - Required: `mode`.
  - Modes: `text_to_model`, `image_to_model`, `multiview_to_model`.
  - Fields include `prompt`, `subject_type`, `image`, `front_image`, `back_image`, `left_image`, `right_image`, `rig`, `face_limit`, `texture_quality`, `model_seed`, `texture_seed`, `image_seed`, `confirmed_image_paths`.
- `query_3d_model_task`
  - Required: `task_id`.

### Existing Product Boundary

- `docs/README.md`
- `docs/NEXT_THREAD_HANDOFF.md`

These require the local call chain to remain `Workbench UI -> Fastify Local Server -> Project MCP Runtime -> @taptap/maker stdio MCP server -> Maker MCP tools -> selected local TapTap Maker project`.

