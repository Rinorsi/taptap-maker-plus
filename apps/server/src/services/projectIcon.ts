import fs from "node:fs";
import path from "node:path";
import type { ProjectSummary } from "../types.js";

type GameProjectConfig = {
  assets?: {
    icon?: unknown;
    icon_url?: unknown;
  };
  taptap_publish?: {
    title?: unknown;
  };
};

const PROJECT_CONFIG_RELATIVE_PATH = [".project", "project.json"];
const FALLBACK_ICON_RELATIVE_PATH = ["game_material", "icon.png"];

function isSafeProjectPath(projectRoot: string, targetPath: string) {
  const root = path.resolve(projectRoot);
  const target = path.resolve(targetPath);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function readGameProjectConfig(projectRoot: string): GameProjectConfig | undefined {
  const configPath = path.join(projectRoot, ...PROJECT_CONFIG_RELATIVE_PATH);
  if (!fs.existsSync(configPath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as GameProjectConfig;
  } catch {
    return undefined;
  }
}

export function resolveProjectDisplayName(project: Pick<ProjectSummary, "rootPath" | "name">): string {
  const projectRoot = path.resolve(project.rootPath);
  const gameConfig = readGameProjectConfig(projectRoot);
  const title = gameConfig?.taptap_publish?.title;
  if (typeof title !== "string") return project.name;
  const trimmed = title.trim();
  return trimmed || project.name;
}

function resolveConfiguredIconPath(projectRoot: string, iconPath: string) {
  const resolved = path.resolve(projectRoot, iconPath);
  if (!isSafeProjectPath(projectRoot, resolved)) return undefined;
  return resolved;
}

export function resolveProjectIconPath(project: Pick<ProjectSummary, "rootPath">): string | undefined {
  const projectRoot = path.resolve(project.rootPath);
  const gameConfig = readGameProjectConfig(projectRoot);
  const configuredIcon = gameConfig?.assets?.icon;

  if (typeof configuredIcon === "string" && configuredIcon.trim()) {
    const resolved = resolveConfiguredIconPath(projectRoot, configuredIcon.trim());
    if (resolved && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return resolved;
  }

  const fallbackPath = path.join(projectRoot, ...FALLBACK_ICON_RELATIVE_PATH);
  if (fs.existsSync(fallbackPath) && fs.statSync(fallbackPath).isFile()) return fallbackPath;
  return undefined;
}

export function resolveProjectRemoteIconUrl(project: Pick<ProjectSummary, "rootPath">): string | undefined {
  const projectRoot = path.resolve(project.rootPath);
  const gameConfig = readGameProjectConfig(projectRoot);
  const remoteIconUrl = gameConfig?.assets?.icon_url;
  if (typeof remoteIconUrl !== "string") return undefined;
  const trimmed = remoteIconUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  return trimmed;
}

export function withProjectIconUrl<T extends ProjectSummary>(project: T): T {
  const iconPath = resolveProjectIconPath(project);
  const displayName = resolveProjectDisplayName(project);
  const projectWithDisplayName = displayName === project.name ? project : { ...project, name: displayName };
  if (!iconPath) {
    const remoteIconUrl = resolveProjectRemoteIconUrl(project);
    return remoteIconUrl ? { ...projectWithDisplayName, iconUrl: remoteIconUrl } : projectWithDisplayName;
  }
  return {
    ...projectWithDisplayName,
    iconUrl: `/api/projects/${encodeURIComponent(project.id)}/icon`
  };
}
