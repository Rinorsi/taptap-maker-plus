import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildAssetDirectoryTree, filterAssetsForDirectory, flattenDirectoryTree } from "../apps/web/src/features/assets/assetTree.ts";
import { collectBatchModelGovernanceActions, defaultAssetImportFolders, managedAssetRoots, modelGovernanceCategoryLabels, modelGovernanceLabels, modelPackageBelongsToGovernanceCategory } from "../apps/web/src/features/assets/assetGovernance.ts";
import { serverManagedAssetRoots } from "../apps/server/src/services/assetGovernance.ts";
import { sqlite, upsertProject } from "../apps/server/src/lib/db.ts";
import { scanAssetReferences } from "../apps/server/src/services/assetReferenceScanner.ts";
import { scanProjectAssets } from "../apps/server/src/services/assetScanner.ts";
import { discardModelPackage, restoreModelPackage, scanModelPackages, updateResourceTable } from "../apps/server/src/services/modelPackage.ts";
import type { AssetSummary } from "../apps/web/src/api.ts";
import type { ProjectSummary } from "../apps/server/src/types.ts";

function asset(relativePath: string, assetType: AssetSummary["assetType"] = "image"): AssetSummary {
  return {
    id: `test:${relativePath}`,
    projectId: "test",
    absolutePath: `G:/Project/${relativePath}`,
    relativePath,
    fileName: relativePath.split("/").at(-1) ?? relativePath,
    extension: relativePath.includes(".") ? `.${relativePath.split(".").at(-1)}` : "",
    assetType,
    sizeBytes: 1,
    mtimeMs: 1,
    status: "available",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function verifyScopedAssetTree() {
  const assets = [
    asset("assets/image/maker_plus/a.png"),
    asset("assets/image/maker_plus/nested/b.png"),
    asset("assets/video/maker_plus/c.mp4", "video"),
    asset("assets/audio/maker_plus/d.mp3", "audio")
  ];
  const tree = buildAssetDirectoryTree(assets, managedAssetRoots.image);
  const paths = flattenDirectoryTree(tree).map((node) => node.path);

  assert.equal(tree.path, managedAssetRoots.image);
  assert.equal(tree.totalAssetCount, 2);
  assert(paths.includes("assets/image/maker_plus"));
  assert(paths.includes("assets/image/maker_plus/nested"));
  assert(!paths.includes("assets/video"));
  assert(!paths.includes("assets/audio"));
}

function verifyDirectoryFiltering() {
  const assets = [
    asset("assets/image/a.png"),
    asset("assets/image/nested/b.png"),
    asset("assets/image/nested/deeper/c.png"),
    asset("assets/video/d.mp4", "video")
  ];

  assert.deepEqual(
    filterAssetsForDirectory(assets, "assets/image", false).map((item) => item.relativePath),
    ["assets/image/a.png"]
  );
  assert.deepEqual(
    filterAssetsForDirectory(assets, "assets/image/nested", false).map((item) => item.relativePath),
    ["assets/image/nested/b.png"]
  );
  assert.deepEqual(
    filterAssetsForDirectory(assets, "assets/image", true).map((item) => item.relativePath),
    ["assets/image/a.png", "assets/image/nested/b.png", "assets/image/nested/deeper/c.png"]
  );
}

function verifyFrontendBackendRoots() {
  assert.equal(managedAssetRoots.image, serverManagedAssetRoots.image);
  assert.equal(managedAssetRoots.video, serverManagedAssetRoots.video);
  assert.equal(managedAssetRoots.audio, serverManagedAssetRoots.audio);
  assert.equal(managedAssetRoots.project, serverManagedAssetRoots.project);
  assert.equal(managedAssetRoots.modelSource, serverManagedAssetRoots.modelSource);
  assert.equal(managedAssetRoots.modelDiscarded, serverManagedAssetRoots.modelDiscarded);

  assert.equal(defaultAssetImportFolders.image, `${managedAssetRoots.image}/maker_plus`);
  assert.equal(defaultAssetImportFolders.video, `${managedAssetRoots.video}/maker_plus`);
  assert.equal(defaultAssetImportFolders.audio, `${managedAssetRoots.audio}/maker_plus`);
}

function verifyModelGovernanceLabels() {
  assert.equal(modelGovernanceLabels.runtime_orphan, "待打包");
  assert.equal(modelGovernanceLabels.packaged_unused, "已打包未使用");
  assert.equal(modelGovernanceCategoryLabels.runtime_orphan, modelGovernanceLabels.runtime_orphan);
  assert.equal(modelGovernanceCategoryLabels.packaged_unused, modelGovernanceLabels.packaged_unused);
  assert.equal(modelGovernanceCategoryLabels.issues, modelGovernanceLabels.broken);
}

function verifyModelGovernanceUiRules() {
  assert.deepEqual(
    collectBatchModelGovernanceActions([
      { suggestedActions: ["organize", "discard"] },
      { suggestedActions: ["restore"] },
      { suggestedActions: ["copy_lua"] }
    ]),
    ["organize", "restore", "discard"]
  );

  assert.equal(modelPackageBelongsToGovernanceCategory({ governanceState: "discarded", issues: [{ severity: "warning", message: "ignored" }] }, "issues"), false);
  assert.equal(modelPackageBelongsToGovernanceCategory({ governanceState: "broken", issues: [{ severity: "error", message: "shown" }] }, "issues"), true);
  assert.equal(modelPackageBelongsToGovernanceCategory({ governanceState: "runtime_orphan", issues: [] }, "runtime_orphan"), true);
}

function writeFile(root: string, relativePath: string, content = "") {
  const fullPath = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

async function withTempProject(run: (project: ProjectSummary) => Promise<void>) {
  const rootPath = fs.mkdtempSync(path.join(os.tmpdir(), "maker-plus-governance-"));
  const project: ProjectSummary = {
    id: `verify-${Date.now()}`,
    name: "Verify Asset Governance",
    rootPath,
    makerProjectId: "verify-maker-project",
    configPath: path.join(rootPath, ".maker-mcp", "config.json"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    writeFile(rootPath, ".maker-mcp/config.json", JSON.stringify({ project_id: project.makerProjectId }, null, 2));
    upsertProject(project);
    await run(project);
  } finally {
    sqlite.prepare("DELETE FROM projects WHERE id = ?").run(project.id);
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
}

async function verifyModelPackageGovernance() {
  await withTempProject(async (project) => {
    writeFile(project.rootPath, ".project/resources.json", JSON.stringify({ groups: { default: [] } }, null, 2));
    writeFile(project.rootPath, "assets/Meshes/Loose.mdl", "mdl");
    writeFile(project.rootPath, "assets/Materials/Loose.xml", "<material />");
    writeFile(project.rootPath, "assets/Textures/Loose.png", "texture");

    await scanProjectAssets(project);
    let packages = scanModelPackages(project.id);
    let loose = packages.find((item) => item.runtimeMdl === "assets/Meshes/Loose.mdl");
    assert(loose, "runtime MDL package should be discovered");
    assert.equal(loose.governanceState, "runtime_orphan");
    assert(loose.suggestedActions.includes("add_to_resource"));

    updateResourceTable(project.id, loose.id, "add");
    packages = scanModelPackages(project.id);
    loose = packages.find((item) => item.runtimeMdl === "assets/Meshes/Loose.mdl");
    assert(loose, "resource-updated package should still be discovered");
    assert.equal(loose.inResourceTable, true);
    assert.equal(loose.governanceState, "packaged_unused");

    writeFile(project.rootPath, "scripts/main.lua", 'return { meshPath = "Meshes/Loose.mdl" }');
    packages = scanModelPackages(project.id);
    loose = packages.find((item) => item.runtimeMdl === "assets/Meshes/Loose.mdl");
    assert(loose, "script-referenced package should still be discovered");
    assert.equal(loose.governanceState, "in_use");
    assert.throws(() => updateResourceTable(project.id, loose!.id, "remove"), /still referenced by Lua scripts/);

    writeFile(project.rootPath, "assets/model/LooseSource.glb", "source");
    await scanProjectAssets(project);
    packages = scanModelPackages(project.id);
    const source = packages.find((item) => item.sourceGlb === "assets/model/LooseSource.glb");
    assert(source, "source GLB package should be discovered");
    assert.equal(source.governanceState, "source_orphan");

    discardModelPackage(project.id, source.id);
    await scanProjectAssets(project);
    packages = scanModelPackages(project.id);
    let discarded = packages.find((item) => item.id === source.id);
    assert(discarded, "discarded package should be discoverable");
    assert.equal(discarded.governanceState, "discarded");
    assert(discarded.suggestedActions.includes("restore"));
    assert(discarded.files.some((file) => file.relativePath.startsWith(serverManagedAssetRoots.modelDiscarded)));

    restoreModelPackage(project.id, source.id);
    await scanProjectAssets(project);
    packages = scanModelPackages(project.id);
    discarded = packages.find((item) => item.id === source.id);
    assert(discarded, "restored package should be discoverable");
    assert.equal(discarded.governanceState, "draft");
    assert(discarded.files.some((file) => file.relativePath.startsWith(serverManagedAssetRoots.modelSource)));
  });
}

async function verifyAssetReferenceScanner() {
  await withTempProject(async (project) => {
    writeFile(project.rootPath, ".project/resources.json", JSON.stringify({ groups: { default: ["assets/image/Hero.png"] } }, null, 2));
    writeFile(project.rootPath, "scripts/main.lua", 'return { icon = "assets/image/Hero.png" }');
    writeFile(project.rootPath, "assets/flows/intro.json", JSON.stringify({ image: "assets/image/Hero.png" }, null, 2));
    writeFile(project.rootPath, "assets/notes.json", JSON.stringify({ image: "assets/image/Hero.png" }, null, 2));

    const results = await scanAssetReferences(project.rootPath, ["assets/image/Hero.png", "assets/image/Missing.png"]);
    const hero = results.find((item) => item.relativePath === "assets/image/Hero.png");
    const missing = results.find((item) => item.relativePath === "assets/image/Missing.png");

    assert(hero, "referenced asset should be present in scan result");
    assert.equal(hero.referenceCount, 3);
    assert.deepEqual(
      hero.references.map((item) => item.sourcePath).sort(),
      [".project/resources.json", "assets/flows/intro.json", "scripts/main.lua"]
    );
    assert(hero.references.every((item) => item.lineText.includes("assets/image/Hero.png")));

    assert(missing, "unreferenced asset should be present in scan result");
    assert.equal(missing.referenceCount, 0);
    assert.deepEqual(missing.references, []);
  });
}

function readSourceFile(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), ...relativePath.split("/")), "utf8");
}

function verifyStudioAssetManagerUsage() {
  const assetHub = readSourceFile("apps/web/src/features/assets/AssetHub.tsx");
  assert(assetHub.includes("<AssetManagerPanel"), "Asset Hub should use the full asset manager");
  assert(!assetHub.includes("showDirectoryTree={false}"), "Asset Hub should keep the directory tree");

  for (const relativePath of [
    "apps/web/src/features/generation/ImageStudio.tsx",
    "apps/web/src/features/generation/VideoStudio.tsx",
    "apps/web/src/features/generation/MusicStudio.tsx"
  ]) {
    const source = readSourceFile(relativePath);
    assert(source.includes("AssetManagerPanel"), `${relativePath} should use AssetManagerPanel`);
    assert(source.includes("showDirectoryTree={false}"), `${relativePath} should use compact asset manager without the side directory tree`);
  }

  const modelStudio = readSourceFile("apps/web/src/features/generation/Model3DStudio.tsx");
  assert(!modelStudio.includes("AssetManagerPanel"), "Model3DStudio should use model package governance, not ordinary asset manager");
}

verifyScopedAssetTree();
verifyDirectoryFiltering();
verifyFrontendBackendRoots();
verifyModelGovernanceLabels();
verifyModelGovernanceUiRules();
verifyStudioAssetManagerUsage();
await verifyModelPackageGovernance();
await verifyAssetReferenceScanner();

console.log("asset governance verification passed");
