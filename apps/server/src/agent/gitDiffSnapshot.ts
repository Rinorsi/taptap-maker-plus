import { execa } from "execa";
import { buildManagedRuntimeEnv, config } from "../lib/config.js";
import { getProject } from "../lib/db.js";

export type AgentGitDiffScope = "workspace" | "project";

export type AgentGitDiffSnapshot = {
  scope: AgentGitDiffScope;
  cwd: string;
  generatedAt: string;
  status: string;
  stat: string;
  diff: string;
  truncated: boolean;
  exitCode?: number;
  stderr: string;
  durationMs: number;
};

const MAX_DIFF_LENGTH = 80_000;

export async function readAgentGitDiffSnapshot(input: {
  scope?: AgentGitDiffScope;
  projectId?: string;
}): Promise<AgentGitDiffSnapshot> {
  const scope = input.scope ?? "workspace";
  const cwd = scope === "project" && input.projectId
    ? getProject(input.projectId)?.rootPath ?? config.workspaceRoot
    : config.workspaceRoot;
  const startedAt = Date.now();
  const env = buildManagedRuntimeEnv();
  const [status, stat, diff] = await Promise.all([
    runGit(["status", "--short", "--branch"], cwd, env),
    runGit(["diff", "--stat"], cwd, env),
    runGit(["diff", "--no-ext-diff", "--unified=3", "--"], cwd, env)
  ]);
  const rawDiff = diff.stdout;
  const trimmedDiff = trimDiff(rawDiff);
  return {
    scope,
    cwd,
    generatedAt: new Date().toISOString(),
    status: status.stdout,
    stat: stat.stdout,
    diff: trimmedDiff.value,
    truncated: trimmedDiff.truncated,
    exitCode: firstExitCode(status.exitCode, stat.exitCode, diff.exitCode),
    stderr: cleanGitWarnings([status.stderr, stat.stderr, diff.stderr].filter(Boolean).join("\n")),
    durationMs: Date.now() - startedAt
  };
}

async function runGit(args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const result = await execa("git", args, {
    cwd,
    env,
    timeout: 20_000,
    reject: false
  });
  return {
    exitCode: result.exitCode,
    stdout: trimOutput(result.stdout),
    stderr: trimOutput(result.stderr)
  };
}

function trimDiff(value: string) {
  if (value.length <= MAX_DIFF_LENGTH) return { value, truncated: false };
  return {
    value: `${value.slice(0, 30_000)}\n\n... diff truncated ...\n\n${value.slice(-45_000)}`,
    truncated: true
  };
}

function trimOutput(value: string) {
  const maxLength = 40_000;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, 16_000)}\n\n... output truncated ...\n\n${value.slice(-20_000)}`;
}

function firstExitCode(...codes: Array<number | undefined>) {
  return codes.find((code) => code !== 0);
}

function cleanGitWarnings(value: string) {
  return value
    .split(/\r?\n/)
    .filter((line) => !/warning: in the working copy of '.+', LF will be replaced by CRLF the next time Git touches it/.test(line))
    .join("\n")
    .trim();
}
