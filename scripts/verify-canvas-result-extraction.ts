import assert from "node:assert/strict";
import {
  extractCanvasResultAssets,
  extractCanvasTaskId,
} from "../apps/web/src/features/canvas-core/resultExtraction";

const rawResult = {
  task_id: "cgt-video-001",
  structuredContent: {
    workspace_video_path: "assets/video/clip.mp4",
    workspace_last_frame_path: "assets/image/clip-last.png",
    workspace_image_path: "assets/image/generated.png",
    workspace_audio_path: "assets/audio/music.mp3",
    workspace_music_path: "assets/audio/loop.wav",
    workspace_model_path: "assets/model/hero.glb",
    workspace_model_paths: ["assets/model/hero-lod.glb"],
    localPath: "assets/image/clear_anime_first_frame_20260625162032.png",
    rendered_image_url: "https://example.test/render.png",
    confirmed_image_paths: {
      front: "assets/image/front.png",
      left: "assets/image/left.png",
      back: "assets/image/back.png",
      right: "assets/image/right.png",
    },
  },
};

const assets = extractCanvasResultAssets(rawResult);

assert.equal(extractCanvasTaskId(rawResult), "cgt-video-001");
assert.deepEqual(
  assets.map((asset) => `${asset.kind}:${asset.role}:${asset.path}`),
  [
    "video:video_result:assets/video/clip.mp4",
    "image:last_frame:assets/image/clip-last.png",
    "image:image_result:assets/image/generated.png",
    "image:image_result:assets/image/clear_anime_first_frame_20260625162032.png",
    "audio:audio_result:assets/audio/music.mp3",
    "audio:audio_result:assets/audio/loop.wav",
    "model:model_result:assets/model/hero.glb",
    "model:model_result:assets/model/hero-lod.glb",
    "image:model_preview:https://example.test/render.png",
    "image:model_front_view:assets/image/front.png",
    "image:model_left_view:assets/image/left.png",
    "image:model_back_view:assets/image/back.png",
    "image:model_right_view:assets/image/right.png",
  ],
);

console.log("canvas result extraction verified");
