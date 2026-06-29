import fs from "node:fs";
import path from "node:path";
import { config } from "../lib/config.js";

export type CachedMakerPackage = {
  packageName: string;
  packageDir: string;
  packageJsonPath: string;
  version: string;
  binPath?: string;
  shimPath?: string;
};

export function extractPackageName(packageSpec: string) {
  const trimmed = packageSpec.trim();
  if (trimmed.startsWith("@")) {
    const [scope, nameAndVersion] = trimmed.split("/");
    const name = nameAndVersion?.split("@")[0];
    return scope && name ? `${scope}/${name}` : trimmed;
  }
  return trimmed.split("@")[0] || trimmed;
}

export function extractPackageVersionToken(packageSpec: string) {
  const trimmed = packageSpec.trim();
  if (trimmed.startsWith("@")) {
    const version = trimmed.split("/")[1]?.split("@")[1];
    return version || undefined;
  }
  const version = trimmed.split("@")[1];
  return version || undefined;
}

export function findCachedMakerPackage(packageSpec = config.makerPackage, cacheRoot = config.makerNpmCacheDir): CachedMakerPackage | undefined {
  const packageName = extractPackageName(packageSpec);
  const requestedVersion = extractPackageVersionToken(packageSpec);
  const packageJsonPath = findCachedPackageJson(cacheRoot, packageName, requestedVersion);
  if (!packageJsonPath) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { bin?: unknown; name?: unknown; version?: unknown };
    if (parsed.name !== packageName || typeof parsed.version !== "string" || !parsed.version.trim()) return undefined;
    const packageDir = path.dirname(packageJsonPath);
    const bin = parsed.bin && typeof parsed.bin === "object" && !Array.isArray(parsed.bin)
      ? parsed.bin as Record<string, unknown>
      : undefined;
    const binRelativePath = typeof bin?.["taptap-maker"] === "string" ? bin["taptap-maker"] : undefined;
    const binPath = binRelativePath ? path.resolve(packageDir, binRelativePath) : undefined;
    const packageNodeModulesDir = findAncestorNodeModules(packageDir);
    const shimPath = packageNodeModulesDir
      ? path.join(packageNodeModulesDir, ".bin", process.platform === "win32" ? "taptap-maker.cmd" : "taptap-maker")
      : undefined;
    return {
      packageName,
      packageDir,
      packageJsonPath,
      version: parsed.version.trim(),
      binPath: binPath && fs.existsSync(binPath) ? binPath : undefined,
      shimPath: shimPath && fs.existsSync(shimPath) ? shimPath : undefined,
    };
  } catch {
    return undefined;
  }
}

function findCachedPackageJson(cacheRoot: string, packageName: string, requestedVersion?: string) {
  const npxRoot = path.join(cacheRoot, "_npx");
  if (!fs.existsSync(npxRoot) || !fs.statSync(npxRoot).isDirectory()) return undefined;
  const stack = [npxRoot];
  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
        continue;
      }
      if (!entry.isFile() || entry.name !== "package.json") continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(entryPath, "utf8")) as { name?: unknown; version?: unknown };
        if (parsed.name === packageName && (!requestedVersion || parsed.version === requestedVersion)) return entryPath;
      } catch {
        continue;
      }
    }
  }
  return undefined;
}

function findAncestorNodeModules(packageDir: string) {
  let current = packageDir;
  while (current && current !== path.dirname(current)) {
    if (path.basename(current) === "node_modules") return current;
    current = path.dirname(current);
  }
  return undefined;
}
