import { useEffect, useState } from "react";
import { Globe, Loader2, Search } from "lucide-react";
import { motion } from "framer-motion";
import type { ProjectSummary } from "../../../api";
import type { AgentActionKind, AgentBrowserProbeResult, AgentContextSnapshot } from "../api";
import { probeAgentBrowserUrl } from "../api";
import { Button } from "../../../components/ui/Button";

const AGENT_BROWSER_URL_STORAGE_KEY = "taptap.agent.browserUrlV2";

export function AgentBrowserTab({
  selectedProject,
  context,
  onCreateActionPreview
}: {
  selectedProject?: ProjectSummary;
  context?: AgentContextSnapshot;
  onCreateActionPreview: (input: { actionKind: AgentActionKind; projectId?: string; args?: Record<string, unknown> }) => void;
}) {
  void selectedProject;
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

  const handleProbe = async (e: React.FormEvent) => {
    e.preventDefault();
    let target = inputUrl.trim();
    if (!target) return;
    if (!target.startsWith("http://") && !target.startsWith("https://")) {
      target = "https://" + target;
      setInputUrl(target);
    }
    setLoading(true);
    setError("");
    setProbe(undefined);
    try {
      setProbe(await probeAgentBrowserUrl(target));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-bg text-agent-text">
      <div className="shrink-0 p-4 border-b border-agent-border-soft bg-agent-bg/50 backdrop-blur-md sticky top-0 z-10">
        <form onSubmit={handleProbe} className="mx-auto flex max-w-2xl items-center justify-center">
          <div className="flex w-full items-center gap-2 rounded-full border border-agent-border-soft bg-agent-panel/60 px-3 py-2 shadow-sm backdrop-blur-xl transition-colors focus-within:border-agent-border focus-within:bg-agent-panel">
            <Globe className="h-4 w-4 shrink-0 text-agent-subtle" />
            <input
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="min-w-0 flex-1 bg-transparent px-1 text-sm text-agent-text outline-none placeholder:text-agent-subtle"
              placeholder="输入 URL 探测服务端响应..."
            />
            <Button type="submit" variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-agent-surface transition-colors" disabled={loading || !inputUrl.trim()}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin text-agent-accent" /> : <Search className="h-3 w-3 text-agent-muted" />}
            </Button>
          </div>
        </form>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error ? (
          <div className="rounded-panel border border-[#b03939]/25 bg-[#b03939]/5 p-3 text-xs leading-5 text-[#b03939]">
            {error}
          </div>
        ) : null}

        {!probe && !error ? (
          <div className="flex h-full min-h-[260px] items-center justify-center text-center px-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="max-w-sm rounded-[24px] border border-agent-border-soft bg-gradient-to-b from-agent-panel to-agent-bg p-8 shadow-xl"
            >
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-agent-surface shadow-inner border border-agent-border-soft">
                <Globe className="h-6 w-6 text-agent-muted" />
              </div>
              <h3 className="m-0 text-[15px] font-semibold text-agent-text">浏览器能力待接入</h3>
              <p className="m-0 mt-3 text-[13px] leading-relaxed text-agent-subtle">
                现阶段只能检查 URL 的响应状态、标题和内容类型；完整的页面渲染交互、DOM解析、截图和自动化浏览器控制引擎将由后续 Pi Runtime 提供。
              </p>
            </motion.div>
          </div>
        ) : null}

        {probe ? (
          <div className="space-y-3">
            <div className="rounded-panel border border-agent-border bg-agent-panel p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-agent-text">{probe.title || probe.finalUrl || probe.requestedUrl}</div>
                  <div className="mt-1 truncate text-[11px] text-agent-muted">{probe.finalUrl || probe.requestedUrl}</div>
                </div>
                <span className={probe.ok ? "rounded-pill bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-600" : "rounded-pill bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-600"}>
                  {probe.ok ? "OK" : "FAILED"}
                </span>
              </div>
            </div>

            <div className="grid gap-2 text-xs sm:grid-cols-2">
              <ProbeRow label="HTTP 状态" value={probe.status ? `${probe.status} ${probe.statusText ?? ""}`.trim() : "-"} />
              <ProbeRow label="内容类型" value={probe.contentType ?? "-"} />
              <ProbeRow label="耗时" value={`${probe.durationMs}ms`} />
              <ProbeRow label="检查时间" value={probe.checkedAt} />
              <ProbeRow label="请求 URL" value={probe.requestedUrl} wide />
              <ProbeRow label="最终 URL" value={probe.finalUrl ?? "-"} wide />
              {probe.error ? <ProbeRow label="错误" value={probe.error} wide /> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProbeRow({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "rounded-control border border-agent-border bg-agent-panel p-3 sm:col-span-2" : "rounded-control border border-agent-border bg-agent-panel p-3"}>
      <div className="text-[11px] font-medium text-agent-subtle">{label}</div>
      <div className="mt-1 break-words text-xs leading-5 text-agent-text">{value}</div>
    </div>
  );
}
