import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ImagePlus, RefreshCw, Search, Wand2, Loader2, Cuboid, FileImage, Package, Layers, FileWarning, LayoutGrid, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { assetPreviewUrl, convertMdlToGltf, type AssetSummary, type ProjectSummary, type TaskRecord, type ToolSummary, type ModelPackageSummary, listModelPackages, organizeModelPackage, bindModelPackage, discardModelPackage, restoreModelPackage, updateModelPackageResource, batchModelPackageAction } from "../../api";
import "@google/model-viewer";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { src?: string; alt?: string; "auto-rotate"?: boolean; "camera-controls"?: boolean; style?: React.CSSProperties; "environment-image"?: string; exposure?: string; "shadow-intensity"?: string; }, HTMLElement>;
    }
  }
}
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
import { FileTypeChips, SelectionBox, StatusBadge, StudioBulkActionBar, StudioMediaDropzone, StudioModeButton, StudioSelectField } from "../../components/studio/StudioKit";
import { collectBatchModelGovernanceActions, managedAssetRoots, modelGovernanceCategoryLabels, modelGovernanceCategoryOrder, modelGovernanceLabels, modelGovernanceTones, modelPackageBelongsToGovernanceCategory, type BatchModelGovernanceAction } from "../assets/assetGovernance";
import { cn } from "../../lib/utils";

function clampFaceLimit(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 20000;
  return Math.min(20000, Math.max(48, parsed));
}

function faceLimitHint(value: string) {
  const limit = clampFaceLimit(value);
  if (limit <= 5000) return "低面数，适合小物件和移动端预览";
  if (limit <= 12000) return "中等面数，质量和体积较均衡";
  return "高面数，质量更高，耗时和消耗通常更高";
}

// --- Main Studio Component ---
type Props = {
  project?: ProjectSummary;
  tools: ToolSummary[];
  assets: AssetSummary[];
  tasks: TaskRecord[];
  busy: boolean;
  onCallTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  onSelectTool?: (tool: ToolSummary) => void;
  onSelectAsset?: (asset: AssetSummary) => void;
  onScanAssets: () => void;
  onDeleteAssets: (relativePaths: string[]) => Promise<void>;
  onMoveAssets?: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onRenameAsset?: (relativePath: string, newName: string) => Promise<void>;
  onImportAssets?: (files: File[], targetFolder: string) => Promise<void>;
};

type Mode = "text_to_model" | "image_to_model" | "multiview_to_model";
type Stage = "input" | "confirm";
type CategoryKey = (typeof modelGovernanceCategoryOrder)[number];
type ConfirmedImagePaths = { front: string; right: string; back: string; left?: string };

function packagePreviewPath(pkg: ModelPackageSummary) {
  return pkg.previewImage ?? pkg.sourceGlb ?? pkg.multiviewImages[0] ?? null;
}

function primaryPath(pkg: ModelPackageSummary) {
  return pkg.previewImage ?? pkg.sourceGlb ?? pkg.runtimeMdl ?? pkg.materialXmls[0] ?? pkg.textureFiles[0] ?? "未关联文件";
}

function copyLuaSnippet(pkg: ModelPackageSummary) {
  const mesh = pkg.runtimeMdl?.replace(/^assets\//, "");
  const material = pkg.materialXmls[0]?.replace(/^assets\//, "");
  return [
    mesh ? `meshPath = "${mesh}"` : undefined,
    material ? `materialPath = "${material}"` : undefined,
  ].filter(Boolean).join(",\n");
}

function packagePathsByFileType(pkg: ModelPackageSummary) {
  const entries: Record<string, string[]> = {
    GLB: pkg.sourceGlb ? [pkg.sourceGlb] : [],
    GBM: pkg.files.filter((file) => file.role === "source_gbm").map((file) => file.relativePath),
    MDL: pkg.runtimeMdl ? [pkg.runtimeMdl] : [],
    MAT: pkg.materialXmls,
    TEX: pkg.textureFiles.filter((file) => !file.endsWith(".meta")),
    PREVIEW: pkg.previewImage ? [pkg.previewImage] : [],
    MULTIVIEW: pkg.multiviewImages,
    PREFAB: pkg.prefabFiles,
    META: pkg.files.filter((file) => file.role.endsWith("_meta")).map((file) => file.relativePath),
    MANIFEST: pkg.files.filter((file) => file.role === "manifest").map((file) => file.relativePath),
    RES: pkg.resourceEntries,
    LUA: pkg.referencedByScripts,
    FLOW: pkg.referencedByFlows,
  };
  return Object.fromEntries(Object.entries(entries).filter(([, paths]) => paths.length > 0));
}

function collectStrings(value: unknown, output: string[] = []) {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, output));
    return output;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, output));
  }
  return output;
}

function extractConfirmedImagePaths(toolResponse: unknown): ConfirmedImagePaths | null {
  const strings = collectStrings(toolResponse);
  const paths = strings
    .flatMap((text) => text.match(/assets[\/\\]image[\/\\][^\s"'<>),]+?\.(?:png|jpe?g|webp)/gi) ?? [])
    .map((text) => text.replace(/\\/g, "/"));
  const uniquePaths = [...new Set(paths)];
  const findView = (view: "front" | "right" | "back" | "left") => uniquePaths.find((path) => path.toLowerCase().includes(view));
  const front = findView("front");
  const right = findView("right");
  const back = findView("back");
  if (!front || !right || !back) return null;
  const left = findView("left");
  return { front, right, back, ...(left ? { left } : {}) };
}

export function Model3DStudio({ project, tools, assets, tasks, busy, onCallTool, onSelectTool, onSelectAsset, onScanAssets, onDeleteAssets, onMoveAssets, onRenameAsset, onImportAssets }: Props) {
  const [mode, setMode] = useState<Mode>("text_to_model");
  const [stage, setStage] = useState<Stage>("input");
  const [rightOpen, setRightOpen] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [singleImage, setSingleImage] = useState("");
  const [multiview, setMultiview] = useState({ front: "", right: "", back: "", left: "" });
  const [confirmedImages, setConfirmedImages] = useState<ConfirmedImagePaths | null>(null);
  const [phaseMessage, setPhaseMessage] = useState("");

  const [subjectType, setSubjectType] = useState("biped");
  const [rig, setRig] = useState(true);
  const [faceLimit, setFaceLimit] = useState("20000");
  const [textureQuality, setTextureQuality] = useState("standard");
  const [seed, setSeed] = useState("");
  const [transparent, setTransparent] = useState(false);

  const [packages, setPackages] = useState<ModelPackageSummary[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<CategoryKey>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeDropzone, setActiveDropzone] = useState<string>("");
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [mdlConverting, setMdlConverting] = useState(false);
  const [mdlError, setMdlError] = useState<string | null>(null);
  const [mdlPreview, setMdlPreview] = useState<{ sourcePath: string; gltfPath: string; version: number } | null>(null);

  const activeModelPackage = useMemo(() => packages.find(p => p.id === selectedIds[0]), [packages, selectedIds]);
  const displayAssetPath = useMemo(() => {
    if (!activeModelPackage) return null;
    if (activeModelPackage.runtimeMdl) return activeModelPackage.runtimeMdl;
    if (activeModelPackage.canPreview && activeModelPackage.sourceGlb) return activeModelPackage.sourceGlb;
    return activeModelPackage.previewImage;
  }, [activeModelPackage]);
  const displayAssetExtension = displayAssetPath?.split(".").pop()?.toLowerCase();

  const modelTool = tools.find(t => t.name === "create_3d_model_task");
  const activeGenerationTask = useMemo(() => tasks.find(t => t.status === "running" && t.toolName === "create_3d_model_task"), [tasks]);

  const refreshPackages = async () => {
    if (!project) return;
    const response = await listModelPackages(project.id);
    setPackages(response.packages);
  };
  useEffect(() => { refreshPackages(); }, [project]);

  async function runPackageAction(action: () => Promise<unknown>) {
    await action();
    await refreshPackages();
    onScanAssets();
  }

  async function runBatchAction(action: BatchModelGovernanceAction) {
    if (!project || selectedIds.length === 0) return;
    const visibleIds = new Set(visiblePackages.map((pkg) => pkg.id));
    const targetIds = selectedIds.filter((id) => visibleIds.has(id));
    if (targetIds.length === 0) return;
    const response = await batchModelPackageAction(project.id, targetIds, action);
    setPackages(response.packages);
    onScanAssets();
    const failed = response.results.filter((result) => !result.ok);
    if (failed.length > 0) {
      setPhaseMessage(`批量操作完成，但 ${failed.length} 个失败：${failed.map((result) => `${result.id}: ${result.error ?? "未知错误"}`).join("；")}`);
    } else {
      setPhaseMessage("批量操作完成");
    }
  }

  function togglePackageSelection(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function selectVisiblePackages() {
    setSelectedIds(visiblePackages.map((pkg) => pkg.id));
  }

  function invertVisiblePackageSelection() {
    setSelectedIds((current) => {
      const visibleIds = visiblePackages.map((pkg) => pkg.id);
      const visibleSet = new Set(visibleIds);
      const hiddenSelected = current.filter((id) => !visibleSet.has(id));
      const currentSet = new Set(current);
      return [...hiddenSelected, ...visibleIds.filter((id) => !currentSet.has(id))];
    });
  }

  function importReferenceImages(files: File[]) {
    if (!onImportAssets || files.length === 0) return;
    void onImportAssets(files, managedAssetRoots.modelReferences).then(() => onScanAssets());
  }

  useEffect(() => {
    if (!project || !displayAssetPath?.toLowerCase().endsWith(".mdl")) {
      setMdlConverting(false);
      setMdlError(null);
      setMdlPreview(null);
      return;
    }
    let cancelled = false;
    setMdlConverting(true);
    setMdlError(null);
    setMdlPreview(null);
    convertMdlToGltf(project.id, displayAssetPath)
      .then((result) => {
        if (cancelled) return;
        setMdlPreview({ sourcePath: displayAssetPath, gltfPath: result.gltfRelativePath, version: Date.now() });
      })
      .catch((error) => {
        if (cancelled) return;
        setMdlError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setMdlConverting(false);
      });
    return () => { cancelled = true; };
  }, [project, displayAssetPath]);

  const categories = useMemo(() => {
    const counts = { all: packages.length, in_use: 0, adopted: 0, packaged_unused: 0, runtime_orphan: 0, draft: 0, source_orphan: 0, discarded: 0, issues: 0 };
    for (const p of packages) {
      if (p.governanceState === "in_use") counts.in_use++;
      else if (p.governanceState === "adopted") counts.adopted++;
      else if (p.governanceState === "packaged_unused") counts.packaged_unused++;
      else if (p.governanceState === "runtime_orphan") counts.runtime_orphan++;
      else if (p.governanceState === "draft") counts.draft++;
      else if (p.governanceState === "source_orphan") counts.source_orphan++;
      else if (p.governanceState === "discarded") counts.discarded++;
      if (p.governanceState !== "discarded" && p.issues.length > 0) counts.issues++;
    }
    const always = new Set<CategoryKey>(["all", "in_use", "runtime_orphan", "discarded", "issues"]);
    return modelGovernanceCategoryOrder.map((key) => ({
      key,
      label: modelGovernanceCategoryLabels[key],
      count: counts[key],
      always: always.has(key)
    })).filter((category) => category.always || category.count > 0);
  }, [packages]);

  useEffect(() => {
    if (!categories.some((category) => category.key === selectedCategoryKey)) {
      setSelectedCategoryKey("all");
    }
  }, [categories, selectedCategoryKey]);

  const visiblePackages = useMemo(() => {
    let list = packages;
    if (selectedCategoryKey !== "all") {
      list = list.filter((pkg) => modelPackageBelongsToGovernanceCategory(pkg, selectedCategoryKey));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.displayName.toLowerCase().includes(q) || p.purpose.toLowerCase().includes(q));
    }
    return list;
  }, [packages, selectedCategoryKey, search]);

  const selectedVisiblePackages = useMemo(() => visiblePackages.filter((pkg) => selectedIds.includes(pkg.id)), [selectedIds, visiblePackages]);

  const batchActions = useMemo(() => {
    return collectBatchModelGovernanceActions(selectedVisiblePackages).map((action) => {
      if (action === "organize") return { id: action, label: "整理", onClick: () => runBatchAction(action).catch(err => setPhaseMessage("批量整理失败: " + (err.message || String(err)))) };
      if (action === "restore") return { id: action, label: "还原", onClick: () => runBatchAction(action).catch(err => setPhaseMessage("批量还原失败: " + (err.message || String(err)))) };
      if (action === "add_to_resource") return { id: action, label: "加入资源表", onClick: () => runBatchAction(action).catch(err => setPhaseMessage("批量进表失败: " + (err.message || String(err)))) };
      if (action === "remove_from_resource") return { id: action, label: "移出资源表", onClick: () => runBatchAction(action).catch(err => setPhaseMessage("批量移出失败: " + (err.message || String(err)))) };
      return { id: action, label: "移入废弃", tone: "warning" as const, onClick: () => runBatchAction(action).catch(err => setPhaseMessage("批量废弃失败: " + (err.message || String(err)))) };
    });
  }, [selectedVisiblePackages]);

  async function handleGenerateViews() {
    if (!modelTool) return;
    const payload: Record<string, unknown> = { mode };
    if (mode === "text_to_model") {
      payload.prompt = prompt;
      payload.subject_type = subjectType;
      if (seed) payload.image_seed = Number(seed);
    } else if (mode === "image_to_model") {
      payload.image = singleImage;
      payload.rig = subjectType === "biped" ? rig : false;
    }
    setPhaseMessage("正在生成四视图，完成后会自动读取返回路径。");
    const response = await onCallTool(modelTool.name, payload);
    const nextImages = extractConfirmedImagePaths(response);
    if (nextImages) {
      setConfirmedImages(nextImages);
      setStage("confirm");
      setPhaseMessage("已读取四视图路径，请确认后继续生成模型。");
    } else {
      setStage("confirm");
      setPhaseMessage("四视图任务已返回，但未在结果中识别到 front/back/right 路径。请在右侧任务 raw result 查看真实返回。");
    }
  }

  async function handleGenerateModel() {
    if (!modelTool) return;
    const payload: Record<string, unknown> = { mode, subject_type: subjectType, rig: subjectType === "biped" ? rig : false, face_limit: clampFaceLimit(faceLimit), texture_quality: textureQuality };
    if (seed) payload.model_seed = Number(seed);

    if (mode === "multiview_to_model") {
      payload.front_image = multiview.front;
      if (multiview.right) payload.right_image = multiview.right;
      if (multiview.back) payload.back_image = multiview.back;
      if (multiview.left) payload.left_image = multiview.left;
      await onCallTool(modelTool.name, payload);
    } else if (mode === "text_to_model" && confirmedImages) {
      payload.prompt = prompt; payload.confirmed_image_paths = confirmedImages;
      await onCallTool(modelTool.name, payload);
    } else if (mode === "image_to_model" && confirmedImages) {
      payload.image = singleImage; payload.confirmed_image_paths = confirmedImages;
      await onCallTool(modelTool.name, payload);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-6 h-full min-h-0 w-full max-w-[1600px] mx-auto relative">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div>
          <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-subtle font-semibold mb-1">
            <Cuboid className="w-3.5 h-3.5" />
            Model 3D Studio
          </span>
          <h1 className="text-xl md:text-2xl font-extrabold text-text m-0">3D 生成工作室</h1>
          <p className="text-xs text-text-muted mt-1 max-w-xl">
            {project ? `当前项目：${project.name}` : "请先选择项目"}
          </p>
        </div>
        
        {/* Mode switcher */}
        <div className="flex items-center p-1 bg-surface-muted rounded-pill border border-border-soft">
          <StudioModeButton active={mode === "text_to_model"} onClick={() => setMode("text_to_model")} icon={<Wand2 className="w-4 h-4" />}>文本生成</StudioModeButton>
          <StudioModeButton active={mode === "image_to_model"} onClick={() => setMode("image_to_model")} icon={<ImagePlus className="w-4 h-4" />}>单图生成</StudioModeButton>
          <StudioModeButton active={mode === "multiview_to_model"} onClick={() => setMode("multiview_to_model")} icon={<Layers className="w-4 h-4" />}>多视图生成</StudioModeButton>
        </div>
      </div>

      <div className="flex-1 flex gap-5 min-h-0 relative">
        {/* Left Parameters Panel (Exactly matching ImageStudio glass UI) */}
        <div className="w-[280px] md:w-[320px] lg:w-[360px] xl:w-[420px] shrink-0 relative rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col min-h-0">
          <div className="absolute inset-0 bg-surface-app/40 backdrop-blur-2xl border border-white/5 rounded-3xl overflow-hidden [mask-image:linear-gradient(white,white)] pointer-events-none" />

          <div className="relative z-10 flex flex-col h-full min-h-0 overflow-hidden rounded-3xl">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-brand/10 blur-[60px] rounded-full pointer-events-none" />
            
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 min-h-0 relative z-10 custom-scrollbar">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
              <div className="flex items-center gap-2">
                 <Wand2 className="w-4 h-4 text-brand" />
                 <span className="text-sm font-black text-text uppercase tracking-widest">创作台</span>
              </div>
              <span className="text-[10px] text-brand-strong bg-brand/10 px-2.5 py-1 rounded-full font-bold">
                 {modelTool ? (mode === "text_to_model" ? "Text to 3D" : mode === "image_to_model" ? "Image to 3D" : "MultiView to 3D") : "等待工具"}
              </span>
            </div>
            
            {stage === "input" ? (
              <>
                {mode === "text_to_model" && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-bold text-text-muted flex items-center justify-between">
                      <span>提示词 (Prompt)</span>
                      <span className="text-[10px] text-brand font-bold bg-brand/10 px-1.5 py-0.5 rounded">必填</span>
                    </Label>
                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="描述你想要的 3D 模型外观..." className="w-full min-h-[140px] rounded-2xl border-2 border-transparent bg-surface-panel px-4 py-3 text-[13px] placeholder:text-text-subtle focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all resize-y shadow-sm" />
                  </div>
                )}

                {mode === "image_to_model" && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-bold text-text-muted flex items-center justify-between">
                      <span>正面参考图</span>
                      <span className="text-[10px] text-brand font-bold bg-brand/10 px-1.5 py-0.5 rounded">必填</span>
                    </Label>
                    <StudioMediaDropzone image={singleImage ? assetPreviewUrl(project?.id ?? "", singleImage) : ""} onChange={(v) => { setSingleImage(v); }} height="h-32" onPickClick={() => { setActiveDropzone("singleImage"); imageInputRef.current?.click(); }} onImportFiles={importReferenceImages} />
                  </div>
                )}

                {mode === "multiview_to_model" && (
                  <div className="flex flex-col gap-2">
                    <Label className="text-xs font-bold text-text-muted flex items-center justify-between">
                      <span>四视图输入</span>
                      <span className="text-[10px] text-brand font-bold bg-brand/10 px-1.5 py-0.5 rounded">必填</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5"><Label className="text-[11px] font-bold text-brand">前视</Label><StudioMediaDropzone image={multiview.front ? assetPreviewUrl(project?.id ?? "", multiview.front) : ""} onChange={(v)=>{ setMultiview(m => ({...m, front: v})); }} height="h-24" onPickClick={() => { setActiveDropzone("multi_front"); imageInputRef.current?.click(); }} onImportFiles={importReferenceImages} /></div>
                      <div className="flex flex-col gap-1.5"><Label className="text-[11px] font-bold text-text-muted">右视</Label><StudioMediaDropzone image={multiview.right ? assetPreviewUrl(project?.id ?? "", multiview.right) : ""} onChange={(v)=>{ setMultiview(m => ({...m, right: v})); }} height="h-24" onPickClick={() => { setActiveDropzone("multi_right"); imageInputRef.current?.click(); }} onImportFiles={importReferenceImages} /></div>
                      <div className="flex flex-col gap-1.5"><Label className="text-[11px] font-bold text-text-muted">后视</Label><StudioMediaDropzone image={multiview.back ? assetPreviewUrl(project?.id ?? "", multiview.back) : ""} onChange={(v)=>{ setMultiview(m => ({...m, back: v})); }} height="h-24" onPickClick={() => { setActiveDropzone("multi_back"); imageInputRef.current?.click(); }} onImportFiles={importReferenceImages} /></div>
                      <div className="flex flex-col gap-1.5"><Label className="text-[11px] font-bold text-text-muted">左视</Label><StudioMediaDropzone image={multiview.left ? assetPreviewUrl(project?.id ?? "", multiview.left) : ""} onChange={(v)=>{ setMultiview(m => ({...m, left: v})); }} height="h-24" onPickClick={() => { setActiveDropzone("multi_left"); imageInputRef.current?.click(); }} onImportFiles={importReferenceImages} /></div>
                    </div>
                  </div>
                )}
                
                <div className="h-px bg-white/5 my-2" />
                
                <StudioSelectField label="模型类型" value={subjectType} onChange={setSubjectType} options={[{ value: "biped", label: "双足人形 (Biped)" }, { value: "quadruped", label: "四足动物" }, { value: "scenery", label: "场景" }, { value: "other", label: "物体 / 其他" }]} />
                
                <div className={cn("flex items-center justify-between p-3 rounded-xl border transition-all h-12", subjectType === "biped" ? "border-brand/30 bg-brand/5" : "border-border bg-surface-muted opacity-60")}>
                  <Label className="text-[13px] font-bold text-text">自动骨骼绑定 (Rig)</Label>
                  <input type="checkbox" checked={rig} disabled={subjectType !== "biped"} onChange={(e) => setRig(e.target.checked)} className="rounded text-brand accent-brand w-4 h-4 cursor-pointer" />
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="text-[13px] text-text p-4 bg-surface-panel rounded-2xl border border-border">{phaseMessage || "请确认生成的四视图，确认无误后点击生成 3D 模型。"}</div>
                <div className="grid grid-cols-2 gap-3 mt-2">
                   <StudioMediaDropzone image={confirmedImages?.front ? assetPreviewUrl(project?.id ?? "", confirmedImages.front) : ""} onChange={()=>{}} height="h-28" />
                   <StudioMediaDropzone image={confirmedImages?.right ? assetPreviewUrl(project?.id ?? "", confirmedImages.right) : ""} onChange={()=>{}} height="h-28" />
                   <StudioMediaDropzone image={confirmedImages?.back ? assetPreviewUrl(project?.id ?? "", confirmedImages.back) : ""} onChange={()=>{}} height="h-28" />
                   <StudioMediaDropzone image={confirmedImages?.left ? assetPreviewUrl(project?.id ?? "", confirmedImages.left) : ""} onChange={()=>{}} height="h-28" />
                </div>
                <Button variant="secondary" className="w-full h-11 rounded-xl font-bold bg-surface-panel border-transparent hover:bg-surface-raised transition-all" onClick={() => setStage("input")}>返回修改参数</Button>
              </div>
            )}
          </div>
          
          {/* Bottom Action Area */}
          <div className="flex flex-col gap-2 border-t border-white/5 bg-surface-panel/40 p-4 backdrop-blur-md shrink-0 relative z-10">
            <div className="flex items-center gap-3 w-full">
              <div className="flex shrink-0 items-center gap-1.5" title="面数限制 48-20000。积分/价格以 MCP 返回的 raw result 为准。">
                <Label className="text-[11px] font-bold text-text whitespace-nowrap">面数限制</Label>
              </div>
              
              <div className="flex items-center gap-1">
                <Input type="number" min={48} max={20000} step={1} value={faceLimit} onChange={(e) => setFaceLimit(e.target.value)} onBlur={() => setFaceLimit(String(clampFaceLimit(faceLimit)))} className="h-7 w-[68px] px-1.5 text-center text-[10px] rounded border-border bg-surface-raised font-bold" />
                <div className="flex shrink-0 items-center gap-0.5 bg-surface-raised p-0.5 rounded-md border border-border">
                  {[5000, 10000, 20000].map((value) => (
                    <button key={value} type="button" onClick={() => setFaceLimit(String(value))} className={cn("h-5 rounded px-1.5 text-[9px] font-bold transition-all", clampFaceLimit(faceLimit) === value ? "bg-surface-app text-brand shadow-sm" : "text-text-muted hover:text-text")}>
                      {value >= 1000 ? `${value / 1000}K` : value}
                    </button>
                  ))}
                </div>
              </div>

              <label className="ml-auto flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-text-muted hover:text-text transition-colors shrink-0 whitespace-nowrap">
                <input type="checkbox" checked={textureQuality === "detailed"} onChange={(e) => setTextureQuality(e.target.checked ? "detailed" : "standard")} className="rounded border-border text-brand accent-brand w-3.5 h-3.5 cursor-pointer" />
                高清贴图
              </label>
            </div>
            
            {stage === "input" && mode !== "multiview_to_model" ? (
              <Button size="lg" onClick={handleGenerateViews} disabled={busy || !project || !modelTool || activeGenerationTask !== undefined || (mode === "text_to_model" && !prompt.trim()) || (mode === "image_to_model" && !singleImage)} className="gap-2 w-full text-[14px] h-11 font-black rounded-xl bg-surface-raised text-text shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0 border-border">
                {activeGenerationTask ? <RefreshCw className="h-5 w-5 animate-spin" /> : <FileImage className="w-5 h-5" />}
                {activeGenerationTask ? "生成中..." : "生成四视图预览 (阶段一)"}
              </Button>
            ) : (
              <Button size="lg" onClick={handleGenerateModel} disabled={busy || !project || !modelTool || activeGenerationTask !== undefined || (stage === "confirm" && !confirmedImages) || (mode === "multiview_to_model" && !multiview.front)} className="gap-2 w-full text-[14px] h-11 font-black rounded-xl bg-gradient-to-r from-brand to-brand-strong text-[#04202a] shadow-lg shadow-brand/20 hover:shadow-brand/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0">
                {activeGenerationTask ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Cuboid className="w-5 h-5" />}
                {activeGenerationTask ? "3D建模中..." : "启动 3D 生成"}
              </Button>
            )}
          </div>
        </div>
      </div>

        {/* Center: Canvas Area */}
        <div className="flex-1 bg-surface-panel border border-border rounded-large flex flex-col min-h-0 overflow-hidden shadow-sm relative">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-4 shrink-0 bg-surface-raised/40 absolute top-0 left-0 right-0 z-10">
            <div className="flex items-center gap-3">
               <span className="text-sm font-bold text-text">3D 预览与资产</span>
            </div>
            {/* Toggle Button for Governance Center */}
            <Button variant="outline" size="sm" className={cn("h-9 text-xs backdrop-blur-md shadow-lg border-border pointer-events-auto rounded-xl", rightOpen ? "bg-brand/10 border-brand/30 text-brand" : "bg-surface-panel/90 text-text-subtle hover:text-text")} onClick={() => setRightOpen(!rightOpen)}>
              <Package className="w-4 h-4 mr-1.5" />
              {rightOpen ? "收起治理中心" : "资产治理中心"}
            </Button>
          </div>
          
          <div className="flex-1 min-h-0 bg-surface-app relative" style={{ backgroundImage: "radial-gradient(var(--color-border) 1px, transparent 1px)", backgroundSize: "16px 16px" }}>
             {displayAssetPath ? (
               displayAssetExtension === "mdl" ? (
                 mdlPreview ? (
                   // @ts-ignore
                 <model-viewer
                     src={`${assetPreviewUrl(project?.id ?? "", mdlPreview.gltfPath)}&v=${mdlPreview.version}`}
                     camera-controls
                     auto-rotate
                     shadow-intensity="1"
                     data-no-app-context-menu
                     class="w-full h-full bg-transparent outline-none"
                   />
                 ) : (
                   <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-surface-app rounded-2xl border border-border-soft shadow-sm text-center">
                     {mdlConverting ? <Loader2 className="w-12 h-12 text-brand mx-auto mb-4 animate-spin" /> : <Cuboid className="w-12 h-12 text-brand mx-auto mb-4" />}
                     <h2 className="text-base font-bold text-text mb-2">Maker 运行时模型</h2>
                     <p className="text-xs text-text-muted">
                       {mdlConverting ? "正在解析 .mdl 并生成浏览器预览用 glTF..." : mdlError ? "MDL 解析或转换失败。" : "选择 .mdl 后会生成 glTF 预览文件。"}
                     </p>
                     {mdlError && <div className="mt-3 rounded-lg bg-red-500/10 p-2 text-[11px] text-red-500 break-words max-w-md">{mdlError}</div>}
                   </div>
                 )
               ) : displayAssetExtension === "glb" || displayAssetExtension === "gltf" ? (
                 // @ts-ignore
                 <model-viewer
                   src={assetPreviewUrl(project?.id ?? "", displayAssetPath)}
                   camera-controls
                   auto-rotate
                   shadow-intensity="1"
                   data-no-app-context-menu
                   class="w-full h-full bg-transparent outline-none"
                 />
               ) : displayAssetExtension === "png" || displayAssetExtension === "jpg" || displayAssetExtension === "jpeg" ? (
                 <div className="absolute inset-0 flex items-center justify-center p-6">
                    <img src={assetPreviewUrl(project?.id ?? "", displayAssetPath)} className="w-full h-full object-contain drop-shadow-2xl" />
                 </div>
               ) : (
                 <div className="absolute inset-0 flex items-center justify-center p-6 text-text-muted text-xs">无法预览此文件格式：{displayAssetExtension}</div>
               )
             ) : (
               <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-6">
                 <div className="w-20 h-20 rounded-full bg-brand/10 flex items-center justify-center shadow-inner">
                   <Cuboid className="w-10 h-10 text-brand opacity-80" />
                 </div>
                 <h3 className="text-lg font-bold text-text">3D 预览区</h3>
                 <p className="text-xs text-text-muted leading-relaxed max-w-sm">
                   在右侧点击展开“资产治理中心”选择模型进行预览，或在左侧重新生成。
                 </p>
               </div>
             )}
          </div>

          {/* Right Floating Drawer */}
          <AnimatePresence>
            {rightOpen && (
              <motion.div initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 300, opacity: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className="absolute right-4 top-16 bottom-4 w-[360px] bg-surface-panel/95 backdrop-blur-xl border border-border-soft rounded-2xl shadow-2xl flex flex-col overflow-hidden z-20 pointer-events-auto">
                <div className="h-14 flex items-center justify-between px-4 border-b border-border-soft shrink-0 bg-surface-app/30">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-brand" />
                    <span className="font-bold text-sm text-text">资产治理中心</span>
                  </div>
                  <div className="flex items-center gap-2">
                     <button className="p-1.5 text-text-muted hover:text-text hover:bg-surface-raised rounded-md transition-colors" onClick={refreshPackages} title="刷新列表"><RefreshCw className="w-3.5 h-3.5" /></button>
                     <Button variant="ghost" size="icon" onClick={() => setRightOpen(false)} className="h-8 w-8 text-text-subtle hover:text-text hover:bg-surface-muted rounded-full">
                       <ChevronRight className="w-4 h-4" />
                     </Button>
                  </div>
                </div>
                
                <div className="p-3 border-b border-border-soft shrink-0 bg-surface-app/10">
                  <div
                    className="mb-3 flex gap-1.5 overflow-x-auto whitespace-nowrap pb-1 custom-scrollbar"
                    onWheel={(event) => {
                      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
                      event.currentTarget.scrollLeft += event.deltaY;
                    }}
                  >
                    {categories.map((cat) => (
                      <button key={cat.key} onClick={() => setSelectedCategoryKey(cat.key as CategoryKey)} className={cn("px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all", selectedCategoryKey === cat.key ? "bg-brand/10 text-brand border border-brand/20 shadow-sm" : "bg-surface-muted text-text-subtle hover:text-text hover:bg-surface-raised border border-transparent")}>
                        {cat.label} <span className="opacity-60 font-normal ml-0.5">{cat.count}</span>
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索模型..." className="w-full h-8 pl-8 text-xs bg-surface-app border-border rounded-md" />
                  </div>
                  <StudioBulkActionBar
                    selectedCount={selectedIds.filter((id) => visiblePackages.some((pkg) => pkg.id === id)).length}
                    allSelected={visiblePackages.length > 0 && visiblePackages.every((pkg) => selectedIds.includes(pkg.id))}
                    onSelectAll={selectVisiblePackages}
                    onInvertSelection={invertVisiblePackageSelection}
                    onClear={() => setSelectedIds([])}
                    actions={batchActions}
                  />
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2 custom-scrollbar">
                  {visiblePackages.map((pkg) => {
                    const selected = selectedIds.includes(pkg.id);
                    return (
                      <div key={pkg.id} onClick={() => setSelectedIds([pkg.id])} className={cn("p-2.5 rounded-xl border transition-all cursor-pointer group flex flex-col gap-2", selected ? "border-brand/50 bg-brand/5 shadow-sm" : "border-border-soft hover:border-brand/30 bg-surface-app")}>
                         <div className="flex items-start gap-3">
                           <SelectionBox selected={selected} onClick={(e) => { e.stopPropagation(); togglePackageSelection(pkg.id); }} title={selected ? "取消选择" : "选择模型包"} />
                           <div className="w-12 h-12 rounded-lg bg-surface-muted shrink-0 overflow-hidden flex items-center justify-center border border-border-soft">
                             {packagePreviewPath(pkg) && packagePreviewPath(pkg)?.match(/\.(png|jpe?g|webp)$/i) ? (
                               <img src={assetPreviewUrl(project?.id ?? "", packagePreviewPath(pkg)!)} className="w-full h-full object-cover" />
                             ) : packagePreviewPath(pkg)?.match(/\.(glb|gltf)$/i) ? (
                               <div className="flex h-full w-full items-center justify-center bg-brand/10 text-brand"><Cuboid className="w-5 h-5" /></div>
                             ) : (
                               <Package className="w-5 h-5 text-text-muted opacity-50" />
                             )}
                           </div>
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center justify-between gap-2">
                               <div className="text-xs font-bold text-text truncate">{pkg.displayName}</div>
                               <StatusBadge tone={modelGovernanceTones[pkg.governanceState]}>{modelGovernanceLabels[pkg.governanceState]}</StatusBadge>
                             </div>
                              <FileTypeChips items={pkg.fileTypes} missing={pkg.missingParts} pathsByType={packagePathsByFileType(pkg)} />
                             <div className="text-[9px] text-text-subtle truncate mt-1.5" title={primaryPath(pkg)}>
                               {primaryPath(pkg)}
                             </div>
                           </div>
                         </div>
                         
                         {selected && (
                           <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="pt-2 border-t border-border-soft flex flex-col gap-2 overflow-hidden">
                              {pkg.sourceNotes.map((note, i) => (
                                 <div key={`source-${i}`} className="flex items-start gap-1.5 rounded bg-surface-muted p-1.5 text-[10px] text-text-muted">
                                    <FileWarning className="h-3 w-3 shrink-0" />
                                    <span className="leading-tight">{note}</span>
                                 </div>
                              ))}
                              {pkg.issues.map((iss, i) => (
                                 <div key={i} className={cn("text-[10px] p-1.5 rounded flex items-start gap-1.5", iss.severity === "warning" ? "bg-amber-500/10 text-amber-600" : iss.severity === "error" ? "bg-red-500/10 text-red-500" : "bg-surface-muted text-text-muted")}>
                                    <FileWarning className="w-3 h-3 shrink-0" />
                                    <span className="leading-tight">{iss.message}</span>
                                 </div>
                              ))}
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                 {pkg.suggestedActions.includes("organize") && <Button size="sm" variant="secondary" className="h-6 text-[10px] px-2 bg-surface-muted text-text hover:bg-surface-raised border-0" onClick={(e) => { e.stopPropagation(); runPackageAction(() => organizeModelPackage(project?.id ?? "", pkg.id)).catch(err => setPhaseMessage("操作失败: " + (err.message || String(err)))); }}>归档整理</Button>}
                                 {pkg.suggestedActions.includes("discard") && <Button size="sm" variant="secondary" className="h-6 text-[10px] px-2 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 border-0" onClick={(e) => { e.stopPropagation(); runPackageAction(() => discardModelPackage(project?.id ?? "", pkg.id)).catch(err => setPhaseMessage("操作失败: " + (err.message || String(err)))); }}>移入废弃区</Button>}
                                 {pkg.suggestedActions.includes("restore") && <Button size="sm" variant="secondary" className="h-6 text-[10px] px-2 bg-brand/10 text-brand hover:bg-brand/20 border-0" onClick={(e) => { e.stopPropagation(); runPackageAction(() => restoreModelPackage(project?.id ?? "", pkg.id)).catch(err => setPhaseMessage("还原失败: " + (err.message || String(err)))); }}>还原</Button>}
                                 {pkg.suggestedActions.includes("add_to_resource") && <Button size="sm" variant="secondary" className="h-6 text-[10px] px-2 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-0" onClick={(e) => { e.stopPropagation(); runPackageAction(() => updateModelPackageResource(project?.id ?? "", pkg.id, "add")).catch(err => setPhaseMessage("操作失败: " + (err.message || String(err)))); }}>加资源表</Button>}
                                 {pkg.suggestedActions.includes("remove_from_resource") && <Button size="sm" variant="secondary" className="h-6 text-[10px] px-2 bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-0" onClick={(e) => { e.stopPropagation(); runPackageAction(() => updateModelPackageResource(project?.id ?? "", pkg.id, "remove")).catch(err => setPhaseMessage("操作失败: " + (err.message || String(err)))); }}>移出资源表</Button>}
                                 {pkg.suggestedActions.includes("copy_lua") && <Button size="sm" variant="secondary" className="h-6 text-[10px] px-2 bg-surface-muted text-text hover:bg-surface-raised border-0" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(copyLuaSnippet(pkg)).catch(() => undefined); }}>复制 Lua</Button>}
                                 {pkg.suggestedActions.includes("delete_package") && <Button size="sm" variant="secondary" className="h-6 text-[10px] px-2 bg-red-500/10 text-red-600 hover:bg-red-500/20 border-0" onClick={(e) => { e.stopPropagation(); const paths = pkg.files.filter((file) => file.exists).map((file) => file.relativePath); onDeleteAssets(paths).then(() => { refreshPackages(); onScanAssets(); }).catch(err => setPhaseMessage("删除失败: " + (err.message || String(err)))); }}>永久删除</Button>}
                              </div>
                           </motion.div>
                         )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Hidden File Input */}
      <input type="file" className="hidden" ref={imageInputRef} accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (evt) => { const result = evt.target?.result as string; if (activeDropzone === "singleImage") setSingleImage(result); else if (activeDropzone === "multi_front") setMultiview(m => ({...m, front: result})); else if (activeDropzone === "multi_right") setMultiview(m => ({...m, right: result})); else if (activeDropzone === "multi_back") setMultiview(m => ({...m, back: result})); else if (activeDropzone === "multi_left") setMultiview(m => ({...m, left: result})); }; reader.readAsDataURL(file); }} />
    </div>
  );
}
