import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Clipboard, FileClock, Hammer, Loader2, Play, RefreshCw, Server, ShieldAlert, Terminal, Globe, GitCommit, Check } from "lucide-react";
import { getBuildLogs, type ProjectBuildLogEntry, type ProjectBuildLogsSummary, type ProjectLogFileSummary, type ProjectSummary, type RuntimeSummary, type TaskRecord, type ToolSummary } from "../../api";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Label } from "../../components/ui/Label";
import { SelectField } from "../../components/ui/SelectField";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../components/ui/Card";
import { cn, formatBytes } from "../../lib/utils";

type Props = {
  project?: ProjectSummary;
  runtime?: RuntimeSummary;
  tools: ToolSummary[];
  tasks: TaskRecord[];
  busy: boolean;
  onCallTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>;
  onSelectTool: (tool: ToolSummary) => void;
};

export function BuildCenter({ project, runtime, tools, tasks, busy, onCallTool, onSelectTool }: Props) {
  const buildTool = tools.find((tool) => tool.name === "maker_build_current_directory");
  const buildTasks = tasks.filter((task) => task.toolName === "maker_build_current_directory").slice(0, 6);
  const [logs, setLogs] = useState<ProjectBuildLogsSummary>();
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logError, setLogError] = useState("");
  const [activeLogTab, setActiveLogTab] = useState<"overview" | "attempts" | "runtime" | "watcherOut" | "watcherErr">("overview");

  const latestBuild = logs?.buildLogs[0];
  const runtimeState = logs?.runtime.state;
  const runtimeStateRows = useMemo(() => Object.entries(runtimeState ?? {}).slice(0, 10), [runtimeState]);

  useEffect(() => {
    if (!project) {
      setLogs(undefined);
      return;
    }
    void refreshLogs(project.id);
  }, [project?.id]);

  async function refreshLogs(projectId = project?.id) {
    if (!projectId) return;
    setLoadingLogs(true);
    setLogError("");
    try {
      setLogs(await getBuildLogs(projectId));
    } catch (error) {
      setLogError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingLogs(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4 md:p-6">
      <div className="grid shrink-0 gap-3 md:grid-cols-4">
        <BuildStat icon={<Server className="h-4 w-4" />} label="MCP runtime" value={runtime?.status ?? "idle"} tone={runtime?.status === "ready" ? "good" : "neutral"} />
        <BuildStat icon={<Hammer className="h-4 w-4" />} label="构建工具" value={buildTool ? buildTool.name : "未加载"} tone={buildTool ? "brand" : "bad"} />
        <BuildStat icon={<Play className="h-4 w-4" />} label="构建记录" value={`${buildTasks.length} 条`} tone="neutral" />
        <BuildStat icon={<FileClock className="h-4 w-4" />} label="日志文件" value={`${logs?.buildLogs.length ?? 0} 个`} tone={latestBuild ? "brand" : "neutral"} />
      </div>

      {!buildTool ? (
        <div className="flex flex-1 items-center justify-center rounded-large border border-dashed border-border bg-surface-panel p-8 text-center">
          <div>
            <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-text-subtle" />
            <h2 className="m-0 text-base font-bold text-text">未发现 maker_build_current_directory</h2>
            <p className="mt-2 text-sm text-text-muted">启动 MCP runtime 并刷新 tools/list 后才能显示真实构建 schema。</p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(420px,1.15fr)_minmax(360px,0.85fr)] gap-4 overflow-hidden max-[1120px]:grid-cols-1 max-[1120px]:overflow-y-auto">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-large border border-border bg-surface-panel shadow-sm">
            <BuildConsolePanel
              buildTool={buildTool}
              project={project}
              busy={busy}
              onCallTool={async (toolName, args) => {
                await onCallTool(toolName, args);
                if (project) await refreshLogs(project.id);
              }}
            />
          </div>

          <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
            <div className="flex shrink-0 items-center justify-between gap-3 rounded-large border border-border bg-surface-panel px-4 py-3 shadow-sm">
              <div className="min-w-0">
                <h2 className="m-0 text-sm font-bold text-text">本地 Maker 证据</h2>
                <p className="mt-1 truncate text-[11px] text-text-subtle">{project?.rootPath ?? "请选择项目"}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void refreshLogs()} disabled={!project || loadingLogs} className="h-8 gap-1.5 px-2.5 text-xs">
                {loadingLogs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                刷新日志
              </Button>
            </div>

            {logError ? (
              <div className="rounded-large border border-[#b03939]/25 bg-[#b03939]/5 p-4 text-xs text-[#b03939]">{logError}</div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-large border border-border bg-surface-panel shadow-sm">
              <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border-soft px-2 py-1.5 scrollbar-none bg-surface-raised/50">
                <button
                  type="button"
                  className={cn("whitespace-nowrap flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors", activeLogTab === "overview" ? "bg-surface-panel text-text shadow-sm ring-1 ring-border-soft" : "text-text-subtle hover:bg-surface-muted hover:text-text")}
                  onClick={() => setActiveLogTab("overview")}
                >
                  <Activity className="h-3.5 w-3.5" /> 状态总览
                </button>
                <div className="mx-1 h-3.5 w-px bg-border-soft" />
                <button
                  type="button"
                  className={cn("whitespace-nowrap rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors", activeLogTab === "attempts" ? "bg-surface-panel text-text shadow-sm ring-1 ring-border-soft" : "text-text-subtle hover:bg-surface-muted hover:text-text")}
                  onClick={() => setActiveLogTab("attempts")}
                >
                  Build Attempts
                </button>
                <button
                  type="button"
                  className={cn("flex whitespace-nowrap items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors", activeLogTab === "runtime" ? "bg-surface-panel text-text shadow-sm ring-1 ring-border-soft" : "text-text-subtle hover:bg-surface-muted hover:text-text")}
                  onClick={() => setActiveLogTab("runtime")}
                >
                  <Terminal className="h-3 w-3" /> runtime.log
                </button>
                <button
                  type="button"
                  className={cn("flex whitespace-nowrap items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors", activeLogTab === "watcherOut" ? "bg-surface-panel text-text shadow-sm ring-1 ring-border-soft" : "text-text-subtle hover:bg-surface-muted hover:text-text")}
                  onClick={() => setActiveLogTab("watcherOut")}
                >
                  <Activity className="h-3 w-3" /> watcher.out
                </button>
                {logs?.runtime.watcherErr?.exists && logs.runtime.watcherErr.sizeBytes > 0 ? (
                  <button
                    type="button"
                    className={cn("flex whitespace-nowrap items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-bold transition-colors", activeLogTab === "watcherErr" ? "bg-surface-panel text-[#b03939] shadow-sm ring-1 ring-border-soft" : "text-text-subtle hover:bg-[#b03939]/10 hover:text-[#b03939]")}
                    onClick={() => setActiveLogTab("watcherErr")}
                  >
                    <AlertTriangle className="h-3 w-3" /> watcher.err
                  </button>
                ) : null}
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface-app/50">
                {activeLogTab === "overview" && (
                  <div className="p-4 flex flex-col shrink-0 gap-4">
                    <RuntimeStatePanel rows={runtimeStateRows} stateParseError={logs?.runtime.stateParseError} />
                    <FileHealthPanel logs={logs} />
                  </div>
                )}
                {activeLogTab === "attempts" && <BuildAttemptsPanel entries={logs?.buildLogs ?? []} />}
                {activeLogTab === "runtime" && <LogTailPanel file={logs?.runtime.runtimeLog} />}
                {activeLogTab === "watcherOut" && <LogTailPanel file={logs?.runtime.watcherOut} />}
                {activeLogTab === "watcherErr" && <LogTailPanel file={logs?.runtime.watcherErr} />}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function RuntimeStatePanel({ rows, stateParseError }: { rows: [string, unknown][]; stateParseError?: string }) {
  return (
    <section className="flex flex-col rounded-large border border-border bg-surface-panel shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-soft px-3 py-2.5">
        <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-text-subtle">Runtime State</h3>
        <span className="rounded-pill bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand-strong">state.json</span>
      </div>
      <div className="flex-1 p-3">
        {stateParseError ? <p className="m-0 text-xs text-[#b03939] mb-2">{stateParseError}</p> : null}
        {rows.length === 0 ? <p className="m-0 text-xs text-text-muted">未读取到 state.json。</p> : (
          <div className="grid gap-1">
            {rows.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-control bg-surface-muted px-2 py-1 overflow-hidden">
                <span className="shrink-0 truncate text-[10px] font-semibold text-text-subtle">{key}</span>
                <strong className="min-w-0 truncate text-right text-[11px] text-text">{formatValue(value)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FileHealthPanel({ logs }: { logs?: ProjectBuildLogsSummary }) {
  const files = [logs?.runtime.stateFile, logs?.runtime.runtimeLog, logs?.runtime.watcherOut, logs?.runtime.watcherErr].filter(Boolean) as ProjectLogFileSummary[];
  const levelCounts = Object.entries(logs?.runtime.levelCounts ?? {});
  return (
    <section className="flex flex-col rounded-large border border-border bg-surface-panel shadow-sm">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-soft px-3 py-2.5">
        <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-text-subtle">Watcher Files</h3>
        <span className="text-[10px] font-semibold text-text-subtle">{files.filter((file) => file.exists).length}/{files.length || 4}</span>
      </div>
      <div className="flex-1 p-3">
        <div className="grid gap-1">
          {files.length === 0 ? <p className="m-0 text-xs text-text-muted">暂无日志文件摘要。</p> : files.map((file) => (
            <div key={file.relativePath} className="flex items-center justify-between gap-2 rounded-control bg-surface-muted px-2 py-1">
              <span className="truncate text-[10px] font-semibold text-text-muted">{file.name}</span>
              <span className="shrink-0 text-[10px] text-text-subtle">{file.exists ? formatBytes(file.sizeBytes) : "missing"}</span>
            </div>
          ))}
        </div>
        {levelCounts.length ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5 pt-2.5 border-t border-border-soft">
            {levelCounts.map(([level, count]) => <span key={level} className="rounded-pill bg-surface-raised px-2 py-0.5 text-[10px] font-semibold text-text-muted border border-border-soft shadow-sm">{level} {count}</span>)}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function BuildAttemptsPanel({ entries }: { entries: ProjectBuildLogEntry[] }) {
  const [expandedFile, setExpandedFile] = useState("");
  return (
    <div className="grid gap-2 p-3">
      {entries.length === 0 ? <p className="m-0 p-3 text-xs text-text-muted">未发现 .maker/logs/build/*.txt。</p> : entries.map((entry) => {
        const expanded = expandedFile === entry.file.relativePath;
        return (
          <article key={entry.file.relativePath} className="rounded-card border border-border-soft bg-surface-panel p-2 shadow-sm transition-colors hover:border-border">
            <div className="flex items-start justify-between gap-3 px-1">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setExpandedFile(expanded ? "" : entry.file.relativePath)}>
                <strong className="block truncate text-xs text-text">{entry.heading ?? entry.file.name}</strong>
                <span className="mt-0.5 block truncate text-[10px] text-text-subtle">{entry.file.relativePath} · {formatBytes(entry.file.sizeBytes)}</span>
              </button>
              <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-control text-text-subtle hover:bg-surface-muted hover:text-text" title="复制 raw log" onClick={() => void navigator.clipboard.writeText(entry.rawText)}>
                <Clipboard className="h-3.5 w-3.5" />
              </button>
            </div>
            {entry.flags.length ? <div className="mt-2 flex flex-wrap gap-1 px-1">{entry.flags.map((flag) => <Flag key={flag} text={flag} />)}</div> : null}
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {entry.keyValues.slice(0, 8).map((item) => <KeyValueRow key={`${entry.file.name}-${item.section ?? "root"}-${item.key}-${item.value}`} itemKey={item.key} value={item.value} />)}
            </div>
            {expanded ? (
              <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words rounded-control bg-surface-muted p-2 text-[10px] leading-tight text-text-muted scrollbar-thin">
                {entry.rawText}
              </pre>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function LogTailPanel({ file }: { file?: ProjectLogFileSummary }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-muted p-3 font-mono text-[10px] leading-tight text-text-muted scrollbar-thin">
        {file?.tailLines.length ? file.tailLines.join("\n") : "暂无日志行。"}
      </pre>
    </div>
  );
}

function BuildStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "brand" | "good" | "bad" | "neutral" }) {
  return (
    <div className="flex items-center gap-3 rounded-large border border-border bg-surface-panel px-3 py-2.5 shadow-sm">
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-control",
        tone === "brand" ? "bg-brand/10 text-brand-strong" : tone === "good" ? "bg-[#246b2f]/10 text-[#246b2f]" : tone === "bad" ? "bg-[#b03939]/10 text-[#b03939]" : "bg-surface-muted text-text-muted"
      )}>{icon}</div>
      <div className="min-w-0">
        <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-text-subtle">{label}</span>
        <strong className="block truncate text-xs text-text">{value}</strong>
      </div>
    </div>
  );
}

function Flag({ text }: { text: string }) {
  const bad = text.includes("504") || text.includes("timeout") || text.includes("not started");
  return <span className={cn("rounded-pill px-2 py-0.5 text-[10px] font-bold", bad ? "bg-[#b03939]/10 text-[#b03939]" : "bg-brand/10 text-brand-strong")}>{text}</span>;
}

function KeyValueRow({ itemKey, value }: { itemKey: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-control bg-surface-muted px-2 py-1">
      <span className="truncate text-[10px] font-semibold text-text-subtle">{itemKey}</span>
      <strong className="truncate text-right text-[10px] text-text-muted">{value || "-"}</strong>
    </div>
  );
}

function formatValue(value: unknown) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function BuildConsolePanel({
  buildTool,
  project,
  busy,
  onCallTool
}: {
  buildTool: ToolSummary;
  project?: ProjectSummary;
  busy: boolean;
  onCallTool: (toolName: string, args: Record<string, unknown>) => Promise<unknown>
}) {
  const [env, setEnv] = useState("");
  const [timeoutMs, setTimeoutMs] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState("");
  const [multiplayer, setMultiplayer] = useState("");
  const [forceRemote, setForceRemote] = useState(false);

  async function submit() {
    const guardedData: Record<string, unknown> = {};
    if (env) guardedData.env = env;
    if (timeoutMs) guardedData.timeout_ms = parseInt(timeoutMs, 10);
    if (serverUrl) guardedData.server_url = serverUrl;
    if (message) guardedData.message = message;
    if (files) guardedData.files = files.split(",").map(s => s.trim()).filter(Boolean);
    if (multiplayer) {
      try {
        guardedData.multiplayer = JSON.parse(multiplayer);
      } catch (e) {
        toast.error("多人联机配置 JSON 格式错误");
        return;
      }
    }
    if (forceRemote) guardedData.confirm_remote_build_without_submit = true;

    await toast.promise(onCallTool(buildTool.name, guardedData), {
      loading: `正在启动构建任务`,
      success: `构建请求已提交`,
      error: `构建请求失败`
    });
  }

  return (
    <div className="flex h-full flex-col relative bg-surface-panel">
      {/* 紧凑型 Header */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border-soft px-4 py-3 bg-surface-muted/30">
        <div className="min-w-0 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-control bg-brand/10 border border-brand/20 shadow-[0_0_10px_rgba(0,217,197,0.1)]">
            <Hammer className="h-4 w-4 text-brand-strong" />
          </div>
          <div>
            <h2 className="m-0 truncate text-sm font-bold text-text flex items-center gap-1.5">
              Maker 构建控制台
            </h2>
            <p className="mt-0.5 truncate text-[10px] text-text-subtle">
              Tool: {buildTool.name}
            </p>
          </div>
        </div>

        <button
          disabled={busy || !project}
          onClick={submit}
          className="relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[12px] font-bold transition-all cursor-pointer bg-text text-surface-app hover:bg-brand hover:text-[#04202a] px-4 py-1.5 h-[28px] rounded-full shadow-sm disabled:opacity-50 disabled:cursor-not-allowed group/btn overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
          <Play className="h-3.5 w-3.5 fill-current relative z-10" />
          <span className="relative z-10">运行构建</span>
        </button>
      </div>

      {/* 表单区域 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin bg-surface-panel">
        <div className="flex flex-col pb-10">

           {/* 区域 1：远程环境配置 */}
           <div className="flex flex-col">
             <div className="px-6 py-5 border-b border-border-soft bg-surface-muted/30">
               <h3 className="text-sm font-bold flex items-center gap-2 text-text">
                 <Globe className="w-4 h-4 text-brand" /> 远程环境配置
               </h3>
               <p className="mt-1.5 text-[13px] text-text-subtle">
                 配置与 Maker 远程构建服务器连接的基础参数。
               </p>
             </div>
             <div className="flex flex-col">

               {/* 行 1: 构建环境 */}
               <div className="flex flex-col gap-3 p-6 border-b border-border-soft hover:bg-surface-muted/10 transition-colors">
                 <div>
                   <Label htmlFor="env" className="text-sm font-bold">构建环境</Label>
                   <p className="text-[13px] text-text-subtle mt-1.5 leading-relaxed">
                     选择构建时所使用的 TAPTAP_MCP_ENV，这将直接影响资源打包的目标端点。
                   </p>
                 </div>
                 <SelectField
                   id="env"
                   value={env}
                   onChange={setEnv}
                   options={[
                     { value: "", label: "系统默认配置" },
                     { value: "test", label: "测试环境" },
                     { value: "prod", label: "生产环境" }
                   ]}
                 />
               </div>

               {/* 行 2: 超时限制 */}
               <div className="flex flex-col gap-3 p-6 border-b border-border-soft hover:bg-surface-muted/10 transition-colors">
                 <div>
                   <Label htmlFor="timeoutMs" className="text-sm font-bold">超时限制</Label>
                   <p className="text-[13px] text-text-subtle mt-1.5 leading-relaxed">
                     设置远程构建连接的断开时间。若网络不稳定，建议适当调大。
                   </p>
                 </div>
                 <div className="relative">
                   <Input
                     id="timeoutMs"
                     type="number"
                     value={timeoutMs}
                     onChange={e => setTimeoutMs(e.target.value)}
                     placeholder="默认 600000 (10 分钟)"
                     className="pr-10"
                   />
                   <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-text-subtle font-mono">ms</span>
                 </div>
               </div>

               {/* 行 3: 服务器端点 */}
               <div className="flex flex-col gap-3 p-6 border-b border-border-soft hover:bg-surface-muted/10 transition-colors">
                 <div>
                   <Label htmlFor="serverUrl" className="text-sm font-bold">独立服务器端点</Label>
                   <p className="text-[13px] text-text-subtle mt-1.5 leading-relaxed">
                     覆盖默认的 Maker 端点 URL。通常仅在进行内部联调测试时使用。
                   </p>
                 </div>
                 <Input
                   id="serverUrl"
                   value={serverUrl}
                   onChange={e => setServerUrl(e.target.value)}
                   placeholder="选填"
                 />
               </div>

               {/* 行 4: 多人联机配置 */}
               <div className="flex flex-col gap-3 p-6 border-b border-border-soft hover:bg-surface-muted/10 transition-colors">
                 <div>
                   <Label htmlFor="multiplayer" className="text-sm font-bold">多人联机参数</Label>
                   <p className="text-[13px] text-text-subtle mt-1.5 leading-relaxed">
                     注入到远程构建中的联机配置，格式必须为有效的 JSON 字符串。
                   </p>
                 </div>
                 <Input
                   id="multiplayer"
                   className="font-mono text-[12px]"
                   value={multiplayer}
                   onChange={e => setMultiplayer(e.target.value)}
                   placeholder='{"enabled": false}'
                 />
               </div>

             </div>
           </div>

           {/* 区域 2：本地提交流程 */}
           <div className="flex flex-col mt-4">
             <div className="px-6 py-5 border-y border-border-soft bg-surface-muted/30">
               <h3 className="text-sm font-bold flex items-center gap-2 text-text">
                 <GitCommit className="w-4 h-4 text-brand" /> 提交流程与校验
               </h3>
               <p className="mt-1.5 text-[13px] text-text-subtle">
                 管理代码构建前的 Git 提交流程与增量文件校验规则。
               </p>
             </div>
             <div className="flex flex-col">

               {/* 行 1: 包含文件 */}
               <div className="flex flex-col gap-3 p-6 border-b border-border-soft hover:bg-surface-muted/10 transition-colors">
                 <div>
                   <Label htmlFor="files" className="text-sm font-bold">指定包含文件</Label>
                   <p className="text-[13px] text-text-subtle mt-1.5 leading-relaxed">
                     强制包含在本次提交流程中的文件列表。多文件请使用半角逗号分隔。
                   </p>
                 </div>
                 <Input
                   id="files"
                   value={files}
                   onChange={e => setFiles(e.target.value)}
                   placeholder="src/main.ts, assets/logo.png"
                 />
               </div>

               {/* 行 2: 强制云端构建 */}
               <div className="flex items-center justify-between gap-4 p-6 border-b border-border-soft hover:bg-surface-muted/10 transition-colors">
                 <div className="flex-1 pr-4 min-w-0">
                   <Label className="text-sm font-bold">强制云端构建</Label>
                   <p className="text-[13px] text-text-subtle mt-1.5 leading-relaxed">
                     忽略本地尚未 Push 的修改，直接使用服务器最新主干版本进行构建。勾选此项可绕过一切本地校验。
                   </p>
                 </div>
                 <div className="shrink-0 flex justify-end">
                   <label className="relative inline-flex items-center cursor-pointer">
                     <input type="checkbox" className="sr-only peer" checked={forceRemote} onChange={e => setForceRemote(e.target.checked)} />
                     <div className="w-10 h-6 bg-surface-raised border border-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-brand-strong after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-text-muted peer-checked:after:bg-[#04202a] after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand peer-checked:border-brand"></div>
                   </label>
                 </div>
               </div>

               {/* 行 3: 提交说明 (跨行设计) */}
               <div className="flex flex-col gap-3 p-6 hover:bg-surface-muted/10 transition-colors">
                 <div>
                   <Label htmlFor="message" className="text-sm font-bold">版本提交说明</Label>
                   <p className="text-[13px] text-text-subtle mt-1.5 leading-relaxed">
                     若本次构建包含未提交的本地改动，这些改动将自动被打包提交，你可以在此填写 Commit Message。
                   </p>
                 </div>
                 <textarea
                   id="message"
                   value={message}
                   onChange={e => setMessage(e.target.value)}
                   className="flex min-h-[90px] w-full rounded-control border border-border bg-surface-panel px-4 py-3 text-sm shadow-sm transition-colors placeholder:text-text-subtle/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50 resize-y scrollbar-thin"
                   placeholder="请简述本次包含的改动内容..."
                 />
               </div>

             </div>
           </div>

        </div>
      </div>
    </div>
  );
}
