# TapTap Maker Plus Frontend Implementation Standard

This document is the working standard for the Maker++ frontend. It exists to stop page-level copy/paste and keep every studio, asset manager, and inspector on the same product system.

## 1. Product UI Direction

The frontend is a local Maker MCP workbench. It is not a chat page, not a marketing page, and not a debug dashboard.

The visual language is:

- Light-first, dense, restrained, TapTap-green accented.
- Permanent workbench shell on desktop.
- Tool pages are production panels, not isolated one-off pages.
- Assets, tasks, files, and MCP calls must stay traceable.

Do not create a new visual style per page. If one studio needs a control, it belongs in the shared studio kit unless it is truly domain-specific.

## 2. Layering Rule

Frontend code must be split by responsibility:

| Layer | Path | Responsibility |
| --- | --- | --- |
| Shell layout | `apps/web/src/components/layout` | Top bar, sidebar, inspector, workbench viewport |
| UI primitives | `apps/web/src/components/ui` | Button, Input, Label, Select, Card |
| Studio kit | `apps/web/src/components/studio` | Shared studio controls, media slots, status badges, chips, bulk bars |
| Feature pages | `apps/web/src/features/*` | Business composition and domain state only |
| API client | `apps/web/src/api.ts` | Local Fastify API calls and shared response types |

Feature pages must not reimplement primitives that already exist in `components/ui` or `components/studio`.

## 3. Copy/Paste Prohibition

Do not duplicate these patterns inside feature pages:

- Mode switch pill buttons.
- Select field wrappers.
- Media drag/drop slots.
- Status badges.
- File type chips.
- Selection checkboxes.
- Bulk action toolbars.
- Empty states.
- Drawer headers and list toolbars.

Use or extend:

- `StudioModeButton`
- `StudioSelectField`
- `StudioMediaDropzone`
- `StatusBadge`
- `FileTypeChips`
- `SelectionBox`
- `StudioBulkActionBar`

If a page needs a slightly different version, add a prop to the shared module first. Only create a local component when the UI is tied to that page's domain model and cannot be reused.

## 4. Studio Page Contract

Every Studio page should use the same structure:

1. Header: English studio label, Chinese title, current project.
2. Mode switch: shared pill control.
3. Left or primary parameter panel: prompt, reference inputs, required parameters.
4. Sticky execution area: primary action and run status.
5. Preview area: current output, active task, or empty state.
6. Asset manager / governance drawer: filters, search, selected count, batch actions.

The action button must remain reachable. Advanced options must not push the primary action out of view.

## 5. Asset Management Contract

Detailed asset rules live in `docs/asset-management-governance.md`. This section is the frontend summary.

Asset and package management UI must separate these concepts:

- File type: what files exist.
- Lifecycle state: where the asset/package is in the workflow.
- Project usage: whether the project actually references it.
- Resource table state: whether `.project/resources.json` includes it.

Do not display internal state strings directly when a user-facing label exists.

Examples:

| Internal value | User label |
| --- | --- |
| `in_use` | 使用中 |
| `adopted` | 已采用 |
| `runtime_orphan` | 待打包 |
| `source_orphan` | 待整理 |
| `discarded` | 废弃 |
| `broken` | 有问题 |

Use file type chips for file existence:

- `GLB`
- `GBM`
- `MDL`
- `MAT`
- `TEX`
- `PREVIEW`
- `PREFAB`
- `META`
- `RES`
- `LUA`
- `FLOW`

## 6. Form Rules

All MCP-facing forms must be based on real tool schema or explicitly verified mapping code.

Rules:

- Do not invent MCP fields.
- Do not send empty strings for optional integer fields.
- Do not expose native browser selects when `SelectField` can be used.
- Put model and resolution controls in normal visible parameter areas when they are core generation parameters.
- Keep advanced options for low-frequency parameters only.

## 7. Theme Rules

Components must use semantic tokens through Tailwind mappings:

- `bg-surface-app`
- `bg-surface-panel`
- `bg-surface-raised`
- `text-text`
- `text-text-muted`
- `border-border`
- `text-brand`

Avoid page-level hardcoded colors except for status tones. If a status color repeats in more than one page, move it into a shared component.

## 8. Quality Gate

Before finishing UI work, check:

- No duplicated local `Field`, `ModeButton`, or `Dropzone` when shared equivalents exist.
- No raw internal state shown directly to users.
- No page-specific visual style that conflicts with other studios.
- All long lists have search/filter and clear selection state.
- Batch actions show selected count.
- Primary action remains visible.
- `npm run verify:assets` passes when asset roots, asset tree behavior, or model governance labels change.
- `npm run typecheck` passes.
- `npm run build` passes for completed UI changes.

## 9. Interaction Rules

Asset and Studio interactions must be predictable across pages:

- Selection belongs to the shared asset manager or the 3D package governance panel, not to individual Studio pages.
- Dragging an ordinary asset uses project-relative `relativePath` data. Dragging into a directory moves the asset; dragging files from the OS imports them into the active directory.
- Copyable paths are shown as compact path chips or table cells. Hover shows the full path; click copies the project-relative path.
- Bulk operations must expose selected count, select all, invert selection, clear, and the destructive action separately.
- Type-scoped pages such as Image Studio, Video Studio, and Music Studio do not show redundant file-type filters.
- 3D package filters are lifecycle filters, not file-type filters. File existence belongs in file type chips.
- Discarded 3D packages are shown only in the discarded filter and are not counted as normal issue items.
- Status labels and import roots must come from `apps/web/src/features/assets/assetGovernance.ts`.
- Empty states should say what is empty and what action is available; they should not expose implementation details.

## 10. Current Migration Plan

The shared studio kit is now the standard for new UI work.

Current asset-management baseline:

- Asset Hub uses `AssetManagerPanel`.
- Image Studio uses `AssetManagerPanel`.
- Video Studio uses `AssetManagerPanel`.
- Music Studio uses `AssetManagerPanel`.
- 3D Studio stays separate as model package governance.

Next consolidation order:

1. Keep ordinary asset management changes inside `AssetManagerPanel`.
2. Keep model package state and package actions inside 3D governance.
3. Move repeated Studio controls into `components/studio/StudioKit.tsx`.
4. Remove user-facing raw internal labels from shared controls.
5. Verify each page after small migrations instead of rewriting the whole page.

Do not rewrite a whole page only for style cleanup. Migrate repeated controls in small, verifiable steps.
