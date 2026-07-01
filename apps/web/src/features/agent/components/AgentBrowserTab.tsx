import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock3,
  Code2,
  Globe,
  Loader2,
  MousePointerClick,
  RefreshCw,
  Search,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { ProjectSummary } from "../../../api";
import type { AgentActionKind, AgentBrowserProbeResult, AgentContextSnapshot } from "../api";
import { probeAgentBrowserUrl } from "../api";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";

const AGENT_BROWSER_URL_STORAGE_KEY = "taptap.agent.browserUrlV2";

const lifecycleRows = [
  { label: "Request", body: "服务端按 URL 发起只读 GET 请求。", state: "可用", tone: "good" },
  { label: "Inspect", body: "解析 HTTP 状态、标题和内容类型。", state: "可用", tone: "good" },
  { label: "Render", body: "真实页面渲染、DOM、截图等待 Pi Runtime Browser 接入。", state: "待接入", tone: "neutral" },
  { label: "Act", body: "点击、输入和自动化浏览器动作必须走后续审批。", state: "待接入", tone: "warning" },
] as const;

const capabilityRows: Array<{
  icon: LucideIcon;
  label: string;
  body: string;
  state: "可用" | "只读" | "待接入";
}> = [
  { icon: Globe, label: "HTTP probe", body: "读取响应状态、最终 URL、标题和内容类型。", state: "可用" },
  { icon: ShieldCheck, label: "Readonly boundary", body: "不会点击、提交表单、保存 cookie 或执行页面脚本。", state: "只读" },
  { icon: Code2, label: "DOM snapshot", body: "后续由 Pi Runtime Browser 提供页面结构。", state: "待接入" },
  { icon: MousePointerClick, label: "Browser action", body: "点击、输入、截图和断言需要动作审批链路。", state: "待接入" },
];

export function AgentBrowserTab({
  selectedProject,
  context,
  onCreateActionPreview,
}: {
  selectedProject?: ProjectSummary;
  context?: AgentContextSnapshot;
  onCreateActionPreview: (input: { actionKind: AgentActionKind; projectId?: string; args?: Record<string, unknown> }) => void;
}) {
  void context;
  void onCreateActionPreview;

  const [inputUrl, setInputUrl] = useState(() => localStorage.getItem(AGENT_BROWSER_URL_STORAGE_KEY) || "");
  const [probe, setProbe] = useState<AgentBrowserProbeResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const target = inputUrl.trim();
    if (target) localStorage.setItem(AGENT_BROWSER_URL_STORAGE_KEY, target);
  }, [inputUrl]);

  const normalizedTarget = useMemo(() => {
    const target = inputUrl.trim();
    if (!target) return "";
    if (target.startsWith("http://") || target.startsWith("https://")) return target;
    return `https://${target}`;
  }, [inputUrl]);

  const handleProbe = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!normalizedTarget) return;
    if (normalizedTarget !== inputUrl.trim()) setInputUrl(normalizedTarget);
    setLoading(true);
    setError("");
    setProbe(undefined);
    try {
      setProbe(await probeAgentBrowserUrl(normalizedTarget));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  const statusTone = probe?.ok ? "good" : probe ? "bad" : "neutral";
  const statusLabel = probe ? (probe.ok ? "OK" : "Failed") : loading ? "Running" : "Idle";
  const headerTitle = probe?.title || probe?.finalUrl || probe?.requestedUrl || selectedProject?.name || "Browser Probe";

  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-bg text-agent-text">
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-agent-border bg-agent-panel px-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Globe className="h-4 w-4 shrink-0 text-agent-muted" />
            <h2 className="truncate text-[15px] font-medium text-agent-text">{headerTitle}</h2>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-agent-subtle">
            <InlineStatus icon={loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CircleDashed className="h-3 w-3" />} label={loading ? "probe running" : "server-side probe"} />
            <InlineStatus icon={<ShieldCheck className="h-3 w-3" />} label="readonly" />
            {probe?.checkedAt ? <InlineStatus icon={<Clock3 className="h-3 w-3" />} label={probe.checkedAt} /> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled
            className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-agent-border-soft bg-agent-bg text-agent-subtle opacity-60"
            title="上一条探测待接入"
            aria-label="上一条探测待接入"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="rounded-control border border-agent-border-soft bg-agent-bg px-2 py-1 text-[11px] text-agent-muted">
            probe
          </span>
          <button
            type="button"
            disabled
            className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-agent-border-soft bg-agent-bg text-agent-subtle opacity-60"
            title="下一条探测待接入"
            aria-label="下一条探测待接入"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-1 h-8 gap-1.5 border-agent-border bg-agent-bg px-2 text-[11px] text-agent-muted hover:bg-agent-surface hover:text-agent-text"
            disabled={loading || !normalizedTarget}
            onClick={(event) => void handleProbe(event)}
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            探测
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden">
        <main className="min-h-0 overflow-auto p-4 lg:p-6">
          <div className="mx-auto flex max-w-[960px] flex-col gap-4">
            <section className="rounded-panel border border-agent-border bg-agent-panel shadow-sm">
              <div className="border-b border-agent-border-soft p-4">
                <form onSubmit={handleProbe} className="flex flex-col gap-3">
                  <div className="min-w-0">
                    <p className="m-0 truncate text-[13px] font-medium text-agent-text">Browser probe artifact</p>
                    <p className="m-0 mt-0.5 truncate text-[11px] text-agent-subtle">
                      只读检查 URL 响应；真实浏览器渲染和交互保持待接入。
                    </p>
                  </div>
                  <div className="flex min-h-10 items-center gap-2 rounded-control border border-agent-border-soft bg-agent-bg px-3 transition-colors focus-within:border-agent-accent/45 focus-within:bg-agent-panel">
                    <Globe className="h-4 w-4 shrink-0 text-agent-muted" />
                    <input
                      value={inputUrl}
                      onChange={(event) => setInputUrl(event.target.value)}
                      className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-agent-text outline-none placeholder:text-agent-subtle"
                      placeholder="输入 URL，例如 https://example.com"
                      aria-label="Browser probe URL"
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-control text-agent-muted hover:bg-agent-surface hover:text-agent-text"
                      disabled={loading || !normalizedTarget}
                      title="探测 URL"
                    >
                      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </form>
              </div>

              <div className="grid gap-0 sm:grid-cols-2 2xl:grid-cols-4">
                <MetricTile label="Status" value={statusLabel} tone={statusTone} />
                <MetricTile label="HTTP" value={probe?.status ? `${probe.status} ${probe.statusText ?? ""}`.trim() : "-"} tone={probe?.ok ? "good" : probe ? "bad" : "neutral"} />
                <MetricTile label="Content type" value={probe?.contentType ?? "-"} />
                <MetricTile label="Duration" value={probe ? `${probe.durationMs}ms` : loading ? "running" : "-"} />
              </div>

              {error ? (
                <div className="border-t border-agent-border-soft p-4">
                  <div className="rounded-control border border-[#b03939]/25 bg-[#b03939]/5 p-3 text-[12px] leading-5 text-[#b03939]">
                    {error}
                  </div>
                </div>
              ) : null}

              <div className="grid min-h-[320px] border-t border-agent-border-soft 2xl:grid-cols-[minmax(0,1fr)_260px]">
                <div className="min-w-0 p-4">
                  {probe ? (
                    <ProbeResultSurface probe={probe} />
                  ) : (
                    <EmptyProbeSurface loading={loading} normalizedTarget={normalizedTarget} />
                  )}
                </div>
                <aside className="border-t border-agent-border-soft bg-agent-bg p-4 2xl:border-l 2xl:border-t-0">
                  <PanelTitle title="Probe capabilities" subtitle="真实能力和待接入边界" />
                  <div className="flex flex-col gap-2">
                    {capabilityRows.map((row) => (
                      <CapabilityRow key={row.label} row={row} />
                    ))}
                  </div>
                </aside>
              </div>
            </section>

            <section className="grid gap-4 2xl:grid-cols-[1fr_1fr]">
              <InfoPanel title="Lifecycle" subtitle="从 URL 检查到浏览器产物的骨架">
                <div className="flex flex-col overflow-hidden rounded-control border border-agent-border-soft">
                  {lifecycleRows.map((row) => (
                    <LifecycleRow key={row.label} row={row} />
                  ))}
                </div>
              </InfoPanel>
              <InfoPanel title="Browser readiness" subtitle="只显示当前真实可用状态">
                <div className="flex flex-col gap-2">
                  <ReadinessRow label="HTTP GET probe" value="可用" ready />
                  <ReadinessRow label="HTML title extraction" value="可用" ready />
                  <ReadinessRow label="Rendered DOM" value="待接入" ready={false} />
                  <ReadinessRow label="Screenshot capture" value="待接入" ready={false} />
                  <ReadinessRow label="Browser actions" value="待审批接入" ready={false} />
                </div>
              </InfoPanel>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function ProbeResultSurface({ probe }: { probe: AgentBrowserProbeResult }) {
  return (
    <div className="rounded-control border border-agent-border-soft bg-agent-bg p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 truncate text-[14px] font-medium text-agent-text">
            {probe.title || probe.finalUrl || probe.requestedUrl}
          </p>
          <p className="m-0 mt-1 break-words text-[11px] leading-5 text-agent-muted">
            {probe.finalUrl || probe.requestedUrl}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-control border px-2 py-1 text-[11px]",
            probe.ok ? "border-agent-accent/25 bg-agent-accent/10 text-agent-accent" : "border-[#b03939]/25 bg-[#b03939]/5 text-[#b03939]"
          )}
        >
          {probe.ok ? "OK" : "FAILED"}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <ProbeRow label="请求 URL" value={probe.requestedUrl} wide />
        <ProbeRow label="最终 URL" value={probe.finalUrl ?? "-"} wide />
        <ProbeRow label="HTTP 状态" value={probe.status ? `${probe.status} ${probe.statusText ?? ""}`.trim() : "-"} />
        <ProbeRow label="内容类型" value={probe.contentType ?? "-"} />
        <ProbeRow label="耗时" value={`${probe.durationMs}ms`} />
        <ProbeRow label="检查时间" value={probe.checkedAt} />
        {probe.error ? <ProbeRow label="错误" value={probe.error} wide tone="bad" /> : null}
      </div>
    </div>
  );
}

function EmptyProbeSurface({
  loading,
  normalizedTarget,
}: {
  loading: boolean;
  normalizedTarget: string;
}) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-control border border-dashed border-agent-border bg-agent-bg p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-control border border-agent-border-soft bg-agent-panel text-agent-muted">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Globe className="h-5 w-5" />}
        </div>
        <p className="m-0 text-[14px] font-medium text-agent-text">
          {loading ? "正在探测 URL" : normalizedTarget ? "准备探测 URL" : "等待 URL"}
        </p>
        <p className="m-0 mt-2 text-[12px] leading-6 text-agent-muted">
          这里只显示真实服务端响应检查结果；页面渲染、DOM 和截图仍标记为待接入。
        </p>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "bad";
}) {
  return (
    <div className="min-h-[76px] border-b border-agent-border-soft p-4 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 2xl:border-r 2xl:[&:nth-child(2n)]:border-r 2xl:last:border-r-0">
      <p className="m-0 text-[10px] uppercase tracking-normal text-agent-subtle">{label}</p>
      <p
        className={cn(
          "m-0 mt-2 truncate text-[15px] font-medium",
          tone === "good" ? "text-agent-accent" : tone === "bad" ? "text-[#b03939]" : "text-agent-text"
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function CapabilityRow({ row }: { row: (typeof capabilityRows)[number] }) {
  const Icon = row.icon;
  return (
    <div className="rounded-control border border-agent-border-soft bg-agent-panel p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-agent-muted" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-agent-text">{row.label}</span>
        <span className="shrink-0 rounded-control bg-agent-bg px-1.5 py-0.5 text-[10px] text-agent-subtle">{row.state}</span>
      </div>
      <p className="m-0 mt-1 line-clamp-2 text-[11px] leading-5 text-agent-muted">{row.body}</p>
    </div>
  );
}

function ProbeRow({
  label,
  value,
  wide,
  tone,
}: {
  label: string;
  value: string;
  wide?: boolean;
  tone?: "bad";
}) {
  return (
    <div className={cn("rounded-control border border-agent-border-soft bg-agent-panel p-3", wide && "sm:col-span-2")}>
      <div className="text-[11px] font-medium text-agent-subtle">{label}</div>
      <div className={cn("mt-1 break-words text-[12px] leading-5 text-agent-text", tone === "bad" && "text-[#b03939]")}>
        {value}
      </div>
    </div>
  );
}

function LifecycleRow({ row }: { row: (typeof lifecycleRows)[number] }) {
  return (
    <div className="flex min-h-12 items-center gap-3 border-b border-agent-border-soft bg-agent-bg px-3 py-2 last:border-b-0">
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          row.tone === "good" ? "bg-agent-accent" : row.tone === "warning" ? "bg-agent-warning" : "bg-agent-subtle"
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium text-agent-text">{row.label}</span>
        <span className="block truncate text-[11px] text-agent-muted">{row.body}</span>
      </span>
      <span className="shrink-0 rounded-control border border-agent-border-soft bg-agent-panel px-1.5 py-0.5 text-[10px] text-agent-subtle">
        {row.state}
      </span>
    </div>
  );
}

function ReadinessRow({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <div className="flex min-h-10 items-center gap-3 rounded-control border border-agent-border-soft bg-agent-bg px-3 py-2">
      {ready ? <CheckCircle2 className="h-4 w-4 shrink-0 text-agent-accent" /> : <CircleDashed className="h-4 w-4 shrink-0 text-agent-subtle" />}
      <span className="min-w-0 flex-1 truncate text-[12px] text-agent-muted">{label}</span>
      <span className="shrink-0 truncate text-[11px] text-agent-text">{value}</span>
    </div>
  );
}

function InlineStatus({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="shrink-0 text-agent-subtle">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}

function InfoPanel({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-panel border border-agent-border bg-agent-panel p-3 shadow-sm">
      <PanelTitle title={title} subtitle={subtitle} />
      {children}
    </div>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h3 className="m-0 truncate text-[13px] font-medium text-agent-text">{title}</h3>
      <p className="m-0 mt-0.5 truncate text-[11px] text-agent-subtle">{subtitle}</p>
    </div>
  );
}
