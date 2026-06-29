import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const runtimeRoot = path.join(os.tmpdir(), "TapTap Maker Plus Runtime Check", "node-runtime");
const cacheRoot = path.join(os.tmpdir(), "TapTap Maker Plus Runtime Check", "npm-cache");
fs.mkdirSync(runtimeRoot, { recursive: true });
fs.writeFileSync(path.join(runtimeRoot, process.platform === "win32" ? "node.exe" : "node"), "");
fs.writeFileSync(path.join(runtimeRoot, process.platform === "win32" ? "npm.cmd" : "npm"), "");
fs.writeFileSync(path.join(runtimeRoot, process.platform === "win32" ? "npx.cmd" : "npx"), "");

process.env.TAPTAP_NODE_RUNTIME_DIR = runtimeRoot;
process.env.TAPTAP_MAKER_NPM_CACHE_DIR = cacheRoot;

const { buildMcpRuntimeLaunchCommand } = await import("../apps/server/src/services/mcpRuntime.ts");
const launch = buildMcpRuntimeLaunchCommand();

assert.equal(launch.command, path.join(runtimeRoot, process.platform === "win32" ? "npx.cmd" : "npx"));
assert.deepEqual(launch.args, ["-y", "-p", "@taptap/maker", "taptap-maker"]);
assert.notEqual(path.basename(launch.command).toLowerCase(), "cmd.exe");
assert(!launch.args.includes("/c"));
assert(launch.command.includes(" "));

console.log(JSON.stringify({
  ok: true,
  command: launch.command,
  args: launch.args,
}, null, 2));
