import type { AssetSummary } from "../../api";

export type AssetDirectoryNode = {
  name: string;
  path: string;
  parentPath: string;
  depth: number;
  assetCount: number;
  totalAssetCount: number;
  children: AssetDirectoryNode[];
};

export function normalizeAssetPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export function getAssetDirectory(relativePath: string) {
  const normalized = normalizeAssetPath(relativePath);
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(0, slashIndex) : "";
}

export function getAssetFileName(relativePath: string) {
  const normalized = normalizeAssetPath(relativePath);
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

function isPathUnderRoot(relativePath: string, rootPath: string) {
  const normalized = normalizeAssetPath(relativePath);
  const root = normalizeAssetPath(rootPath);
  if (!root) return true;
  return normalized === root || normalized.startsWith(`${root}/`);
}

export function isPathInDirectory(relativePath: string, directoryPath: string, recursive: boolean) {
  const assetDirectory = getAssetDirectory(relativePath);
  const directory = normalizeAssetPath(directoryPath);
  if (!directory) return recursive || !assetDirectory.includes("/");
  if (assetDirectory === directory) return true;
  return recursive ? assetDirectory.startsWith(`${directory}/`) : false;
}

export function buildAssetDirectoryTree(assets: AssetSummary[], rootPath = "assets"): AssetDirectoryNode {
  const normalizedRoot = normalizeAssetPath(rootPath);
  const root: AssetDirectoryNode = {
    name: normalizedRoot || "assets",
    path: normalizedRoot,
    parentPath: "",
    depth: 0,
    assetCount: 0,
    totalAssetCount: 0,
    children: []
  };
  const nodes = new Map<string, AssetDirectoryNode>([[normalizedRoot, root]]);

  function ensureNode(path: string) {
    const normalized = normalizeAssetPath(path);
    const existing = nodes.get(normalized);
    if (existing) return existing;

    const slashIndex = normalized.lastIndexOf("/");
    const parentPath = slashIndex >= 0 ? normalized.slice(0, slashIndex) : "";
    const parent = parentPath && isPathUnderRoot(parentPath, normalizedRoot) ? ensureNode(parentPath) : root;
    const node: AssetDirectoryNode = {
      name: slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized,
      path: normalized,
      parentPath: parent.path,
      depth: parent.depth + 1,
      assetCount: 0,
      totalAssetCount: 0,
      children: []
    };
    parent.children.push(node);
    parent.children.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
    nodes.set(normalized, node);
    return node;
  }

  for (const asset of assets) {
    if (!isPathUnderRoot(asset.relativePath, normalizedRoot)) continue;
    const directory = getAssetDirectory(asset.relativePath);
    if (!directory || directory === normalizedRoot) {
      root.assetCount += 1;
      continue;
    }
    const node = ensureNode(directory);
    node.assetCount += 1;
  }

  function fillTotal(node: AssetDirectoryNode) {
    node.totalAssetCount = node.assetCount + node.children.reduce((total, child) => total + fillTotal(child), 0);
    return node.totalAssetCount;
  }
  fillTotal(root);
  return root;
}

export function flattenDirectoryTree(root: AssetDirectoryNode) {
  const output: AssetDirectoryNode[] = [];
  function visit(node: AssetDirectoryNode) {
    output.push(node);
    for (const child of node.children) visit(child);
  }
  visit(root);
  return output;
}

export function getDirectoryBreadcrumbs(path: string) {
  const normalized = normalizeAssetPath(path);
  if (!normalized) return [];
  const parts = normalized.split("/");
  return parts.map((part, index) => ({
    name: part,
    path: parts.slice(0, index + 1).join("/")
  }));
}

export function filterAssetsForDirectory(assets: AssetSummary[], directoryPath: string, recursive: boolean) {
  return assets.filter((asset) => isPathInDirectory(asset.relativePath, directoryPath, recursive));
}
