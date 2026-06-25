# Open Questions

## 1. Product Scope

- Should the all-in-one canvas expose every Maker MCP generation tool immediately, or only curated creative chains first?
- Should `batch_generate_images` be a first-class batch node or a template that compiles multiple image nodes?
- Should `query_video_task` appear as a visible polling node, or as a task action on video result nodes?
- Should 3D model generation live in all-in-one canvas immediately after Phase 3, or remain dedicated studio until the two-phase UX is polished?

## 2. Editor Choices

- Use Tiptap Mention first, or implement a lighter custom token editor?
- Use Konva for focused mask artifacts, or evaluate Filerobot first?
- Is Pintura licensing acceptable for a product-grade image editor?
- Should Remotion be limited to preview/export templates, or become a core timeline engine?
- Should wavesurfer.js become the default audio node preview?

## 3. MCP Schema Dependencies

Need real schema before implementation:

- image mask field;
- outpaint field;
- remove-object field;
- cutout field;
- layer-aware image editing;
- video timeline editing;
- audio-to-video sync field;
- GLB -> MDL conversion if planned;
- cloud project pull/restore if homepage exposes it.

## 4. Agent Runtime

- Should Mastra be the first runtime after the approval/control surface exists?
- Should LangGraph.js be used only for long-running state-machine flows?
- Should OpenAI Agents SDK tracing be integrated from day one of model runtime?
- Where should model credentials live in desktop distribution?

## 5. Plugin Runtime

- Should first-party plugins be static imports or manifest-loaded modules?
- What is the minimum permission model before local plugin install?
- Should plugin code run in renderer, worker, iframe, or server process?
- How will plugin compatibility be checked against canvas schema versions?
- Will marketplace plugins be allowed before signed package support exists?

## 6. Settings And Distribution

- Should users edit `TAPTAP_MAKER_PROJECTS_ROOT` from settings or only through environment/config?
- Should the desktop app bundle Node or keep depending on system Node?
- Should MCP stderr logs have retention limits?
- Should project removal delete related tasks/assets index records, or preserve history after the project disappears?

## 7. Extra Product Ideas To Consider

1. Local asset provenance graph: show which prompt, task, workflow, and raw result created or reused every asset.
2. Prompt and asset version timeline: compare prompt versions and generated outputs across attempts.
3. Credit/cost simulator before execution: estimate expensive tasks and show risk before submit.
4. Offline project health doctor: verify config, schema freshness, missing assets, stale references, and runtime logs.
5. Privacy/security vault: keep tokens and secrets out of canvas files and templates.
6. Template marketplace or starter packs: character video, first-last-frame video, music rhythm, 3D biped, UI icon sets.
7. Reusable style/character bible: project-level style sheets and character references that can be inserted as tokens.
8. Dataset/fine-tune future boundary: reserve concepts but do not implement until product scope and API support exist.
9. Generation/task performance profiler: track queue time, run time, failures, and retry patterns.
10. Team handoff/export package: export canvas, assets, prompts, raw results, and open issues for another developer or artist.

