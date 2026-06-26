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

export async function initMakerProject(targetDir: string): Promise<MakerOnboardingProjectResult> {
  const projectRoot = path.resolve(targetDir);
  await fs.mkdir(projectRoot, { recursive: true });
  const result = await runMakerCli(["init", "--target-dir", projectRoot, "--json"], { timeout: 180_000 });
  ensureMakerCliSucceeded(result, "Maker init");
  return { cli: result, project: await bindProjectRoot(projectRoot) };
}

export async function bindExistingMakerProject(targetDir: string): Promise<MakerOnboardingProjectResult> {
  const projectRoot = path.resolve(targetDir);
  const result = await runMakerCli(["doctor", "--target-dir", projectRoot, "--json"], { timeout: 120_000 });
  ensureMakerCliSucceeded(result, "Maker doctor");
  return { cli: result, project: await bindProjectRoot(projectRoot) };
}

export async function scanExistingMakerProjects(rootDir?: string): Promise<ProjectSummary[]> {
  return scanMakerProjects(rootDir ? path.resolve(rootDir) : config.makerProjectsRoot);
}
