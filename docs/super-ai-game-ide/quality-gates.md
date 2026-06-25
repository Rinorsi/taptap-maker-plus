# Quality Gates

## 1. Universal Rule

No feature is complete until it is verified against:

- current repo files;
- exact MCP schema;
- user-visible UI behavior;
- raw result or task evidence when execution is involved.

## 2. Schema Gates

Before mapping a field:

- [ ] read current `tools/list` or persisted `tools.json`;
- [ ] copy exact tool name;
- [ ] copy exact field name;
- [ ] copy exact required list;
- [ ] copy exact enum values;
- [ ] confirm field nesting;
- [ ] confirm result fields from raw result before extracting them.

Forbidden:

- guessing field names;
- lowercasing or camelCasing by convention;
- mapping future fields into current payload;
- treating public docs as proof of Maker MCP schema.

## 3. Canvas Gates

Before marking a canvas feature complete:

- [ ] node size stays stable;
- [ ] text does not overflow controls;
- [ ] payload/source panels scroll internally;
- [ ] result nodes are reusable;
- [ ] field source can locate nodes;
- [ ] validation issue can locate nodes;
- [ ] saved canvas can reload;
- [ ] asset identity survives reload;
- [ ] missing material paths show errors before execution;
- [ ] raw result remains inspectable.

## 4. Media Gates

Image:

- [ ] `generate_image` uses exact schema fields.
- [ ] `edit_image` uses exact schema fields.
- [ ] mask/outpaint/remove-object UI cannot submit unsupported fields.
- [ ] result image becomes reusable node.

Video:

- [ ] all four `create_video_task` modes compile valid payloads.
- [ ] invalid material combinations are blocked before execution.
- [ ] `workspace_video_path` is shown when returned.
- [ ] `workspace_last_frame_path` becomes reusable.
- [ ] `query_video_task` interval respects schema guidance.

Audio:

- [ ] `text_to_music` simple mode works with `prompt`.
- [ ] custom mode requires `title` and `style`.
- [ ] audio result becomes reusable audio node.
- [ ] audio reference cannot be used alone for video multimodal mode.

3D:

- [ ] `create_3d_model_task` mode rules are visible.
- [ ] text/image two-phase flows require explicit user confirmation before phase 2.
- [ ] `query_3d_model_task` uses real `task_id`.
- [ ] model preview does not claim unsupported conversion.

## 5. Runtime And Agent Gates

- [ ] browser does not spawn MCP.
- [ ] Agent does not call MCP directly.
- [ ] Fastify owns action execution.
- [ ] `executeToolCall` remains the shared MCP execution path.
- [ ] credit-spending work requires confirmation.
- [ ] file mutation requires confirmation.
- [ ] runtime start/stop/restart requires confirmation.
- [ ] raw result is preserved.
- [ ] task ID is preserved for long tasks.

## 6. Asset Governance Gates

- [ ] generated assets are scanned or indexed.
- [ ] delete/move/rename uses reference scan where relevant.
- [ ] remove record and delete local folder are separate.
- [ ] file operations show exact paths.
- [ ] destructive file actions require explicit confirmation.

## 7. Documentation Gates

For every implemented phase:

- [ ] update relevant docs in this folder;
- [ ] update `docs/NEXT_THREAD_HANDOFF.md` if the project state changes materially;
- [ ] keep `docs/README.md` as the current entry point;
- [ ] move historical/obsolete plans to archive if needed;
- [ ] do not leave stale instructions as active contracts.

## 8. Verification Commands

When code changes are made, run the current repo verification chain unless the change is docs-only:

```powershell
npm run typecheck
npm run verify:assets
npm run build
```

For docs-only changes, verify:

- files exist;
- links from docs index exist;
- required headings are present;
- no unsupported capability is described as implemented.

## 9. Final Completion Prompt

Before telling the user a development phase is done, answer:

```text
What exact repo files changed?
What exact MCP schema fields were used?
What command or UI check verified it?
What remains unsupported?
Can the user safely continue from here?
```

