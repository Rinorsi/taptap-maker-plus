# 3D And Model Pipeline

## 1. Current State

The repo already has a dedicated 3D studio and model package pipeline, but the shared all-in-one canvas does not yet expose 3D generation.

Current real Maker MCP tools:

- `create_3d_model_task`;
- `query_3d_model_task`.

Current shared canvas type:

- `CanvasAssetKind` includes `model`;
- `CanvasToolName` does not include `create_3d_model_task`;
- `UniversalCanvas.tsx` does not include `create_3d_model_task` in its tool list.

## 2. Real `create_3d_model_task` Schema

Required:

- `mode`.

Modes:

- `text_to_model`;
- `image_to_model`;
- `multiview_to_model`.

Fields:

- `prompt`;
- `subject_type`;
- `image`;
- `front_image`;
- `back_image`;
- `left_image`;
- `right_image`;
- `rig`;
- `face_limit`;
- `texture_quality`;
- `model_seed`;
- `texture_seed`;
- `image_seed`;
- `confirmed_image_paths`.

`confirmed_image_paths` requires:

- `front`;
- `back`;
- `right`.

`left` is optional.

Related polling tool:

- `query_3d_model_task` with required `task_id`.

## 3. 3D Node Types

Add 3D nodes only after the shared canvas contract supports them.

Required node types:

- 3D prompt node;
- subject type node;
- front image node;
- back image node;
- left image node;
- right image node;
- confirmed image paths node;
- model generation settings node;
- 3D task executor node;
- 3D task query node;
- model result node;
- model preview node;
- model package node;
- runtime MDL node;
- model governance status node.

## 4. Compile Rules

Rules must be written against real schema only.

### `text_to_model`

Phase 1:

- accepts `mode`;
- accepts `prompt`;
- accepts `subject_type`;
- accepts `image_seed`;
- does not require image nodes.

Phase 2:

- accepts `confirmed_image_paths.front`;
- accepts `confirmed_image_paths.back`;
- accepts `confirmed_image_paths.right`;
- accepts optional `confirmed_image_paths.left`;
- should retain prompt and subject context when available.

### `image_to_model`

Phase 1:

- accepts exactly one `image`;
- image must be treated as front-facing source image in the UX copy;
- can accept `rig`, `face_limit`, `texture_quality`, `model_seed`, `texture_seed`.

Phase 2:

- accepts `confirmed_image_paths` after user review.

### `multiview_to_model`

- requires `front_image`;
- can accept `back_image`, `left_image`, `right_image`;
- can accept `rig`, `face_limit`, `texture_quality`, `model_seed`, `texture_seed`.

## 5. Preview And Packaging

Use current local model pipeline before adding new libraries.

Current known local pieces:

- dedicated 3D studio in `apps/web/src/features/generation/Model3DStudio.tsx`;
- model package types in `apps/server/src/types.ts`;
- `.mdl -> .gltf` conversion route under `/api/projects/:projectId/model-convert/mdl-to-gltf`;
- model preview through installed `@google/model-viewer`;
- model package governance and reference scanning.

Do not present GLB -> MDL as existing unless a real implementation is found. Current known route is `.mdl -> .gltf` preview conversion.

## 6. Library Plan

| Capability | Library | Stage |
|---|---|---|
| Basic GLB/glTF preview | `@google/model-viewer` | Already installed |
| Model transform gizmo and scene interaction | three.js + React Three Fiber | P1 |
| Transform controls | three.js `TransformControls` or `three-stdlib` | P1 |
| glTF inspection and optimization | glTF Transform | P1/P2 |
| Mesh optimization | meshoptimizer / gltfpack | P2 |
| External debug viewer | Babylon Sandbox or glTF Sample Viewer | P2 |
| USD/USDZ interchange | OpenUSD tooling | Future only |

## 7. P0

- Document 3D as a real tool that is not yet in shared canvas.
- Add `create_3d_model_task` to shared canvas planning, not immediate code.
- Add node design and compile rules before implementation.
- Preserve two-phase user confirmation for `text_to_model` and `image_to_model`.
- Show generated multiview images for user review before phase 2.
- Show task ID and `query_3d_model_task` follow-up when needed.

## 8. P1

- Add 3D result node and model preview node.
- Add model package node:
  - source model;
  - preview image;
  - multiview images;
  - runtime MDL;
  - material XMLs;
  - texture files;
  - missing parts;
  - can preview;
  - can run.
- Add governance status:
  - in resource table;
  - referenced by scripts;
  - referenced by flows;
  - referenced by resources;
  - issues;
  - suggested actions.

## 9. P2

- Add mesh/material inspection.
- Add model package export.
- Add scene placement preview if it maps cleanly to Maker runtime resources.
- Add reusable character/model template frames.

