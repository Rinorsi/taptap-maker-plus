import type { AssetDirectoryNode, AssetSummary } from "../types.js";

function normalizeAssetPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

function getAssetDirectory(relativePath: string) {
  const normalized = normalizeAssetPath(relativePath);
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(0, slashIndex) : "";
}

function isPathUnderRoot(relativePath: string, rootPath: string) {
  const normalized = normalizeAssetPath(relativePath);
  const root = normalizeAssetPath(rootPath);
  if (!root) return true;
  return normalized === root || normalized.startsWith(`${root}/`);
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

  function ensureNode(directoryPath: string) {
    const normalized = normalizeAssetPath(directoryPath);
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
