import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Braces, Copy } from "lucide-react";
import { Button } from "../ui/Button";
import { copyText } from "../../lib/clipboard";
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

const MonacoEditor = lazy(() => import("@monaco-editor/react"));

type RawViewerProps = {
  title: string;
  value?: string;
  language?: "json" | "log" | "text";
  copyLabel?: string;
  copySuccessMessage?: string;
  emptyText?: string;
  className?: string;
  height?: string;
  compactGutter?: boolean;
};

function readCodeViewerPreferences() {
  return {
    theme: readStoredPreference("codeEditorTheme") as CodeEditorThemePreference,
    fontSize: readStoredPreference("codeEditorFontSize") as CodeEditorFontSizePreference,
    wrap: readStoredPreference("codeEditorWrap") as CodeEditorWrapPreference,
    lineNumbers: readStoredPreference("codeEditorLineNumbers") as CodeEditorLineNumbersPreference,
  };
}

function useCodeViewerPreferences() {
  const [preferences, setPreferences] = useState(readCodeViewerPreferences);

  useEffect(() => {
    const keys = new Set<string>([
      settingsPreferenceKeys.codeEditorTheme,
      settingsPreferenceKeys.codeEditorFontSize,
      settingsPreferenceKeys.codeEditorWrap,
      settingsPreferenceKeys.codeEditorLineNumbers,
    ]);
    const handleChange = (event: Event) => {
      const key = (event as CustomEvent<{ key?: string }>).detail?.key;
      if (key && keys.has(key)) setPreferences(readCodeViewerPreferences());
    };
    window.addEventListener(SETTINGS_PREFERENCES_CHANGED_EVENT, handleChange);
    return () => window.removeEventListener(SETTINGS_PREFERENCES_CHANGED_EVENT, handleChange);
  }, []);

  return preferences;
}

export function RawViewer({
  title,
  value,
  language = "json",
  copyLabel = "复制",
  copySuccessMessage,
  emptyText = "暂无内容",
  className,
  height = "320px",
  compactGutter = false
}: RawViewerProps) {
  const documentTheme = useDocumentTheme();
  const preferences = useCodeViewerPreferences();
  const [wrapOverride, setWrapOverride] = useState<boolean | undefined>();
  const wrapLines = wrapOverride ?? preferences.wrap === "wrap";
  const rawValue = value ?? "";
  const viewerValue = useMemo(() => formatRawValue(rawValue, language, emptyText), [emptyText, language, rawValue]);
  const monacoLanguage = language === "json" ? "json" : "text";
  const theme = preferences.theme === "light"
    ? "vs"
    : preferences.theme === "high-contrast"
      ? "hc-black"
      : preferences.theme === "dark"
      ? "vs-dark"
      : documentTheme === "light" ? "vs" : "vs-dark";
  const fontSize = preferences.fontSize === "small" ? 10 : preferences.fontSize === "large" ? 13 : 11;
  const lineHeight = preferences.fontSize === "small" ? 16 : preferences.fontSize === "large" ? 21 : 18;

  return (
    <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface-panel shadow-sm", className)}>
      <div
        className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border-soft bg-surface-muted/30 px-3"
        onDoubleClick={() => setWrapOverride((current) => current === undefined ? !wrapLines : !current)}
        title={wrapLines ? "双击切换为横向滚动" : "双击切换为自动换行"}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Braces className="h-3.5 w-3.5 shrink-0 text-text-subtle" />
          <span className="truncate text-[11px] font-bold text-text">{title}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate rounded-control bg-surface-muted px-2 py-0.5 font-mono text-[10px] text-text-muted">{monacoLanguage}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void copyText(rawValue, { successMessage: copySuccessMessage ?? `${title} 已复制` })}
            onDoubleClick={(event) => event.stopPropagation()}
            className="h-7 gap-1.5 px-2 text-[10px] text-text-muted"
            title={copyLabel}
          >
            <Copy className="h-3.5 w-3.5" />
            {copyLabel}
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1" style={{ height }}>
        <Suspense fallback={<RawViewerFallback />}>
          <MonacoEditor
            height="100%"
            language={monacoLanguage}
            theme={theme}
            value={viewerValue}
            options={{
              readOnly: true,
              domReadOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: wrapLines ? "on" : "off",
              lineNumbers: preferences.lineNumbers === "show" ? "on" : "off",
              lineNumbersMinChars: compactGutter ? 2 : 5,
              lineDecorationsWidth: compactGutter ? 4 : 10,
              glyphMargin: false,
              folding: !compactGutter,
              automaticLayout: true,
              renderLineHighlight: "none",
              fontSize,
              lineHeight,
              tabSize: 2,
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8
              }
            }}
          />
        </Suspense>
      </div>
    </section>
  );
}

function RawViewerFallback() {
  return (
    <div className="flex flex-col h-full min-h-[160px] items-center justify-center bg-surface-muted/30 text-text-subtle gap-3">
      <div className="relative flex items-center justify-center w-8 h-8">
        <div className="absolute inset-0 rounded-full border-[1.5px] border-brand/10 dark:border-brand/5"></div>
        <div className="absolute inset-0 rounded-full border-[1.5px] border-brand border-t-transparent border-l-transparent animate-[spin_0.8s_linear_infinite]"></div>
        <div className="absolute inset-[3px] rounded-full border-[1px] border-brand/40 border-b-transparent border-r-transparent animate-[spin_1.2s_linear_infinite_reverse]"></div>
        <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse shadow-[0_0_8px_rgba(0,217,197,0.6)]"></div>
      </div>
      <div className="text-[12px] font-medium tracking-wider text-text-muted animate-pulse">
        正在加载代码查看器...
      </div>
    </div>
  );
}

function formatRawValue(value: string, language: RawViewerProps["language"], emptyText: string) {
  if (!value) return emptyText;
  if (language !== "json") return value;
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function getDocumentTheme() {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme;
}

function useDocumentTheme() {
  const [theme, setTheme] = useState(getDocumentTheme);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const observer = new MutationObserver(() => setTheme(getDocumentTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}
