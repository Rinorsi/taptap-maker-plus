# Media Editing Libraries

## 1. Principle

Use mature libraries for editing primitives. Do not hand-roll full image/video/audio editors unless the scope is narrow and the behavior is explicitly bounded.

The product should distinguish:

- local preview/editing artifacts;
- exact MCP payload fields;
- long-running generation tasks;
- final adopted Maker assets.

## 2. Image Editing

### Current Local Capability

Current real `edit_image` schema:

- `image`;
- `prompt`;
- `name`;
- `aspect_ratio`;
- `target_size`;
- `transparent`;
- `reference_images`;
- `seed`;
- `thinking_level`;
- `resolution`;
- `model`.

Required fields:

- `image`;
- `prompt`;
- `name`;
- `target_size`.

No real schema field currently exists for:

- `mask`;
- outpaint rectangle;
- remove-object region;
- layer stack.

### Recommended Options

| Library | Use | Fit | Risk |
|---|---|---|---|
| Pintura | Product-grade image editor | Strongest commercial option | Requires license decision |
| Filerobot Image Editor | Open-source image editor UI | Good POC path | React 19 compatibility must be proven |
| Konva / react-konva | Custom mask and object layer | Good for focused mask editor | Not a complete editor |
| Fabric.js | Canvas object engine | Good for custom object editing | Needs custom React product UI |
| Toast UI Image Editor | Older open-source editor | POC only | Maintenance risk |
| Photopea API | External professional editor | Useful advanced escape hatch | External iframe dependency |
| Excalidraw / tldraw | Annotation/whiteboard reference | Good for markup inspiration | Not pixel image editing core |

### P0 Image Plan

- Keep current `edit_image` as prompt-only image editing.
- Add clear copy: local mask and region editing are not submitted unless schema supports them.
- Add source image preview and reference image chips.
- Add field source and validation display in Payload.
- Add generated image result as reusable image node.

### P1 Image Plan

- Build schema-gated mask artifact editor.
- Store original image, mask image, editor state, prompt, and preview locally.
- Enable submit only if refreshed `tools/list` exposes exact mask-compatible fields.
- Use Konva or `react-canvas-masker` for the first focused mask editor.

### P2 Image Plan

- Add advanced image editor integration after license and compatibility checks.
- Add template presets:
  - transparent icon;
  - sprite sheet source;
  - character consistency;
  - style transfer;
  - edit original image.

## 3. Video Editing And Generation

### Current Real Video Schema

`create_video_task` fields:

- `mode`;
- `model`;
- `prompt`;
- `images`;
- `videos`;
- `audios`;
- `generate_audio`;
- `resolution`;
- `ratio`;
- `duration`;
- `seed`;
- `return_last_frame`;
- `enable_web_search`;
- `execution_expires_after`.

Required field:

- `mode`.

Related query tool:

- `query_video_task` with required `task_id`.

### Current Canvas Support

Current compiler already builds:

- `images` with `first_frame`, `last_frame`, or `reference_image`;
- `videos` with `reference_video`;
- `audios` with `reference_audio`;
- `return_last_frame`;
- mode validation;
- duration, ratio, resolution, seed, and expiry validation.

### Recommended Libraries

| Library | Use | Fit | Risk |
|---|---|---|---|
| Remotion | React video composition, timeline previews, render pipeline | Good for preview compositions and template video exports | Server/render setup is heavier than simple preview |
| ffmpeg.wasm | Browser-side trim, thumbnail, transcode experiments | Useful for local proof of concept | Heavy payload, memory and performance risk |
| WebCodecs | Low-level frame extraction/encoding | Useful for advanced local frame/thumbnail work | Browser support and complexity |
| Video.js | Stable video playback | Good if native video element is not enough | Plugin ecosystem adds surface area |
| Media Chrome | Custom media controls with web components | Good for polished player controls | Mostly player UI, not editing |

### P0 Video Plan

- Make the video canvas the first polished canvas.
- Restore real video thumbnails/previews in asset cards.
- Show first frame and last frame nodes clearly.
- Show reference video role and reference audio role.
- Show exact `create_video_task` JSON before submit.
- Show task status, raw result, and `workspace_video_path`.
- Show `workspace_last_frame_path` and one-click continue chain.
- Add `query_video_task` follow-up UX for returned `task_id`, with a 120-second minimum interval.

### P1 Video Plan

- Add local clip preview strip:
  - thumbnail;
  - duration;
  - frame capture;
  - selected in/out markers for local note-taking.
- Add simple storyboard frame group.
- Add A/B frame duplication.
- Add Remotion-based preview only for compositions that are local and deterministic.
- Add WebCodecs or ffmpeg.wasm only after profiling Tauri/web memory.

### P2 Video Plan

- Add timeline view for generated sequences.
- Add scene stitching plan:
  - generated video A;
  - last frame;
  - generated video B;
  - music reference;
  - raw results.
- Add export package for storyboard, prompts, assets, and outputs.

## 4. Audio And Music

### Current Real Music Schema

`text_to_music` fields:

- `customMode`;
- `instrumental`;
- `model`;
- `prompt`;
- `style`;
- `title`;
- `negativeTags`;
- `vocalGender`.

Required field:

- `prompt`.

When `customMode` is true, current compiler requires:

- `title`;
- `style`.

### Recommended Libraries

| Library | Use | Fit | Risk |
|---|---|---|---|
| wavesurfer.js | Waveform display, regions, playback | Best first choice for audio preview and rhythm markers | Need wrapper hygiene in React |
| Peaks.js | Waveform and segment editor | Good for region annotation | Heavier custom integration |
| Tone.js | Web Audio timing, metronome, generative playback | Useful for rhythm prototyping | Not needed for basic preview |
| Media Chrome | Audio/video controls | Good for consistent player UI | Not waveform editing |

### P0 Audio Plan

- Show audio waveform or compact player for audio nodes.
- Let music result become audio material node.
- Let audio material connect to `create_video_task` as reference audio.
- Show rule: reference audio cannot be used alone in `multi_modal_reference`.
- Add music prompt presets without hiding exact schema fields.
- Keep `text_to_music` result raw JSON visible.

### P1 Audio Plan

- Add waveform regions:
  - intro;
  - beat drop;
  - loop range;
  - action sync;
  - ending.
- Store local rhythm annotations as canvas metadata.
- Feed rhythm meaning into prompt text or reference guide, not invented MCP fields.

### P2 Audio Plan

- Add simple beat/grid preview with Tone.js only if it improves editing.
- Add audio-to-video rhythm template.
- Add background music package export.

## 5. Cross-Media Result Reuse

Required reuse matrix:

| Result | Can become |
|---|---|
| generated image | image reference, edit source, video first frame, 3D front image |
| edited image | image reference, video first frame, 3D front image |
| video result | video reference, timeline clip |
| video last frame | image reference, next video first frame |
| music result | audio reference, BGM package asset |
| 3D model result | model preview, model package, runtime MDL governance |
| raw result JSON | diagnostics and reproducibility record |

## 6. User Pain Points To Treat As P0

- Asset cards must not fall back to generic icons when real preview is available.
- Media nodes must not become oversized.
- Fullscreen/focus mode must not break sidebars or canvas layout.
- Payload/source details must move into Payload tabs or Inspector, not a large always-visible surface.
- Field source lists must truncate and scroll internally.

