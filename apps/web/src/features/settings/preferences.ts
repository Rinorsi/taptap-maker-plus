import type { WorkbenchModule } from "../../app/routes";

export type ThemePreference = "system" | "light" | "dark";
export type StartupPreference = "last-project" | "home" | "home-picker";
export type DefaultWorkspace = "assets" | "studio-video" | "studio-image" | "studio-music" | "studio-3d";
export type DensityPreference = "comfortable" | "standard" | "compact";
export type PanelPreference = "remember" | "expanded" | "collapsed";
export type ConfirmationPreference = "standard" | "strict";
export type AutoRuntimePreference = "manual" | "selected-project";
export type LogRetentionPreference = "14d" | "30d" | "100mb" | "manual";
export type CanvasGridPreference = "visible" | "hidden";
export type CanvasMiniMapPreference = "visible" | "hidden";
export type CanvasAutoSavePreference = "on" | "off";
export type CanvasSidebarPreference = "keep" | "collapse-left" | "collapse-both";
export type CanvasLeavePreference = "keep" | "restore";
export type CodeEditorThemePreference = "app" | "dark" | "light" | "high-contrast" | "custom";
export type CodeEditorPalettePreference = "vscode-dark" | "github-light" | "monokai" | "custom";
export type CodeEditorFontSizePreference = "small" | "standard" | "large";
export type CodeEditorWrapPreference = "wrap" | "scroll";
export type CodeEditorLineNumbersPreference = "show" | "hide";
export type AssetDropPreference = "copy" | "ask";
export type AssetReferencePreference = "scan" | "skip";
export type TaskPanelPreference = "status" | "logs" | "errors";
export type TaskCompletionRefreshPreference = "on" | "off";
export type ImageDefaultMode = "generate" | "batch" | "edit";
export type ImageDefaultModel = "auto" | "nanobanana" | "gpt";
export type ImageDefaultResolution = "0.5K" | "1K" | "2K" | "4K";
export type ImageThinkingLevel = "minimal" | "high";
export type VideoDefaultMode = "text_to_video" | "first_frame" | "first_last_frame";
export type VideoDefaultResolution = "720p" | "480p";
export type VideoDefaultModel = "default" | "fast";
export type MusicDefaultModel = "V4_5" | "V5" | "V4_5PLUS" | "V4" | "V3_5";
export type MusicVocalGender = "m" | "f";
export type Model3DDefaultMode = "text_to_model" | "image_to_model" | "multiview_to_model";
export type Model3DSubjectType = "biped" | "quadruped" | "scenery" | "other";
export type Model3DTextureQuality = "standard" | "detailed";

export type SettingsPreferences = {
  themePreference: ThemePreference;
  startupPreference: StartupPreference;
  defaultWorkspace: DefaultWorkspace;
  density: DensityPreference;
  sidebarPreference: PanelPreference;
  inspectorPreference: PanelPreference;
  confirmationPreference: ConfirmationPreference;
  autoRuntime: AutoRuntimePreference;
  logRetention: LogRetentionPreference;
  failureNotifications: boolean;
  autoOpenErrors: boolean;
  openHiddenLegacyWorkspaces: boolean;
  canvasGrid: CanvasGridPreference;
  canvasMiniMap: CanvasMiniMapPreference;
  canvasAutoSave: CanvasAutoSavePreference;
  canvasSidebarBehavior: CanvasSidebarPreference;
  canvasLeaveBehavior: CanvasLeavePreference;
  codeEditorTheme: CodeEditorThemePreference;
  codeEditorPalette: CodeEditorPalettePreference;
  codeEditorFontSize: CodeEditorFontSizePreference;
  codeEditorWrap: CodeEditorWrapPreference;
  codeEditorLineNumbers: CodeEditorLineNumbersPreference;
  assetDropBehavior: AssetDropPreference;
  assetReferenceCheck: AssetReferencePreference;
  taskDefaultPanel: TaskPanelPreference;
  taskCompletionRefresh: TaskCompletionRefreshPreference;
  imageDefaultMode: ImageDefaultMode;
  imageTargetSize: string;
  imageAspectRatio: string;
  imageModel: ImageDefaultModel;
  imageResolution: ImageDefaultResolution;
  imageThinkingLevel: ImageThinkingLevel;
  videoDefaultMode: VideoDefaultMode;
  videoRatio: string;
  videoDuration: string;
  videoResolution: VideoDefaultResolution;
  videoModel: VideoDefaultModel;
  videoGenerateAudio: boolean;
  videoReturnLastFrame: boolean;
  videoEnableWebSearch: boolean;
  musicModel: MusicDefaultModel;
  musicInstrumental: boolean;
  musicVocalGender: MusicVocalGender;
  model3dDefaultMode: Model3DDefaultMode;
  model3dSubjectType: Model3DSubjectType;
  model3dRig: boolean;
  model3dFaceLimit: string;
  model3dTextureQuality: Model3DTextureQuality;
  model3dTransparent: boolean;
};

export const settingsPreferenceKeys = {
  themePreference: "taptap.settings.themePreference",
  startupPreference: "taptap.settings.startupPreference",
  defaultWorkspace: "taptap.settings.defaultWorkspace",
  density: "taptap.settings.density",
  sidebarPreference: "taptap.settings.sidebarPreference",
  inspectorPreference: "taptap.settings.inspectorPreference",
  confirmationPreference: "taptap.settings.confirmationPreference",
  autoRuntime: "taptap.settings.autoRuntime",
  logRetention: "taptap.settings.logRetention",
  failureNotifications: "taptap.settings.failureNotifications",
  autoOpenErrors: "taptap.settings.autoOpenErrors",
  openHiddenLegacyWorkspaces: "taptap.settings.openHiddenLegacyWorkspaces",
  canvasGrid: "taptap.settings.canvasGrid",
  canvasMiniMap: "taptap.settings.canvasMiniMap",
  canvasAutoSave: "taptap.settings.canvasAutoSave",
  canvasSidebarBehavior: "taptap.settings.canvasSidebarBehavior",
  canvasLeaveBehavior: "taptap.settings.canvasLeaveBehavior",
  codeEditorTheme: "taptap.settings.codeEditorTheme",
  codeEditorPalette: "taptap.settings.codeEditorPalette",
  codeEditorFontSize: "taptap.settings.codeEditorFontSize",
  codeEditorWrap: "taptap.settings.codeEditorWrap",
  codeEditorLineNumbers: "taptap.settings.codeEditorLineNumbers",
  assetDropBehavior: "taptap.settings.assetDropBehavior",
  assetReferenceCheck: "taptap.settings.assetReferenceCheck",
  taskDefaultPanel: "taptap.settings.taskDefaultPanel",
  taskCompletionRefresh: "taptap.settings.taskCompletionRefresh",
  imageDefaultMode: "taptap.settings.imageDefaultMode",
  imageTargetSize: "taptap.settings.imageTargetSize",
  imageAspectRatio: "taptap.settings.imageAspectRatio",
  imageModel: "taptap.settings.imageModel",
  imageResolution: "taptap.settings.imageResolution",
  imageThinkingLevel: "taptap.settings.imageThinkingLevel",
  videoDefaultMode: "taptap.settings.videoDefaultMode",
  videoRatio: "taptap.settings.videoRatio",
  videoDuration: "taptap.settings.videoDuration",
  videoResolution: "taptap.settings.videoResolution",
  videoModel: "taptap.settings.videoModel",
  videoGenerateAudio: "taptap.settings.videoGenerateAudio",
  videoReturnLastFrame: "taptap.settings.videoReturnLastFrame",
  videoEnableWebSearch: "taptap.settings.videoEnableWebSearch",
  musicModel: "taptap.settings.musicModel",
  musicInstrumental: "taptap.settings.musicInstrumental",
  musicVocalGender: "taptap.settings.musicVocalGender",
  model3dDefaultMode: "taptap.settings.model3dDefaultMode",
  model3dSubjectType: "taptap.settings.model3dSubjectType",
  model3dRig: "taptap.settings.model3dRig",
  model3dFaceLimit: "taptap.settings.model3dFaceLimit",
  model3dTextureQuality: "taptap.settings.model3dTextureQuality",
  model3dTransparent: "taptap.settings.model3dTransparent",
} as const;

export const SETTINGS_PREFERENCES_CHANGED_EVENT = "taptap:settings-preferences-changed";

export const defaultSettingsPreferences: SettingsPreferences = {
  themePreference: "system",
  startupPreference: "last-project",
  defaultWorkspace: "assets",
  density: "standard",
  sidebarPreference: "remember",
  inspectorPreference: "remember",
  confirmationPreference: "standard",
  autoRuntime: "manual",
  logRetention: "14d",
  failureNotifications: true,
  autoOpenErrors: true,
  openHiddenLegacyWorkspaces: false,
  canvasGrid: "visible",
  canvasMiniMap: "visible",
  canvasAutoSave: "on",
  canvasSidebarBehavior: "collapse-both",
  canvasLeaveBehavior: "keep",
  codeEditorTheme: "app",
  codeEditorPalette: "vscode-dark",
  codeEditorFontSize: "standard",
  codeEditorWrap: "wrap",
  codeEditorLineNumbers: "show",
  assetDropBehavior: "copy",
  assetReferenceCheck: "scan",
  taskDefaultPanel: "logs",
  taskCompletionRefresh: "on",
  imageDefaultMode: "generate",
  imageTargetSize: "1024x1024",
  imageAspectRatio: "1:1",
  imageModel: "auto",
  imageResolution: "1K",
  imageThinkingLevel: "minimal",
  videoDefaultMode: "text_to_video",
  videoRatio: "16:9",
  videoDuration: "5",
  videoResolution: "720p",
  videoModel: "default",
  videoGenerateAudio: false,
  videoReturnLastFrame: true,
  videoEnableWebSearch: false,
  musicModel: "V4_5",
  musicInstrumental: false,
  musicVocalGender: "f",
  model3dDefaultMode: "text_to_model",
  model3dSubjectType: "biped",
  model3dRig: true,
  model3dFaceLimit: "20000",
  model3dTextureQuality: "standard",
  model3dTransparent: false,
};

export const defaultWorkspaceLabels: Record<DefaultWorkspace, string> = {
  assets: "资产库",
  "studio-video": "视频工作室",
  "studio-image": "图像工作室",
  "studio-music": "音频工作室",
  "studio-3d": "3D 工作室",
};

export function readStoredPreference<K extends keyof SettingsPreferences>(key: K): SettingsPreferences[K] {
  return readLocalPreference(settingsPreferenceKeys[key], defaultSettingsPreferences[key]);
}

export function writeStoredPreference<K extends keyof SettingsPreferences>(key: K, value: SettingsPreferences[K]) {
  localStorage.setItem(settingsPreferenceKeys[key], JSON.stringify(value));
}

export function readLocalPreference<T>(key: string, initialValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return initialValue;
    const parsed = JSON.parse(stored);
    if (key === settingsPreferenceKeys.startupPreference && parsed === "ask") return "home-picker" as T;
    return parsed as T;
  } catch {
    return initialValue;
  }
}

export function writeLocalPreference<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(SETTINGS_PREFERENCES_CHANGED_EVENT, { detail: { key, value } }));
}

export function defaultWorkspaceToModule(value: DefaultWorkspace): WorkbenchModule {
  return value;
}
