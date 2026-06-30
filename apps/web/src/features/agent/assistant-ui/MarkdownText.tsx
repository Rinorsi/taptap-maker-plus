import "@assistant-ui/react-markdown/styles/dot.css";

import {
  MarkdownTextPrimitive,
  type CodeHeaderProps,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import { CheckIcon, CopyIcon } from "lucide-react";
import { memo, useState, type FC } from "react";
import remarkGfm from "remark-gfm";
import { cn } from "../../../lib/utils";
import { TooltipIconButton } from "./TooltipIconButton";

const MarkdownTextImpl = () => (
  <MarkdownTextPrimitive
    remarkPlugins={[remarkGfm]}
    className="aui-md agent-markdown-text"
    components={defaultComponents}
    defer
  />
);

export const MarkdownText = memo(MarkdownTextImpl);

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  return (
    <div className="aui-code-header-root mt-3 flex items-center justify-between rounded-t-xl border border-b-0 border-white/10 bg-black/40 px-3 py-1.5 text-[11px]">
      <span className="aui-code-header-language font-semibold uppercase text-zinc-400">
        {language || "text"}
      </span>
      <TooltipIconButton tooltip="复制代码" onClick={onCopy} className="h-6 w-6">
        {isCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
      </TooltipIconButton>
    </div>
  );
};

function useCopyToClipboard({ copiedDuration = 3000 }: { copiedDuration?: number } = {}) {
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = (value: string) => {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(value).then(
      () => {
        setIsCopied(true);
        window.setTimeout(() => setIsCopied(false), copiedDuration);
      },
      () => {}
    );
  };

  return { isCopied, copyToClipboard };
}

const defaultComponents = memoizeMarkdownComponents({
  h1: ({ className, ...props }) => <h1 className={cn("mt-5 mb-2 text-xl font-semibold first:mt-0 last:mb-0", className)} {...props} />,
  h2: ({ className, ...props }) => <h2 className={cn("mt-5 mb-2 text-lg font-semibold first:mt-0 last:mb-0", className)} {...props} />,
  h3: ({ className, ...props }) => <h3 className={cn("mt-4 mb-1.5 text-base font-semibold first:mt-0 last:mb-0", className)} {...props} />,
  h4: ({ className, ...props }) => <h4 className={cn("mt-3.5 mb-1 text-base font-medium first:mt-0 last:mb-0", className)} {...props} />,
  h5: ({ className, ...props }) => <h5 className={cn("mt-3 mb-1 text-sm font-semibold first:mt-0 last:mb-0", className)} {...props} />,
  h6: ({ className, ...props }) => <h6 className={cn("mt-3 mb-1 text-sm font-medium first:mt-0 last:mb-0", className)} {...props} />,
  p: ({ className, ...props }) => <p className={cn("my-3 leading-relaxed first:mt-0 last:mb-0", className)} {...props} />,
  a: ({ className, ...props }) => <a className={cn("text-blue-400 underline underline-offset-2 hover:text-blue-300", className)} {...props} />,
  blockquote: ({ className, ...props }) => <blockquote className={cn("my-3 border-s-2 border-white/20 ps-4 text-zinc-400", className)} {...props} />,
  ul: ({ className, ...props }) => <ul className={cn("my-3 ms-5 list-disc marker:text-zinc-500 [&>li]:mt-1", className)} {...props} />,
  ol: ({ className, ...props }) => <ol className={cn("my-3 ms-5 list-decimal marker:text-zinc-500 [&>li]:mt-1", className)} {...props} />,
  hr: ({ className, ...props }) => <hr className={cn("my-3 border-white/10", className)} {...props} />,
  table: ({ className, ...props }) => <table className={cn("my-3 w-full border-separate border-spacing-0 overflow-y-auto", className)} {...props} />,
  th: ({ className, ...props }) => <th className={cn("bg-black/30 px-3 py-1.5 text-start font-semibold first:rounded-ss-xl last:rounded-se-xl border-b border-white/10", className)} {...props} />,
  td: ({ className, ...props }) => <td className={cn("border-s border-b border-white/10 px-3 py-1.5 text-start last:border-e", className)} {...props} />,
  tr: ({ className, ...props }) => <tr className={cn("m-0 border-b border-white/10 p-0 first:border-t", className)} {...props} />,
  li: ({ className, ...props }) => <li className={cn("leading-relaxed", className)} {...props} />,
  strong: ({ className, ...props }) => <strong className={cn("font-semibold text-zinc-100", className)} {...props} />,
  sup: ({ className, ...props }) => <sup className={cn("[&>a]:text-[10px] [&>a]:no-underline text-zinc-500", className)} {...props} />,
  pre: ({ className, ...props }) => <pre className={cn("overflow-x-auto rounded-t-none rounded-b-xl border border-t-0 border-white/10 bg-[#0d0d0d] p-3.5 text-[13px] leading-relaxed text-[#d6dde3]", className)} {...props} />,
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock();
    return (
      <code
        className={cn(
          !isCodeBlock && "rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-200",
          className
        )}
        {...props}
      />
    );
  },
  CodeHeader,
});
