export type WorkbenchModule = "home" | "assets" | "studio-image" | "studio-video" | "studio-music" | "studio-3d" | "workflow" | "build" | "runs" | "settings";

export const workbenchRoutes: Array<{ id: WorkbenchModule; label: string; shortLabel: string }> = [
  { id: "home", label: "首页", shortLabel: "主页" },
  { id: "assets", label: "资产库", shortLabel: "资产库" },
  { id: "studio-image", label: "图像工作室", shortLabel: "作图" },
  { id: "studio-video", label: "视频工作室", shortLabel: "视频" },
  { id: "studio-music", label: "音频工作室", shortLabel: "作曲" },
  { id: "studio-3d", label: "3D 工作室", shortLabel: "3D" },
  { id: "workflow", label: "节点流", shortLabel: "流" },
  { id: "build", label: "构建中心", shortLabel: "构建" },
  { id: "runs", label: "运行记录", shortLabel: "记录" },
  { id: "settings", label: "设置", shortLabel: "设置" },
];
