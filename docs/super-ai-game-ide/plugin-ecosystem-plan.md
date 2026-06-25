# Plugin Ecosystem Plan

## 1. Direction

The plugin system should make the workbench extensible without letting plugins bypass the local MCP and project safety model.

Plugins should extend:

- canvas nodes;
- asset importers;
- templates;
- inspectors;
- Agent draft skills;
- exporters;
- local validators;
- MCP tool adapters only through approved server-side contracts.

Plugins must not directly call Maker MCP from the browser.

## 2. Current Repo State

Current repo has related pieces, but not a formal plugin system:

- canvas node presets and tool definitions in `apps/web/src/features/generation/nodeRegistry.ts` and `apps/web/src/features/canvas-core/toolRegistry.ts`;
- saved canvas flows under project `assets/flows`;
- workflow graph tables and routes in server database/API;
- `WorkflowCanvas.tsx` retained for old workflow data and internal diagnostics;
- schema-driven forms through `@rjsf/core`;
- command palette and context menu infrastructure;
- asset governance, asset scanning, and provenance tracking.

No current evidence of:

- plugin manifest;
- plugin registry;
- plugin install/uninstall;
- plugin permission model;
- plugin sandbox;
- plugin signature/source trust;
- plugin compatibility checks.

## 3. External Ecosystem References

Use these as product references:

- VS Code contribution points:
  - explicit extension manifest;
  - menus, commands, languages, views, debuggers, themes, snippets;
  - contribution points are declared, not arbitrary.
- Obsidian plugins:
  - plugin manifest;
  - app-level API;
  - community plugin enable/disable model.
- ComfyUI custom nodes:
  - node packages as extension units;
  - graph-oriented node registration.
- Figma plugins:
  - plugin manifest;
  - UI iframe separation;
  - host/plugin API boundary.
- Tauri capabilities:
  - permission-based desktop capability model;
  - commands and windows are not implicitly available everywhere.

## 4. Plugin Types

### Canvas Node Pack

Adds:

- node definitions;
- port definitions;
- validation logic;
- Inspector panel;
- preview renderer;
- template examples.

Must not add MCP fields unless the tool schema supports them.

### MCP Tool Adapter

Adds:

- UI mapping for a real MCP tool;
- schema display hints;
- compile function;
- validation;
- result extraction hints.

The adapter must call Fastify action routes, not direct MCP.

### Asset Importer

Adds:

- import source;
- accepted file types;
- metadata extraction;
- preview generation;
- target folder suggestion.

Must use asset governance confirmation for write/move/delete.

### Template Pack

Adds:

- canvas templates;
- frame templates;
- project starter packs;
- prompt presets;
- style/character bibles.

Template packs cannot execute actions during install.

### Inspector Extension

Adds:

- side panel view;
- diagnostics view;
- asset metadata view;
- raw result renderer.

Must be read-only unless it creates action previews.

### Agent Skill Pack

Adds:

- observe/draft instructions;
- prompt reviewers;
- validators;
- checklist generators.

Must not execute. Execution goes through main approval queue.

### Exporter

Adds:

- storyboard export;
- prompt package export;
- asset bundle export;
- run report export.

Must declare file write permissions.

## 5. Manifest Shape

This is a proposed contract, not current code.

Required fields should include:

- `id`;
- `name`;
- `version`;
- `publisher`;
- `description`;
- `entry`;
- `compatibility`;
- `contributes`;
- `permissions`;
- `config`;
- `homepage`;
- `repository`;
- `license`.

Do not implement until exact runtime and packaging decisions are made.

## 6. Permission Model

Permission groups:

- read project metadata;
- read assets;
- write assets;
- read source files;
- write source files;
- read logs;
- call MCP tools;
- spend credits;
- start runtime;
- run workflow;
- build project;
- network access;
- open external URLs;
- access local filesystem outside project.

Default:

- no write permission;
- no MCP call permission;
- no network permission;
- no outside-project filesystem permission.

All risky permissions require install-time disclosure and per-action approval.

## 7. Scope Model

Configuration scopes:

- app/global;
- workspace;
- project;
- plugin instance;
- canvas file.

Project scope should override global scope where appropriate. Sensitive values should not be stored in canvas JSON.

## 8. Security Model

P0:

- local first-party plugin registry only;
- plugin files packaged with the app or placed in a trusted dev folder;
- no third-party remote install;
- no arbitrary code execution in renderer;
- all actions go through declared host APIs;
- host validates permissions server-side.

P1:

- plugin enable/disable;
- plugin uninstall;
- compatibility check;
- version lock;
- source display;
- permission diff when updating.

P2:

- signed plugins;
- marketplace;
- review status;
- plugin crash isolation;
- telemetry opt-in;
- automatic vulnerability warnings.

## 9. P0 Implementation Plan

Do not start with a marketplace.

Start with first-party extension points:

- canvas node registry contribution;
- template registry contribution;
- Inspector renderer contribution;
- asset importer contribution;
- Agent draft skill contribution.

Add a plugin manifest parser only after the first-party extension points are stable.

## 10. P1 Implementation Plan

- Add plugin management page.
- Add install from local folder.
- Add enable/disable.
- Add permission review.
- Add compatibility warnings.
- Add plugin logs.

## 11. P2 Implementation Plan

- Add signed plugin packages.
- Add marketplace/catalog.
- Add plugin update flow.
- Add sandbox worker/runtime if arbitrary third-party code is allowed.

## 12. Hard Rules

- Plugins cannot invent MCP fields.
- Plugins cannot call MCP directly.
- Plugins cannot write outside the selected project without explicit permission.
- Plugins cannot hide raw result or action preview.
- Plugins cannot auto-execute on install.
- Plugins must be disabled if manifest compatibility does not match the workbench version.

