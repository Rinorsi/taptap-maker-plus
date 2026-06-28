import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const workspaceRoot = path.dirname(path.dirname(scriptPath));
const localFeedDir = path.join(workspaceRoot, "update-feed");
const worktreeDir = path.join(workspaceRoot, ".update-feed-worktree");
const feedBranch = "updates-feed";

run("git", ["fetch", "origin", feedBranch]);
fs.rmSync(worktreeDir, { recursive: true, force: true });
run("git", ["worktree", "add", "--detach", worktreeDir, `origin/${feedBranch}`]);

fs.rmSync(localFeedDir, { recursive: true, force: true });
fs.mkdirSync(localFeedDir, { recursive: true });
for (const entry of fs.readdirSync(worktreeDir)) {
  if (entry === ".git") continue;
  fs.cpSync(path.join(worktreeDir, entry), path.join(localFeedDir, entry), { recursive: true });
}

run("git", ["worktree", "remove", "--force", worktreeDir], { allowFailure: true });
console.log(JSON.stringify({ ok: true, branch: feedBranch, output: "update-feed" }, null, 2));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}${result.stderr}`.trim());
  }
  return result;
}
