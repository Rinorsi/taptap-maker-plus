import fs from "node:fs";
import path from "node:path";
import { getProject, listAssets } from "../lib/db.js";
import type { ModelPackageSummary, ModelPackageFile, ModelPackageFileType } from "../types.js";
import { isUnderProjectRoot, modelDiscardedPackagePath, modelSourcePackagePath, normalizeProjectPath, projectRelativePath, serverManagedAssetRoots } from "./assetGovernance.js";

function parseResourcesJson(rootPath: string): string[] {
  const jsonPath = path.join(rootPath, ".project", "resources.json");
  if (!fs.existsSync(jsonPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    const defaultGroup = data.groups?.default || [];
    return Array.isArray(defaultGroup) ? defaultGroup : [];
  } catch {
    return [];
  }
}

function parseReadmeMapping(rootPath: string) {
  const readmePath = path.join(rootPath, "assets", "model", "README_模型清单.md");
  const mapping = new Map<string, { name: string, category: string, purpose: string }>();
  if (!fs.existsSync(readmePath)) return mapping;
  try {
    const content = fs.readFileSync(readmePath, "utf-8");
    const lines = content.split("\n");
    for (const line of lines) {
      if (line.includes("|") && line.includes("`")) {
        const parts = line.split("|").map(p => p.trim());
        if (parts.length >= 6) {
          const name = parts[2];
          const type = parts[3];
          const filePart = parts[4];
          const purpose = parts[5];
          const match = filePart.match(/`([^`]+)`/);
          if (match) {
            mapping.set(match[1], { name, category: type, purpose });
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return mapping;
}

function scanFilesWithExt(dir: string, ext: string, filesList: { path: string, content: string, relative: string }[] = [], rootDir?: string) {
  if (!rootDir) rootDir = dir;
  if (!fs.existsSync(dir)) return filesList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      scanFilesWithExt(fullPath, ext, filesList, rootDir);
    } else if (file.endsWith(ext)) {
      try {
         const content = fs.readFileSync(fullPath, "utf-8");
         filesList.push({ path: fullPath, content, relative: path.relative(rootDir, fullPath).replace(/\\/g, "/") });
      } catch (e) {}
    }
  }
  return filesList;
}

function extractGeneratedModelIdFromMaterial(fileName: string) {
  const match = fileName.match(/_tripo_material_([a-f0-9-]{36})\.xml$/i);
  return match?.[1];
}

function normalizeSourceMatchText(value: string) {
  return value.toLowerCase().replace(/[\s_-]+/g, "");
}

function extractLuaStringField(content: string, fieldName: string) {
  const match = content.match(new RegExp(`${fieldName}\\s*=\\s*"([^"]+)"`));
  return match?.[1];
}

function parseLuaModelAliases(luaFiles: { content: string; relative: string }[]) {
  const aliasesByMdlBase = new Map<string, string[]>();
  for (const lua of luaFiles) {
    const matches = lua.content.matchAll(/(meshPath|mesh)\s*=\s*"Meshes\/([^"]+)\.mdl"/g);
    for (const match of matches) {
      const mdlBase = match[2];
      const before = lua.content.slice(0, match.index);
      const blockStart = Math.max(before.lastIndexOf("\n    {"), before.lastIndexOf("\n{"), before.lastIndexOf("\n\t{"));
      const block = lua.content.slice(blockStart >= 0 ? blockStart : Math.max(0, match.index - 1200), match.index + 500);
      const aliases = [
        mdlBase,
        extractLuaStringField(block, "name"),
        extractLuaStringField(block, "badge"),
        extractLuaStringField(block, "code"),
      ].filter((value): value is string => Boolean(value));
      aliasesByMdlBase.set(mdlBase, [...new Set(aliases)]);
    }
  }
  return aliasesByMdlBase;
}

function isResourceMatch(entry: string, relativePath: string) {
  if (entry === relativePath) return true;
  if (!entry.includes("*")) return false;
  const escaped = entry
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`).test(relativePath);
}

function pushUniqueString(list: string[], value: string) {
  if (!list.includes(value)) list.push(value);
}

function pushUniqueFile(pkg: ModelPackageSummary, file: ModelPackageFile) {
  if (!pkg.files.some((item) => item.relativePath === file.relativePath && item.role === file.role)) {
    pkg.files.push(file);
  }
}

function addMetaFileIfPresent(projectRoot: string, pkg: ModelPackageSummary, relativePath: string, role: ModelPackageFile["role"]) {
  const metaRel = `${relativePath}.meta`;
  if (fs.existsSync(path.join(projectRoot, metaRel))) {
    pushUniqueFile(pkg, { role, relativePath: metaRel, exists: true });
  }
}

function addGbmDirectoryIfPresent(projectRoot: string, pkg: ModelPackageSummary, sourceRel: string) {
  const gbmRel = sourceRel.replace(/\.glb$/i, ".gbm");
  if (gbmRel !== sourceRel && fs.existsSync(path.join(projectRoot, gbmRel))) {
    pushUniqueFile(pkg, { role: "source_gbm", relativePath: gbmRel, exists: true });
  }
}

function attachSourceGlb(projectRoot: string, pkg: ModelPackageSummary, relativePath: string) {
  if (pkg.sourceGlb) return;
  pkg.sourceGlb = relativePath;
  pkg.canPreview = true;
  pushUniqueFile(pkg, { role: "source_glb", relativePath, exists: true });
  addMetaFileIfPresent(projectRoot, pkg, relativePath, "source_meta");
  if (relativePath.endsWith(".glb")) addGbmDirectoryIfPresent(projectRoot, pkg, relativePath);
}

function ensureUniquePath(targetPath: string) {
  if (!fs.existsSync(targetPath)) return targetPath;
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  for (let index = 1; index < 1000; index += 1) {
    const nextPath = path.join(dir, `${base}_${index}${ext}`);
    if (!fs.existsSync(nextPath)) return nextPath;
  }
  throw new Error(`Cannot find available path for ${targetPath}`);
}

function moveDirectoryContents(sourceDir: string, targetDir: string) {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir)) {
    const sourcePath = path.join(sourceDir, entry);
    const targetPath = ensureUniquePath(path.join(targetDir, entry));
    fs.renameSync(sourcePath, targetPath);
  }
}

function buildFileTypes(pkg: ModelPackageSummary): ModelPackageFileType[] {
  const counts = new Map<ModelPackageFileType["type"], number>();
  const add = (type: ModelPackageFileType["type"], count = 1) => {
    if (count > 0) counts.set(type, (counts.get(type) ?? 0) + count);
  };

  if (pkg.sourceGlb) add("GLB");
  add("GBM", pkg.files.filter((file) => file.role === "source_gbm").length);
  if (pkg.runtimeMdl) add("MDL");
  add("MAT", pkg.materialXmls.length);
  add("TEX", pkg.textureFiles.filter((file) => !file.endsWith(".xml") && !file.endsWith(".meta")).length);
  if (pkg.previewImage) add("PREVIEW");
  add("MULTIVIEW", pkg.multiviewImages.length);
  add("PREFAB", pkg.prefabFiles.length);
  add("META", pkg.files.filter((file) => file.role.endsWith("_meta")).length);
  add("MANIFEST", pkg.files.filter((file) => file.role === "manifest").length);
  add("RES", pkg.referencedByResources.length);
  add("LUA", pkg.referencedByScripts.length);
  add("FLOW", pkg.referencedByFlows.length);

  const order: ModelPackageFileType["type"][] = ["GLB", "GBM", "MDL", "MAT", "TEX", "PREVIEW", "MULTIVIEW", "PREFAB", "META", "MANIFEST", "RES", "LUA", "FLOW"];
  return order
    .filter((type) => counts.has(type))
    .map((type) => ({ type, count: counts.get(type)! }));
}

function stateRank(state: ModelPackageSummary["governanceState"]) {
  const order: Record<ModelPackageSummary["governanceState"], number> = {
    broken: 0,
    runtime_orphan: 1,
    source_orphan: 2,
    draft: 3,
    packaged_unused: 4,
    adopted: 5,
    in_use: 6,
    discarded: 7,
  };
  return order[state] ?? 99;
}

export function scanModelPackages(projectId: string): ModelPackageSummary[] {
  const project = getProject(projectId);
  if (!project) return [];
  
  const assets = listAssets(projectId, 100000);
  const resourcesTable = parseResourcesJson(project.rootPath);
  const readmeMapping = parseReadmeMapping(project.rootPath);
  
  // Parse Lua and JSON flow files
  const luaFiles = scanFilesWithExt(path.join(project.rootPath, "scripts"), ".lua");
  const flowFiles = scanFilesWithExt(path.join(project.rootPath, "assets", "flows"), ".json");
  const luaModelAliases = parseLuaModelAliases(luaFiles);
  
  const packages = new Map<string, ModelPackageSummary>();
  const linkedSourcePackageIds = new Set<string>();

  function getPackage(id: string) {
    if (!packages.has(id)) {
      packages.set(id, {
        id,
        projectId,
        displayName: id,
        category: "其它",
        purpose: "",
        multiviewImages: [],
        materialXmls: [],
        textureFiles: [],
        prefabFiles: [],
        resourceEntries: [],
        fileTypes: [],
        missingParts: [],
        sourceState: "missing",
        sourceNotes: [],
        inResourceTable: false,
        isOrganized: false,
        canPreview: false,
        canRun: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        
        // Governance
        isDiscarded: false,
        referencedByScripts: [],
        referencedByFlows: [],
        referencedByResources: [],
        isReferenced: false,
        governanceState: "source_orphan",
        issues: [],
        suggestedActions: [],
        files: []
      });
    }
    return packages.get(id)!;
  }

  function linkSourcePackageToRuntime(runtimePkg: ModelPackageSummary, sourceId: string) {
    const sourcePkg = packages.get(sourceId);
    if (!sourcePkg || sourcePkg.id === runtimePkg.id) return;

    if (!runtimePkg.sourceGlb && sourcePkg.sourceGlb) {
      runtimePkg.sourceGlb = sourcePkg.sourceGlb;
      runtimePkg.canPreview = true;
    }
    if (!runtimePkg.previewImage && sourcePkg.previewImage) runtimePkg.previewImage = sourcePkg.previewImage;
    for (const imagePath of sourcePkg.multiviewImages) {
      if (!runtimePkg.multiviewImages.includes(imagePath)) runtimePkg.multiviewImages.push(imagePath);
    }
    for (const file of sourcePkg.files) pushUniqueFile(runtimePkg, file);
    linkedSourcePackageIds.add(sourceId);
  }

  // Pass 1: Organized packages (manifest.json)
  for (const asset of assets) {
    const rel = normalizeProjectPath(asset.relativePath);
    if ((isUnderProjectRoot(rel, serverManagedAssetRoots.modelSource) || isUnderProjectRoot(rel, serverManagedAssetRoots.modelDiscarded)) && asset.fileName === "manifest.json") {
       try {
         const fullPath = projectRelativePath(project.rootPath, asset.relativePath);
         const manifest = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
         const id = manifest.id || path.basename(path.dirname(fullPath));
         const pkg = getPackage(id);
         pkg.displayName = manifest.displayName || id;
         pkg.category = manifest.category || pkg.category;
         pkg.purpose = manifest.purpose || pkg.purpose;
         
         if (manifest.isDiscarded || isUnderProjectRoot(rel, serverManagedAssetRoots.modelDiscarded)) pkg.isDiscarded = true;
         if (manifest.runtimeMdl) pkg.runtimeMdl = manifest.runtimeMdl;
         
         pkg.isOrganized = true;
         pkg.files.push({ role: "manifest", relativePath: rel, exists: true });
       } catch {
         // ignore
       }
    }
  }

  // Pass 2: Source models & Previews
  for (const asset of assets) {
    const rel = normalizeProjectPath(asset.relativePath);
    if (isUnderProjectRoot(rel, serverManagedAssetRoots.model)) {
       if (rel.endsWith(".glb") || rel.endsWith(".fbx") || rel.endsWith(".obj") || rel.endsWith(".zip")) {
         const match = asset.fileName.match(/^([a-f0-9\\-]{36})/i);
          const id = match ? match[1] : asset.fileName.replace(/\.(glb|fbx|obj|zip)$/, "").replace(/_model$/, "");
          const pkg = getPackage(id);
          if (!pkg.sourceGlb) {
           attachSourceGlb(project.rootPath, pkg, rel);
           
           if (isUnderProjectRoot(rel, serverManagedAssetRoots.modelDiscarded)) pkg.isDiscarded = true;
           if (isUnderProjectRoot(rel, serverManagedAssetRoots.modelSource)) pkg.isOrganized = true;
         }
         
         const mappingKey = asset.fileName;
         if (readmeMapping.has(mappingKey)) {
            const m = readmeMapping.get(mappingKey)!;
            if (!pkg.isOrganized) {
               pkg.displayName = m.name;
               pkg.category = m.category;
               pkg.purpose = m.purpose;
            }
         }
       } else if (rel.endsWith(".webp") || rel.endsWith(".png") || rel.endsWith(".jpg")) {
         const match = asset.fileName.match(/^([a-f0-9\\-]{36})/i);
         const id = match ? match[1] : asset.fileName.replace(/_preview\.(webp|png|jpg)$/, "").replace(/\.(webp|png|jpg)$/, "");
         
         if (rel.includes("front") || rel.includes("back") || rel.includes("left") || rel.includes("right")) {
           const pkg = getPackage(id);
           if (!pkg.multiviewImages.includes(rel)) {
             pkg.multiviewImages.push(rel);
             pkg.files.push({ role: "multiview", relativePath: rel, exists: true });
             addMetaFileIfPresent(project.rootPath, pkg, rel, "multiview_meta");
           }
         } else {
           const pkg = getPackage(id);
           if (!pkg.previewImage) {
             pkg.previewImage = rel;
             pkg.files.push({ role: "preview", relativePath: rel, exists: true });
             addMetaFileIfPresent(project.rootPath, pkg, rel, "preview_meta");
           }
         }
       }
    }
  }

  // Pass 3: Runtime models
  const nameToId = new Map<string, string>();
  for (const pkg of packages.values()) {
    nameToId.set(pkg.displayName.toLowerCase(), pkg.id);
    nameToId.set(pkg.id.toLowerCase(), pkg.id);
  }

  for (const asset of assets) {
    const rel = normalizeProjectPath(asset.relativePath);
    if (isUnderProjectRoot(rel, serverManagedAssetRoots.runtimeMeshes) && rel.endsWith(".mdl")) {
      const base = asset.fileName.replace(/\.mdl$/, "");
      
      let pkgId = base;
      for (const pkg of packages.values()) {
        if (pkg.runtimeMdl === rel) {
          pkgId = pkg.id;
          break;
        }
      }
      if (pkgId === base) {
        pkgId = nameToId.get(base.toLowerCase()) || base;
      }
      
      const pkg = getPackage(pkgId);
      pkg.runtimeMdl = rel;
      pkg.canRun = true;
      pkg.files.push({ role: "runtime_mdl", relativePath: rel, exists: true });
      addMetaFileIfPresent(project.rootPath, pkg, rel, "runtime_meta");
      if (pkg.displayName === pkgId && pkgId === base) {
         pkg.displayName = base;
         pkg.category = "运行时资源";
      }
    }
  }

  const finalSourceGlbs = assets
    .map((asset) => normalizeProjectPath(asset.relativePath))
    .filter((rel) => isUnderProjectRoot(rel, serverManagedAssetRoots.modelFinal) && rel.endsWith(".glb"));
  for (const pkg of packages.values()) {
    if (pkg.sourceGlb || !pkg.runtimeMdl) continue;
    const mdlBase = path.basename(pkg.runtimeMdl, ".mdl");
    const aliases = luaModelAliases.get(mdlBase) ?? [mdlBase];
    const normalizedAliases = aliases.map(normalizeSourceMatchText).filter(Boolean);
    const matchingGlb = finalSourceGlbs.find((rel) => {
      const name = normalizeSourceMatchText(path.basename(rel, ".glb"));
      return normalizedAliases.some((alias) => alias && name.includes(alias));
    });
    if (matchingGlb) attachSourceGlb(project.rootPath, pkg, matchingGlb);
  }

  for (const asset of assets) {
    const rel = normalizeProjectPath(asset.relativePath);
    if (isUnderProjectRoot(rel, serverManagedAssetRoots.runtimeMaterials) && rel.endsWith(".xml")) {
       const base = asset.fileName.replace(/\.xml$/, "");
       for (const pkg of packages.values()) {
         if (pkg.runtimeMdl) {
           const mdlBase = path.basename(pkg.runtimeMdl, ".mdl");
           if (base.startsWith(mdlBase)) {
             if (!pkg.materialXmls.includes(rel)) {
               pkg.materialXmls.push(rel);
               pushUniqueFile(pkg, { role: "material", relativePath: rel, exists: true });
               addMetaFileIfPresent(project.rootPath, pkg, rel, "material_meta");
             }
             const sourceId = extractGeneratedModelIdFromMaterial(asset.fileName);
             if (sourceId) linkSourcePackageToRuntime(pkg, sourceId);
           }
         }
       }
    } else if (isUnderProjectRoot(rel, serverManagedAssetRoots.runtimeTextures)) {
       const base = asset.fileName.replace(/\.[a-zA-Z0-9]+$/, "");
       for (const pkg of packages.values()) {
         if (pkg.runtimeMdl) {
           const mdlBase = path.basename(pkg.runtimeMdl, ".mdl");
           if (base.startsWith(mdlBase)) {
             if (!pkg.textureFiles.includes(rel)) {
               pkg.textureFiles.push(rel);
               pushUniqueFile(pkg, { role: "texture", relativePath: rel, exists: true });
               addMetaFileIfPresent(project.rootPath, pkg, rel, "texture_meta");
             }
           }
         }
       }
    }
  }

  for (const asset of assets) {
    const rel = normalizeProjectPath(asset.relativePath);
    if (!isUnderProjectRoot(rel, serverManagedAssetRoots.runtimePrefabs) || !rel.endsWith(".prefab")) continue;
    const prefabBase = asset.fileName.replace(/\.prefab$/, "");
    for (const pkg of packages.values()) {
      const mdlBase = pkg.runtimeMdl ? path.basename(pkg.runtimeMdl, ".mdl") : undefined;
      if (mdlBase && prefabBase === mdlBase) {
        pushUniqueString(pkg.prefabFiles, rel);
        pushUniqueFile(pkg, { role: "prefab", relativePath: rel, exists: true });
        addMetaFileIfPresent(project.rootPath, pkg, rel, "prefab_meta");
      }
    }
  }

  // Pass 4: Resource table check and project reference scan.
  for (const pkg of packages.values()) {
    const runtimeResourceTargets = [
      pkg.runtimeMdl,
      ...pkg.materialXmls,
      ...pkg.textureFiles,
      ...pkg.prefabFiles,
    ].filter((value): value is string => Boolean(value));

    for (const entry of resourcesTable) {
      if (runtimeResourceTargets.some((target) => isResourceMatch(entry, target))) {
        pushUniqueString(pkg.resourceEntries, entry);
        pushUniqueString(pkg.referencedByResources, entry);
      }
    }
    pkg.inResourceTable = pkg.resourceEntries.length > 0;

    const scriptTokens: string[] = [];
    if (pkg.runtimeMdl) {
      const shortMdl = pkg.runtimeMdl.replace(/^assets\//, "");
      scriptTokens.push(pkg.runtimeMdl, shortMdl);
    }
    for (const material of pkg.materialXmls) {
      scriptTokens.push(material, material.replace(/^assets\//, ""));
    }

    for (const lua of luaFiles) {
      if (scriptTokens.some((token) => lua.content.includes(token))) {
        pushUniqueString(pkg.referencedByScripts, lua.relative);
      }
    }

    const flowTokens = [...scriptTokens, pkg.id];
    if (pkg.sourceGlb) flowTokens.push(pkg.sourceGlb, path.basename(pkg.sourceGlb));
    for (const flow of flowFiles) {
      if (flowTokens.some((token) => flow.content.includes(token))) {
        pushUniqueString(pkg.referencedByFlows, flow.relative);
      }
    }

    pkg.isReferenced = pkg.referencedByScripts.length > 0;
  }

  // Pass 5: Determine governance state and available actions.
  for (const pkg of packages.values()) {
    pkg.issues = [];
    pkg.suggestedActions = [];
    pkg.missingParts = [];
    pkg.sourceNotes = [];

    const hasRuntimeMdl = Boolean(pkg.runtimeMdl);
    const hasRuntimeMaterial = pkg.materialXmls.length > 0;
    const hasScriptReference = pkg.referencedByScripts.length > 0;
    const hasSource = Boolean(pkg.sourceGlb);
    const runtimeReady = hasRuntimeMdl && hasRuntimeMaterial;
    pkg.canRun = runtimeReady;

    if (pkg.isDiscarded) {
      pkg.sourceState = "discarded";
    } else if (hasSource && hasRuntimeMdl) {
      pkg.sourceState = "linked";
    } else if (hasSource && pkg.isOrganized) {
      pkg.sourceState = "draft";
    } else if (hasSource) {
      pkg.sourceState = "orphan";
    } else {
      pkg.sourceState = "missing";
    }

    if (pkg.isDiscarded) {
      pkg.governanceState = "discarded";
    } else if (runtimeReady && hasScriptReference && pkg.inResourceTable) {
      pkg.governanceState = "in_use";
    } else if (hasScriptReference && (!runtimeReady || !pkg.inResourceTable)) {
      pkg.governanceState = "broken";
    } else if (runtimeReady && pkg.inResourceTable && !hasScriptReference && hasSource) {
      pkg.governanceState = "adopted";
    } else if (runtimeReady && pkg.inResourceTable && !hasScriptReference && !hasSource) {
      pkg.governanceState = "packaged_unused";
    } else if (hasRuntimeMdl && !pkg.inResourceTable && !hasScriptReference) {
      pkg.governanceState = "runtime_orphan";
    } else if (!hasRuntimeMdl && hasSource && pkg.isOrganized) {
      pkg.governanceState = "draft";
    } else if (!hasRuntimeMdl && hasSource && !pkg.isOrganized) {
      pkg.governanceState = "source_orphan";
    } else {
      pkg.governanceState = "broken";
    }
    
    if (pkg.governanceState === "source_orphan") {
      pkg.issues.push({ severity: "warning", message: "源模型待归档" });
      pkg.suggestedActions.push("organize");
      pkg.suggestedActions.push("discard");
    }
    if (pkg.governanceState === "draft") {
      pkg.suggestedActions.push("bind_mdl");
      pkg.suggestedActions.push("discard");
    }
    if (pkg.governanceState === "runtime_orphan") {
      pkg.issues.push({ severity: "warning", message: "运行时未归档" });
      pkg.suggestedActions.push("add_to_resource");
      pkg.suggestedActions.push("discard");
    }
    if (pkg.governanceState === "packaged_unused") {
      pkg.issues.push({ severity: "info", message: "已打包未使用" });
      pkg.suggestedActions.push("remove_from_resource");
      pkg.suggestedActions.push("discard");
    }
    if (pkg.governanceState === "adopted") {
      pkg.issues.push({ severity: "info", message: "已采用未引用" });
      pkg.suggestedActions.push("remove_from_resource");
      pkg.suggestedActions.push("copy_lua");
    }
    if (pkg.governanceState === "in_use") {
      pkg.suggestedActions.push("copy_lua");
    }
    if (pkg.governanceState === "broken" && hasScriptReference && !pkg.inResourceTable) {
      pkg.issues.push({ severity: "error", message: "Lua 引用未进表" });
      pkg.suggestedActions.push("add_to_resource");
      pkg.suggestedActions.push("copy_lua");
    }
    if (pkg.governanceState === "broken" && hasScriptReference && !hasRuntimeMdl) {
      pkg.missingParts.push("MDL");
      pkg.issues.push({ severity: "error", message: "Lua 引用缺 MDL" });
    }
    if (pkg.governanceState === "discarded") {
      pkg.suggestedActions.push("restore");
      pkg.suggestedActions.push("delete_package");
    }
    
    if (hasRuntimeMdl && !hasRuntimeMaterial) {
      pkg.missingParts.push("MAT");
      pkg.issues.push({ severity: "warning", message: "缺少 MAT" });
    }
    if (hasRuntimeMdl && pkg.textureFiles.length === 0) {
      pkg.missingParts.push("TEX");
      pkg.issues.push({ severity: "info", message: "未检测到 TEX" });
    }
    if (hasRuntimeMdl && !pkg.inResourceTable && pkg.governanceState !== "discarded") {
      pkg.missingParts.push("RES");
      pkg.issues.push({ severity: "warning", message: "未进 resources.json" });
      if (!pkg.suggestedActions.includes("add_to_resource")) pkg.suggestedActions.push("add_to_resource");
    }
    if (!hasSource && hasRuntimeMdl) {
      pkg.sourceNotes.push("无源 GLB");
    }
    if (!hasRuntimeMdl && hasSource) {
      pkg.missingParts.push("MDL");
    }
    pkg.fileTypes = buildFileTypes(pkg);
  }

  return Array.from(packages.values()).filter((pkg) => !(linkedSourcePackageIds.has(pkg.id) && !pkg.runtimeMdl)).sort((a, b) => {
    const stateDiff = stateRank(a.governanceState) - stateRank(b.governanceState);
    if (stateDiff !== 0) return stateDiff;
    return a.displayName.localeCompare(b.displayName, "zh-Hans-CN");
  });
}

export function organizeModelPackage(projectId: string, packageId: string) {
  const project = getProject(projectId);
  if (!project) throw new Error("Project not found");
  
  const packages = scanModelPackages(projectId);
  const pkg = packages.find(p => p.id === packageId);
  if (!pkg) throw new Error("Model package not found");
  
  if (pkg.isOrganized) return;
  
  const safeName = pkg.displayName.replace(/[^a-zA-Z0-9_-\u4e00-\u9fa5]/g, '_');
  const targetDir = modelSourcePackagePath(project.rootPath, safeName);
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const manifestPath = path.join(targetDir, "manifest.json");
  const manifestData = {
    id: pkg.id,
    displayName: pkg.displayName,
    category: pkg.category,
    purpose: pkg.purpose,
    runtimeMdl: pkg.runtimeMdl,
    isDiscarded: pkg.isDiscarded,
    organizedAt: new Date().toISOString()
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), "utf-8");
  
  const filesToMove = pkg.files.filter(f => f.role !== "runtime_mdl" && f.role !== "material" && f.role !== "texture").map(f => f.relativePath);
  for (const rel of filesToMove) {
    const src = path.join(project.rootPath, rel);
    if (fs.existsSync(src)) {
      const dest = path.join(targetDir, path.basename(src));
      fs.renameSync(src, dest);
      if (fs.existsSync(src + ".meta")) fs.renameSync(src + ".meta", dest + ".meta");
      const gbmDir = src.replace(/\.glb$/i, ".gbm");
      const destGbm = dest.replace(/\.glb$/i, ".gbm");
      if (fs.existsSync(gbmDir)) fs.renameSync(gbmDir, destGbm);
    }
  }
}

export function discardModelPackage(projectId: string, packageId: string) {
  const project = getProject(projectId);
  if (!project) throw new Error("Project not found");
  
  const packages = scanModelPackages(projectId);
  const pkg = packages.find(p => p.id === packageId);
  if (!pkg) throw new Error("Model package not found");
  
  const safeName = pkg.displayName.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_');
  const targetDir = modelDiscardedPackagePath(project.rootPath, safeName);
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const manifestPath = path.join(targetDir, "manifest.json");
  const manifestData = {
    id: pkg.id,
    displayName: pkg.displayName,
    category: pkg.category,
    purpose: pkg.purpose,
    runtimeMdl: pkg.runtimeMdl,
    isDiscarded: true,
    discardedAt: new Date().toISOString()
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), "utf-8");
  
  for (const f of pkg.files) {
    if (f.role === "runtime_mdl" || f.role === "material" || f.role === "texture") continue;
    const src = path.join(project.rootPath, f.relativePath);
    if (fs.existsSync(src)) {
      const dest = path.join(targetDir, path.basename(src));
      if (src !== dest) {
         try { fs.renameSync(src, dest); } catch {}
      }
      if (fs.existsSync(src + ".meta")) {
         try { fs.renameSync(src + ".meta", dest + ".meta"); } catch {}
      }
      const gbmDir = src.replace(/\.glb$/i, ".gbm");
      if (fs.existsSync(gbmDir)) {
         try { fs.renameSync(gbmDir, dest.replace(/\.glb$/i, ".gbm")); } catch {}
      }
    }
  }
}

export function restoreModelPackage(projectId: string, packageId: string) {
  const project = getProject(projectId);
  if (!project) throw new Error("Project not found");

  const packages = scanModelPackages(projectId);
  const pkg = packages.find(p => p.id === packageId);
  if (!pkg) throw new Error("Model package not found");
  if (!pkg.isDiscarded) return;

  const manifestFile = pkg.files.find((file) => file.role === "manifest" && isUnderProjectRoot(file.relativePath, serverManagedAssetRoots.modelDiscarded));
  if (!manifestFile) throw new Error("Discarded manifest not found");

  const discardedDir = path.dirname(path.join(project.rootPath, manifestFile.relativePath));
  const safeName = pkg.displayName.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_');
  const sourceDir = ensureUniquePath(modelSourcePackagePath(project.rootPath, safeName));

  if (!fs.existsSync(discardedDir)) throw new Error("Discarded package directory not found");
  moveDirectoryContents(discardedDir, sourceDir);

  const manifestPath = path.join(sourceDir, "manifest.json");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    manifest.isDiscarded = false;
    delete manifest.discardedAt;
    manifest.restoredAt = new Date().toISOString();
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  }

  try {
    if (fs.existsSync(discardedDir) && fs.readdirSync(discardedDir).length === 0) {
      fs.rmSync(discardedDir, { recursive: true, force: true });
    }
  } catch {
    // Empty directory cleanup is best-effort; restored files are already moved.
  }
}

export function bindModelPackage(projectId: string, packageId: string, mdlPath: string) {
  const project = getProject(projectId);
  if (!project) throw new Error("Project not found");
  
  const packages = scanModelPackages(projectId);
  const pkg = packages.find(p => p.id === packageId);
  if (!pkg) throw new Error("Model package not found");

  if (!pkg.isOrganized) {
    organizeModelPackage(projectId, packageId);
  }
  
  const safeName = pkg.displayName.replace(/[^a-zA-Z0-9_-\u4e00-\u9fa5]/g, '_');
  const manifestPath = path.join(modelSourcePackagePath(project.rootPath, safeName), "manifest.json");
  
  if (fs.existsSync(manifestPath)) {
    const data = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    data.runtimeMdl = mdlPath;
    fs.writeFileSync(manifestPath, JSON.stringify(data, null, 2), "utf-8");
  }
}

export function updateResourceTable(projectId: string, packageId: string, action: "add" | "remove") {
  const project = getProject(projectId);
  if (!project) throw new Error("Project not found");
  
  const packages = scanModelPackages(projectId);
  const pkg = packages.find(p => p.id === packageId);
  if (!pkg) throw new Error("Model package not found");
  
  if (!pkg.runtimeMdl) throw new Error("Model package has no runtime MDL to bind/unbind");
  
  const jsonPath = path.join(project.rootPath, ".project", "resources.json");
  if (!fs.existsSync(jsonPath)) throw new Error("resources.json not found");
  
  // Backup
  const bakPath = jsonPath + ".bak";
  const content = fs.readFileSync(jsonPath, "utf-8");
  fs.writeFileSync(bakPath, content, "utf-8");
  
  try {
    const data = JSON.parse(content);
    if (!data.groups) data.groups = {};
    if (!data.groups.default) data.groups.default = [];
    
    const targetEntries = [
      pkg.runtimeMdl,
      ...pkg.materialXmls,
      ...pkg.textureFiles,
      ...pkg.prefabFiles,
    ].filter((value): value is string => Boolean(value));
    
    const arr: string[] = data.groups.default;
    let modified = false;
    
    if (action === "add") {
       for (const entry of targetEntries) {
         if (!arr.some((existing) => isResourceMatch(existing, entry))) {
           arr.push(entry);
           modified = true;
         }
       }
    } else if (action === "remove") {
       if (pkg.referencedByScripts.length > 0) {
          throw new Error("Cannot remove from resources.json: model is still referenced by Lua scripts.");
       }
       for (let index = arr.length - 1; index >= 0; index--) {
         if (targetEntries.some((target) => isResourceMatch(arr[index], target))) {
           arr.splice(index, 1);
           modified = true;
         }
       }
    }
    
    if (modified) {
      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), "utf-8");
    }
  } catch (e) {
    fs.writeFileSync(jsonPath, content, "utf-8"); // restore
    throw e;
  }
}

export type ModelPackageBatchAction = "organize" | "discard" | "restore" | "add_to_resource" | "remove_from_resource";

export function runModelPackageBatchAction(projectId: string, packageIds: string[], action: ModelPackageBatchAction) {
  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const id of packageIds) {
    try {
      if (action === "organize") organizeModelPackage(projectId, id);
      if (action === "discard") discardModelPackage(projectId, id);
      if (action === "restore") restoreModelPackage(projectId, id);
      if (action === "add_to_resource") updateResourceTable(projectId, id, "add");
      if (action === "remove_from_resource") updateResourceTable(projectId, id, "remove");
      results.push({ id, ok: true });
    } catch (error) {
      results.push({ id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}
