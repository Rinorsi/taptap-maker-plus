import { motion } from "framer-motion";
import { Activity, FolderOpen, LayoutDashboard, Wrench, FileImage, Cpu, Copy, Sparkles, Video, Music, Box } from "lucide-react";
import type { AssetSummary, ProjectSummary, RuntimeSummary, TaskRecord, ToolSummary } from "../../api";
import { Card } from "../../components/ui/Card";
import { formatRuntimeStatus } from "../../lib/runtimeStatus";
import { cn } from "../../lib/utils";

type Props = {
  project?: ProjectSummary;
  runtime?: RuntimeSummary;
  tools: ToolSummary[];
  assets: AssetSummary[];
  tasks: TaskRecord[];
  statusText: string;
  onSelectAsset: (asset: AssetSummary) => void;
};

export function ProjectOverview({ project, runtime, tools, assets, tasks, statusText, onSelectAsset }: Props) {
  return (
    <section className="flex flex-col gap-6 p-6 max-w-[1440px] mx-auto min-h-0 w-full">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shrink-0 bg-surface-panel p-6 rounded-large border border-border shadow-panel relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-brand" />
        <div className="min-w-0">
          <span className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-subtle font-semibold mb-2">
            <LayoutDashboard className="w-3.5 h-3.5" />
            Workspace
          </span>
          <h1 className="text-2xl font-extrabold text-text m-0 truncate">{project?.name ?? "选择一个项目开始"}</h1>
          <p className="text-sm text-text-muted mt-2 max-w-2xl truncate">
            {project?.rootPath ?? "先扫描本地 Maker 项目，随后启动独立 MCP。"}
          </p>
        </div>
        <div className="grid min-w-[360px] max-w-[520px] grid-cols-2 gap-3 shrink-0">
          <FeaturePreview icon={<Sparkles />} title="图片生成" text={`${tools.filter((tool) => tool.category === "image").length} tools`} />
          <FeaturePreview icon={<Video />} title="视频生成" text={`${tools.filter((tool) => tool.category === "video").length} tools`} />
          <FeaturePreview icon={<Music />} title="音乐生成" text={`${tools.filter((tool) => tool.category === "music").length} tools`} />
          <FeaturePreview icon={<Box />} title="3D 模型" text={`${tools.filter((tool) => tool.category === "model3d").length} tools`} />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3" aria-label="常用工作流">
            <FlowStep index={1} title="选择项目" text={project ? project.name : "未选择"} active={!!project} />
            <FlowStep index={2} title="启动 MCP" text={formatRuntimeStatus(runtime?.status)} active={runtime?.status === "ready"} />
            <FlowStep index={3} title="生成资产" text={`${tools.filter((tool) => tool.category === "image").length} image tools`} active={tools.length > 0} />
            <FlowStep index={4} title="写入项目" text={`${assets.length} indexed`} active={assets.length > 0} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Cpu />} label="MCP 状态" value={formatRuntimeStatus(runtime?.status)} tone={runtime?.status === "ready" ? "good" : "neutral"} />
            <StatCard icon={<Wrench />} label="工具数量" value={String(tools.length)} tone="brand" />
            <StatCard icon={<Activity />} label="最近任务" value={tasks[0]?.toolName ?? "-"} tone={tasks[0]?.status === "failed" ? "bad" : "neutral"} />
            <StatCard icon={<FileImage />} label="资产数量" value={String(assets.length)} tone="brand" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="flex flex-col">
              <div className="flex items-center justify-between gap-3 p-4 border-b border-border-soft min-w-0">
                <h2 className="text-[15px] font-bold text-text m-0 whitespace-nowrap shrink-0">项目概览</h2>
                <CopyableProjectId value={project?.makerProjectId ?? "-"} />
              </div>
              <div className="flex flex-col p-2 gap-1">
                <SummaryRow label="配置文件" value={project?.configPath ?? "-"} />
                <SummaryRow label="MCP 工作目录" value={runtime?.cwd ?? project?.rootPath ?? "-"} />
                <SummaryRow label="工具更新" value={runtime?.toolsListUpdatedAt ?? "-"} />
                <SummaryRow label="状态文本" value={statusText || "等待状态检查"} />
              </div>
            </Card>

            <Card className="flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border-soft">
                <h2 className="text-[15px] font-bold text-text m-0">最近资产</h2>
                <span className="text-xs font-mono text-brand-strong bg-brand/10 px-2 py-1 rounded-control">{assets.length}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
                {assets.slice(0, 6).map((asset) => (
                  <button 
                    key={asset.id} 
                    className="flex flex-col text-left p-3 gap-2 bg-surface-raised border border-border-soft rounded-control hover:border-brand/40 hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand" 
                    type="button" 
                    onClick={() => onSelectAsset(asset)}
                  >
                    <div className="w-8 h-8 rounded-full bg-brand/10 text-brand-strong flex items-center justify-center shrink-0">
                      {asset.assetType === "image" ? <FileImage className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 w-full">
                      <strong className="block text-xs font-semibold text-text truncate mb-0.5">{asset.fileName}</strong>
                      <span className="block text-[10px] text-text-subtle uppercase tracking-wide">{asset.assetType}</span>
                    </div>
                  </button>
                ))}
                {assets.length === 0 ? <div className="col-span-full py-8 text-center text-sm text-text-muted">暂无资产</div> : null}
              </div>
            </Card>

            <Card className="col-span-1 lg:col-span-2 flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-border-soft">
                <h2 className="text-[15px] font-bold text-text m-0">最近任务</h2>
                <span className="text-xs font-mono text-brand-strong bg-brand/10 px-2 py-1 rounded-control">{tasks.length}</span>
              </div>
              <div className="flex flex-col p-2 gap-1">
                {tasks.slice(0, 6).map((task) => {
                  const isFailed = task.status === "failed";
                  const isSuccess = task.status === "succeeded";
                  const isRunning = task.status === "running";
                  
                  return (
                    <div 
                      key={task.taskId} 
                      className={cn(
                        "flex items-center gap-4 p-3 bg-surface-raised border rounded-control text-left",
                        isFailed ? "border-[#b03939]/30" : isSuccess ? "border-[#246b2f]/30" : isRunning ? "border-brand/40" : "border-border-soft"
                      )}
                    >
                      <div className="flex-1 min-w-0 flex items-center justify-between gap-4">
                        <div className="flex flex-col min-w-0">
                          <strong className="text-[13px] font-semibold text-text truncate">{task.toolName}</strong>
                          <small className="text-[11px] text-text-subtle truncate max-w-xl">{task.inputSummary}</small>
                        </div>
                        <div className="shrink-0 flex items-center gap-3">
                          <span className={cn(
                            "px-2 py-1 rounded-pill text-[10px] font-medium uppercase tracking-wide",
                            isFailed ? "bg-[#b03939]/10 text-[#b03939]" : 
                            isSuccess ? "bg-[#246b2f]/10 text-[#246b2f]" : 
                            isRunning ? "bg-[#0a7f72]/10 text-[#0a7f72]" : 
                            "bg-surface-muted text-text-muted"
                          )}>
                            {task.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {tasks.length === 0 ? <div className="py-8 text-center text-sm text-text-muted">暂无运行记录</div> : null}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

function FlowStep({ index, title, text, active }: { index: number; title: string; text: string; active: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 pr-7 rounded-card border transition-colors relative min-w-0 overflow-hidden",
      active ? "bg-surface-panel border-brand/40 shadow-sm" : "bg-surface-raised border-border-soft opacity-70"
    )}>
      <div className={cn(
        "flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0",
        active ? "bg-brand text-surface-app" : "bg-surface-muted text-text-muted"
      )}>
        {index}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <strong className={cn("text-[13px] font-semibold truncate", active ? "text-text" : "text-text-muted")}>{title}</strong>
        <small className="text-[11px] text-text-subtle truncate">{text}</small>
      </div>
      {index < 4 && <span className="flow-step-connector hidden md:block" aria-hidden="true" />}
    </div>
  );
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "brand" | "good" | "bad" | "neutral" }) {
  return (
    <Card className="p-4 flex items-center gap-4">
      <div className={cn(
        "flex items-center justify-center w-10 h-10 rounded-full shrink-0",
        tone === "brand" ? "bg-brand/10 text-brand-strong" :
        tone === "good" ? "bg-[#246b2f]/10 text-[#246b2f]" :
        tone === "bad" ? "bg-[#b03939]/10 text-[#b03939]" :
        "bg-surface-muted text-text-subtle"
      )}>
        <div className="w-5 h-5 [&>svg]:w-full [&>svg]:h-full">{icon}</div>
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-medium text-text-subtle uppercase tracking-wider mb-0.5">{label}</span>
        <strong className="text-lg font-extrabold text-text truncate">{value}</strong>
      </div>
    </Card>
  );
}

function FeaturePreview({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border-soft bg-surface-raised p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-brand/10 text-brand-strong [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </div>
      <div className="min-w-0">
        <strong className="block truncate text-xs text-text">{title}</strong>
        <span className="block truncate text-[10px] text-text-subtle">{text}</span>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 p-2.5 hover:bg-surface-raised rounded-control transition-colors">
      <span className="text-[13px] font-medium text-text-subtle shrink-0">{label}</span>
      <strong className="text-[13px] font-semibold text-text truncate text-right">{value}</strong>
    </div>
  );
}

function CopyableProjectId({ value }: { value: string }) {
  async function copyValue() {
    if (!value || value === "-") return;
    await navigator.clipboard.writeText(value);
  }

  return (
    <button
      type="button"
      onClick={copyValue}
      title={value === "-" ? "暂无 project_id" : `复制 project_id：${value}`}
      className="group inline-flex min-w-0 max-w-[70%] items-center gap-1.5 rounded-control bg-surface-muted px-2 py-1 text-left text-xs font-mono text-text-subtle transition-colors hover:bg-brand/10 hover:text-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      aria-label="复制 project_id"
      disabled={value === "-"}
    >
      <span className="min-w-0 truncate">{value}</span>
      <Copy className="h-3.5 w-3.5 shrink-0 opacity-45 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
