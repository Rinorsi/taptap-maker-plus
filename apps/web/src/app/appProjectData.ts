import {
  getAssetTree,
  getMakerProjectsRootSettings,
  getRuntimeStatus,
  getAssetTree as loadAssetTree,
  listAssets,
  listProjects,
  listTasks,
  listTools,
  scanProjects,
  type AssetDirectoryNode,
  type AssetSummary,
  type MakerProjectsRootSettings,
  type ProjectSummary,
  type RuntimeSummary,
  type TaskRecord,
  type ToolSummary,
} from "../api";

export const BOOTSTRAP_RETRY_DELAYS_MS = [800, 1200, 1800, 2600, 3600];

export type ProjectRefreshData = {
  project?: ProjectSummary;
  runtime?: RuntimeSummary;
  tools?: ToolSummary[];
  assets: AssetSummary[];
  assetTree?: AssetDirectoryNode;
  tasks: TaskRecord[];
};

export async function loadMakerProjectsRootSettingsWithRetry(
  onRetry?: (attempt: number, maxAttempts: number) => void,
): Promise<MakerProjectsRootSettings> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= BOOTSTRAP_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return (await getMakerProjectsRootSettings()).settings;
    } catch (error) {
      lastError = error;
      if (attempt >= BOOTSTRAP_RETRY_DELAYS_MS.length) break;
      onRetry?.(attempt + 1, BOOTSTRAP_RETRY_DELAYS_MS.length);
      await sleep(BOOTSTRAP_RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

export async function loadBootstrapDataWithRetry(
  onRetry?: (attempt: number, maxAttempts: number) => void,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= BOOTSTRAP_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const [stored, scanned] = await Promise.all([
        listProjects(),
        scanProjects(),
      ]);
      return { stored, scanned };
    } catch (error) {
      lastError = error;
      if (attempt >= BOOTSTRAP_RETRY_DELAYS_MS.length) break;
      onRetry?.(attempt + 1, BOOTSTRAP_RETRY_DELAYS_MS.length);
      await sleep(BOOTSTRAP_RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

export async function loadProjectRefreshData(projectId: string): Promise<ProjectRefreshData> {
  const [status, toolData, assetList, assetTree, taskList] = await Promise.all([
    getRuntimeStatus(projectId).catch(() => undefined),
    listTools(projectId).catch(() => undefined),
    listAssets(projectId).catch(() => []),
    getAssetTree(projectId).catch(() => undefined),
    listTasks(projectId).catch(() => []),
  ]);
  return {
    project: status?.project,
    runtime: toolData?.runtime ?? status?.runtime ?? status?.project.runtime,
    tools: toolData?.tools,
    assets: assetList,
    assetTree,
    tasks: taskList,
  };
}

export async function loadProjectAssets(projectId: string) {
  const [assets, assetTree] = await Promise.all([
    listAssets(projectId).catch(() => []),
    loadAssetTree(projectId).catch(() => undefined),
  ]);
  return { assets, assetTree };
}

export async function loadProjectAssetTree(projectId: string) {
  return getAssetTree(projectId).catch(() => undefined);
}

export async function loadTaskList() {
  return listTasks().catch(() => []);
}

export function hasRunningTasks(tasks: TaskRecord[]) {
  return tasks.some((task) => task.status === "running" || task.status === "queued");
}

export function hasGenerationRefreshTrigger({
  previousTasks,
  nextTasks,
  generationTools,
}: {
  previousTasks: TaskRecord[];
  nextTasks: TaskRecord[];
  generationTools: string[];
}) {
  const previousTaskById = new Map(previousTasks.map((task) => [task.taskId, task]));
  const hasGenerationWork = [...previousTasks, ...nextTasks].some(
    (task) =>
      generationTools.includes(task.toolName) &&
      (task.status === "running" || task.status === "queued"),
  );
  const hasCompletedGeneration = nextTasks.some((task) => {
    const previous = previousTaskById.get(task.taskId);
    return (
      generationTools.includes(task.toolName) &&
      task.status === "succeeded" &&
      (previous?.status === "running" || previous?.status === "queued")
    );
  });
  return hasGenerationWork || hasCompletedGeneration;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
