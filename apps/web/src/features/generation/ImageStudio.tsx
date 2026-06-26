import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, ImagePlus, RefreshCw, Settings2, Trash2, Wand2, Activity, Layers, X, Loader2, Clock, ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { assetPreviewUrl, type AssetSummary, type ProjectSummary, type TaskRecord, type ToolSummary } from "../../api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
import { StudioHeader, StudioMediaDropzone, StudioModeButton, StudioPromptField, StudioSelectField } from "../../components/studio/StudioKit";
import { AssetManagerPanel } from "../assets/AssetManagerPanel";
import { defaultAssetImportFolders, defaultImageAssetName, managedAssetRoots } from "../assets/assetGovernance";
import { cn } from "../../lib/utils";
import { TaskProgressBar } from "../../components/studio/TaskProgressBar";
import { calculateAverageDuration } from "../../lib/taskStats";
import {
  readStoredPreference,
  type ImageDefaultMode,
  type ImageDefaultModel,
  type ImageDefaultResolution,
  type ImageThinkingLevel,
} from "../settings/preferences";

type Props = {
  project?: ProjectSummary;
  tools: ToolSummary[];
  assets: AssetSummary[];
  tasks: TaskRecord[];
  busy: boolean;
  onCallTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  onSelectTool: (tool: ToolSummary) => void;
  onSelectAsset?: (asset: AssetSummary) => void;
  onScanAssets: () => void;
  onDeleteAssets: (relativePaths: string[]) => Promise<void>;
  onMoveAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onCopyAssets: (relativePaths: string[], targetFolder: string) => Promise<void>;
  onRenameAsset: (relativePath: string, newName: string) => Promise<void>;
  onRenameDirectory: (directoryPath: string, newName: string) => Promise<void>;
  onMoveDirectory: (directoryPath: string, targetFolder: string) => Promise<void>;
  onCopyDirectory: (directoryPath: string, targetFolder: string) => Promise<void>;
  onDeleteDirectory: (directoryPath: string) => Promise<void>;
  onCreateFolder: (parentFolder: string) => Promise<void>;
  onOpenLocalPath: (relativePath: string, mode: "file" | "directory") => Promise<void>;
  onScanReferences: (relativePaths: string[]) => Promise<void>;
  onImportAssets: (files: File[], targetFolder: string) => Promise<void>;
};

type ImageMode = "generate" | "batch" | "edit";
type ImageModelValue = "auto" | "nanobanana" | "gpt";
type ResolutionValue = "0.5K" | "1K" | "2K" | "4K";
type ThinkingValue = "minimal" | "high";

const targetSizeOptions = [
  { value: "512x512", label: "512 x 512" },
  { value: "1024x1024", label: "1024 x 1024" },
  { value: "1536x1536", label: "1536 x 1536" },
  { value: "1920x1080", label: "1920 x 1080" },
  { value: "1080x1920", label: "1080 x 1920" }
];

const aspectRatioOptions = [
  { value: "1:1", label: "1:1" },
  { value: "2:3", label: "2:3" },
  { value: "3:2", label: "3:2" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
  { value: "21:9", label: "21:9" },
  { value: "5:4", label: "5:4" },
  { value: "4:5", label: "4:5" }
];

const modelOptions = [
  { value: "auto", label: "自动选择 (Auto)" },
  { value: "nanobanana", label: "Nano Banana 2 / Gemini" },
  { value: "gpt", label: "GPT Image 2 / OpenAI" }
];

const resolutionOptions = [
  { value: "0.5K", label: "0.5K" },
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
  { value: "4K", label: "4K" }
];

const thinkingOptions = [
  { value: "minimal", label: "minimal" },
  { value: "high", label: "high" }
];

export function ImageStudio({
  project,
  tools,
  assets,
  tasks,
  busy,
  onCallTool,
  onSelectTool,
  onSelectAsset,
  onScanAssets,
  onDeleteAssets,
  onMoveAssets,
  onCopyAssets,
  onRenameAsset,
  onRenameDirectory,
  onMoveDirectory,
  onCopyDirectory,
  onDeleteDirectory,
  onCreateFolder,
  onOpenLocalPath,
  onScanReferences,
  onImportAssets
}: Props) {
  const [mode, setMode] = useState<ImageMode>(() => readStoredPreference("imageDefaultMode") as ImageDefaultMode);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [batchPrompts, setBatchPrompts] = useState("");
  const [editSourceImage, setEditSourceImage] = useState("");
  const [name, setName] = useState("");
  const [targetSize, setTargetSize] = useState(() => readStoredPreference("imageTargetSize"));
  const [aspectRatio, setAspectRatio] = useState(() => readStoredPreference("imageAspectRatio"));
  const [transparent, setTransparent] = useState(false);
  const [seed, setSeed] = useState("");
  const [thinkingLevel, setThinkingLevel] = useState<ThinkingValue>(() => readStoredPreference("imageThinkingLevel") as ImageThinkingLevel);
  const [resolution, setResolution] = useState<ResolutionValue>(() => readStoredPreference("imageResolution") as ImageDefaultResolution);
  const [model, setModel] = useState<ImageModelValue>(() => readStoredPreference("imageModel") as ImageDefaultModel);
  const [referenceImage, setReferenceImage] = useState("");
  const [viewTab, setViewTab] = useState<"preview" | "manage">("preview");
  const [lightboxAsset, setLightboxAsset] = useState<AssetSummary | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [leftPanelWidth, setLeftPanelWidth] = useState(420);
  const resizeStartRef = useRef<{ pointerX: number; width: number } | null>(null);

  const generateTool = useMemo(() => tools.find((tool) => tool.name === "generate_image"), [tools]);
  const batchTool = useMemo(() => tools.find((tool) => tool.name === "batch_generate_images"), [tools]);
  const editTool = useMemo(() => tools.find((tool) => tool.name === "edit_image"), [tools]);

  const imageAssets = useMemo(() => {
    if (!project) return [];
    return assets
      .filter((asset) => {
        if (asset.projectId !== project.id || asset.assetType !== "image") return false;
        const normalized = asset.relativePath.replace(/\\/g, "/");
        return normalized.startsWith(`${managedAssetRoots.image}/`);
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  }, [assets, project]);

  const activeGenerationTask = useMemo(() => {
    if (!project) return undefined;
    return tasks.find((task) => task.projectId === project.id && (task.toolName === "generate_image" || task.toolName === "batch_generate_images" || task.toolName === "edit_image") && (task.status === "queued" || task.status === "running"));
  }, [project, tasks]);

  const displayAsset = imageAssets && imageAssets.length > 0 ? imageAssets[0] : null;
  const isLastGenerated = displayAsset !== null;

  const previewMetadata = useMemo(() => {
    if (!displayAsset) return null;
    const task = tasks.find(t => t.status === "succeeded" && t.rawResultJson && t.rawResultJson.includes(displayAsset.fileName));
    if (!task) return null;
    try {
      const parsed = JSON.parse(task.inputJson);
      return parsed;
    } catch {
      return null;
    }
  }, [displayAsset, tasks]);

  useEffect(() => {
    if (!activeGenerationTask) {
      setElapsedTime(0);
      return;
    }
    const start = new Date(activeGenerationTask.startedAt).getTime();
    setElapsedTime(Math.floor((Date.now() - start) / 1000));
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeGenerationTask]);

  function handleGenerate() {
    if (!generateTool || !project || !prompt.trim()) return;
    const payload: Record<string, unknown> = {
      prompt: prompt.trim(),
      name: name.trim() || defaultImageAssetName(),
      target_size: targetSize,
      aspect_ratio: aspectRatio,
      transparent,
      resolution,
      thinking_level: thinkingLevel
    };
    const numericSeed = seed.trim();
    if (numericSeed) payload.seed = Number(numericSeed);
    if (referenceImage.trim()) payload.reference_image = referenceImage.trim();
    if (model !== "auto") payload.model = model;
    void onCallTool(generateTool.name, payload);
  }

  function handleBatchGenerate() {
    if (!batchTool || !project || !batchPrompts.trim()) return;
    const prompts = batchPrompts.split("\n").map(p => p.trim()).filter(Boolean);
    if (!prompts.length) return;

    const payload = {
      images: prompts.map(p => {
         const obj: Record<string, unknown> = { prompt: p, name: defaultImageAssetName(), target_size: targetSize, aspect_ratio: aspectRatio, transparent };
         if (resolution !== "1K") obj.resolution = resolution;
         if (thinkingLevel !== "minimal") obj.thinking_level = thinkingLevel;
         const numericSeed = seed.trim();
         if (numericSeed) obj.seed = Number(numericSeed);
         if (referenceImage.trim()) obj.reference_images = [referenceImage.trim()];
         if (model !== "auto") obj.model = model;
         return obj;
      })
    };
    void onCallTool(batchTool.name, payload);
  }

  function handleEditImage() {
    if (!editTool || !project || !prompt.trim() || !editSourceImage.trim()) return;
    const payload: Record<string, unknown> = {
      image: editSourceImage.trim(),
      prompt: prompt.trim(),
      name: name.trim() || defaultImageAssetName(),
      target_size: targetSize,
      aspect_ratio: aspectRatio,
      transparent
    };
    if (resolution !== "1K") payload.resolution = resolution;
    if (thinkingLevel !== "minimal") payload.thinking_level = thinkingLevel;
    const numericSeed = seed.trim();
    if (numericSeed) payload.seed = Number(numericSeed);
    if (referenceImage.trim()) payload.reference_images = [referenceImage.trim()];
    if (model !== "auto") payload.model = model;
    void onCallTool(editTool.name, payload);
  }

  async function handleImport(files: File[] | FileList, targetFolder: string) {
    const list = Array.from(files).filter((file) => file.type.startsWith("image/"));
    if (!list.length || !project) return;
    await onImportAssets(list, targetFolder);
  }

  async function deleteImage(paths: string[]) {
    if (!paths.length) return;
    await onDeleteAssets(paths);
  }

  function usePreviewImageAsReference() {
    if (displayAsset) setReferenceImage(displayAsset.relativePath);
  }

  function usePreviewImageAsEditSource() {
    if (displayAsset) setEditSourceImage(displayAsset.relativePath);
  }

  function startPanelResize(event: React.PointerEvent<HTMLButtonElement>) {
    resizeStartRef.current = { pointerX: event.clientX, width: leftPanelWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function resizePanels(event: React.PointerEvent<HTMLButtonElement>) {
    const start = resizeStartRef.current;
    if (!start) return;
    const nextWidth = Math.min(620, Math.max(280, start.width + event.clientX - start.pointerX));
    setLeftPanelWidth(nextWidth);
  }

  function stopPanelResize(event: React.PointerEvent<HTMLButtonElement>) {
    if (!resizeStartRef.current) return;
    resizeStartRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div className="flex flex-col gap-5 p-6 h-full min-h-0 w-full max-w-[1600px] mx-auto relative">
      <StudioHeader
        icon={<ImageIcon className="w-3.5 h-3.5" />}
        eyebrow="Image Studio"
        title="图像生成工作室"
        projectName={project?.name}
        actions={
          <div className="flex items-center p-1 bg-surface-muted rounded-pill border border-border-soft">
            <StudioModeButton active={mode === "generate"} onClick={() => setMode("generate")} icon={<Wand2 className="w-4 h-4" />}>单图生成</StudioModeButton>
            <StudioModeButton active={mode === "batch"} onClick={() => setMode("batch")} icon={<Layers className="w-4 h-4" />}>批量生成</StudioModeButton>
            <StudioModeButton active={mode === "edit"} onClick={() => setMode("edit")} icon={<ImagePlus className="w-4 h-4" />}>图片编辑</StudioModeButton>
          </div>
        }
      />

      {(mode === "generate" || mode === "batch" || mode === "edit") && (
          <div className="flex-1 flex gap-3 min-h-0 relative">

          {/* Left Parameters Panel */}
          <div
            className="shrink-0 relative rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col min-h-0"
            style={{ width: leftPanelWidth }}
          >
            {/* The Glass Layer with mask-image to fix Chromium bug */}
            <div className="absolute inset-0 bg-surface-app/40 backdrop-blur-2xl border border-white/5 rounded-3xl overflow-hidden [mask-image:linear-gradient(white,white)] pointer-events-none" />

            {/* The clipping layer for children */}
            <div className="relative z-10 flex flex-col h-full min-h-0 overflow-hidden rounded-3xl">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-brand/10 blur-[60px] rounded-full pointer-events-none" />

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 min-h-0 relative z-10">
    <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
      <div className="flex items-center gap-2">
         <Wand2 className="w-4 h-4 text-brand" />
         <span className="text-sm font-black text-text uppercase tracking-widest">创作台</span>
      </div>
      <span className="text-[10px] text-brand-strong bg-brand/10 px-2.5 py-1 rounded-full font-bold">{mode === "generate" ? (generateTool ? "Image Studio" : "等待工具") : mode === "batch" ? (batchTool ? "Batch Studio" : "等待工具") : (editTool ? "Edit Studio" : "等待工具")}</span>
    </div>

        {mode === "edit" && (
      <div className="flex flex-col gap-2">
        <Label className="text-xs font-bold text-text-muted flex items-center justify-between">
          <span>原图 (Source Image)</span>
          <span className="text-[10px] text-brand font-bold bg-brand/10 px-1.5 py-0.5 rounded">必填</span>
        </Label>
        <StudioMediaDropzone
          image={editSourceImage ? assetPreviewUrl(project?.id ?? "", editSourceImage) : ""}
          onChange={setEditSourceImage}
          height="h-32"
          emptyLabel="将图片拖拽至此"
          emptySubLabel="或点击使用当前预览图"
          onPickClick={usePreviewImageAsEditSource}
        />
      </div>
    )}

      {mode === "batch" ? (
         <StudioPromptField
          id="batchPrompts"
          value={batchPrompts}
          onChange={setBatchPrompts}
          label="批量提示词 (Prompts)"
          placeholder={"每行输入一个提示词，批量生成多张图片...\n例如：\n一只可爱的橘猫\n赛博朋克风格的城市"}
          required
        />
      ) : (
         <StudioPromptField
          id="prompt"
          value={prompt}
          onChange={setPrompt}
          label={mode === "edit" ? "修改指令 (Prompt)" : "提示词 (Prompt)"}
          placeholder={mode === "edit" ? "输入修改指令，例如：把背景变成蓝色..." : "描述你想要生成的图像画面，越详细越好..."}
          required
        />
      )}

    <div className={cn("grid gap-4", mode === "batch" || leftPanelWidth < 380 ? "grid-cols-1" : "grid-cols-2")}>
      {mode !== "batch" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="name" className="text-xs font-bold text-text-muted">资源名称</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="留空自动生成"
            className="h-10 rounded-xl bg-surface-raised border-transparent focus:border-brand focus:bg-surface-panel transition-all shadow-inner text-[13px]"
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <StudioSelectField id="target_size" label="目标尺寸" value={targetSize} options={targetSizeOptions} onChange={(size) => {
          setTargetSize(size);
          if (size === "512x512" || size === "1024x1024" || size === "1536x1536") setAspectRatio("1:1");
          else if (size === "1920x1080") setAspectRatio("16:9");
          else if (size === "1080x1920") setAspectRatio("9:16");
        }} />
      </div>
    </div>

    <div className="pt-2">
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className={cn("flex items-center justify-center gap-2 text-[13px] font-bold transition-all w-full py-3 rounded-2xl group", showAdvanced ? "bg-brand/10 text-brand" : "bg-surface-raised text-text-muted hover:bg-surface-panel hover:text-text")}
      >
        <Settings2 className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-90")} />
        参数工坊
        {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />}
      </button>

      <AnimatePresence>
        {showAdvanced && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={cn("grid gap-5 pt-5 pb-2", leftPanelWidth < 430 ? "grid-cols-1" : "grid-cols-2")}>
              <StudioSelectField label="输出分辨率" value={resolution} onChange={(v) => setResolution(v as ResolutionValue)} options={resolutionOptions} />
              <StudioSelectField label="长宽比" value={aspectRatio} onChange={(ratio) => {
                setAspectRatio(ratio);
                if (ratio === "1:1") setTargetSize("1024x1024");
                else if (ratio === "16:9") setTargetSize("1920x1080");
                else if (ratio === "9:16") setTargetSize("1080x1920");
              }} options={aspectRatioOptions} />
              <StudioSelectField label="思考层级" value={thinkingLevel} onChange={(v) => setThinkingLevel(v as ThinkingValue)} options={thinkingOptions} />

              <div className="flex flex-col gap-2">
                <Label htmlFor="seed" className="text-xs font-bold text-text-subtle">随机种子</Label>
                <Input
                  id="seed"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  placeholder="随机"
                  type="number"
                  className="h-10 rounded-xl bg-surface-raised border-transparent focus:border-brand shadow-inner text-[13px]"
                />
              </div>

              {mode !== "edit" && (
              <div className={cn("flex flex-col gap-2 pt-2", leftPanelWidth < 430 ? "col-span-1" : "col-span-2")}>
                <Label className="text-xs font-bold text-text-subtle flex items-center justify-between">
                  <span>附加参考图</span>
                  {referenceImage && <button type="button" className="text-[10px] text-brand hover:text-brand-strong bg-brand/10 px-2 py-0.5 rounded-full transition-colors" onClick={() => setReferenceImage("")}>清除</button>}
                </Label>
                <StudioMediaDropzone
                  image={referenceImage ? assetPreviewUrl(project?.id ?? "", referenceImage) : ""}
                  onChange={setReferenceImage}
                  height="h-32"
                  emptyLabel="将图片拖拽至此"
                  emptySubLabel="或点击使用当前预览图"
                  onPickClick={usePreviewImageAsReference}
                />
              </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

  </div>

  <div className="flex flex-col gap-4 p-6 pt-5 border-t border-white/5 bg-surface-panel/40 shrink-0 relative z-10 rounded-b-3xl">
    <div className={cn("flex gap-4", leftPanelWidth < 390 ? "flex-col items-stretch" : "items-end justify-between")}>
      <div className="flex-1">
        <StudioSelectField label="生成模型" value={model} onChange={(v) => setModel(v as ImageModelValue)} options={modelOptions} />
      </div>
      <div className={cn("shrink-0", leftPanelWidth < 390 ? "" : "mb-0.5")}>
         <button type="button" onClick={() => setTransparent(!transparent)} className={cn("inline-flex items-center gap-2 rounded-xl border-2 h-10 px-4 text-[13px] font-bold transition-all", transparent ? "bg-brand/10 border-brand text-brand-strong" : "bg-surface-raised border-transparent text-text-muted hover:bg-surface-panel hover:text-text")}>
            <div className={cn("w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors", transparent ? "border-brand bg-brand text-white" : "border-text-muted")}>
              {transparent && <Check className="w-2.5 h-2.5" />}
            </div>
            透明背景
         </button>
      </div>
    </div>
    <Button
      size="lg"
      onClick={mode === "generate" ? handleGenerate : mode === "batch" ? handleBatchGenerate : handleEditImage}
      disabled={
        busy || !project || activeGenerationTask !== undefined ||
        (mode === "generate" && (!generateTool || !prompt)) ||
        (mode === "batch" && (!batchTool || !batchPrompts)) ||
        (mode === "edit" && (!editTool || !prompt || !editSourceImage))
      }
      className="gap-2 w-full text-[15px] h-12 font-black rounded-2xl bg-gradient-to-r from-brand to-brand-strong text-white shadow-lg shadow-brand/20 hover:shadow-brand/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0"
    >
      {activeGenerationTask ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
      {activeGenerationTask ? "执行跃迁中..." : mode === "generate" ? "启动生成" : mode === "batch" ? "批量生成" : "启动编辑"}
    </Button>
  </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="调整左右面板宽度"
            title="拖动调整宽度，双击恢复默认"
            className="group relative flex w-3 shrink-0 cursor-col-resize items-stretch justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
            onPointerDown={startPanelResize}
            onPointerMove={resizePanels}
            onPointerUp={stopPanelResize}
            onPointerCancel={stopPanelResize}
            onDoubleClick={() => setLeftPanelWidth(420)}
          >
            <span className="my-4 w-px rounded-full bg-border-soft transition-colors group-hover:bg-brand/60 group-active:bg-brand" />
            <span className="absolute left-1/2 top-1/2 h-10 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface-raised opacity-0 shadow-sm ring-1 ring-border-soft transition-opacity group-hover:opacity-100 group-active:opacity-100" />
          </button>
          {/* Right Gallery & File Manager Panel */}
          <div className="min-w-0 flex-1 bg-surface-panel border border-border rounded-large flex flex-col min-h-0 overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-4 shrink-0 bg-surface-raised/40">
              <div className="flex p-1 bg-surface-app border border-border-soft rounded-lg shadow-inner shrink-0">
                <button onClick={() => setViewTab("preview")} className={cn("px-3 py-1 text-[11px] font-bold rounded transition-all", viewTab === "preview" ? "bg-surface-raised shadow-sm text-text border border-border-soft" : "text-text-subtle hover:text-text")}>预览</button>
                <button onClick={() => setViewTab("manage")} className={cn("px-3 py-1 text-[11px] font-bold rounded transition-all", viewTab === "manage" ? "bg-surface-raised shadow-sm text-text border border-border-soft" : "text-text-subtle hover:text-text")}>图片库</button>
              </div>
              <span className="truncate text-[11px] font-semibold text-text-subtle">{viewTab === "manage" ? managedAssetRoots.image : displayAsset?.relativePath ?? "等待生成结果"}</span>
            </div>
            <div className="flex min-h-0 flex-1 overflow-hidden">
              {viewTab === "preview" ? (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-surface-panel p-6 overflow-y-auto relative">
                   {activeGenerationTask ? (
                     <div className="flex flex-col items-center justify-center w-full h-full max-w-md mx-auto animate-in fade-in duration-500">
                        <div className="relative mb-8">
                          <div className="absolute inset-0 bg-brand/20 blur-xl rounded-full"></div>
                          <Loader2 className="w-16 h-16 text-brand animate-spin relative z-10" />
                        </div>
                        <h3 className="text-xl font-bold text-text mb-2 tracking-wide">图片生成中</h3>
                        <p className="text-sm text-text-subtle mb-8 text-center px-4">
                          正在调度 {activeGenerationTask.toolName === "generate_image" ? "生成" : "批量生成"} 任务，请稍候...
                        </p>
                        <TaskProgressBar
                          elapsedSeconds={elapsedTime}
                          estimatedSeconds={calculateAverageDuration(tasks, activeGenerationTask.toolName) ?? 60}
                          status={activeGenerationTask.status as "queued" | "running"}
                        />
                     </div>
                   ) : displayAsset ? (
                     <div className="flex flex-col items-center max-w-full w-full mt-4">
                       <div className="relative mb-4 shrink-0">
                         <img src={assetPreviewUrl(project?.id ?? "", displayAsset.relativePath)} alt={displayAsset.fileName} className="max-h-[55vh] object-contain rounded-xl shadow-2xl" />
                         {isLastGenerated && (
                           <div className="absolute -top-3 -left-3 bg-brand text-white text-[10px] font-black px-2 py-1 rounded-lg shadow-lg border border-brand/20 rotate-[-5deg] z-10">上次生成</div>
                         )}
                       </div>
                       <div className="w-full max-w-4xl shrink-0 bg-surface-raised/80 p-2.5 pr-3 rounded-xl border border-border flex items-center justify-between gap-4 text-[11px] text-text-subtle shadow-sm relative overflow-hidden">
                         <div className="absolute top-0 left-0 w-1 h-full bg-brand/50"></div>
                         <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-3 flex-1 min-w-0">
                           {previewMetadata?.prompt && (
                             <div className="flex items-center min-w-0">
                               <span className="font-bold text-text-muted mr-1.5 shrink-0">Prompt:</span>
                               <span className="text-text truncate max-w-[200px]" title={previewMetadata.prompt}>{previewMetadata.prompt}</span>
                             </div>
                           )}
                           <div className="flex items-center shrink-0">
                             <span className="font-bold text-text-muted mr-1.5">Model:</span>
                             <span className="bg-surface-app px-1.5 py-0.5 rounded text-text">{previewMetadata?.model || "default"}</span>
                           </div>
                           <div className="flex items-center shrink-0">
                             <span className="font-bold text-text-muted mr-1.5">Size:</span>
                             <span className="bg-surface-app px-1.5 py-0.5 rounded text-text">{previewMetadata?.target_size || "-"}</span>
                           </div>
                           <div className="flex items-center min-w-0 shrink-0">
                             <span className="font-bold text-text-muted mr-1.5 shrink-0">File:</span>
                             <span className="truncate max-w-[180px]" title={displayAsset.relativePath}>{displayAsset.fileName}</span>
                           </div>
                         </div>
                         <div className="shrink-0 pl-3 border-l border-white/5">
                           <Button variant="outline" size="sm" className="text-red-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500 text-[11px] h-7 px-3 rounded-lg" onClick={() => { void deleteImage([displayAsset.relativePath]); }}>
                             <Trash2 className="w-3.5 h-3.5 mr-1" />
                             废弃
                           </Button>
                         </div>
                       </div>
                     </div>
                   ) : (
                     <div className="flex flex-col items-center text-text-subtle opacity-60">
                        <ImagePlus className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-sm font-medium">暂无当前图片</p>
                        <p className="text-xs mt-1">请生成新图片或从图片库选择</p>
                     </div>
                   )}
                </div>
              ) : (
                <AssetManagerPanel
                  assets={imageAssets}
                  disabled={!project}
                  rootPath={managedAssetRoots.image}
                  title="图片管理"
                  defaultTargetFolder={defaultAssetImportFolders.image}
                  assetTypeFilter="image"
                  showTypeFilter={false}
                  showDirectoryTree={false}
                  importAccept="image/*"
                  onScanAssets={onScanAssets}
                  onImportAssets={(files, targetFolder) => handleImport(files, targetFolder)}
                  onDeleteAssets={onDeleteAssets}
                  onMoveAssets={onMoveAssets}
                  onCopyAssets={onCopyAssets}
                  onRenameAsset={onRenameAsset}
                  onRenameDirectory={onRenameDirectory}
                  onMoveDirectory={onMoveDirectory}
                  onCopyDirectory={onCopyDirectory}
                  onDeleteDirectory={onDeleteDirectory}
                  onCreateFolder={onCreateFolder}
                  onOpenLocalPath={onOpenLocalPath}
                  onScanReferences={onScanReferences}
                  onSelectAsset={(asset) => {
                    onSelectAsset?.(asset);
                    setLightboxAsset(asset);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
      {/* Old placeholders removed */}

      <AnimatePresence>
        {lightboxAsset && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6" onClick={() => setLightboxAsset(null)}>
             <img
               src={assetPreviewUrl(lightboxAsset.projectId, lightboxAsset.relativePath)}
               alt={lightboxAsset.fileName}
               className="max-h-[95vh] max-w-[95vw] object-contain shadow-2xl cursor-default"
               onClick={(e) => e.stopPropagation()}
             />
             <Button variant="ghost" size="icon" className="absolute top-4 right-4 h-12 w-12 text-white/50 hover:text-white hover:bg-white/10 rounded-full bg-black/20 backdrop-blur-md" onClick={() => setLightboxAsset(null)}>
                <X className="h-6 w-6" />
             </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
