import { useEffect, useState } from "react";
import { Globe, Loader2, RotateCcw, ExternalLink } from "lucide-react";
import { openExternalUrl, type ProjectSummary } from "../../../api";
import type { AgentActionKind, AgentContextSnapshot } from "../api";
import { Button } from "../../../components/ui/Button";

const AGENT_BROWSER_URL_STORAGE_KEY = "taptap.agent.browserUrlV2";
const DEFAULT_URL = "https://maker.taptap.cn";

export function AgentBrowserTab({
  selectedProject,
  context,
  onCreateActionPreview
}: {
  selectedProject?: ProjectSummary;
  context?: AgentContextSnapshot;
  onCreateActionPreview: (input: { actionKind: AgentActionKind; projectId?: string; args?: Record<string, unknown> }) => void;
}) {
  const [url, setUrl] = useState(() => localStorage.getItem(AGENT_BROWSER_URL_STORAGE_KEY) || DEFAULT_URL);
  const [frameKey, setFrameKey] = useState(0);
  const [inputUrl, setInputUrl] = useState(url);

  useEffect(() => {
    if (url && url !== "about:blank") localStorage.setItem(AGENT_BROWSER_URL_STORAGE_KEY, url);
  }, [url]);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let target = inputUrl.trim();
    if (target && !target.startsWith("http://") && !target.startsWith("https://") && target !== "about:blank") {
      target = "https://" + target;
    }
    setUrl(target);
  };

  const handleExternal = () => {
    void openExternalUrl(url);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <form onSubmit={handleNavigate} className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface px-2 py-1">
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
            placeholder="输入 URL..."
          />
        </form>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => setFrameKey((k) => k + 1)} title="刷新">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={handleExternal} title="在外部浏览器打开">
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 bg-white">
        {url && url !== "about:blank" ? (
          <iframe key={frameKey} title="Agent Browser" src={url} className="h-full w-full border-0" sandbox="allow-scripts allow-same-origin allow-forms" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">请输入有效的 URL</div>
        )}
      </div>
    </div>
  );
}
