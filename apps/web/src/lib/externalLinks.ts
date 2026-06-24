export async function openExternalUrl(url: string) {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_external_url", { url });
    return;
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
