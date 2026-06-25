# Implementation Roadmap

## Phase 0 - Documentation Contract

Status: this folder.

Deliverables:

- product goal;
- research sources;
- current repo evidence;
- global canvas plan;
- media editing plan;
- 3D plan;
- homepage/settings/runtime plan;
- Agent architecture plan;
- plugin ecosystem plan;
- quality gates.

Exit check:

- [ ] docs reviewed;
- [ ] no product code required for this phase;
- [ ] no unsupported MCP field treated as implemented.

## Phase 1 - Finish Video Multimodal Canvas

Goal:

Make the video canvas genuinely usable and close to Jimeng/Seedance-style multimodal reference workflows.

Scope:

- asset preview restoration;
- compact material nodes;
- structured `@素材` tokens;
- Payload tabs;
- field source truncation and internal scrolling;
- issue-to-node navigation;
- first frame and last frame flow;
- reference image/video/audio flow;
- result backflow;
- task status and query fallback;
- focus mode and sidebars.

Do not:

- add 3D to canvas yet;
- implement mask/outpaint submit;
- replace React Flow;
- add plugin runtime.

Exit check:

- [ ] video canvas can create valid `create_video_task` payload for all four modes.
- [ ] generated video result can continue from last frame.
- [ ] raw payload and raw result are inspectable.
- [ ] user can understand why a payload is invalid before submitting.

## Phase 2 - Extract Global Canvas Capability

Goal:

Move reusable behavior out of page-specific video implementation.

Scope:

- shared canvas types;
- shared node registry;
- shared material references;
- shared mention/token handling;
- shared compiler interface;
- shared result extraction and result node creation;
- shared Inspector view model;
- shared persistence versioning.

Exit check:

- [ ] video canvas uses shared layer.
- [ ] all-in-one canvas uses shared layer.
- [ ] no duplicated compiler logic for the same tool.

## Phase 3 - Rebuild All-In-One Canvas On Shared Layer

Goal:

Turn the current all-in-one canvas into a real production canvas.

Scope:

- `generate_image`;
- `edit_image`;
- `create_video_task`;
- `text_to_music`;
- reusable templates;
- result backflow;
- schema-backed node library;
- right Inspector integration.

Exit check:

- [ ] all four first-stage tools compile exact payloads.
- [ ] results become reusable nodes.
- [ ] unsupported fields remain disabled.

## Phase 4 - Add 3D To Global Canvas

Goal:

Bring 3D generation into the same canvas model without weakening the two-phase confirmation flow.

Scope:

- `create_3d_model_task`;
- `query_3d_model_task`;
- text-to-model phase 1 and phase 2;
- image-to-model phase 1 and phase 2;
- multiview-to-model;
- model result node;
- model preview/package/governance nodes.

Exit check:

- [ ] 3D phase 1 cannot silently proceed to phase 2 without user confirmation.
- [ ] generated multiview images are reviewable.
- [ ] model result can be previewed or clearly marked as not previewable.

## Phase 5 - Homepage, Settings, Runtime Polish

Goal:

Make the desktop workbench feel like an IDE, not a pile of debug panels.

Scope:

- homepage project state;
- manual project bind;
- remove record;
- settings tabs;
- runtime actions;
- Inspector policy;
- diagnostics copy/export.

Exit check:

- [ ] project cards show real project/runtime state.
- [ ] remove record and delete local folder are separate.
- [ ] settings has structured configuration.
- [ ] Inspector owns runtime detail density.

## Phase 6 - Agent Control Surface

Goal:

Add auditable AI assistance without tool-call bypass.

Scope:

- Agent sessions;
- context pack;
- draft mode;
- approval queue;
- action preview;
- confirmed execution through Fastify.

Exit check:

- [ ] no Agent action can call MCP directly.
- [ ] credit/file/runtime actions require confirmation.
- [ ] raw results and task IDs are recorded.

## Phase 7 - First-Party Plugin Extension Points

Goal:

Prepare the system for extension without third-party marketplace risk.

Scope:

- first-party node registry extension;
- template registry;
- Inspector renderer extension;
- asset importer extension;
- Agent draft skill extension;
- manifest draft.

Exit check:

- [ ] extension points do not bypass permissions.
- [ ] no arbitrary third-party code execution is required.

## Phase 8 - Optional Marketplace And Advanced Editing

Only after P0/P1 stability:

- signed plugin packages;
- marketplace/catalog;
- advanced image editor;
- timeline editor;
- Remotion composition;
- local media processing with profiling;
- third-party plugin sandbox.

