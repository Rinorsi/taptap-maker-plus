# Asset Explorer SVAR Integration

Date: 2026-06-25

## Decision

Keep the existing Maker++ asset center UI as the primary product surface.

Use `@svar-ui/react-filemanager` as a capability reference and adapter validation layer for file-manager semantics such as tree data shape, operation events, context-menu extension, and multi-item mutation behavior.

Do not render the stock SVAR file manager as the asset center UI.

## Verified Package Facts

Verified from the installed local package:

- Package: `@svar-ui/react-filemanager`
- Version: `2.6.0`
- License: `MIT`
- Peer dependencies: `react >=18`, `react-dom >=18`
- Main export verified by Node ESM import: `Filemanager`
- Style exports: `@svar-ui/react-filemanager/style.css`, `@svar-ui/react-filemanager/all.css`

## Verified SVAR Extension Points

`Filemanager` exposes these integration points through its local TypeScript declarations:

- `data?: IEntity[]`
- `menuOptions?: (mode: TContextMenuType, item?: IParsedEntity) => IFileMenuOption[] | false`
- `extraInfo?: (file: IParsedEntity) => Promise<IExtraInfo> | IExtraInfo | null`
- `icons?: ((file, size) => string | false) | "simple"`
- `previews?: (file, width, height) => string | null`
- `init?: (api: IApi) => void`
- event props generated from `TMethodsConfig`

The store event names verified from `TMethodsConfig`:

- `create-file`
- `rename-file`
- `delete-files`
- `move-files`
- `copy-files`
- `open-file`
- `download-file`
- `request-data`
- `provide-data`

The event prop names remove hyphens and add the `on` prefix, for example:

- `oncreatefile`
- `onrenamefile`
- `ondeletefiles`
- `onmovefiles`
- `oncopyfiles`

## Path Mapping

SVAR uses `/` as its internal root and path-like IDs such as `/Music`.

Maker++ assets use project-relative paths such as `assets/image/foo.png`.

The adapter rule is:

```text
assets/image/foo.png -> /assets/image/foo.png
/assets/image/foo.png -> assets/image/foo.png
```

The current proof adapter lives at:

```text
apps/web/src/features/assets/svarAssetAdapter.ts
```

## Backend Contract Required For SVAR

SVAR can cover explorer UI and interactions, but Maker++ still owns the backend semantics:

- `POST /api/projects/:projectId/assets/folders/create`
- `POST /api/projects/:projectId/assets/folders/rename`
- `POST /api/projects/:projectId/assets/folders/move`
- `POST /api/projects/:projectId/assets/folders/delete`
- `POST /api/projects/:projectId/assets/folders/copy`
- extend `POST /api/projects/:projectId/assets/rename` with `updateReferences`
- extend `POST /api/projects/:projectId/assets/move` with `updateReferences`

The Maker++ UI should call these APIs directly or through local helpers that mirror the verified SVAR event semantics. SVAR default rendering must stay outside the primary asset-center entry.

## Headless Tree Gate

Do not add Headless Tree yet.

Add Headless Tree only if the existing Maker++ asset center cannot reliably cover one of these requirements after applying the verified file-manager semantics:

- directory tree cannot support the Maker++ visual hierarchy cleanly
- breadcrumb and directory drop behavior cannot be customized enough
- inline directory rename cannot match Explorer-like behavior
- multi-select tree operations become unreliable through SVAR alone

## Packaged Desktop Resources

The desktop package now has a read-only bundled-resource baseline:

- `docs/help`
- `docs/templates`
- `docs/workflow-templates`

These are copied into `desktop-dist` by `scripts/prepare-desktop-resources.mjs` and checked by `scripts/verify-desktop-readiness.ts`.
