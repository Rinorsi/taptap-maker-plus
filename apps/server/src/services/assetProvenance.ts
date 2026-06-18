import { randomUUID } from "node:crypto";
import path from "node:path";
import { listAssets, listGenerations, listTasks, listWorkflowRuns, replaceAssetProvenance } from "../lib/db.js";
import type { AssetProvenanceSummary, AssetSummary, GenerationRecord, ProjectSummary, TaskRecord, WorkflowRunRecord } from "../types.js";

function normalizePathText(value: string) {
  return value.replaceAll("\\", "/");
}

function textIncludesPath(text: string, asset: AssetSummary): AssetProvenanceSummary["matchedBy"] | undefined {
  const normalizedText = normalizePathText(text);
  if (normalizedText.includes(asset.relativePath)) return "relative_path";
  if (normalizedText.includes(normalizePathText(asset.absolutePath))) return "absolute_path";
  return undefined;
}

function safeJson(value: string | undefined) {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

function extractPrompt(inputJson?: string) {
  const parsed = safeJson(inputJson);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const prompt = (parsed as { prompt?: unknown }).prompt;
    if (typeof prompt === "string") return prompt;
  }
  return undefined;
}

function sourceTextForTask(task: TaskRecord) {
  return [task.inputJson, task.rawResultJson, task.errorMessage].filter(Boolean).join("\n");
}

function sourceTextForGeneration(generation: GenerationRecord) {
  return [generation.inputJson, generation.rawResultJson, generation.errorMessage].filter(Boolean).join("\n");
}

function idFromParts(parts: Array<string | undefined>) {
  return parts.map((part) => part ?? "none").join(":");
}

function taskRecord(projectId: string, asset: AssetSummary, task: TaskRecord, matchedBy: AssetProvenanceSummary["matchedBy"]): AssetProvenanceSummary {
  return {
    id: idFromParts([projectId, asset.relativePath, "task", task.taskId]),
    projectId,
    assetId: asset.id,
    assetRelativePath: asset.relativePath,
    sourceType: "task",
    sourceId: task.taskId,
    toolName: task.toolName,
    inputSummary: task.inputSummary,
    prompt: extractPrompt(task.inputJson),
    matchedBy,
    sourceCreatedAt: task.startedAt,
    createdAt: new Date().toISOString()
  };
}

function generationRecord(projectId: string, asset: AssetSummary, generation: GenerationRecord, matchedBy: AssetProvenanceSummary["matchedBy"]): AssetProvenanceSummary {
  return {
    id: idFromParts([projectId, asset.relativePath, "generation", generation.id]),
    projectId,
    assetId: asset.id,
    assetRelativePath: asset.relativePath,
    sourceType: "generation",
    sourceId: generation.id,
    toolName: generation.toolName,
    prompt: extractPrompt(generation.inputJson),
    matchedBy,
    sourceCreatedAt: generation.createdAt,
    createdAt: new Date().toISOString()
  };
}

function workflowRunRecord(projectId: string, asset: AssetSummary, run: WorkflowRunRecord, nodeId: string | undefined, toolName: string | undefined, matchedBy: AssetProvenanceSummary["matchedBy"]): AssetProvenanceSummary {
  return {
    id: idFromParts([projectId, asset.relativePath, "workflow_run", run.id, nodeId ?? randomUUID()]),
    projectId,
    assetId: asset.id,
    assetRelativePath: asset.relativePath,
    sourceType: "workflow_run",
    sourceId: run.id,
    workflowRunId: run.id,
    workflowNodeId: nodeId,
    toolName,
    matchedBy,
    sourceCreatedAt: run.createdAt,
    createdAt: new Date().toISOString()
  };
}

export function rebuildAssetProvenance(project: ProjectSummary): AssetProvenanceSummary[] {
  const assets = listAssets(project.id, 1000);
  const tasks = listTasks(project.id, 1000);
  const generations = listGenerations(project.id, 1000);
  const workflowRuns = listWorkflowRuns(project.id, 1000);
  const records: AssetProvenanceSummary[] = [];

  for (const asset of assets) {
    for (const task of tasks) {
      const matchedBy = textIncludesPath(sourceTextForTask(task), asset);
      if (matchedBy) records.push(taskRecord(project.id, asset, task, matchedBy));
    }

    for (const generation of generations) {
      const matchedBy = textIncludesPath(sourceTextForGeneration(generation), asset);
      if (matchedBy) records.push(generationRecord(project.id, asset, generation, matchedBy));
    }

    for (const run of workflowRuns) {
      const runText = JSON.stringify(run);
      const matchedBy = textIncludesPath(runText, asset);
      if (!matchedBy) continue;
      const node = run.nodeResults.find((result) => {
        const nodeText = [result.inputJson, result.rawResultJson, result.errorMessage].filter(Boolean).join("\n");
        return !!textIncludesPath(nodeText, asset);
      });
      records.push(workflowRunRecord(project.id, asset, run, node?.nodeId, node?.toolName, matchedBy));
    }
  }

  replaceAssetProvenance(project.id, dedupe(records));
  return records;
}

function dedupe(records: AssetProvenanceSummary[]) {
  const seen = new Set<string>();
  const output: AssetProvenanceSummary[] = [];
  for (const record of records) {
    const key = path.posix.join(record.projectId, record.assetRelativePath, record.sourceType, record.sourceId, record.workflowNodeId ?? "none");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(record);
  }
  return output;
}
