import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import { Braces, Copy } from "lucide-react";
import { Button } from "../ui/Button";
import { copyText } from "../../lib/clipboard";
import { cn } from "../../lib/utils";

type RawViewerProps = {
  title: string;
  value?: string;
  language?: "json" | "log" | "text";
  copyLabel?: string;
  copySuccessMessage?: string;
  emptyText?: string;
  className?: string;
  height?: string;
};

export function RawViewer({
  title,
  value,
  language = "json",
  copyLabel = "复制",
  copySuccessMessage,
  emptyText = "暂无内容",
  className,
  height = "320px"
}: RawViewerProps) {
  const documentTheme = useDocumentTheme();
  const rawValue = value ?? "";
  const viewerValue = useMemo(() => formatRawValue(rawValue, language, emptyText), [emptyText, language, rawValue]);
  const monacoLanguage = language === "json" ? "json" : "text";
  const theme = documentTheme === "light" ? "vs" : "vs-dark";

  return (
    <section className={cn("flex min-h-0 flex-col overflow-hidden rounded-panel border border-border bg-surface-panel shadow-sm", className)}>
      <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-b border-border-soft bg-surface-muted/30 px-3">
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
            className="h-7 gap-1.5 px-2 text-[10px] text-text-muted"
            title={copyLabel}
          >
            <Copy className="h-3.5 w-3.5" />
            {copyLabel}
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1" style={{ height }}>
        <Editor
          height="100%"
          language={monacoLanguage}
          theme={theme}
          value={viewerValue}
          options={{
            readOnly: true,
            domReadOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            lineNumbers: "on",
            folding: true,
            automaticLayout: true,
            renderLineHighlight: "none",
            fontSize: 11,
            lineHeight: 18,
            tabSize: 2,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8
            }
          }}
        />
      </div>
    </section>
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
