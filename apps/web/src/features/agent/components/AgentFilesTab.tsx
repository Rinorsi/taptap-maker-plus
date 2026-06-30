import { Braces, FileCode2, FileText, Image, Monitor, Search, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import type { ProjectSummary } from "../../../api";
import type { AgentContextSnapshot, AgentPageState } from "../api";
import { formatRuntimeStatus } from "../../../lib/runtimeStatus";
import { describeSelection } from "../utils";
import { AgentInfoRow, AgentMetric, AgentSection, EmptyState } from "./AgentPanelPrimitives";

export function AgentFilesTab({ context, selectedProject, page }: { context?: AgentContextSnapshot; selectedProject?: ProjectSummary; page: AgentPageState }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const files = useMemo(() => {
    const rows = [
      ...(context?.assets ?? []).map((asset) => ({
        id: `asset:${asset.id}`,
        title: asset.relativePath,
        subtitle: `${asset.assetType} · ${formatBytes(asset.sizeBytes)}`,
        icon: asset.assetType === "image" ? Image : FileText,
        detail: asset
      })),
      ...(context?.tools ?? []).map((tool) => ({
        id: `tool:${tool.name}`,
        title: tool.name,
        subtitle: `${tool.category} · ${tool.required.length} required`,
        icon: Wrench,
        detail: tool
      })),
      ...(context?.buildLogs?.buildLogs ?? []).map((log) => ({
        id: `log:${log.file.relativePath}`,
        title: log.file.relativePath,
        subtitle: `${log.file.sizeBytes} bytes · ${log.file.updatedAt}`,
        icon: Braces,
        detail: { file: log.file, flags: log.flags, tail: log.file.tailLines }
      }))
    ];
    const needle = query.trim().toLowerCase();
    if (!needle) return rows.slice(0, 80);
    return rows.filter((row) => `${row.title} ${row.subtitle}`.toLowerCase().includes(needle)).slice(0, 80);
  }, [context, query]);
  const selectedFile = files.find((file) => file.id === selectedId) ?? files[0];

  return (
    <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(260px,0.85fr)_minmax(420px,1.15fr)]">
      <AgentSection icon={<FileCode2 className="h-4 w-4" />} title="上下文文件">
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-border-soft p-2">
            <label className="flex h-8 items-center gap-2 rounded-control border border-border bg-surface px-2 text-xs text-text-muted">
              <Search className="h-3.5 w-3.5" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent text-xs text-text outline-none placeholder:text-text-subtle"
                placeholder="筛选文件、工具、日志"
              />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {files.length ? files.map((file) => {
              const Icon = file.icon;
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setSelectedId(file.id)}
                  className="flex w-full items-center gap-2 rounded-control px-2 py-2 text-left hover:bg-surface-muted"
                >
                  <Icon className="h-4 w-4 shrink-0 text-text-muted" />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-xs text-text">{file.title}</strong>
                    <span className="block truncate text-[11px] text-text-subtle">{file.subtitle}</span>
                  </span>
                </button>
              );
            }) : <EmptyState title="暂无文件上下文" body="选择项目并刷新上下文后，这里会展示资产、工具和日志入口。" />}
          </div>
        </div>
      </AgentSection>

      <AgentSection icon={<Monitor className="h-4 w-4" />} title="当前选择">
        <div className="grid gap-3 p-3">
          <div className="grid gap-2 md:grid-cols-2">
            <AgentMetric label="项目" value={selectedProject?.name ?? "-"} tone="brand" />
            <AgentMetric label="MCP" value={formatRuntimeStatus(context?.runtime?.status ?? selectedProject?.runtime?.status ?? "idle")} />
            <AgentMetric label="工具" value={String(context?.counts.tools ?? 0)} />
            <AgentMetric label="资产" value={String(context?.counts.assets ?? 0)} />
          </div>
          <div className="rounded-large border border-border bg-surface p-2">
            <AgentInfoRow label="项目路径" value={selectedProject?.rootPath ?? "-"} />
            <AgentInfoRow label="面板" value={context?.page.activeTab ?? page.activeTab ?? "-"} />
            <AgentInfoRow label="选择" value={describeSelection(context?.page.selection ?? page.selection)} />
            <AgentInfoRow label="上下文时间" value={context?.generatedAt ?? "-"} />
          </div>
          <div className="min-h-0 rounded-large border border-border bg-surface">
            <div className="border-b border-border-soft px-3 py-2 text-xs font-bold text-text">{selectedFile?.title ?? "未选择条目"}</div>
            <pre className="m-0 max-h-[360px] overflow-auto whitespace-pre-wrap p-3 text-[11px] leading-5 text-text-muted">
              {selectedFile ? JSON.stringify(selectedFile.detail, null, 2) : "暂无详情"}
            </pre>
          </div>
        </div>
      </AgentSection>
    </div>
  );
}

function formatBytes(size: number) {
  if (!Number.isFinite(size)) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
