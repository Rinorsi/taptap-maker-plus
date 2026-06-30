import { execa } from "execa";
import { buildManagedRuntimeEnv, config } from "../lib/config.js";
import { getProject } from "../lib/db.js";

export type AgentTerminalSnapshotCommandId = "workspace_status" | "node_version" | "npm_version" | "git_status" | "where_node_npm_npx" | "npm_cache_config";

export type AgentTerminalSnapshot = {
  commandId: AgentTerminalSnapshotCommandId;
  label: string;
  cwd: string;
  command: string;
  args: string[];
  displayCommand?: string;
  displayArgs?: string[];
  exitCode?: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  generatedAt: string;
};

const COMMANDS: Record<AgentTerminalSnapshotCommandId, { label: string; command: string; args: string[]; timeoutMs: number; displayCommand?: string; displayArgs?: string[] }> = {
  workspace_status: {
    label: "工作区 Git 状态",
    command: "git",
    args: ["status", "--short", "--branch"],
    timeoutMs: 15_000
  },
  node_version: {
    label: "Node 版本",
    command: config.nodeCommand,
    args: ["--version"],
    timeoutMs: 10_000
  },
  npm_version: {
    label: "npm 版本",
    command: config.npmCommand,
    args: ["--version"],
    timeoutMs: 10_000
  },
  git_status: {
    label: "项目 Git 状态",
    command: "git",
    args: ["status", "--short", "--branch"],
    timeoutMs: 15_000
  },
  where_node_npm_npx: {
    label: "Node/npm/npx 路径",
    command: config.nodeCommand,
    args: ["-e", [
      "const { spawnSync } = require('node:child_process');",
      "const fs = require('node:fs');",
      "const path = require('node:path');",
      `const commands = ${JSON.stringify([config.nodeCommand, config.npmCommand, config.npxCommand])};`,
      "for (const command of commands) {",
      "  console.log(`# ${command}`);",
      "  if (path.isAbsolute(command)) {",
      "    console.log(fs.existsSync(command) ? command : '<not found>');",
      "    continue;",
      "  }",
      "  const probe = process.platform === 'win32' ? spawnSync('where.exe', [command], { encoding: 'utf8' }) : spawnSync('sh', ['-lc', `command -v ${JSON.stringify(command)}`], { encoding: 'utf8' });",
      "  console.log((probe.stdout || '').trim() || '<not found>');",
      "  if (probe.status !== 0 && (probe.stderr || '').trim()) console.error(probe.stderr.trim());",
      "}"
    ].join("\n")],
    displayCommand: "managed-runtime",
    displayArgs: ["where", "node", "npm", "npx"],
    timeoutMs: 10_000
  },
  npm_cache_config: {
    label: "npm cache 配置",
    command: config.npmCommand,
    args: ["config", "get", "cache"],
    timeoutMs: 10_000
  }
};

export async function runAgentTerminalSnapshot(input: {
  commandId: AgentTerminalSnapshotCommandId;
  projectId?: string;
}): Promise<AgentTerminalSnapshot> {
  const definition = COMMANDS[input.commandId];
  const cwd = input.commandId === "git_status" && input.projectId
    ? getProject(input.projectId)?.rootPath ?? config.workspaceRoot
    : config.workspaceRoot;
  const startedAt = Date.now();
  const result = await execa(definition.command, definition.args, {
    cwd,
    env: buildManagedRuntimeEnv(),
    timeout: definition.timeoutMs,
    reject: false
  });
  return {
    commandId: input.commandId,
    label: definition.label,
    cwd,
    command: definition.command,
    args: definition.args,
    displayCommand: definition.displayCommand,
    displayArgs: definition.displayArgs,
    exitCode: result.exitCode,
    stdout: trimOutput(result.stdout),
    stderr: trimOutput(result.stderr),
    durationMs: Date.now() - startedAt,
    generatedAt: new Date().toISOString()
  };
}

function trimOutput(value: string) {
  const maxLength = 24_000;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, 4_000)}\n...\n${value.slice(-18_000)}`;
}
