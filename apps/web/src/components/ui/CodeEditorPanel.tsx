import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  readStoredPreference,
  settingsPreferenceKeys,
  SETTINGS_PREFERENCES_CHANGED_EVENT,
  type CodeEditorFontSizePreference,
  type CodeEditorLineNumbersPreference,
  type CodeEditorThemePreference,
  type CodeEditorWrapPreference,
} from "../../features/settings/preferences";

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

function readCodeEditorPreferences() {
  return {
    theme: readStoredPreference("codeEditorTheme") as CodeEditorThemePreference,
    fontSize: readStoredPreference("codeEditorFontSize") as CodeEditorFontSizePreference,
    wrap: readStoredPreference("codeEditorWrap") as CodeEditorWrapPreference,
    lineNumbers: readStoredPreference("codeEditorLineNumbers") as CodeEditorLineNumbersPreference,
  };
}

function useCodeEditorPreferences() {
  const [preferences, setPreferences] = useState(readCodeEditorPreferences);

  useEffect(() => {
    const keys = new Set<string>([
      settingsPreferenceKeys.codeEditorTheme,
      settingsPreferenceKeys.codeEditorFontSize,
      settingsPreferenceKeys.codeEditorWrap,
      settingsPreferenceKeys.codeEditorLineNumbers,
    ]);
    const handleChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (key && keys.has(key)) setPreferences(readCodeEditorPreferences());
    };
    window.addEventListener(SETTINGS_PREFERENCES_CHANGED_EVENT, handleChange);
    return () => window.removeEventListener(SETTINGS_PREFERENCES_CHANGED_EVENT, handleChange);
  }, []);

  return preferences;
}

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
  const preferences = useCodeEditorPreferences();
  const [wrapOverride, setWrapOverride] = useState<boolean | undefined>();
  const wrapLines = wrapOverride ?? preferences.wrap === "wrap";
  const showLineNumbers = preferences.lineNumbers === "show";
  const displayValue = value || emptyText;
  const lines = useMemo(() => displayValue.split("\n"), [displayValue]);
  const fontSizeClass = preferences.fontSize === "small" ? "text-[10px] leading-4" : preferences.fontSize === "large" ? "text-[12px] leading-6" : "text-[11px] leading-5";
  const isLight = preferences.theme === "light";
  const isHighContrast = preferences.theme === "high-contrast";
  const panelClassName = isHighContrast
    ? "border-[#FDE047] bg-[#000000]"
    : isLight
      ? "border-border bg-[#F8FAFC]"
      : "border-border bg-[#1f1f1f]";
  const headerClassName = isHighContrast
    ? "border-[#FDE047] bg-[#050505]"
    : isLight
      ? "border-border-soft bg-[#EEF2F7]"
      : "border-[#343434] bg-[#242424]";
  const bodyClassNames = isHighContrast
    ? "bg-[#000000] text-[#FFFFFF]"
    : isLight
      ? "bg-[#FFFFFF] text-[#111827]"
      : "bg-[#181818] text-[#E8E8E8]";
  const mutedTextClassName = isHighContrast ? "text-[#FDE047]" : isLight ? "text-[#475569]" : "text-[#C7C7C7]";

  function handleCopy() {
    void navigator.clipboard.writeText(value || "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-panel border shadow-sm", panelClassName, className)}>
      <div
        className={cn("flex min-h-10 shrink-0 items-center justify-between gap-3 border-b px-3 py-2", headerClassName)}
        onDoubleClick={() => setWrapOverride((current) => current === undefined ? !wrapLines : !current)}
        title={wrapLines ? "双击切换为横向滚动" : "双击切换为自动换行"}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Terminal className="h-3.5 w-3.5 shrink-0 text-[#8FDAD2]" />
          <span className={cn("min-w-0 whitespace-normal break-words text-[11px] font-bold leading-4", isLight ? "text-[#0F172A]" : "text-[#F3F4F6]")}>{title}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          {language ? <span className={cn("truncate rounded-control px-2 py-0.5 font-mono text-[10px]", isLight ? "bg-[#E2E8F0] text-[#334155]" : "bg-[#303030] text-[#C7C7C7]")}>{language}</span> : null}
          <button
            type="button"
            onClick={handleCopy}
            onDoubleClick={(event) => event.stopPropagation()}
            className={cn("inline-flex h-7 shrink-0 items-center gap-1.5 rounded-control px-2 text-[10px] font-semibold hover:bg-[#303030] hover:text-[#FFFFFF]", mutedTextClassName)}
            title={copyLabel}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-brand" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "已复制" : copyLabel}
          </button>
        </div>
      </div>
      <div className={cn("min-h-0 overflow-auto font-mono scrollbar-thin", fontSizeClass, bodyClassNames, bodyClassName)} style={{ maxHeight }}>
        <div className={cn("py-2", wrapLines ? "min-w-0" : "min-w-max")}>
          {lines.map((line, index) => (
            <div
              key={`${index}-${line.slice(0, 12)}`}
              className={cn("grid px-0", showLineNumbers ? (wrapLines ? "grid-cols-[44px_minmax(0,1fr)]" : "grid-cols-[44px_max-content]") : (wrapLines ? "grid-cols-[minmax(0,1fr)]" : "grid-cols-[max-content]"))}
            >
              {showLineNumbers ? <span className={cn("select-none border-r border-white/8 pr-2 text-right align-top", isLight ? "text-[#64748B]" : "text-[#808080]")}>{index + 1}</span> : null}
              <pre
                className={cn(
                  "m-0 px-3 text-inherit",
                  wrapLines
                    ? "min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                    : "min-w-max whitespace-pre"
                )}
              >
                {renderHighlightedLine(line)}
              </pre>
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
