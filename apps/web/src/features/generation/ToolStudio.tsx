import { useMemo, useState } from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import type { RJSFSchema, UiSchema } from "@rjsf/utils";
import { toast } from "sonner";
import { Braces, Boxes, FileVideo, Music, Play, Search, Wrench, Box, Sparkles, ChevronRight, Activity, Image as ImageIcon } from "lucide-react";
import type { AssetSummary, ProjectSummary, TaskRecord, ToolSummary } from "../../api";
import { RawViewer } from "../../components/developer";
import { cn } from "../../lib/utils";

type StudioCategory = "image" | "video" | "music" | "model3d" | "build" | "status";

type Props = {
  category: StudioCategory;
  title: string;
  project?: ProjectSummary;
  tools: ToolSummary[];
  assets: AssetSummary[];
  tasks: TaskRecord[];
  busy: boolean;
  onCallTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  onSelectTool: (tool: ToolSummary) => void;
  onSelectAsset?: (asset: AssetSummary) => void;
};

const categoryMeta: Record<StudioCategory, { label: string; icon: React.ElementType }> = {
  image: { label: "Image", icon: ImageIcon },
  video: { label: "Video", icon: FileVideo },
  music: { label: "Music", icon: Music },
  model3d: { label: "3D", icon: Box },
  build: { label: "Build", icon: Wrench },
  status: { label: "Status", icon: Braces }
};

const uiSchema: UiSchema = {
  "ui:submitButtonOptions": { norender: true },
  "ui:globalOptions": {
    label: true
  }
};

export function ToolStudio({ category, title, project, tools, assets, tasks, busy, onCallTool, onSelectTool, onSelectAsset }: Props) {
  const categoryTools = useMemo(() => tools.filter((tool) => tool.category === category), [tools, category]);
  const [selectedToolName, setSelectedToolName] = useState("");
  const [query, setQuery] = useState("");
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  
  const selectedTool = useMemo(
    () => categoryTools.find((tool) => tool.name === selectedToolName) ?? categoryTools[0],
    [categoryTools, selectedToolName]
  );
  
  const activeTasks = useMemo(
    () => tasks.filter((task) => selectedTool && task.toolName === selectedTool.name).slice(0, 5),
    [tasks, selectedTool]
  );
  
  const filteredAssets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets.filter((asset) => {
      if (category === "image" && asset.assetType !== "image") return false;
      if (category === "video" && asset.assetType !== "video") return false;
      if (category === "music" && asset.assetType !== "audio") return false;
      if (category === "model3d" && asset.assetType !== "model3d") return false;
      if (!needle) return true;
      return asset.fileName.toLowerCase().includes(needle) || asset.relativePath.toLowerCase().includes(needle);
    }).slice(0, 12);
  }, [assets, category, query]);

  const Icon = categoryMeta[category].icon;
  const schema = selectedTool?.inputSchema as RJSFSchema | undefined;
  const schemaProperties = schema?.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
    ? schema.properties
    : undefined;
  const schemaJson = useMemo(() => selectedTool ? JSON.stringify(selectedTool.inputSchema, null, 2) : "", [selectedTool]);

  function changeTool(tool: ToolSummary) {
    setSelectedToolName(tool.name);
    setFormData({});
    onSelectTool(tool);
  }

  async function submit(event: { formData?: unknown }) {
    if (!selectedTool || !event.formData || typeof event.formData !== "object" || Array.isArray(event.formData)) return;
    const submitted = event.formData as Record<string, unknown>;
    const guardedData = schemaProperties
      ? Object.fromEntries(Object.entries(submitted).filter(([key]) => Object.prototype.hasOwnProperty.call(schemaProperties, key)))
      : submitted;
    await toast.promise(onCallTool(selectedTool.name, guardedData), {
      loading: `正在执行 ${selectedTool.name}`,
      success: `${selectedTool.name} 已提交`,
      error: `${selectedTool.name} 执行失败`
    });
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col gap-6 overflow-hidden p-6 md:p-8">
      
      {/* 华丽头部区域 */}
      <div className="flex shrink-0 items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex items-center gap-5">
           <div className="w-[52px] h-[52px] rounded-2xl bg-brand/10 border border-brand/20 flex items-center justify-center shadow-[0_0_20px_rgba(0,217,197,0.15)] relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-br from-brand/20 to-transparent opacity-50" />
             <Icon className="w-7 h-7 text-brand-strong relative z-10" strokeWidth={2.5} />
           </div>
           <div>
             <h1 className="text-[24px] font-black text-text tracking-tight flex items-center gap-2 m-0">
               {categoryMeta[category].label} Studio
             </h1>
             <p className="text-[13px] text-text-subtle font-medium mt-1">
               {title} {project ? <span className="text-brand/80 ml-2">· 当前项目：{project.name}</span> : ""}
             </p>
           </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface-panel px-4 py-2 text-[13px] font-bold text-text shadow-sm">
          <Sparkles className="h-4 w-4 text-brand-strong" />
          <span>{categoryTools.length} 核心工具</span>
        </div>
      </div>

      {/* 主体三列工作区 */}
      <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(340px,1fr)_280px] gap-6 overflow-hidden max-[1180px]:grid-cols-[240px_minmax(340px,1fr)] max-[900px]:grid-cols-1">
        
        {/* 左侧：工具目录 */}
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface-panel shadow-sm animate-in fade-in slide-in-from-left-4 duration-500 delay-100">
          <div className="border-b border-border-soft px-5 py-4 bg-surface-muted/30">
            <h2 className="m-0 text-[13px] font-bold uppercase tracking-widest text-text-subtle flex items-center gap-2">
              <Boxes className="w-4 h-4" /> 工具引擎目录
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
            {categoryTools.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted opacity-70">
                <Boxes className="w-10 h-10 mx-auto mb-3 opacity-50" />
                当前项目暂无此分类工具
              </div>
            ) : (
              categoryTools.map((tool) => (
                <button
                  key={tool.name}
                  type="button"
                  onClick={() => changeTool(tool)}
                  className={cn(
                    "mb-2 flex w-full flex-col gap-1.5 rounded-xl border px-4 py-3 text-left transition-all duration-200 group outline-none",
                    selectedTool?.name === tool.name
                      ? "border-brand/40 bg-brand/10 text-brand-strong shadow-[0_0_15px_rgba(0,217,197,0.05)]"
                      : "border-transparent text-text-muted hover:border-border-soft hover:bg-surface-raised hover:text-text cursor-pointer"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <strong className="truncate text-[14px] font-bold">{tool.name}</strong>
                    <ChevronRight className={cn("w-4 h-4 transition-transform", selectedTool?.name === tool.name ? "text-brand translate-x-1" : "opacity-0 group-hover:opacity-100 group-hover:translate-x-1")} />
                  </div>
                  <span className="truncate text-[11px] opacity-80 font-mono">
                    {tool.required.length ? `REQ: ${tool.required.join(", ")}` : "OPTIONAL ONLY"}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* 中间：表单与执行区 */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface-panel shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 relative group">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brand/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <div className="flex items-center justify-between gap-4 border-b border-border-soft px-6 py-4 bg-surface-muted/10">
            <div className="min-w-0">
              <h2 className="m-0 truncate text-[16px] font-black text-text flex items-center gap-2">
                <Wrench className="w-4 h-4 text-brand" /> {selectedTool?.name ?? "未加载工具"}
              </h2>
              <p className="mt-1 truncate text-[12px] text-text-subtle">由底层 Schema 动态渲染的原生参数面板</p>
            </div>
            <button
              disabled={!selectedTool || busy || !project}
              onClick={() => document.getElementById("mcp-schema-form-submit")?.click()}
              className="relative inline-flex items-center justify-center gap-2 whitespace-nowrap text-[13px] font-bold transition-all cursor-pointer bg-text text-surface-app hover:bg-brand hover:text-[#04202a] px-6 py-2.5 h-[36px] rounded-full shadow-sm disabled:opacity-50 disabled:cursor-not-allowed group/btn overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
              <Play className="h-4 w-4 fill-current relative z-10" />
              <span className="relative z-10">立即执行</span>
            </button>
          </div>
          
          <div className="schema-form-host flex-1 overflow-y-auto p-6 scrollbar-thin">
            {selectedTool && schema ? (
              <div className="animate-in fade-in duration-300">
                <Form
                  schema={schema}
                  uiSchema={uiSchema}
                  validator={validator}
                  formData={formData}
                  disabled={busy || !project}
                  showErrorList={false}
                  onChange={(event) => setFormData((event.formData ?? {}) as Record<string, unknown>)}
                  onSubmit={submit}
                >
                  <button id="mcp-schema-form-submit" type="submit" className="hidden" />
                </Form>
                <RawViewer
                  title="工具 Schema"
                  value={schemaJson}
                  language="json"
                  height="260px"
                  copyLabel="复制 schema"
                  copySuccessMessage="工具 Schema 已复制"
                  className="mt-5"
                />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center rounded-xl border border-dashed border-border-soft p-8 text-center bg-surface-muted/30">
                <div className="w-12 h-12 rounded-full bg-surface-raised border border-border flex items-center justify-center mb-4">
                  <Braces className="w-6 h-6 text-text-muted" />
                </div>
                <strong className="block text-sm font-bold text-text mb-1">等待工具载入</strong>
                <p className="text-[12px] text-text-subtle">选择左侧工具后，这里将自动构建交互表单</p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：资产与日志 */}
        <aside className="flex min-h-0 flex-col gap-6 overflow-hidden max-[1180px]:hidden animate-in fade-in slide-in-from-right-4 duration-500 delay-300">
          
          {/* 生成资产 */}
          <div className="flex min-h-0 flex-[1.2] flex-col rounded-2xl border border-border bg-surface-panel shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-border-soft px-5 py-4 bg-surface-muted/30">
              <h2 className="m-0 text-[13px] font-bold uppercase tracking-widest text-text-subtle flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> 生成资产
              </h2>
            </div>
            <div className="p-3 border-b border-border-soft bg-surface-app/50">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-subtle" />
                <input 
                  value={query} 
                  onChange={(event) => setQuery(event.target.value)} 
                  className="w-full h-[32px] rounded-full border border-border bg-surface-panel pl-9 pr-4 text-[12px] text-text placeholder:text-text-muted outline-none focus:border-brand/50 focus:shadow-[0_0_0_2px_rgba(0,217,197,0.1)] transition-all" 
                  placeholder="搜索本地资产..." 
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
              {filteredAssets.length === 0 ? (
                <div className="p-6 text-center text-[12px] text-text-muted opacity-80">
                  暂无相关文件产生。
                </div>
              ) : filteredAssets.map((asset) => (
                <button key={asset.id} type="button" onClick={() => onSelectAsset?.(asset)} className="group mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-surface-raised border border-transparent hover:border-border-soft transition-all cursor-pointer">
                  <span className="h-9 w-9 shrink-0 rounded-lg bg-surface-muted border border-border-soft text-text-muted group-hover:text-brand-strong group-hover:bg-brand/10 group-hover:border-brand/20 transition-colors flex items-center justify-center text-[10px] font-bold uppercase shadow-sm">
                    {asset.extension.replace(".", "").slice(0, 3)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[12px] font-semibold text-text group-hover:text-brand transition-colors">{asset.fileName}</strong>
                    <span className="block truncate text-[10px] text-text-subtle font-mono mt-0.5">{asset.relativePath}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 最近调用任务 */}
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-surface-panel shadow-sm">
            <div className="border-b border-border-soft px-5 py-4 bg-surface-muted/30">
              <h2 className="m-0 text-[13px] font-bold uppercase tracking-widest text-text-subtle flex items-center gap-2">
                <Activity className="w-4 h-4" /> 运行追踪
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
              <div className="flex flex-col gap-2">
                {activeTasks.length === 0 ? (
                  <div className="p-4 text-center text-[12px] text-text-muted">暂无该工具的调用记录。</div>
                ) : activeTasks.map((task) => (
                  <div key={task.taskId} className="flex flex-col gap-1.5 rounded-xl border border-border-soft bg-surface-raised px-3 py-2.5 text-[11px] shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className={cn("px-2 py-0.5 rounded-full font-bold uppercase text-[9px]", task.status === "succeeded" ? "bg-green-500/10 text-green-500" : task.status === "failed" ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500")}>
                        {task.status}
                      </span>
                      <span className="text-text-subtle font-mono">{task.startedAt}</span>
                    </div>
                    <span className="text-text-muted truncate font-mono text-[10px]" title={task.taskId}>{task.taskId.split("-")[0]}...</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

      </div>
    </section>
  );
}

