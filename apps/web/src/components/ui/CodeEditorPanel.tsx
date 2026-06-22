import { useMemo, useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { cn } from "../../lib/utils";

type CodeEditorPanelProps = {
  title: string;
  value: string;
  language?: string;
  className?: string;
  bodyClassName?: string;
  maxHeight?: string;
  copyLabel?: string;
  emptyText?: string;
};

export function CodeEditorPanel({
  title,
  value,
  language,
  className,
  bodyClassName,
  maxHeight = "320px",
  copyLabel = "复制",
  emptyText = "暂无内容"
}: CodeEditorPanelProps) {
  const [copied, setCopied] = useState(false);
  const displayValue = value || emptyText;
  const lines = useMemo(() => displayValue.split("\n"), [displayValue]);

  function handleCopy() {
    void navigator.clipboard.writeText(value || "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-[#1f1f1f] shadow-sm", className)}>
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border-soft bg-[#242424] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Terminal className="h-3.5 w-3.5 shrink-0 text-text-subtle" />
          <span className="truncate text-[11px] font-bold text-text">{title}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {language ? <span className="truncate rounded-control bg-[#303030] px-2 py-0.5 font-mono text-[10px] text-[#C7C7C7]">{language}</span> : null}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-control px-2 text-[10px] font-semibold text-text-muted hover:bg-surface-muted hover:text-text"
            title={copyLabel}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "已复制" : copyLabel}
          </button>
        </div>
      </div>
      <div className={cn("min-h-0 overflow-auto bg-[#181818] font-mono text-[11px] leading-5 text-[#E8E8E8] scrollbar-thin", bodyClassName)} style={{ maxHeight }}>
        <div className="min-w-max py-2">
          {lines.map((line, index) => (
            <div key={`${index}-${line.slice(0, 12)}`} className="grid grid-cols-[44px_1fr] px-0">
              <span className="select-none border-r border-white/8 pr-2 text-right text-[#808080]">{index + 1}</span>
              <pre className="m-0 whitespace-pre px-3 text-inherit">{renderHighlightedLine(line)}</pre>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function renderHighlightedLine(line: string) {
  if (!line) return " ";

  if (/^\s*\$/.test(line)) {
    return <span className="text-[#DCDCAA]">{line}</span>;
  }

  if (/^\s*>/.test(line)) {
    return <span className="text-[#9CDCFE]">{line}</span>;
  }

  const parts = line.split(/("(?:\\.|[^"\\])*"|true|false|null|-?\d+(?:\.\d+)?)/g);
  return parts.map((part, index) => {
    if (!part) return null;
    if (/^"(?:\\.|[^"\\])*"$/.test(part)) {
      const nextText = parts.slice(index + 1).join("");
      const isKey = /^\s*:/.test(nextText);
      return (
        <span key={`${index}-${part}`} className={isKey ? "text-[#9CDCFE]" : "text-[#CE9178]"}>
          {part}
        </span>
      );
    }
    if (/^(true|false|null)$/.test(part)) {
      return <span key={`${index}-${part}`} className="text-[#569CD6]">{part}</span>;
    }
    if (/^-?\d+(?:\.\d+)?$/.test(part)) {
      return <span key={`${index}-${part}`} className="text-[#B5CEA8]">{part}</span>;
    }
    return <span key={`${index}-${part}`} className="text-[#D4D4D4]">{part}</span>;
  });
}
