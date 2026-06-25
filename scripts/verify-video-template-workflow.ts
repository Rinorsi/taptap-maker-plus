import { createVideoReferenceTemplate } from "../apps/web/src/features/canvas-core/templates";
import { createSharedCanvasModel } from "../apps/web/src/features/canvas-core/model";

const template = createVideoReferenceTemplate(123456789);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function node(idPrefix: string) {
  const found = template.nodes.find((item) => item.id.startsWith(idPrefix));
  assert(found, `missing node: ${idPrefix}`);
  return found;
}

const imageResult = node("image-result-");
imageResult.data = {
  ...imageResult.data,
  resultAssets: [
    {
      kind: "image",
      role: "image_result",
      path: "assets/image/clear_anime_first_frame_20260626010101.png",
    },
  ],
};

const audioResult = node("music-result-");
audioResult.data = {
  ...audioResult.data,
  resultAssets: [
    {
      kind: "audio",
      role: "audio_result",
      path: "assets/audio/clear_anime_bgm_20260626010101.mp3",
    },
  ],
};

const videoExecutor = node("task-");
const resultBeforeReferences = createSharedCanvasModel(template.nodes, template.edges, videoExecutor.id).compileResult;
assert(!resultBeforeReferences.ok, "video payload should wait for explicit reference nodes");
assert(
  resultBeforeReferences.issues.some((issue) => issue.message.includes("至少需要一个参考素材")),
  "video payload should not treat result nodes as references",
);

template.nodes.push(
  {
    id: "explicit-image-reference",
    type: "mediaNode",
    position: { x: 1900, y: 120 },
    data: {
      presetId: "CharacterImageNode",
      role: "character_image",
      referenceUse: "character",
      referenceId: "explicit-image-reference",
      alias: "图1",
      relativePath: "assets/image/clear_anime_first_frame_20260626010101.png",
      fileName: "clear_anime_first_frame_20260626010101.png",
    },
  },
  {
    id: "explicit-audio-reference",
    type: "mediaNode",
    position: { x: 1900, y: 730 },
    data: {
      presetId: "RhythmAudioNode",
      role: "rhythm_audio",
      referenceUse: "rhythm",
      referenceId: "explicit-audio-reference",
      alias: "音频1",
      relativePath: "assets/audio/clear_anime_bgm_20260626010101.mp3",
      fileName: "clear_anime_bgm_20260626010101.mp3",
    },
  },
);
template.edges.push(
  { id: "e-explicit-image-reference-payload", source: "explicit-image-reference", target: node("payload-").id, animated: false, type: "custom" },
  { id: "e-explicit-audio-reference-payload", source: "explicit-audio-reference", target: node("payload-").id, animated: false, type: "custom" },
);

const model = createSharedCanvasModel(template.nodes, template.edges, videoExecutor.id);
const result = model.compileResult;

assert(result.ok, `video template payload failed: ${result.issues.map((issue) => issue.message).join("; ")}`);
assert(result.toolName === "create_video_task", "template should compile create_video_task");
assert(result.payload?.mode === "multi_modal_reference", "video mode should be multi_modal_reference");
assert(Array.isArray(result.payload?.images), "video payload should include images");
assert(Array.isArray(result.payload?.audios), "video payload should include audios");
assert(result.payload.images.length === 1, "video payload should include one generated image");
assert(result.payload.audios.length === 1, "video payload should include one generated audio");
assert(result.payload.images[0].url === "assets/image/clear_anime_first_frame_20260626010101.png", "explicit image reference should feed video payload");
assert(result.payload.audios[0].url === "assets/audio/clear_anime_bgm_20260626010101.mp3", "explicit audio reference should feed video payload");

const imageExecutor = node("image-exec-");
const imageResultPayload = createSharedCanvasModel(template.nodes, template.edges, imageExecutor.id).compileResult;
assert(imageResultPayload.ok, `image payload failed: ${imageResultPayload.issues.map((issue) => issue.message).join("; ")}`);
assert(imageResultPayload.toolName === "generate_image", "image chain should compile generate_image");
assert(imageResultPayload.payload?.model === "nanobanana", "image chain should use nanobanana model");

const musicExecutor = node("music-exec-");
const musicResultPayload = createSharedCanvasModel(template.nodes, template.edges, musicExecutor.id).compileResult;
assert(musicResultPayload.ok, `music payload failed: ${musicResultPayload.issues.map((issue) => issue.message).join("; ")}`);
assert(musicResultPayload.toolName === "text_to_music", "music chain should compile text_to_music");

console.log("video template workflow verified");
