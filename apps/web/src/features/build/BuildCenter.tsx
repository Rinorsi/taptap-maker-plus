import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Clipboard, FileClock, Hammer, Loader2, Play, RefreshCw, Server, ShieldAlert, Terminal } from "lucide-react";
import { getBuildLogs, type ProjectBuildLogEntry, type ProjectBuildLogsSummary, type ProjectLogFileSummary, type ProjectSummary, type RuntimeSummary, type TaskRecord, type ToolSummary } from "../../api";
import { ToolStudio } from "../generation/ToolStudio";
import { Button } from "../../components/ui/Button";
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
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-hidden bg-surface-app p-4 md:p-6">
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
          <div className="min-h-0 overflow-hidden rounded-large border border-border bg-surface-panel shadow-sm">
            <ToolStudio
              category="build"
              title="构建中心"
              project={project}
              tools={tools}
              assets={[]}
              tasks={tasks}
              busy={busy}
              onCallTool={async (toolName, args) => {
                await onCallTool(toolName, args);
                if (project) await refreshLogs(project.id);
              }}
              onSelectTool={onSelectTool}
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

            <div className="grid shrink-0 gap-3 sm:grid-cols-2">
              <RuntimeStatePanel rows={runtimeStateRows} stateParseError={logs?.runtime.stateParseError} />
              <FileHealthPanel logs={logs} />
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
              <BuildAttemptsPanel entries={logs?.buildLogs ?? []} />
              <LogTailPanel title="runtime.log tail" icon={<Terminal className="h-3.5 w-3.5" />} file={logs?.runtime.runtimeLog} />
              <LogTailPanel title="watcher.out.log tail" icon={<Activity className="h-3.5 w-3.5" />} file={logs?.runtime.watcherOut} />
              {logs?.runtime.watcherErr?.exists && logs.runtime.watcherErr.sizeBytes > 0 ? <LogTailPanel title="watcher.err.log tail" icon={<AlertTriangle className="h-3.5 w-3.5" />} file={logs.runtime.watcherErr} /> : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function RuntimeStatePanel({ rows, stateParseError }: { rows: [string, unknown][]; stateParseError?: string }) {
  return (
    <section className="rounded-large border border-border bg-surface-panel p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-text-subtle">Runtime State</h3>
        <span className="rounded-pill bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand-strong">state.json</span>
      </div>
      {stateParseError ? <p className="m-0 text-xs text-[#b03939]">{stateParseError}</p> : null}
      {rows.length === 0 ? <p className="m-0 text-xs text-text-muted">未读取到 state.json。</p> : (
        <div className="grid gap-1.5">
          {rows.map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-control bg-surface-muted px-2 py-1.5">
              <span className="truncate text-[10px] font-semibold text-text-subtle">{key}</span>
              <strong className="truncate text-right text-[11px] text-text">{formatValue(value)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function FileHealthPanel({ logs }: { logs?: ProjectBuildLogsSummary }) {
  const files = [logs?.runtime.stateFile, logs?.runtime.runtimeLog, logs?.runtime.watcherOut, logs?.runtime.watcherErr].filter(Boolean) as ProjectLogFileSummary[];
  const levelCounts = Object.entries(logs?.runtime.levelCounts ?? {});
  return (
    <section className="rounded-large border border-border bg-surface-panel p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-text-subtle">Watcher Files</h3>
        <span className="text-[10px] font-semibold text-text-subtle">{files.filter((file) => file.exists).length}/{files.length || 4}</span>
      </div>
      <div className="grid gap-1.5">
        {files.length === 0 ? <p className="m-0 text-xs text-text-muted">暂无日志文件摘要。</p> : files.map((file) => (
          <div key={file.relativePath} className="flex items-center justify-between gap-2 rounded-control bg-surface-muted px-2 py-1.5">
            <span className="truncate text-[10px] font-semibold text-text-muted">{file.name}</span>
            <span className="shrink-0 text-[10px] text-text-subtle">{file.exists ? formatBytes(file.sizeBytes) : "missing"}</span>
          </div>
        ))}
      </div>
      {levelCounts.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {levelCounts.map(([level, count]) => <span key={level} className="rounded-pill bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-text-muted">{level} {count}</span>)}
        </div>
      ) : null}
    </section>
  );
}

function BuildAttemptsPanel({ entries }: { entries: ProjectBuildLogEntry[] }) {
  const [expandedFile, setExpandedFile] = useState("");
  return (
    <section className="rounded-large border border-border bg-surface-panel shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border-soft px-4 py-3">
        <h3 className="m-0 text-xs font-bold uppercase tracking-wider text-text-subtle">Build Attempts</h3>
        <span className="text-[10px] font-semibold text-text-subtle">{entries.length} files</span>
      </div>
      <div className="grid gap-2 p-3">
        {entries.length === 0 ? <p className="m-0 p-3 text-xs text-text-muted">未发现 .maker/logs/build/*.txt。</p> : entries.map((entry) => {
          const expanded = expandedFile === entry.file.relativePath;
          return (
            <article key={entry.file.relativePath} className="rounded-card border border-border-soft bg-surface-raised p-3">
              <div className="flex items-start justify-between gap-3">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setExpandedFile(expanded ? "" : entry.file.relativePath)}>
                  <strong className="block truncate text-xs text-text">{entry.heading ?? entry.file.name}</strong>
                  <span className="mt-1 block truncate text-[10px] text-text-subtle">{entry.file.relativePath} · {formatBytes(entry.file.sizeBytes)}</span>
                </button>
                <button type="button" className="inline-flex h-7 w-7 items-center justify-center rounded-control text-text-subtle hover:bg-surface-muted hover:text-text" title="复制 raw log" onClick={() => void navigator.clipboard.writeText(entry.rawText)}>
                  <Clipboard className="h-3.5 w-3.5" />
                </button>
              </div>
              {entry.flags.length ? <div className="mt-2 flex flex-wrap gap-1.5">{entry.flags.map((flag) => <Flag key={flag} text={flag} />)}</div> : null}
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                {entry.keyValues.slice(0, 8).map((item) => <KeyValueRow key={`${entry.file.name}-${item.section ?? "root"}-${item.key}-${item.value}`} itemKey={item.key} value={item.value} />)}
              </div>
              {expanded ? (
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-control bg-surface-muted p-3 text-[10px] leading-relaxed text-text-muted">
                  {entry.rawText}
                </pre>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LogTailPanel({ title, icon, file }: { title: string; icon: React.ReactNode; file?: ProjectLogFileSummary }) {
  return (
    <section className="rounded-large border border-border bg-surface-panel shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border-soft px-4 py-3">
        <h3 className="m-0 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-subtle">{icon}{title}</h3>
        <span className="text-[10px] font-semibold text-text-subtle">{file?.exists ? formatBytes(file.sizeBytes) : "missing"}</span>
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words p-3 text-[10px] leading-relaxed text-text-muted">
        {file?.tailLines.length ? file.tailLines.join("\n") : "暂无日志行。"}
      </pre>
    </section>
  );
}

function BuildStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "brand" | "good" | "bad" | "neutral" }) {
  return (
    <div className="flex items-center gap-3 rounded-large border border-border bg-surface-panel p-4 shadow-sm">
      <div className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-control",
        tone === "brand" ? "bg-brand/10 text-brand-strong" : tone === "good" ? "bg-[#246b2f]/10 text-[#246b2f]" : tone === "bad" ? "bg-[#b03939]/10 text-[#b03939]" : "bg-surface-muted text-text-muted"
      )}>{icon}</div>
      <div className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-text-subtle">{label}</span>
        <strong className="block truncate text-sm text-text">{value}</strong>
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
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-control bg-surface-muted px-2 py-1.5">
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
