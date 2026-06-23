# TapTap Maker Plus Asset Management Governance

This document defines the bottom rules for asset management in Maker++. It is the product boundary between ordinary project files, generated media, task records, and 3D model package governance.

## 1. Responsibility Split

Maker++ manages two different asset domains:

| Domain | Owner | Scope |
| --- | --- | --- |
| Ordinary assets | `AssetManagerPanel` | Images, videos, audio, and other files under `assets/` |
| 3D model packages | `Model3DStudio` model package governance | Source models, runtime MDL, materials, textures, previews, manifests, resource table entries, and project references |

Studio pages own generation forms. They do not own file-management behavior.

Asset management owns file tree, search, selection, import, move, delete, copy path, and preview behavior.

3D model governance owns package state, package actions, runtime readiness, resource table state, and reference evidence.

## 2. Directory Rules

Generated and imported ordinary assets use stable project-relative roots:

| Asset type | Default managed root | Default import folder |
| --- | --- | --- |
| Image | `assets/image` | `assets/image/maker_plus` |
| Video | `assets/video` | `assets/video/maker_plus` |
| Audio | `assets/audio` | `assets/audio/maker_plus` |
| Project-wide assets | `assets` | `assets` |

3D uses package-oriented roots:

| 3D area | Path |
| --- | --- |
| Organized source packages | `assets/model/maker_plus/source` |
| Reference images | `assets/model/maker_plus/references` |
| Discarded packages | `assets/model/maker_plus/discarded` |
| Runtime MDL | `assets/Meshes` |
| Runtime materials | `assets/Materials` |
| Runtime textures | `assets/Textures` |
| Runtime prefabs | `assets/Prefabs` |

The frontend passes project-relative paths only. The backend resolves paths under the selected project root and rejects unsafe paths.

## 3. Ordinary Asset Rules

Ordinary assets are files under the selected project's `assets/` directory.

The asset manager must use a real recursive directory tree derived from asset `relativePath`. When a page passes a scoped root such as `assets/image`, the tree must only contain files below that root.

Ordinary asset operations:

- Import local files into the active directory.
- Move selected files into a selected project-relative directory.
- Delete selected files.
- Refresh the project asset scan after a filesystem change.
- Rebuild provenance from stored task, generation, and workflow-run raw JSON.
- Copy project-relative paths from cards or table rows.
- Preview media when the file type supports it.

Ordinary asset UI must not duplicate per-page file manager logic. Image, video, audio, and Asset Hub use the shared asset manager.

Before moving, deleting, or renaming ordinary assets, Maker++ must run a read-only reference scan for the selected project-relative paths. The scan records literal text evidence from `.project/resources.json`, `scripts/**/*.lua`, and `assets/flows/**/*.json`. It does not parse or assume JSON field meaning, and it does not rewrite references in this round.

## 4. Provenance Rules

Provenance is local evidence. It links an asset to stored workbench records when real `relativePath` or `absolutePath` text appears in:

- MCP task input/output JSON.
- Generation records.
- Workflow run records.

Provenance does not prove runtime usage. Runtime usage must be checked through project-specific resource and reference evidence.

## 5. 3D Model Package Rules

3D source files and runtime files are not the same thing.

Source files such as GLB or GLTF are authoring evidence. They are not proof that the game can load the model.

Runtime readiness is based on:

- Runtime MDL file.
- Material XML files.
- Texture files when the material requires them or they are discovered beside the runtime package.
- `.project/resources.json` entries.
- Lua or Flow references.

Lack of a source GLB does not mean the model cannot run. A model can be usable in game when the runtime MDL/material/resource/reference chain exists.

Discarded model packages must be excluded from normal package categories. They appear only in the discarded view and can be restored or permanently deleted.

## 6. Model Package States

Model package state is derived from real evidence:

| State | User label | Evidence |
| --- | --- | --- |
| `in_use` | 使用中 | Runtime-ready, in resource table, and referenced by Lua or Flow |
| `adopted` | 已采用 | Runtime-ready, in resource table, has source package, not referenced |
| `packaged_unused` | 已打包未使用 | Runtime-ready, in resource table, no source package, not referenced |
| `draft` | 草稿 | Organized source package exists, runtime MDL not found |
| `source_orphan` | 待整理 | Source file exists outside the organized source package root |
| `runtime_orphan` | 待打包 | Runtime MDL exists, not in resource table, not referenced |
| `broken` | 有问题 | Reference evidence exists but runtime/resource evidence is incomplete, or the package cannot be classified safely |
| `discarded` | 废弃 | Package is explicitly marked discarded or located in the discarded area |

File type chips show file existence. State badges show workflow state. Do not merge these concepts.

## 7. UI Rules

Shared asset management UI must provide:

- Directory tree.
- Breadcrumb.
- Grid and table modes.
- Search.
- Type filter when the page is not already type-scoped.
- Provenance filter.
- Multi-select.
- Select all, invert selection, and clear selection.
- Bulk move and delete.
- Drag file to directory.
- Import files into current directory.
- Copy path.
- Media preview.

Studio-specific UI must provide:

- Prompt and generation parameters.
- Reference inputs.
- Submit action.
- Current result preview.
- Task status handoff to the right panel.

3D-specific UI must provide:

- Generation parameters.
- Model preview.
- Package state filters.
- Package file chips.
- Missing-part diagnostics.
- Batch organize, discard, restore, add to resource table, remove from resource table.
- Per-package actions such as copy Lua path and inspect runtime files.

## 8. API Rules

Ordinary asset APIs:

- `GET /api/projects/:projectId/assets`
- `POST /api/projects/:projectId/assets/scan`
- `POST /api/projects/:projectId/assets/import`
- `POST /api/projects/:projectId/assets/move`
- `POST /api/projects/:projectId/assets/delete`
- `POST /api/projects/:projectId/assets/rename`
- `GET /api/projects/:projectId/assets/tree`
- `POST /api/projects/:projectId/assets/provenance/rebuild`
- `POST /api/projects/:projectId/assets/references/scan`

3D package APIs:

- `GET /api/projects/:projectId/model-packages`
- `POST /api/projects/:projectId/model-packages/:id/organize`
- `POST /api/projects/:projectId/model-packages/:id/bind`
- `POST /api/projects/:projectId/model-packages/:id/discard`
- `POST /api/projects/:projectId/model-packages/:id/restore`
- `POST /api/projects/:projectId/model-packages/:id/resource`
- `POST /api/projects/:projectId/model-packages/batch`

MCP tool calls remain project-level task operations. The frontend does not spawn MCP and does not construct arbitrary absolute output paths.

Backend implementation rules:

- Route handlers validate request shape, resolve the selected project, call the domain operation, then rescan or return refreshed data.
- Ordinary filesystem operations stay in asset-oriented routes and services. Studio pages do not get separate file APIs.
- Model package operations stay in model package services. Do not implement model package actions in ordinary asset APIs.
- Backend asset roots live in `apps/server/src/services/assetGovernance.ts`.
- Frontend asset roots live in `apps/web/src/features/assets/assetGovernance.ts`.
- The two files must describe the same roots, but they are separate adapters because server code resolves filesystem paths and frontend code renders project-relative paths.
- Resource table changes must preserve a backup and roll back on JSON write failure.
- Removing model resources must fail when Lua references still exist.

## 9. Verification Standard

Asset management work is not complete until:

- Asset Hub, Image Studio, Video Studio, and Music Studio use `AssetManagerPanel`.
- No Studio page owns a copied file manager.
- Scoped roots show only directories below the scoped root.
- Import, move, delete, copy path, preview, select all, invert selection, and clear selection work from the shared panel.
- 3D remains separate as package governance.
- Discarded 3D packages are not mixed into normal package categories.
- `npm run verify:assets` passes.
- `npm run typecheck` passes.
- `npm run build` passes.

`npm run verify:assets` currently proves:

- Scoped asset trees exclude files outside the requested root.
- Recursive and non-recursive directory filtering behave differently.
- Frontend and backend managed roots stay aligned.
- Model governance labels stay aligned with category labels.
- 3D issue filters exclude discarded packages.
- 3D batch action buttons are derived from selected packages' suggested actions.
- Runtime-only MDL packages are classified as `runtime_orphan`.
- Adding runtime resources moves an unreferenced package to `packaged_unused`.
- Lua-referenced runtime packages are classified as `in_use`.
- Removing resources is blocked when Lua still references the model.
- Source GLB packages can be discarded and restored through the model package service.
