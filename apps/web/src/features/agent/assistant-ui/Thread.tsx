import {
  ActionBarPrimitive,
  AuiIf,
  type AssistantState,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChartColumnIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CodeXmlIcon,
  CopyIcon,
  FileTextIcon,
  GitBranchIcon,
  LightbulbIcon,
  PencilIcon,
  RefreshCwIcon,
  SearchIcon,
  SquareIcon,
  TerminalIcon,
} from "lucide-react";
import { useState, type FC, type ReactNode } from "react";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";
import { MarkdownText } from "./MarkdownText";
import { ToolFallback } from "./ToolFallback";
import { TooltipIconButton } from "./TooltipIconButton";

const isNewChatView = (state: AssistantState) =>
  state.thread.messages.length === 0 && (!state.thread.isLoading || state.threads.isLoading);

export const Thread: FC = () => {
  const isEmpty = useAuiState(isNewChatView);

  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root flex h-full min-h-0 flex-col bg-transparent"
      style={{
        ["--thread-max-width" as string]: "48rem",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        className={cn(
          "relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto scroll-smooth px-4 pt-4",
          isEmpty && "justify-center"
        )}
      >
        <AuiIf condition={isNewChatView}>
          <ThreadWelcome />
        </AuiIf>

        <div className="mb-14 flex flex-col gap-y-6 empty:hidden">
          <ThreadPrimitive.Messages>{() => <ThreadMessage />}</ThreadPrimitive.Messages>
        </div>

        <ThreadPrimitive.ViewportFooter
          className={cn(
            "mx-auto flex w-full max-w-[var(--thread-max-width)] shrink-0 flex-col gap-4 overflow-visible bg-transparent pb-4 md:pb-6 relative z-10",
            !isEmpty && "sticky bottom-0 mt-auto"
          )}
        >
          <ThreadScrollToBottom />
          <Composer />
          <AuiIf condition={isNewChatView}>
            <div className="min-h-20">
              <AuiIf condition={(state) => state.composer.isEmpty}>
                <ThreadSuggestions />
              </AuiIf>
            </div>
          </AuiIf>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

const ThreadMessage: FC = () => {
  const role = useAuiState((state) => state.message.role);
  const isEditing = useAuiState((state) => state.message.composer.isEditing);

  if (isEditing) return <EditComposer />;
  if (role === "user") return <UserMessage />;
  return <AssistantMessage />;
};

const ThreadScrollToBottom: FC = () => (
  <ThreadPrimitive.ScrollToBottom asChild>
    <TooltipIconButton
      tooltip="滚动到底部"
      variant="outline"
      className="absolute -top-12 z-10 self-center rounded-full bg-background p-3 disabled:invisible shadow-sm"
    >
      <ArrowDownIcon className="h-4 w-4" />
    </TooltipIconButton>
  </ThreadPrimitive.ScrollToBottom>
);

const ThreadWelcome: FC = () => (
  <div className="mx-auto mb-6 flex w-full max-w-[var(--thread-max-width)] flex-col items-center px-4 text-center">
    <h1 className="m-0 text-3xl font-semibold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">有什么可以帮您的？</h1>
  </div>
);

type SuggestionGroup = {
  label: string;
  icon: ReactNode;
  options: Array<{ label: string; prompt: string }>;
};

const suggestionGroups: SuggestionGroup[] = [
  {
    label: "诊断",
    icon: <SearchIcon className="h-4 w-4" />,
    options: [
      { label: "检查 MCP 启动失败", prompt: "帮我诊断当前 MCP 为什么没有启动，先读取日志和环境状态。" },
      { label: "分析当前页面异常", prompt: "帮我分析当前页面的异常，列出最可能原因和下一步检查。" },
      { label: "检查依赖环境", prompt: "检查当前项目的本地依赖、Node、npm 和内置运行时是否可用。" },
    ],
  },
  {
    label: "代码",
    icon: <CodeXmlIcon className="h-4 w-4" />,
    options: [
      { label: "解释最近改动", prompt: "解释当前工作区最近的代码改动，以及可能影响哪些功能。" },
      { label: "做一次代码审查", prompt: "请审查当前未提交改动，重点找 bug、回归风险和缺失验证。" },
      { label: "拆分一个模块", prompt: "帮我找出当前页面里最需要拆分的模块，并给出低风险拆分方案。" },
    ],
  },
  {
    label: "Diff",
    icon: <GitBranchIcon className="h-4 w-4" />,
    options: [
      { label: "总结 Git diff", prompt: "总结当前 Git diff，按功能、风险和验证结果分类。" },
      { label: "找 UI 回归", prompt: "从当前 diff 里找可能导致 UI 回归的改动。" },
      { label: "准备提交说明", prompt: "基于当前 diff 写一份清晰的提交说明草稿。" },
    ],
  },
  {
    label: "终端",
    icon: <TerminalIcon className="h-4 w-4" />,
    options: [
      { label: "跑类型检查", prompt: "运行类型检查，并解释失败原因或确认通过。" },
      { label: "跑构建", prompt: "运行构建验证，完成后总结警告和风险。" },
      { label: "查看服务状态", prompt: "检查本地前端和后端 dev server 状态，说明端口占用情况。" },
    ],
  },
  {
    label: "计划",
    icon: <LightbulbIcon className="h-4 w-4" />,
    options: [
      { label: "规划下一阶段", prompt: "根据当前项目状态，规划下一阶段 Agent 能力建设优先级。" },
      { label: "压缩上下文", prompt: "整理当前上下文，生成一份给下个 Agent 接手的摘要。" },
      { label: "列风险清单", prompt: "列出当前 Agent 模块最可能出现的 bug 和修复优先级。" },
    ],
  },
];

const suggestionChipClass =
  "h-auto gap-1.5 rounded-pill border border-border-soft px-3.5 py-1.5 text-sm font-normal text-text transition hover:bg-surface-muted";

const ThreadSuggestions: FC = () => {
  const aui = useAui();
  const [expandedLabel, setExpandedLabel] = useState<string | null>(null);
  const expandedGroup = suggestionGroups.find((group) => group.label === expandedLabel);

  const sendPrompt = (prompt: string) => {
    if (aui.thread().getState().isRunning) return;
    aui.thread().append({
      content: [{ type: "text", text: prompt }],
      runConfig: aui.composer().getState().runConfig,
    });
  };

  return (
    <div className="flex w-full flex-col gap-2 px-4">
      <div className="w-full overflow-x-auto">
        <div className="mx-auto flex w-max items-center gap-2">
          {suggestionGroups.map((group) => (
            <Button
              key={group.label}
              type="button"
              variant="ghost"
              className={cn(suggestionChipClass, group.label === expandedLabel && "bg-surface-muted")}
              onClick={() => setExpandedLabel(group.label === expandedLabel ? null : group.label)}
            >
              {group.icon}
              {group.label}
            </Button>
          ))}
        </div>
      </div>
      {expandedGroup ? (
        <div className="w-full overflow-x-auto">
          <div className="mx-auto flex w-max items-center gap-2">
            {expandedGroup.options.map((option) => (
              <Button
                key={option.label}
                type="button"
                variant="ghost"
                className={suggestionChipClass}
                onClick={() => sendPrompt(option.prompt)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const Composer: FC = () => (
  <ComposerPrimitive.Root className="relative flex w-full flex-col px-4 group">
    <div className="flex w-full flex-col gap-2 rounded-3xl border border-white/[0.08] bg-black/50 p-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-2xl transition-all duration-300 focus-within:border-cyan-500/30 focus-within:bg-black/70 focus-within:shadow-[0_8px_40px_rgba(34,211,238,0.15)]">
      <ComposerPrimitive.Input
        placeholder="Type a message... (@ for context, / for commands)"
        className="max-h-[30vh] min-h-10 w-full resize-none bg-transparent px-4 py-3 text-[14px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600 font-mono transition-colors"
        rows={1}
        autoFocus
        aria-label="Agent Message Input"
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-pill text-text-muted" title="添加上下文">
            <FileTextIcon className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" className="h-7 rounded-pill px-2.5 text-xs font-semibold text-text-muted">
            <ChartColumnIcon className="h-4 w-4" />
            Maker Agent
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <AuiIf condition={(state) => !state.thread.isRunning}>
            <ComposerPrimitive.Send asChild>
              <TooltipIconButton tooltip="发送消息" className="h-9 w-9 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white hover:from-cyan-500 hover:to-indigo-500 shadow-md shadow-cyan-900/30 transition-all hover:scale-105 active:scale-95">
                <ArrowUpIcon className="h-4 w-4 shrink-0" />
              </TooltipIconButton>
            </ComposerPrimitive.Send>
          </AuiIf>
          <AuiIf condition={(state) => state.thread.isRunning}>
            <ComposerPrimitive.Cancel asChild>
              <TooltipIconButton tooltip="停止生成" className="h-9 w-9 rounded-full bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all hover:scale-105 active:scale-95">
                <SquareIcon className="h-4 w-4 shrink-0 fill-current" />
              </TooltipIconButton>
            </ComposerPrimitive.Cancel>
          </AuiIf>
        </div>
      </div>
    </div>
  </ComposerPrimitive.Root>
);

const MessageError: FC = () => (
  <MessagePrimitive.Error>
    <ErrorPrimitive.Root className="mt-2 rounded-card border border-[#d95f5f]/30 bg-[#d95f5f]/10 p-3 text-sm text-[#b03939]">
      <ErrorPrimitive.Message className="line-clamp-2" />
    </ErrorPrimitive.Root>
  </MessagePrimitive.Error>
);

const AssistantMessage: FC = () => (
  <MessagePrimitive.Root className="relative mx-auto w-full max-w-[var(--thread-max-width)] mb-6" data-role="assistant">
    <div className="px-5 py-4 leading-relaxed text-[13px] text-zinc-200 bg-white/[0.02] backdrop-blur-xl border border-white/[0.05] shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-3xl [contain-intrinsic-size:auto_24px] [content-visibility:auto]">
      <MessagePrimitive.Parts>
        {({ part }) => {
          if (part.type === "text") return <MarkdownText />;
          if (part.type === "tool-call") return part.toolUI ?? <ToolFallback {...part} />;
          return null;
        }}
      </MessagePrimitive.Parts>
      <AuiIf condition={(state) => state.message.status?.type === "running" && state.message.parts.length === 0}>
        <span className="animate-pulse font-sans text-zinc-500" aria-label="Agent 正在生成">
          ●
        </span>
      </AuiIf>
      <MessageError />
    </div>
    <div className="-mb-7.5 ms-2 flex min-h-7 items-center pt-1.5">
      <BranchPicker />
      <AssistantActionBar />
    </div>
  </MessagePrimitive.Root>
);

const AssistantActionBar: FC = () => (
  <ActionBarPrimitive.Root
    hideWhenRunning
    autohide="not-last"
    className="flex gap-1 text-text-subtle opacity-0 transition group-hover:opacity-100"
  >
    <ActionBarPrimitive.Copy asChild>
      <TooltipIconButton tooltip="复制">
        <AuiIf condition={(state) => state.message.isCopied}>
          <CheckIcon className="h-3.5 w-3.5" />
        </AuiIf>
        <AuiIf condition={(state) => !state.message.isCopied}>
          <CopyIcon className="h-3.5 w-3.5" />
        </AuiIf>
      </TooltipIconButton>
    </ActionBarPrimitive.Copy>
    <ActionBarPrimitive.Reload asChild>
      <TooltipIconButton tooltip="重新生成">
        <RefreshCwIcon className="h-3.5 w-3.5" />
      </TooltipIconButton>
    </ActionBarPrimitive.Reload>
  </ActionBarPrimitive.Root>
);

const UserMessage: FC = () => (
  <MessagePrimitive.Root
    className="mx-auto grid w-full max-w-[var(--thread-max-width)] auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-4 mb-6 [&:where(>*)]:col-start-2"
    data-role="user"
  >
    <div className="relative col-start-2 min-w-0">
      <div className="peer rounded-3xl rounded-tr-sm bg-gradient-to-br from-cyan-900/60 to-indigo-900/40 px-5 py-3.5 text-[14px] text-zinc-100 shadow-md shadow-black/20 border border-cyan-500/10 backdrop-blur-md empty:hidden">
        <MessagePrimitive.Parts />
      </div>
      <div className="absolute start-0 top-1/2 -translate-x-full -translate-y-1/2 pe-2 peer-empty:hidden">
        <UserActionBar />
      </div>
    </div>
    <BranchPicker className="col-span-full col-start-1 row-start-3 justify-end" />
  </MessagePrimitive.Root>
);

const UserActionBar: FC = () => (
  <ActionBarPrimitive.Root hideWhenRunning autohide="not-last" className="flex flex-col items-end">
    <ActionBarPrimitive.Edit asChild>
      <TooltipIconButton tooltip="编辑">
        <PencilIcon className="h-3.5 w-3.5" />
      </TooltipIconButton>
    </ActionBarPrimitive.Edit>
  </ActionBarPrimitive.Root>
);

const EditComposer: FC = () => (
  <MessagePrimitive.Root className="flex flex-col px-4 mb-4">
    <ComposerPrimitive.Root className="ms-auto flex w-full max-w-[85%] flex-col rounded-xl border border-white/10 bg-black/40 shadow-sm">
      <ComposerPrimitive.Input className="min-h-14 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-[13px] text-zinc-200 outline-none" autoFocus />
      <div className="mx-3 mb-3 mt-2 flex items-center justify-end gap-2">
        <ComposerPrimitive.Cancel asChild>
          <Button type="button" variant="ghost" className="h-7 text-zinc-400 hover:text-zinc-200 hover:bg-white/10">取消</Button>
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send asChild>
          <Button type="button" className="h-7 bg-white text-black hover:bg-zinc-200">更新</Button>
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  </MessagePrimitive.Root>
);

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({ className, ...rest }) => (
  <BranchPickerPrimitive.Root
    hideWhenSingleBranch
    className={cn("-ms-2 me-2 inline-flex items-center text-xs font-medium text-text-subtle", className)}
    {...rest}
  >
    <BranchPickerPrimitive.Previous asChild>
      <TooltipIconButton tooltip="上一条">
        <ChevronLeftIcon className="h-3.5 w-3.5" />
      </TooltipIconButton>
    </BranchPickerPrimitive.Previous>
    <span>
      <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
    </span>
    <BranchPickerPrimitive.Next asChild>
      <TooltipIconButton tooltip="下一条">
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </TooltipIconButton>
    </BranchPickerPrimitive.Next>
  </BranchPickerPrimitive.Root>
);
