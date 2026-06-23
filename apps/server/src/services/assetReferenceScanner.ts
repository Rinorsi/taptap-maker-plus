import fs from "node:fs/promises";
import path from "node:path";
import type { AssetReferenceEvidence, AssetReferenceScanResult, AssetReferenceSourceType } from "../types.js";
import { normalizeProjectPath } from "./assetGovernance.js";

type ScanSource = {
  sourceType: AssetReferenceSourceType;
  sourcePath: string;
  absolutePath: string;
};

function projectFile(rootPath: string, relativePath: string) {
  return path.join(rootPath, ...relativePath.split("/"));
}

function isSafeProjectRelativePath(relativePath: string) {
  const normalized = normalizeProjectPath(relativePath).trim();
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) return false;
  return !normalized.split("/").some((segment) => segment === "" || segment === "." || segment === "..");
}

async function walkFiles(rootPath: string, relativeDir: string, extension: string, sourceType: AssetReferenceSourceType): Promise<ScanSource[]> {
  const startDir = projectFile(rootPath, relativeDir);
  const output: ScanSource[] = [];

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (entry.isFile() && entry.name.endsWith(extension)) {
        output.push({
          sourceType,
          absolutePath,
          sourcePath: normalizeProjectPath(path.relative(rootPath, absolutePath))
        });
      }
    }
  }

  await walk(startDir);
  return output;
}

async function scanSources(rootPath: string): Promise<ScanSource[]> {
  const resourcesPath = projectFile(rootPath, ".project/resources.json");
  const sources: ScanSource[] = [];

  if (await fs.stat(resourcesPath).then((stats) => stats.isFile()).catch(() => false)) {
    sources.push({
      sourceType: "resources_json",
      sourcePath: ".project/resources.json",
      absolutePath: resourcesPath
    });
  }

  sources.push(...await walkFiles(rootPath, "scripts", ".lua", "lua_script"));
  sources.push(...await walkFiles(rootPath, "assets/flows", ".json", "flow_json"));
  return sources;
}

function findTextEvidence(source: ScanSource, content: string, relativePath: string): AssetReferenceEvidence[] {
  const references: AssetReferenceEvidence[] = [];
  const lines = content.split(/\r?\n/);

  lines.forEach((lineText, lineIndex) => {
    let searchFrom = 0;
    while (searchFrom <= lineText.length) {
      const columnIndex = lineText.indexOf(relativePath, searchFrom);
      if (columnIndex === -1) break;
      references.push({
        sourceType: source.sourceType,
        sourcePath: source.sourcePath,
        line: lineIndex + 1,
        column: columnIndex + 1,
        lineText
      });
      searchFrom = columnIndex + relativePath.length;
    }
  });

  return references;
}

export async function scanAssetReferences(rootPath: string, relativePaths: string[]): Promise<AssetReferenceScanResult[]> {
  const normalizedPaths = [...new Set(relativePaths.map(normalizeProjectPath).filter(isSafeProjectRelativePath))];
  const results = new Map<string, AssetReferenceEvidence[]>();
  for (const relativePath of normalizedPaths) results.set(relativePath, []);

  const sources = await scanSources(rootPath);
  for (const source of sources) {
    const content = await fs.readFile(source.absolutePath, "utf8").catch(() => undefined);
    if (content === undefined) continue;

    for (const relativePath of normalizedPaths) {
      results.get(relativePath)!.push(...findTextEvidence(source, content, relativePath));
    }
  }

  return normalizedPaths.map((relativePath) => {
    const references = results.get(relativePath) ?? [];
    return {
      relativePath,
      referenceCount: references.length,
      references
    };
  });
}
