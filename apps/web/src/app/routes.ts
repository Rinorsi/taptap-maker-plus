export type WorkbenchModule = "home" | "assets" | "studio-canvas" | "studio-image" | "studio-video" | "studio-music" | "studio-3d" | "workflow" | "build" | "runs" | "agent" | "settings";

// Legacy: hidden modules remain in the type union for old data/internal references,
// but are intentionally not surfaced in primary navigation.
// - studio-canvas: parked while the product focuses on the video canvas.
// - workflow: no current plan to revive as a visible workspace page.
// - runs: superseded by the right inspector task log panel.
export const workbenchRoutes: Array<{ id: WorkbenchModule; label: string; shortLabel: string }> = [
  { id: "home", label: "首页", shortLabel: "主页" },
  { id: "assets", label: "资产库", shortLabel: "资产库" },
  { id: "studio-image", label: "图像工作室", shortLabel: "作图" },
  { id: "studio-video", label: "视频工作室", shortLabel: "视频" },
  { id: "studio-music", label: "音频工作室", shortLabel: "作曲" },
  { id: "studio-3d", label: "3D 工作室", shortLabel: "3D" },
  { id: "build", label: "构建中心", shortLabel: "构建" },
  { id: "agent", label: "助手上下文", shortLabel: "助手" },
  { id: "settings", label: "设置", shortLabel: "设置" },
];
