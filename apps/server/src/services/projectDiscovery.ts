import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../lib/config.js";
import { upsertProject } from "../lib/db.js";
import type { ProjectSummary } from "../types.js";

type MakerConfig = {
  project_id: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
};

async function readJson<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return undefined;
  }
}

export async function scanMakerProjects(root = config.makerProjectsRoot): Promise<ProjectSummary[]> {
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const projects: ProjectSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projectRoot = path.join(root, entry.name);
    const configPath = path.join(projectRoot, ".maker-mcp", "config.json");
    const makerConfig = await readJson<MakerConfig>(configPath);
    if (!makerConfig?.project_id) continue;

    const project: ProjectSummary = {
      id: makerConfig.project_id,
      name: entry.name,
      rootPath: projectRoot,
      makerProjectId: makerConfig.project_id,
      configPath,
      createdAt: makerConfig.created_at,
      updatedAt: makerConfig.updated_at
    };
    upsertProject(project);
    projects.push(project);
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
}
