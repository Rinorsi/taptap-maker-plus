import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const workspaceRoot = path.dirname(path.dirname(scriptPath));
const localFeedDir = path.join(workspaceRoot, "update-feed");
const worktreeDir = path.join(workspaceRoot, ".update-feed-worktree");
const feedBranch = "updates-feed";

if (!fs.existsSync(path.join(localFeedDir, "app-update-manifest.json"))) {
  throw new Error("本地 update-feed/app-update-manifest.json 不存在，无法发布更新源。");
}

run("git", ["fetch", "origin", feedBranch], { allowFailure: true });
fs.rmSync(worktreeDir, { recursive: true, force: true });

const hasRemoteFeed = run("git", ["rev-parse", "--verify", `origin/${feedBranch}`], { allowFailure: true }).status === 0;
if (hasRemoteFeed) {
  run("git", ["worktree", "add", worktreeDir, `origin/${feedBranch}`]);
  run("git", ["-C", worktreeDir, "switch", "-C", feedBranch]);
} else {
  run("git", ["worktree", "add", "--detach", worktreeDir, "HEAD"]);
  run("git", ["-C", worktreeDir, "switch", "--orphan", feedBranch]);
  removeAllFiles(worktreeDir);
}

syncUpdates();
run("git", ["-C", worktreeDir, "add", "."]);
const diff = run("git", ["-C", worktreeDir, "diff", "--cached", "--quiet"], { allowFailure: true });
if (diff.status === 0) {
  console.log(JSON.stringify({ ok: true, branch: feedBranch, changed: false }, null, 2));
  cleanup();
  process.exit(0);
}

run("git", ["-C", worktreeDir, "commit", "-m", "chore: update app feed"]);
run("git", ["-C", worktreeDir, "push", "origin", `${feedBranch}:${feedBranch}`]);
console.log(JSON.stringify({ ok: true, branch: feedBranch, changed: true }, null, 2));
cleanup();

function syncUpdates() {
  removeAllFiles(worktreeDir);
  fs.cpSync(localFeedDir, worktreeDir, { recursive: true });
}

function removeAllFiles(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
  for (const entry of fs.readdirSync(directoryPath)) {
    if (entry === ".git") continue;
    fs.rmSync(path.join(directoryPath, entry), { recursive: true, force: true });
  }
}

function cleanup() {
  run("git", ["worktree", "remove", "--force", worktreeDir], { allowFailure: true });
}

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
