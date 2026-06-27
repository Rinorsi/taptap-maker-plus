import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { config } from "../lib/config.js";
import { setSelectedProject, upsertProject } from "../lib/db.js";
import { readMakerProjectAt, scanMakerProjects } from "./projectDiscovery.js";
import type { ProjectSummary } from "../types.js";

export type MakerCliResult = {
  ok: boolean;
  exitCode?: number;
  stdout: string;
  stderr: string;
  json?: unknown;
};

export type MakerOnboardingProjectResult = {
  cli: MakerCliResult;
  project: ProjectSummary;
  targetDir: string;
  doctorPassed?: boolean;
  warning?: string;
};

export type MakerCloudProject = {
  id: string;
  name: string;
  userId?: string;
  user_id?: string;
  createdAt?: string;
  lastAccessedAt?: string | null;
  lastConversationAt?: string | null;
  pinnedAt?: string | null;
  stage?: string;
  gameType?: string;
};

function parseCliJson(stdout: string): unknown | undefined {
  const trimmed = stdout.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

async function runMakerCli(args: string[], options: { cwd?: string; timeout?: number; input?: string } = {}): Promise<MakerCliResult> {
  await fs.mkdir(config.makerNpmCacheDir, { recursive: true });
  const result = await execa("npm.cmd", ["exec", "--yes", "--package", config.makerPackage, "--", "taptap-maker", ...args], {
    cwd: options.cwd ?? config.workspaceRoot,
    env: {
      ...process.env,
      npm_config_cache: config.makerNpmCacheDir,
      NPM_CONFIG_CACHE: config.makerNpmCacheDir
    },
    input: options.input,
    timeout: options.timeout ?? 120_000,
    reject: false
  });

  return {
    ok: !result.failed,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    json: parseCliJson(result.stdout)
  };
}

function ensureMakerCliSucceeded(result: MakerCliResult, action: string) {
  if (result.ok) return;
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  throw new Error(output || `${action} failed with exit code ${result.exitCode ?? "unknown"}`);
}

function makerCliFailureMessage(result: MakerCliResult, action: string) {
  return [result.stdout, result.stderr].filter(Boolean).join("\n").trim() || `${action} failed with exit code ${result.exitCode ?? "unknown"}`;
}

async function bindProjectRoot(targetDir: string): Promise<ProjectSummary> {
  const projectRoot = path.resolve(targetDir);
  const project = await readMakerProjectAt(projectRoot);
  if (!project) {
    throw new Error(`目录不是有效 Maker 项目，缺少 .maker-mcp/config.json 或 project_id：${projectRoot}`);
  }
  upsertProject(project);
  setSelectedProject(project.id);
  return project;
}

function normalizeCloudProjects(value: unknown): MakerCloudProject[] {
  if (!Array.isArray(value)) return [];
  const projects: MakerCloudProject[] = [];
  for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const source = item as Record<string, unknown>;
      const id = typeof source.id === "string" ? source.id : "";
      const name = typeof source.name === "string" ? source.name : id;
      if (!id || !name) continue;
      projects.push({
        id,
        name,
        userId: typeof source.userId === "string" ? source.userId : undefined,
        user_id: typeof source.user_id === "string" ? source.user_id : undefined,
        createdAt: typeof source.createdAt === "string" ? source.createdAt : undefined,
        lastAccessedAt: typeof source.lastAccessedAt === "string" || source.lastAccessedAt === null ? source.lastAccessedAt : undefined,
        lastConversationAt: typeof source.lastConversationAt === "string" || source.lastConversationAt === null ? source.lastConversationAt : undefined,
        pinnedAt: typeof source.pinnedAt === "string" || source.pinnedAt === null ? source.pinnedAt : undefined,
        stage: typeof source.stage === "string" ? source.stage : undefined,
        gameType: typeof source.gameType === "string" ? source.gameType : undefined
      });
  }
  return projects;
}

function sanitizeDirectoryName(value: string) {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 80) || "MakerProject";
}

export function resolveMakerCloudProjectTargetDir(projectName: string, targetDir?: string) {
  return targetDir?.trim()
    ? path.resolve(targetDir)
    : path.join(config.makerProjectsRoot, sanitizeDirectoryName(projectName));
}

export function resolveMakerCloudProjectTarget(projects: MakerCloudProject[], appId: string, targetDir?: string) {
  const cloudProject = projects.find((project) => project.id === appId);
  if (!cloudProject) throw new Error(`未在 Maker 云端项目列表中找到项目：${appId}`);
  const projectRoot = resolveMakerCloudProjectTargetDir(cloudProject.name, targetDir);
  return { cloudProject, targetDir: projectRoot };
}

export async function loginMaker(): Promise<MakerCliResult> {
  const result = await runMakerCli(["login", "--json"], { timeout: 180_000 });
  ensureMakerCliSucceeded(result, "Maker login");
  return result;
}

export async function setMakerToken(token: string): Promise<MakerCliResult> {
  const trimmedToken = token.trim();
  if (!trimmedToken) throw new Error("Maker Token 不能为空。");
  const result = await runMakerCli(["pat", "set", "--pat-stdin", "--json"], {
    input: `${trimmedToken}\n`,
    timeout: 120_000
  });
  ensureMakerCliSucceeded(result, "Maker token setup");
  return result;
}

export async function listMakerCloudProjects(): Promise<{ cli: MakerCliResult; projects: MakerCloudProject[] }> {
  const result = await runMakerCli(["apps", "--json"], { timeout: 120_000 });
  ensureMakerCliSucceeded(result, "Maker apps");
  return { cli: result, projects: normalizeCloudProjects(result.json) };
}

export async function initMakerProject(targetDir: string, appId?: string): Promise<MakerOnboardingProjectResult> {
  const projectRoot = path.resolve(targetDir);
  await fs.mkdir(projectRoot, { recursive: true });
  const args = ["init", "--target-dir", projectRoot, "--json"];
  if (appId) args.splice(1, 0, "--app-id", appId);
  const result = await runMakerCli(args, { timeout: 180_000 });
  ensureMakerCliSucceeded(result, "Maker init");
  return { cli: result, project: await bindProjectRoot(projectRoot), targetDir: projectRoot };
}

export async function initMakerCloudProject(appId: string, targetDir?: string): Promise<MakerOnboardingProjectResult> {
  const { projects } = await listMakerCloudProjects();
  const target = resolveMakerCloudProjectTarget(projects, appId, targetDir);
  return initMakerProject(target.targetDir, appId);
}

export async function bindExistingMakerProject(targetDir: string): Promise<MakerOnboardingProjectResult> {
  const projectRoot = path.resolve(targetDir);
  const result = await runMakerCli(["doctor", "--target-dir", projectRoot, "--json"], { timeout: 120_000 });
  if (!result.ok) {
    const project = await bindProjectRoot(projectRoot).catch(() => undefined);
    if (!project) {
      ensureMakerCliSucceeded(result, "Maker doctor");
      throw new Error(makerCliFailureMessage(result, "Maker doctor"));
    }
    return {
      cli: result,
      project,
      targetDir: projectRoot,
      doctorPassed: false,
      warning: makerCliFailureMessage(result, "Maker doctor")
    };
  }
  return { cli: result, project: await bindProjectRoot(projectRoot), targetDir: projectRoot, doctorPassed: true };
}

export async function scanExistingMakerProjects(rootDir?: string): Promise<ProjectSummary[]> {
  return scanMakerProjects(rootDir ? path.resolve(rootDir) : config.makerProjectsRoot);
}
