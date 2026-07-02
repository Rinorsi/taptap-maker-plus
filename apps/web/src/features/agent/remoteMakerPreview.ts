export type MakerPreviewBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
};

export function isMakerPreviewWebViewAvailable() {
  return "__TAURI_INTERNALS__" in window;
}

export function makerPreviewUrl(projectId: string) {
  return `https://maker.taptap.cn/app/${encodeURIComponent(projectId)}?hide_chat=1&tab=preview`;
}

async function invokeMakerPreview(command: string, args?: Record<string, unknown>) {
  if (!isMakerPreviewWebViewAvailable()) {
    throw new Error("当前运行在浏览器预览环境，桌面端原生 WebView 不可用。");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke(command, args);
}

export async function openMakerPreview(projectId: string) {
  return invokeMakerPreview("maker_preview_open", { projectId });
}

export async function openMakerPreviewLogin(projectId: string) {
  return invokeMakerPreview("maker_preview_open_login", { projectId });
}

export async function closeMakerPreviewLogin() {
  return invokeMakerPreview("maker_preview_close_login");
}

export async function confirmMakerPreviewLoggedIn(projectId: string) {
  return invokeMakerPreview("maker_preview_confirm_logged_in", { projectId });
}

export async function setMakerPreviewBounds(bounds: MakerPreviewBounds) {
  return invokeMakerPreview("maker_preview_set_bounds", {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    scaleFactor: bounds.scaleFactor,
  });
}

export async function setMakerPreviewTheme(theme: "light" | "dark") {
  return invokeMakerPreview("maker_preview_set_theme", { theme });
}

export async function hideMakerPreview() {
  return invokeMakerPreview("maker_preview_hide");
}

export async function showMakerPreview() {
  return invokeMakerPreview("maker_preview_show");
}

export async function closeMakerPreview() {
  return invokeMakerPreview("maker_preview_close");
}

export async function reloadMakerPreview() {
  return invokeMakerPreview("maker_preview_reload");
}
