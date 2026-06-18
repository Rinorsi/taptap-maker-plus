import fs from "node:fs";
import path from "node:path";
import type { ProjectBuildLogEntry, ProjectBuildLogsSummary, ProjectLogFileSummary, ProjectLogKeyValue, ProjectRuntimeLogSummary, ProjectSummary } from "../types.js";

const MAX_TAIL_BYTES = 96 * 1024;
const MAX_BUILD_BYTES = 160 * 1024;

function isSafeProjectPath(projectRoot: string, targetPath: string) {
  const root = path.resolve(projectRoot);
  const target = path.resolve(targetPath);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function knownProjectPath(project: ProjectSummary, segments: string[]) {
  const resolved = path.resolve(project.rootPath, ...segments);
  if (!isSafeProjectPath(project.rootPath, resolved)) throw new Error(`Unsafe project log path: ${segments.join("/")}`);
  return resolved;
}

function splitLines(text: string) {
  return text.replace(/\r\n/g, "\n").split("\n");
}

function tailLines(text: string, limit: number) {
  return splitLines(text).filter((line) => line.length > 0).slice(-limit);
}

function readTextTail(filePath: string, maxBytes = MAX_TAIL_BYTES) {
  const stat = fs.statSync(filePath);
  const size = stat.size;
  const bytesToRead = Math.min(size, maxBytes);
  const buffer = Buffer.alloc(bytesToRead);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buffer, 0, bytesToRead, Math.max(0, size - bytesToRead));
  } finally {
    fs.closeSync(fd);
  }
  return buffer.toString("utf8");
}

function readTextLimited(filePath: string, maxBytes = MAX_BUILD_BYTES) {
  const stat = fs.statSync(filePath);
  if (stat.size <= maxBytes) return fs.readFileSync(filePath, "utf8");
  return readTextTail(filePath, maxBytes);
}

function summarizeKnownFile(project: ProjectSummary, segments: string[], lineLimit = 80): ProjectLogFileSummary {
  const absolutePath = knownProjectPath(project, segments);
  const relativePath = path.relative(project.rootPath, absolutePath);
  if (!fs.existsSync(absolutePath)) {
    return {
      name: path.basename(absolutePath),
      relativePath,
      sizeBytes: 0,
      updatedAt: "",
      exists: false,
      tailLines: []
    };
  }

  try {
    const stat = fs.statSync(absolutePath);
    const text = stat.size > 0 ? readTextTail(absolutePath) : "";
    return {
      name: path.basename(absolutePath),
      relativePath,
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
      exists: true,
      tailLines: tailLines(text, lineLimit)
    };
  } catch (error) {
    return {
      name: path.basename(absolutePath),
      relativePath,
      sizeBytes: 0,
      updatedAt: "",
      exists: false,
      tailLines: [],
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function parseKeyValues(text: string): ProjectLogKeyValue[] {
  const values: ProjectLogKeyValue[] = [];
  let section: string | undefined;
  for (const rawLine of splitLines(text)) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) continue;

    const sectionMatch = /^([^:\n]{1,80}):$/.exec(trimmed);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }

    const keyValueMatch = /^-?\s*([^:\n]{1,80}):\s*(.*)$/.exec(trimmed);
    if (!keyValueMatch) continue;
    values.push({ key: keyValueMatch[1], value: keyValueMatch[2], section });
  }
  return values;
}

function buildFlags(text: string, keyValues: ProjectLogKeyValue[]) {
  const flags: string[] = [];
  for (const item of keyValues) {
    if (item.key === "stage") flags.push(`stage: ${item.value}`);
    if (item.key === "classification") flags.push(`classification: ${item.value}`);
    if (item.key === "retryable") flags.push(`retryable: ${item.value}`);
    if (item.key === "retry_reason") flags.push(`retry_reason: ${item.value}`);
    if (item.key === "exit_code") flags.push(`exit_code: ${item.value}`);
  }
  if (text.includes("HTTP 504")) flags.push("HTTP 504");
  if (text.includes("timed out awaiting tools/call")) flags.push("tools/call timeout");
  if (text.includes("remote build was not started")) flags.push("remote build not started");
  return Array.from(new Set(flags));
}

function summarizeBuildFile(project: ProjectSummary, filePath: string): ProjectBuildLogEntry {
  if (!isSafeProjectPath(project.rootPath, filePath)) throw new Error(`Unsafe build log path: ${filePath}`);
  const stat = fs.statSync(filePath);
  const text = readTextLimited(filePath);
  const lines = tailLines(text, 80);
  const heading = splitLines(text).find((line) => line.trim().length > 0)?.trim();
  const keyValues = parseKeyValues(text);
  return {
    file: {
      name: path.basename(filePath),
      relativePath: path.relative(project.rootPath, filePath),
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
      exists: true,
      tailLines: lines
    },
    heading,
    keyValues,
    rawText: text,
    flags: buildFlags(text, keyValues)
  };
}

function countRuntimeLevels(runtimeLog?: ProjectLogFileSummary) {
  const counts: Record<string, number> = {};
  for (const line of runtimeLog?.tailLines ?? []) {
    try {
      const parsed = JSON.parse(line) as { level?: unknown };
      if (typeof parsed.level === "string") counts[parsed.level] = (counts[parsed.level] ?? 0) + 1;
    } catch {
      // Runtime log tail can contain partial lines when read from a large file.
    }
  }
  return counts;
}

function runtimeSummary(project: ProjectSummary): ProjectRuntimeLogSummary {
  const stateFile = summarizeKnownFile(project, [".maker", "logs", "runtime", "state.json"], 20);
  const runtimeLog = summarizeKnownFile(project, [".maker", "logs", "runtime", "runtime.log"], 80);
  const watcherOut = summarizeKnownFile(project, [".maker", "logs", "runtime", "watcher.out.log"], 80);
  const watcherErr = summarizeKnownFile(project, [".maker", "logs", "runtime", "watcher.err.log"], 80);

  let state: Record<string, unknown> | undefined;
  let stateParseError: string | undefined;
  const statePath = knownProjectPath(project, [".maker", "logs", "runtime", "state.json"]);
  if (fs.existsSync(statePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(statePath, "utf8")) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) state = parsed as Record<string, unknown>;
    } catch (error) {
      stateParseError = error instanceof Error ? error.message : String(error);
    }
  }

  return { stateFile, state, stateParseError, runtimeLog, watcherOut, watcherErr, levelCounts: countRuntimeLevels(runtimeLog) };
}

export function getProjectBuildLogs(project: ProjectSummary): ProjectBuildLogsSummary {
  const buildDir = knownProjectPath(project, [".maker", "logs", "build"]);
  const buildLogs = fs.existsSync(buildDir)
    ? fs.readdirSync(buildDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".txt"))
      .map((entry) => path.join(buildDir, entry.name))
      .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
      .slice(0, 12)
      .map((filePath) => summarizeBuildFile(project, filePath))
    : [];

  return {
    projectId: project.id,
    projectName: project.name,
    projectRoot: project.rootPath,
    generatedAt: new Date().toISOString(),
    runtime: runtimeSummary(project),
    buildLogs
  };
}
