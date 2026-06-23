import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const outputRoot = path.join(workspaceRoot, "desktop-dist");

const requiredRuntimePaths = [
  "apps/server/dist",
  "apps/server/package.json",
  "apps/web/dist"
];

function run(command, args) {
  const usesCmdShim = process.platform === "win32" && command === "npm";
  const executable = usesCmdShim ? "cmd.exe" : command;
  const spawnArgs = usesCmdShim ? ["/d", "/s", "/c", "npm.cmd", ...args] : args;
  const result = spawnSync(executable, spawnArgs, {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    const details = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(`${command} ${args.join(" ")} failed${details ? `\n${details}` : ""}`);
  }
  return result.stdout.trim();
}

function copyRelative(relativePath) {
  const source = path.join(workspaceRoot, relativePath);
  const target = path.join(outputRoot, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Missing desktop resource source: ${relativePath}`);
  }
  fs.cpSync(source, target, { recursive: true, dereference: true });
}

function copyPackage(packagePath) {
  const relativePath = path.relative(workspaceRoot, packagePath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Unexpected dependency path outside workspace: ${packagePath}`);
  }
  copyRelative(relativePath);
}

fs.rmSync(outputRoot, { recursive: true, force: true });

for (const relativePath of requiredRuntimePaths) {
  copyRelative(relativePath);
}

const dependencyPaths = run("npm", ["ls", "--workspace", "@taptap/server", "--omit=dev", "--parseable", "--all"])
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((line) => line !== workspaceRoot && line !== path.join(workspaceRoot, "node_modules", "@taptap", "server"));

for (const dependencyPath of dependencyPaths) {
  copyPackage(dependencyPath);
}

console.log(JSON.stringify({
  ok: true,
  outputRoot: path.relative(workspaceRoot, outputRoot).replaceAll(path.sep, "/"),
  dependencies: dependencyPaths.length
}, null, 2));
