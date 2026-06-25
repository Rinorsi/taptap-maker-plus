# Goals And Completion Checklist

## 1. North Star

Build a local AI game creation IDE that turns Maker MCP tools into a coherent production workspace:

- creators arrange materials and intent on a multimodal canvas;
- the canvas compiles to exact MCP payload JSON;
- every submitted field shows where it came from;
- generated results become reusable material nodes;
- project runtime, logs, schemas, assets, history, and Agent context stay visible and auditable;
- destructive or credit-spending work always has explicit confirmation.

## 2. Definition Of Done

The project can be called "done for this product stage" only when all items below are checked with real evidence.

### Stage A - Video Multimodal Canvas

- [ ] Asset nodes show real image/video/audio thumbnails or waveform previews where supported.
- [ ] Asset nodes keep stable material identity through `relativePath` or other exact backend identity, not display name.
- [ ] Asset nodes expose usage labels: role, scene, style, composition, action, camera, rhythm, background music, first frame, last frame.
- [ ] Prompt text supports structured material tokens such as `@图1`, `@视频1`, `@音频1`.
- [ ] Token insertion binds material node ID, not plain visible text only.
- [ ] Clicking a token locates the material node.
- [ ] Clicking a material node shows which prompt nodes reference it.
- [ ] Payload node has tabs for compiled JSON, field source, validation issues, and raw execution result.
- [ ] Payload field source list truncates long values and uses internal scrolling.
- [ ] Payload issues can locate the broken node.
- [ ] `create_video_task` modes are validated from real schema: `text_to_video`, `first_frame`, `first_last_frame`, `multi_modal_reference`.
- [ ] Result node supports video preview and last-frame preview.
- [ ] `workspace_last_frame_path` can become the next video's first-frame node.
- [ ] Long-running video tasks show task ID, status, polling interval, raw result, and retry guidance.

### Stage B - Global Canvas Capability Layer

- [ ] Shared canvas model owns node identity, material references, structured tokens, compile result, field sources, issues, and result assets.
- [ ] Video multimodal canvas uses the shared model.
- [ ] All-in-one canvas uses the shared model.
- [ ] Existing saved flow formats are versioned and migration-safe.
- [ ] Shared result extraction covers image, video, audio, model, and video last-frame assets.
- [ ] Shared Inspector renders preview, MCP field mapping, references, history, errors, raw result, and actions.
- [ ] Shared execution path never bypasses Fastify and `executeToolCall`.

### Stage C - All-In-One Canvas

- [ ] `generate_image` node chain supports prompt, name, aspect_ratio, target_size, transparent, reference_images, seed, thinking_level, resolution, model.
- [ ] `edit_image` node chain supports image, prompt, name, target_size, aspect_ratio, transparent, reference_images, seed, thinking_level, resolution, model.
- [ ] `create_video_task` node chain supports exact real schema fields and result reuse.
- [ ] `text_to_music` node chain supports prompt, customMode, instrumental, model, style, title, negativeTags, vocalGender.
- [ ] `create_3d_model_task` is added only after shared canvas types and compile rules support real 3D schema.
- [ ] `query_3d_model_task` is represented as a task polling/follow-up node, not as a normal generation node.
- [ ] Unsupported future fields such as image mask/outpaint are disabled unless real schema exposes them.

### Stage D - Homepage, Settings, Runtime, Agent, Plugin

- [ ] Homepage project cards show project path, `project_id`, config presence, runtime status, tools count, and last scan time.
- [ ] Settings page becomes a real settings center, not only a large runtime status card.
- [ ] Runtime/binding/log status lives primarily in the right Inspector and can be expanded when needed.
- [ ] Agent actions are separated into observe, draft, and execute modes.
- [ ] Any action that writes files, spends credits, starts runtime, calls MCP, refreshes tools, runs workflows, builds, pushes, clears tasks, moves assets, or deletes assets requires an action preview and user confirmation.
- [ ] Plugin system has manifest, permissions, enable/disable, config scope, version compatibility, and uninstall path before third-party plugins are allowed.

## 3. Final Audit Question

After each implementation phase, answer this before moving on:

```text
Can this phase be marked complete with current repo evidence, exact MCP schema evidence, and user-visible workflow evidence?
```

If the answer is not yes, do not call the phase complete.

