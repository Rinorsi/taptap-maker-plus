import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, RefreshCw, Settings2, Wand2, Music, Tag } from "lucide-react";
import { listAssets, type AssetSummary, type ProjectSummary, type TaskRecord, type ToolSummary } from "../../api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
import { StudioHeader, StudioPromptField, StudioSelectField } from "../../components/studio/StudioKit";
import { AssetManagerPanel } from "../assets/AssetManagerPanel";
import { defaultAssetImportFolders, defaultMusicAssetName, managedAssetRoots } from "../assets/assetGovernance";
import { cn } from "../../lib/utils";
import { TaskProgressBar } from "../../components/studio/TaskProgressBar";
import { calculateAverageDuration } from "../../lib/taskStats";
import { readStoredPreference, type MusicDefaultModel, type MusicVocalGender } from "../settings/preferences";

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

const PRESETS = [
  { label: "电子", style: "electronic, upbeat" },
  { label: "氛围", style: "ambient, relaxing" },
  { label: "战斗", style: "epic, orchestral, battle" },
  { label: "菜单", style: "casual, lo-fi, chill" },
  { label: "赛博", style: "cyberpunk, synthwave" },
  { label: "幻想", style: "fantasy, magical" },
  { label: "可爱", style: "cute, kawaii, cheerful" },
  { label: "低保真", style: "lofi hiphop, chill" },
  { label: "管弦", style: "orchestral, cinematic" },
  { label: "钢琴", style: "piano solo, emotional" },
  { label: "合成器", style: "synthpop, 80s" },
  { label: "节奏感", style: "rhythmic, percussion, groovy" },
  { label: "轻快", style: "upbeat, happy, acoustic" },
  { label: "黑暗", style: "dark, creepy, horror" },
];

const MODELS = [
  { value: "V4_5", label: "V4_5 (推荐)" },
  { value: "V5", label: "V5 (最新)" },
  { value: "V4_5PLUS", label: "V4_5 PLUS" },
  { value: "V4", label: "V4" },
  { value: "V3_5", label: "V3_5" },
];

export function MusicStudio({
  project,
  tools,
  assets,
  tasks,
  busy,
  onCallTool,
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
  // Config state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState("");
  const [negativeTags, setNegativeTags] = useState("");
  const [model, setModel] = useState<string>(() => readStoredPreference("musicModel") as MusicDefaultModel);
  const [instrumental, setInstrumental] = useState<boolean>(() => readStoredPreference("musicInstrumental"));
  const [vocalGender, setVocalGender] = useState<"m" | "f">(() => readStoredPreference("musicVocalGender") as MusicVocalGender);

  const [audioLibraryAssets, setAudioLibraryAssets] = useState<AssetSummary[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [leftPanelWidth, setLeftPanelWidth] = useState(420);
  const resizeStartRef = useRef<{ pointerX: number; width: number } | null>(null);

  function startPanelResize(event: React.PointerEvent<HTMLButtonElement>) {
    resizeStartRef.current = { pointerX: event.clientX, width: leftPanelWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function resizePanels(event: React.PointerEvent<HTMLButtonElement>) {
    const start = resizeStartRef.current;
    if (!start) return;
    const nextWidth = Math.min(620, Math.max(360, start.width + event.clientX - start.pointerX));
    setLeftPanelWidth(nextWidth);
  }

  function stopPanelResize(event: React.PointerEvent<HTMLButtonElement>) {
    if (!resizeStartRef.current) return;
    resizeStartRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  async function refreshAudioLibrary(projectId = project?.id) {
    if (!projectId) {
      setAudioLibraryAssets([]);
      return;
    }
    const nextAssets = await listAssets(projectId, { assetType: "audio", rootPrefix: managedAssetRoots.audio, limit: 1000 }).catch(() => []);
    setAudioLibraryAssets(nextAssets);
  }

  useEffect(() => {
    if (!project) {
      setAudioLibraryAssets([]);
      return;
    }
    let canceled = false;
    listAssets(project.id, { assetType: "audio", rootPrefix: managedAssetRoots.audio, limit: 1000 })
      .then((nextAssets) => {
        if (!canceled) setAudioLibraryAssets(nextAssets);
      })
      .catch(() => {
        if (!canceled) setAudioLibraryAssets([]);
      });
    return () => {
      canceled = true;
    };
  }, [project]);

  const audioAssets = useMemo(() => {
    if (!project) return [];
    const byPath = new Map<string, AssetSummary>();
    for (const asset of assets) byPath.set(asset.relativePath, asset);
    for (const asset of audioLibraryAssets) byPath.set(asset.relativePath, asset);
    return Array.from(byPath.values())
      .filter((asset) => {
        if (asset.projectId !== project.id || asset.assetType !== "audio") return false;
        const normalized = asset.relativePath.replace(/\\/g, "/");
        return normalized.startsWith(`${managedAssetRoots.audio}/`);
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
  }, [assets, audioLibraryAssets, project]);
  
  const activeGenerationTask = useMemo(() => {
    if (!project) return undefined;
    return tasks.find((task) => task.projectId === project.id && task.toolName === "text_to_music" && (task.status === "queued" || task.status === "running"));
  }, [project, tasks]);

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

  const musicTool = tools.find((t) => t.name === "text_to_music");

  function createFallbackTitle() {
    return defaultMusicAssetName();
  }

  function handleGenerate() {
    if (!musicTool || !project || !prompt.trim()) return;

    const isCustom = showAdvanced && !!(title.trim() || style.trim());

    const payload: Record<string, unknown> = {
      prompt: prompt.trim(),
      customMode: isCustom,
      model,
    };

    if (showAdvanced && negativeTags.trim()) {
      payload.negativeTags = negativeTags.trim();
    }

    if (isCustom) {
      // both are required by schema if customMode=true
      if (!title.trim() || !style.trim()) {
        if (!style.trim()) return;
      }
      payload.title = title.trim() || createFallbackTitle();
      payload.style = style.trim();
      payload.instrumental = instrumental;
      
      if (!instrumental) {
        payload.vocalGender = vocalGender;
      }
    }

    void onCallTool(musicTool.name, payload);
  }

  const isPresetActive = (preset: typeof PRESETS[0]) => {
    if (!style) return false;
    const currentStyles = style.split(',').map(s => s.trim()).filter(Boolean);
    const presetStyles = preset.style.split(',').map(s => s.trim()).filter(Boolean);
    return presetStyles.length > 0 && presetStyles.every(ps => currentStyles.includes(ps));
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setStyle(prev => {
      const currentStyles = prev ? prev.split(',').map(s => s.trim()).filter(Boolean) : [];
      const presetStyles = preset.style.split(',').map(s => s.trim()).filter(Boolean);
      
      const hasAll = presetStyles.every(ps => currentStyles.includes(ps));
      
      if (hasAll) {
        // Remove preset styles
        const newStyles = currentStyles.filter(cs => !presetStyles.includes(cs));
        return newStyles.join(', ');
      } else {
        // Add preset styles, avoiding duplicates
        const newStyles = [...currentStyles];
        for (const ps of presetStyles) {
          if (!newStyles.includes(ps)) {
            newStyles.push(ps);
          }
        }
        return newStyles.join(', ');
      }
    });
  };

  async function handleImport(files: File[] | FileList, targetFolder: string) {
    const list = Array.from(files).filter((file) => file.type.startsWith("audio/"));
    if (!list.length || !project) return;
    await onImportAssets(list, targetFolder);
    await refreshAudioLibrary(project.id);
  }

  return (
    <div className="flex flex-col gap-5 p-6 h-full min-h-0 w-full max-w-[1600px] mx-auto relative">
      <StudioHeader 
        icon={<Music className="w-3.5 h-3.5" />} 
        eyebrow="Music Studio" 
        title="音乐创作工坊" 
        projectName={project?.name} 
      />
      
      <div className="flex-1 flex gap-5 min-h-0 relative">
        
        {/* Left Parameters Panel */}
        <div
          className="shrink-0 relative rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col min-h-0"
          style={{ width: leftPanelWidth }}
        >
          <div className="absolute inset-0 bg-surface-app/40 backdrop-blur-2xl border border-white/5 rounded-3xl overflow-hidden [mask-image:linear-gradient(white,white)] pointer-events-none" />

          <div className="relative z-10 flex flex-col h-full min-h-0 rounded-3xl">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-32 bg-brand/10 blur-[60px] rounded-full pointer-events-none" />
            
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 min-h-0 relative z-10 scrollbar-thin">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 shrink-0">
              <div className="flex items-center gap-2">
                 <Wand2 className="w-4 h-4 text-brand" />
                 <span className="text-sm font-black text-text uppercase tracking-widest">创作台</span>
              </div>
              <span className="text-[10px] text-brand-strong bg-brand/10 px-2.5 py-1 rounded-full font-bold">Music Studio</span>
            </div>
            
            <StudioPromptField
              id="musicPrompt"
              label={showAdvanced ? "提示词/歌词 (Prompt)" : "音乐描述 (Prompt)"}
              value={prompt}
              onChange={setPrompt}
              placeholder={showAdvanced ? "输入多行详尽的歌词及风格指令..." : "输入简单的描述，例如：一首欢快的流行歌曲"}
              required
              meta={<span className="text-[10px] font-normal text-text-muted">{prompt.length}/500</span>}
            />

            <div className="pt-2">
              <button 
                type="button" 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn("flex items-center justify-center gap-2 text-[13px] font-bold transition-all w-full py-3 rounded-2xl group", showAdvanced ? "bg-brand/10 text-brand" : "bg-surface-raised text-text-muted hover:bg-surface-panel hover:text-text")}
              >
                <Settings2 className={cn("w-4 h-4 transition-transform", showAdvanced && "rotate-90")} />
                高级控制参数 (自定义音乐)
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
                    <div className="flex flex-col gap-6 pt-5 pb-2">
                      {/* Presets Panel */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-text-subtle">风格预设 (快捷填充)</Label>
                        <div className="flex flex-wrap gap-1.5">
                          {PRESETS.map((p, i) => {
                            const active = isPresetActive(p);
                            return (
                              <button
                                key={i}
                                className={cn("px-2 py-1 border rounded text-[10px] font-medium transition-colors flex items-center gap-1", active ? "bg-brand/20 border-brand text-brand" : "bg-surface-muted hover:bg-brand/10 hover:text-brand border-border-soft text-text-subtle")}
                                onClick={() => applyPreset(p)}
                              >
                                <Tag className="w-2.5 h-2.5" />
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Title & Style */}
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs font-bold text-text-muted flex items-center justify-between">
                            <span>曲名 (Title)</span>
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] text-text-muted font-normal">{title.length}/80</span>
                               <span className="text-[10px] text-brand font-bold bg-brand/10 px-1.5 py-0.5 rounded">自定必备</span>
                            </div>
                          </Label>
                          <Input 
                            value={title} 
                            onChange={e => setTitle(e.target.value.substring(0, 80))} 
                            placeholder="例如: Epic Battle" 
                            className="h-10 rounded-xl bg-surface-raised border-transparent focus:border-brand focus:bg-surface-panel transition-all shadow-inner text-[13px]" 
                          />
                        </div>
                        <StudioPromptField
                          id="style"
                          label="风格 (Style)"
                          value={style}
                          onChange={setStyle}
                          placeholder="electronic, ambient, epic... 可以输入多个风格标签，用逗号分隔"
                          minHeightClass="min-h-[80px]"
                          meta={<span className="text-[10px] text-brand font-bold bg-brand/10 px-1.5 py-0.5 rounded">自定必备</span>}
                        />
                      </div>

                      {/* Negative Tags */}
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs font-bold text-text-muted">排除元素 (Negative Tags)</Label>
                        <Input 
                          value={negativeTags} 
                          onChange={e => setNegativeTags(e.target.value)} 
                          placeholder="不需要的声音..." 
                          className="h-10 rounded-xl bg-surface-raised border-transparent focus:border-brand focus:bg-surface-panel transition-all shadow-inner text-[13px]" 
                        />
                      </div>
                      
                      {/* Vocal Gender - Only show if not instrumental */}
                      {!instrumental && (
                        <div className="flex flex-col gap-2">
                          <Label className="text-xs font-bold text-text-muted">人声选项</Label>
                          <div className="flex items-center gap-2">
                             <button type="button" onClick={() => setVocalGender("m")} className={cn("inline-flex items-center gap-2 rounded-xl border-2 h-10 px-4 text-[13px] font-bold transition-all", vocalGender === "m" ? "bg-brand/10 border-brand text-brand-strong" : "bg-surface-raised border-transparent text-text-muted hover:bg-surface-panel hover:text-text")}>
                                <div className={cn("w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors", vocalGender === "m" ? "border-brand bg-brand text-white" : "border-text-muted")}>
                                  {vocalGender === "m" && <div className="w-1.5 h-1.5 bg-[#04202a] rounded-full" />}
                                </div>
                                男声
                             </button>
                             <button type="button" onClick={() => setVocalGender("f")} className={cn("inline-flex items-center gap-2 rounded-xl border-2 h-10 px-4 text-[13px] font-bold transition-all", vocalGender === "f" ? "bg-brand/10 border-brand text-brand-strong" : "bg-surface-raised border-transparent text-text-muted hover:bg-surface-panel hover:text-text")}>
                                <div className={cn("w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-colors", vocalGender === "f" ? "border-brand bg-brand text-white" : "border-text-muted")}>
                                  {vocalGender === "f" && <div className="w-1.5 h-1.5 bg-[#04202a] rounded-full" />}
                                </div>
                                女声
                             </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="p-6 bg-surface-raised/40 border-t border-white/5 shrink-0 relative z-10 flex flex-col gap-4 rounded-b-3xl">
             {activeGenerationTask && (
               <TaskProgressBar
                 elapsedSeconds={elapsedTime}
                 estimatedSeconds={calculateAverageDuration(tasks, "text_to_music") ?? 60}
                 status={activeGenerationTask.status as "queued" | "running"}
               />
             )}

             {/* Bottom Bar Options */}
             <div className="grid grid-cols-2 gap-4 w-full">
               <div className="col-span-1">
                 <StudioSelectField
                    label="模型 (Model)"
                    value={model}
                    onChange={setModel}
                    options={MODELS}
                  />
               </div>
               <div className="col-span-1">
                 <StudioSelectField
                    label="音乐类型"
                    value={instrumental ? "true" : "false"}
                    onChange={(v) => setInstrumental(v === "true")}
                    options={[
                      { value: "true", label: "纯音乐 (Instrumental)" },
                      { value: "false", label: "含人声 (Vocal)" }
                    ]}
                  />
               </div>
             </div>

             <Button 
              size="lg" 
              onClick={handleGenerate} 
              disabled={busy || !prompt.trim() || Boolean(showAdvanced && (title.trim() || style.trim()) && !style.trim())}
              className="gap-2 w-full text-[15px] h-12 font-black rounded-2xl bg-gradient-to-r from-brand to-brand-strong text-white shadow-lg shadow-brand/20 hover:shadow-brand/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {activeGenerationTask ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Music className="w-5 h-5" />}
              {activeGenerationTask ? "生成调度中..." : "启动生成"}
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

        <AssetManagerPanel
          assets={audioAssets}
          disabled={!project}
          rootPath={managedAssetRoots.audio}
          title="音频管理"
          defaultTargetFolder={defaultAssetImportFolders.audio}
          assetTypeFilter="audio"
          showTypeFilter={false}
          showDirectoryTree={false}
          importAccept="audio/*"
          onScanAssets={() => {
            onScanAssets();
            void refreshAudioLibrary();
          }}
          onImportAssets={(files, targetFolder) => handleImport(files, targetFolder)}
          onDeleteAssets={async (paths) => {
            await onDeleteAssets(paths);
            await refreshAudioLibrary();
          }}
          onMoveAssets={async (paths, targetFolder) => {
            await onMoveAssets(paths, targetFolder);
            await refreshAudioLibrary();
          }}
          onCopyAssets={async (paths, targetFolder) => {
            await onCopyAssets(paths, targetFolder);
            await refreshAudioLibrary();
          }}
          onRenameAsset={async (path, newName) => {
            await onRenameAsset(path, newName);
            await refreshAudioLibrary();
          }}
          onRenameDirectory={async (path, newName) => {
            await onRenameDirectory(path, newName);
            await refreshAudioLibrary();
          }}
          onMoveDirectory={async (path, targetFolder) => {
            await onMoveDirectory(path, targetFolder);
            await refreshAudioLibrary();
          }}
          onCopyDirectory={async (path, targetFolder) => {
            await onCopyDirectory(path, targetFolder);
            await refreshAudioLibrary();
          }}
          onDeleteDirectory={async (path) => {
            await onDeleteDirectory(path);
            await refreshAudioLibrary();
          }}
          onCreateFolder={async (parentFolder) => {
            await onCreateFolder(parentFolder);
            await refreshAudioLibrary();
          }}
          onOpenLocalPath={onOpenLocalPath}
          onScanReferences={onScanReferences}
          onSelectAsset={(asset) => onSelectAsset?.(asset)}
        />
      </div>
    </div>
  );
}
