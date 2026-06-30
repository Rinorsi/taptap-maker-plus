import { getCurrentWindow } from "@tauri-apps/api/window";
import { type WorkbenchModule } from "./routes";
import {
  defaultWorkspaceToModule,
  readStoredPreference,
  type DefaultWorkspace,
  type PanelPreference,
  type StartupPreference,
  type ThemePreference,
} from "../features/settings/preferences";

export function resolveThemePreference(preference: ThemePreference): "light" | "dark" {
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveInitialModule(hasProject: boolean) {
  const startupPreference = readStoredPreference("startupPreference") as StartupPreference;
  const defaultWorkspace = readStoredPreference("defaultWorkspace") as DefaultWorkspace;
  if (!hasProject) return "home";
  if (startupPreference === "home" || startupPreference === "home-picker") return "home";
  return defaultWorkspaceToModule(defaultWorkspace);
}

export function resolveDefaultProjectModule() {
  return defaultWorkspaceToModule(readStoredPreference("defaultWorkspace") as DefaultWorkspace);
}

function readWindowMinimumSize() {
  const width = Number(readStoredPreference("windowMinimumWidth"));
  const height = Number(readStoredPreference("windowMinimumHeight"));
  return {
    minWidth: Number.isFinite(width) ? Math.max(1024, Math.round(width)) : 1366,
    minHeight: Number.isFinite(height) ? Math.max(640, Math.round(height)) : 768,
  };
}

export function applyWindowMinimumSize() {
  if (!("__TAURI_INTERNALS__" in window)) return;
  const size = readWindowMinimumSize();
  void getCurrentWindow().setSizeConstraints(size).catch(() => undefined);
}

export function isDeveloperOnlyModule(module: WorkbenchModule) {
  return module === "studio-canvas" || module === "runs" || module === "build";
}

export function resolvePanelCollapsed(preference: PanelPreference, storageKey: string) {
  if (preference === "expanded") return false;
  if (preference === "collapsed") return true;
  return localStorage.getItem(storageKey) === "true";
}

export function clearTapTapLocalState() {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("taptap.")) localStorage.removeItem(key);
  }
}
