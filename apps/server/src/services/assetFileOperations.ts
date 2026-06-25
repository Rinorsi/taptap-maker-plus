import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type {
  AssetReferenceEvidence,
  AssetReferenceScanResult,
  AssetReferenceUpdateSummary
} from "../types.js";
import { normalizeProjectPath } from "./assetGovernance.js";
import {
  findAssetReferenceTextEvidence,
  isSafeProjectRelativePath,
  scanAssetReferences,
  scanAssetReferenceSources
} from "./assetReferenceScanner.js";

export type AssetPathReplacement = {
  oldPath: string;
  newPath: string;
};

export type AssetMutationResult = {
  replacements: AssetPathReplacement[];
  referenceScan: AssetReferenceScanResult[];
  referenceUpdate?: AssetReferenceUpdateSummary;
};

export class AssetFileOperationError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409 = 400
  ) {
    super(message);
    this.name = "AssetFileOperationError";
  }
}

function badRequest(message: string): never {
  throw new AssetFileOperationError(message, 400);
}

function notFound(message: string): never {
  throw new AssetFileOperationError(message, 404);
}

function conflict(message: string): never {
  throw new AssetFileOperationError(message, 409);
}

function isSafeProjectPath(projectRoot: string, targetPath: string) {
  const root = path.resolve(projectRoot);
  const target = path.resolve(targetPath);
  return target === root || target.startsWith(`${root}${path.sep}`);
}

export function resolveSafeProjectPath(projectRoot: string, relativePath: string) {
  const normalized = normalizeAssetRelativePath(relativePath);
  const resolved = path.resolve(projectRoot, normalized);
  if (!isSafeProjectPath(projectRoot, resolved)) badRequest(`Unsafe project path: ${relativePath}`);
  return resolved;
}

export function normalizeAssetRelativePath(relativePath: string) {
  return normalizeProjectPath(relativePath).trim().replace(/^\/+|\/+$/g, "");
}

export function assertSafeAssetRelativePath(relativePath: string) {
  const normalized = normalizeAssetRelativePath(relativePath);
  if (!isSafeProjectRelativePath(normalized)) badRequest(`Unsafe asset path: ${relativePath}`);
  if (normalized !== "assets" && !normalized.startsWith("assets/")) badRequest(`Asset path must be under assets: ${relativePath}`);
  return normalized;
}

export function sanitizeAssetFileName(fileName: string) {
  return path.basename(fileName).replace(/[\\/:*?"<>|]/g, "_").trim();
}

export function nextAvailablePath(targetPath: string) {
  if (!fs.existsSync(targetPath)) return targetPath;
  const directory = path.dirname(targetPath);
  const extension = path.extname(targetPath);
  const baseName = path.basename(targetPath, extension);
  let index = 1;
  let nextPath = path.join(directory, `${baseName}_${index}${extension}`);
  while (fs.existsSync(nextPath)) {
    index += 1;
    nextPath = path.join(directory, `${baseName}_${index}${extension}`);
  }
  return nextPath;
}

function nextAvailableDirectoryPath(targetPath: string) {
  if (!fs.existsSync(targetPath)) return targetPath;
  const directory = path.dirname(targetPath);
  const baseName = path.basename(targetPath);
  let index = 1;
  let nextPath = path.join(directory, `${baseName}_${index}`);
  while (fs.existsSync(nextPath)) {
    index += 1;
    nextPath = path.join(directory, `${baseName}_${index}`);
  }
  return nextPath;
}

function relativeFromProject(projectRoot: string, absolutePath: string) {
  return normalizeProjectPath(path.relative(projectRoot, absolutePath));
}

function buildMovedPath(relativePath: string, oldDirectory: string, newDirectory: string) {
  const normalized = assertSafeAssetRelativePath(relativePath);
  const oldDir = assertSafeAssetRelativePath(oldDirectory);
  const newDir = assertSafeAssetRelativePath(newDirectory);
  if (normalized === oldDir) return newDir;
  if (!normalized.startsWith(`${oldDir}/`)) return normalized;
  return `${newDir}/${normalized.slice(oldDir.length + 1)}`;
}

function lineColumnToOffset(content: string, line: number, column: number) {
  let currentLine = 1;
  let currentColumn = 1;
  for (let index = 0; index < content.length; index += 1) {
    if (currentLine === line && currentColumn === column) return index;
    const char = content[index];
    if (char === "\r") {
      if (content[index + 1] === "\n") index += 1;
      currentLine += 1;
      currentColumn = 1;
      continue;
    }
    if (char === "\n") {
      currentLine += 1;
      currentColumn = 1;
      continue;
    }
    currentColumn += 1;
  }
  return currentLine === line && currentColumn === column ? content.length : -1;
}

function replaceEvidenceReferences(
  content: string,
  replacement: AssetPathReplacement,
  evidence: AssetReferenceEvidence[]
) {
  const edits = evidence
    .map((item) => ({
      offset: lineColumnToOffset(content, item.line, item.column),
      oldPath: replacement.oldPath,
      newPath: replacement.newPath
    }))
    .filter((item) => item.offset >= 0 && content.slice(item.offset, item.offset + item.oldPath.length) === item.oldPath)
    .sort((a, b) => b.offset - a.offset);

  let next = content;
  for (const edit of edits) {
    next = `${next.slice(0, edit.offset)}${edit.newPath}${next.slice(edit.offset + edit.oldPath.length)}`;
  }
  return { content: next, count: edits.length, skippedCount: evidence.length - edits.length };
}

function listFilesUnderDirectory(projectRoot: string, directoryPath: string) {
  const directory = resolveSafeProjectPath(projectRoot, assertSafeAssetRelativePath(directoryPath));
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (entry.isFile()) files.push(relativeFromProject(projectRoot, absolutePath));
    }
  };
  if (fs.existsSync(directory) && fs.statSync(directory).isDirectory()) walk(directory);
  return files;
}

export async function updateAssetReferences(
  projectRoot: string,
  replacements: AssetPathReplacement[]
): Promise<AssetReferenceUpdateSummary> {
  const normalizedReplacements = replacements
    .map((item) => ({
      oldPath: assertSafeAssetRelativePath(item.oldPath),
      newPath: assertSafeAssetRelativePath(item.newPath)
    }))
    .filter((item) => item.oldPath !== item.newPath);

  const summary: AssetReferenceUpdateSummary = {
    requested: normalizedReplacements,
    updatedFiles: [],
    skipped: [],
    totalReplacements: 0
  };

  if (!normalizedReplacements.length) return summary;

  const sources = await scanAssetReferenceSources(projectRoot);
  for (const source of sources) {
    const original = await fsp.readFile(source.absolutePath, "utf8").catch(() => undefined);
    if (original === undefined) continue;

    const sourceSkippedByReplacement = new Map<string, number>();
    let next = original;
    let replacementsInFile = 0;
    for (const replacement of normalizedReplacements) {
      const evidence = findAssetReferenceTextEvidence(source, next, replacement.oldPath);
      if (!evidence.length) continue;
      const replaced = replaceEvidenceReferences(next, replacement, evidence);
      next = replaced.content;
      replacementsInFile += replaced.count;
      if (replaced.skippedCount > 0) {
        sourceSkippedByReplacement.set(
          `${replacement.oldPath}\u0000${replacement.newPath}`,
          (sourceSkippedByReplacement.get(`${replacement.oldPath}\u0000${replacement.newPath}`) ?? 0) + replaced.skippedCount
        );
      }
    }

    if (next === original) continue;
    const backupPath = `${source.absolutePath}.bak-${Date.now()}`;
    await fsp.copyFile(source.absolutePath, backupPath);
    await fsp.writeFile(source.absolutePath, next, "utf8");
    summary.updatedFiles.push({
      sourceType: source.sourceType,
      sourcePath: source.sourcePath,
      replacements: replacementsInFile,
      backupPath: relativeFromProject(projectRoot, backupPath)
    });
    summary.totalReplacements += replacementsInFile;
    for (const [key, count] of sourceSkippedByReplacement) {
      const [oldPath, newPath] = key.split("\u0000");
      summary.skipped.push({
        oldPath,
        newPath,
        reason: `${count} scanned reference positions did not match during write in ${source.sourcePath}`
      });
    }
  }

  for (const replacement of normalizedReplacements) {
    const remaining = await scanAssetReferences(projectRoot, [replacement.oldPath]);
    const remainingCount = remaining.reduce((total, result) => total + result.referenceCount, 0);
    if (remainingCount > 0) {
      summary.skipped.push({
        oldPath: replacement.oldPath,
        newPath: replacement.newPath,
        reason: `${remainingCount} references remain after exact replacement`
      });
    }
  }

  return summary;
}

export async function moveAssetFiles(
  projectRoot: string,
  relativePaths: string[],
  targetFolder: string,
  updateReferences: boolean
): Promise<AssetMutationResult> {
  const targetDirectory = resolveSafeProjectPath(projectRoot, assertSafeAssetRelativePath(targetFolder));
  fs.mkdirSync(targetDirectory, { recursive: true });

  const replacements: AssetPathReplacement[] = [];
  for (const relativePath of relativePaths.map(assertSafeAssetRelativePath)) {
    const from = resolveSafeProjectPath(projectRoot, relativePath);
    if (!fs.existsSync(from) || !fs.statSync(from).isFile()) continue;
    const requestedTarget = path.join(targetDirectory, path.basename(relativePath));
    if (!isSafeProjectPath(projectRoot, requestedTarget)) badRequest(`Unsafe target path: ${targetFolder}`);
    const to = nextAvailablePath(requestedTarget);
    fs.renameSync(from, to);
    replacements.push({ oldPath: relativePath, newPath: relativeFromProject(projectRoot, to) });
  }

  const referenceScan = await scanAssetReferences(projectRoot, replacements.map((item) => item.oldPath));
  const referenceUpdate = updateReferences ? await updateAssetReferences(projectRoot, replacements) : undefined;
  return { replacements, referenceScan, referenceUpdate };
}

export async function renameAssetFile(
  projectRoot: string,
  relativePath: string,
  newName: string,
  updateReferences: boolean
): Promise<AssetMutationResult> {
  const oldPath = assertSafeAssetRelativePath(relativePath);
  const safeName = sanitizeAssetFileName(newName);
  if (!safeName) badRequest("newName is required");

  const from = resolveSafeProjectPath(projectRoot, oldPath);
  if (!fs.existsSync(from) || !fs.statSync(from).isFile()) notFound("Asset file not found");
  const targetPath = path.join(path.dirname(from), safeName);
  if (!isSafeProjectPath(projectRoot, targetPath)) badRequest(`Unsafe target path: ${newName}`);
  if (fs.existsSync(targetPath)) conflict("Target file already exists");
  fs.renameSync(from, targetPath);

  const replacements = [{ oldPath, newPath: relativeFromProject(projectRoot, targetPath) }];
  const referenceScan = await scanAssetReferences(projectRoot, [oldPath]);
  const referenceUpdate = updateReferences ? await updateAssetReferences(projectRoot, replacements) : undefined;
  return { replacements, referenceScan, referenceUpdate };
}

export async function createAssetFolder(projectRoot: string, parentFolder: string, name: string) {
  const parent = assertSafeAssetRelativePath(parentFolder);
  const safeName = sanitizeAssetFileName(name);
  if (!safeName) badRequest("name is required");
  const targetPath = nextAvailableDirectoryPath(path.join(resolveSafeProjectPath(projectRoot, parent), safeName));
  if (!isSafeProjectPath(projectRoot, targetPath)) badRequest(`Unsafe folder path: ${parentFolder}`);
  fs.mkdirSync(targetPath, { recursive: true });
  return { directoryPath: relativeFromProject(projectRoot, targetPath) };
}

export async function renameAssetFolder(
  projectRoot: string,
  directoryPath: string,
  newName: string,
  updateReferences: boolean
): Promise<AssetMutationResult & { directoryPath: string }> {
  const oldDirectory = assertSafeAssetRelativePath(directoryPath);
  if (oldDirectory === "assets") badRequest("Cannot rename assets root");
  const safeName = sanitizeAssetFileName(newName);
  if (!safeName) badRequest("newName is required");

  const from = resolveSafeProjectPath(projectRoot, oldDirectory);
  if (!fs.existsSync(from) || !fs.statSync(from).isDirectory()) notFound("Directory not found");
  const to = path.join(path.dirname(from), safeName);
  if (!isSafeProjectPath(projectRoot, to)) badRequest(`Unsafe folder path: ${newName}`);
  if (fs.existsSync(to)) conflict("Target directory already exists");

  const oldFiles = listFilesUnderDirectory(projectRoot, oldDirectory);
  fs.renameSync(from, to);
  const newDirectory = relativeFromProject(projectRoot, to);
  const replacements = oldFiles.map((oldPath) => ({ oldPath, newPath: buildMovedPath(oldPath, oldDirectory, newDirectory) }));
  const referenceScan = await scanAssetReferences(projectRoot, replacements.map((item) => item.oldPath));
  const referenceUpdate = updateReferences ? await updateAssetReferences(projectRoot, replacements) : undefined;
  return { directoryPath: newDirectory, replacements, referenceScan, referenceUpdate };
}

export async function moveAssetFolder(
  projectRoot: string,
  directoryPath: string,
  targetFolder: string,
  updateReferences: boolean
): Promise<AssetMutationResult & { directoryPath: string }> {
  const oldDirectory = assertSafeAssetRelativePath(directoryPath);
  const targetDirectory = assertSafeAssetRelativePath(targetFolder);
  if (oldDirectory === "assets") badRequest("Cannot move assets root");
  if (targetDirectory === oldDirectory || targetDirectory.startsWith(`${oldDirectory}/`)) {
    badRequest("Cannot move a directory into itself or its child directory");
  }

  const from = resolveSafeProjectPath(projectRoot, oldDirectory);
  const targetRoot = resolveSafeProjectPath(projectRoot, targetDirectory);
  if (!fs.existsSync(from) || !fs.statSync(from).isDirectory()) notFound("Directory not found");
  fs.mkdirSync(targetRoot, { recursive: true });
  const to = nextAvailableDirectoryPath(path.join(targetRoot, path.basename(oldDirectory)));
  if (!isSafeProjectPath(projectRoot, to)) badRequest(`Unsafe target path: ${targetFolder}`);

  const oldFiles = listFilesUnderDirectory(projectRoot, oldDirectory);
  fs.renameSync(from, to);
  const newDirectory = relativeFromProject(projectRoot, to);
  const replacements = oldFiles.map((oldPath) => ({ oldPath, newPath: buildMovedPath(oldPath, oldDirectory, newDirectory) }));
  const referenceScan = await scanAssetReferences(projectRoot, replacements.map((item) => item.oldPath));
  const referenceUpdate = updateReferences ? await updateAssetReferences(projectRoot, replacements) : undefined;
  return { directoryPath: newDirectory, replacements, referenceScan, referenceUpdate };
}

export async function copyAssetFolder(projectRoot: string, directoryPath: string, targetFolder: string) {
  const sourceDirectory = assertSafeAssetRelativePath(directoryPath);
  const targetDirectory = assertSafeAssetRelativePath(targetFolder);
  if (sourceDirectory === "assets") badRequest("Cannot copy assets root");
  if (targetDirectory === sourceDirectory || targetDirectory.startsWith(`${sourceDirectory}/`)) {
    badRequest("Cannot copy a directory into itself or its child directory");
  }

  const from = resolveSafeProjectPath(projectRoot, sourceDirectory);
  const targetRoot = resolveSafeProjectPath(projectRoot, targetDirectory);
  if (!fs.existsSync(from) || !fs.statSync(from).isDirectory()) notFound("Directory not found");
  fs.mkdirSync(targetRoot, { recursive: true });
  const to = nextAvailableDirectoryPath(path.join(targetRoot, path.basename(sourceDirectory)));
  fs.cpSync(from, to, { recursive: true, errorOnExist: false });
  return { directoryPath: relativeFromProject(projectRoot, to) };
}

export async function deleteAssetFolder(projectRoot: string, directoryPath: string) {
  const targetDirectory = assertSafeAssetRelativePath(directoryPath);
  if (targetDirectory === "assets") badRequest("Cannot delete assets root");
  const targetPath = resolveSafeProjectPath(projectRoot, targetDirectory);
  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isDirectory()) notFound("Directory not found");
  const files = listFilesUnderDirectory(projectRoot, targetDirectory);
  const referenceScan = await scanAssetReferences(projectRoot, files);
  fs.rmSync(targetPath, { recursive: true, force: true });
  return { deletedPaths: files, referenceScan };
}
