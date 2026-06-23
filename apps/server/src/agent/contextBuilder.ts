import {
  getProject,
  getSelectedProjectId,
  getToolsListSnapshot,
  listAssets,
  listCreditRecords,
  listGenerations,
  listProjects,
  listTasks,
  listTools,
  listWorkflowGraphs,
  listWorkflowRuns
} from "../lib/db.js";
import { runtimeManager } from "../services/mcpRuntime.js";
import { getProjectBuildLogs } from "../services/projectLogs.js";
import type { AgentContextSnapshot, AgentPageState, ProjectSummary } from "../types.js";

const TOOL_LIMIT = 80;
const TASK_LIMIT = 40;
const GENERATION_LIMIT = 30;
const ASSET_LIMIT = 80;
const WORKFLOW_LIMIT = 30;
const WORKFLOW_RUN_LIMIT = 30;
const CREDIT_LIMIT = 40;

export type BuildAgentContextInput = {
  projectId?: string;
  page?: AgentPageState;
};

function withRuntime(project: ProjectSummary): ProjectSummary {
  return { ...project, runtime: runtimeManager.getSummary(project.id) };
}

function compactBuildLogs(project: ProjectSummary) {
  const logs = getProjectBuildLogs(project);
  return {
    ...logs,
    buildLogs: logs.buildLogs.slice(0, 5).map((entry) => ({
      ...entry,
      rawText: entry.rawText.slice(-12_000),
      file: {
        ...entry.file,
        tailLines: entry.file.tailLines.slice(-40)
      }
    })),
    runtime: {
      ...logs.runtime,
      runtimeLog: logs.runtime.runtimeLog
        ? { ...logs.runtime.runtimeLog, tailLines: logs.runtime.runtimeLog.tailLines.slice(-40) }
        : undefined,
      watcherOut: logs.runtime.watcherOut
        ? { ...logs.runtime.watcherOut, tailLines: logs.runtime.watcherOut.tailLines.slice(-40) }
        : undefined,
      watcherErr: logs.runtime.watcherErr
        ? { ...logs.runtime.watcherErr, tailLines: logs.runtime.watcherErr.tailLines.slice(-40) }
        : undefined
    }
  };
}

export function buildAgentContext(input: BuildAgentContextInput = {}): AgentContextSnapshot {
  const selectedProjectId = getSelectedProjectId();
  const projectId = input.projectId ?? selectedProjectId;
  const projects = listProjects().map(withRuntime);
  const project = projectId ? getProject(projectId) : undefined;
  const projectWithRuntime = project ? withRuntime(project) : undefined;
  const toolsListSnapshot = project ? getToolsListSnapshot(project.id) : undefined;
  const tools = project ? listTools(project.id).slice(0, TOOL_LIMIT) : [];
  const tasks = listTasks(project?.id, TASK_LIMIT);
  const generations = project ? listGenerations(project.id, GENERATION_LIMIT) : [];
  const assets = project ? listAssets(project.id, { limit: ASSET_LIMIT }) : [];
  const workflows = project ? listWorkflowGraphs(project.id, WORKFLOW_LIMIT) : [];
  const workflowRuns = project ? listWorkflowRuns(project.id, WORKFLOW_RUN_LIMIT) : [];
  const credits = listCreditRecords(project?.id, CREDIT_LIMIT);
  const buildLogs = project ? compactBuildLogs(project) : undefined;

  return {
    generatedAt: new Date().toISOString(),
    selectedProjectId,
    page: input.page ?? {},
    project: projectWithRuntime,
    projects,
    runtime: project ? runtimeManager.getSummary(project.id) : undefined,
    tools,
    toolsListSnapshot: toolsListSnapshot
      ? { projectId: toolsListSnapshot.projectId, updatedAt: toolsListSnapshot.updatedAt }
      : undefined,
    tasks,
    generations,
    assets,
    workflows,
    workflowRuns,
    credits,
    buildLogs,
    counts: {
      projects: projects.length,
      tools: tools.length,
      tasks: tasks.length,
      generations: generations.length,
      assets: assets.length,
      workflows: workflows.length,
      workflowRuns: workflowRuns.length,
      credits: credits.length,
      buildLogs: buildLogs?.buildLogs.length ?? 0
    }
  };
}
