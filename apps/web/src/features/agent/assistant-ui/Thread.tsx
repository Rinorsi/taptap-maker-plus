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
  CopyIcon,
  FileTextIcon,
  PencilIcon,
  RefreshCwIcon,
  SquareIcon,
} from "lucide-react";
import { type FC } from "react";
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
    <h1 className="m-0 text-3xl font-semibold tracking-normal text-agent-text">有什么可以帮您的？</h1>
    <p className="m-0 mt-3 max-w-xl text-sm leading-6 text-agent-muted">
      当前阶段会先读取 TapTap Maker 上下文并生成可审查的回复；文件、终端、浏览器和 Diff 工作区需要手动打开。
    </p>
  </div>
);

const Composer: FC = () => (
  <ComposerPrimitive.Root className="relative flex w-full flex-col px-4">
    <div className="flex w-full flex-col gap-2 rounded-panel border border-agent-border bg-agent-panel p-2 shadow-sm transition-colors focus-within:border-agent-accent focus-within:ring-1 focus-within:ring-agent-accent/20">
      <ComposerPrimitive.Input
        placeholder="输入对话内容... (@ 引用上下文，/ 使用快捷指令)"
        className="max-h-[30vh] min-h-10 w-full resize-none bg-transparent px-3 py-2 text-[14px] leading-relaxed text-agent-text outline-none placeholder:text-agent-muted font-mono"
        rows={1}
        autoFocus
        aria-label="Agent Message Input"
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 rounded-control text-agent-subtle hover:bg-agent-surface" title="添加上下文">
            <FileTextIcon className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" className="h-7 rounded-control px-2.5 text-xs font-semibold text-agent-muted hover:bg-agent-surface">
            <ChartColumnIcon className="h-4 w-4" />
            当前项目上下文
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <AuiIf condition={(state) => !state.thread.isRunning}>
            <ComposerPrimitive.Send asChild>
              <TooltipIconButton tooltip="发送消息" className="h-8 w-8 rounded-control bg-agent-accent text-white hover:brightness-110">
                <ArrowUpIcon className="h-4 w-4 shrink-0" />
              </TooltipIconButton>
            </ComposerPrimitive.Send>
          </AuiIf>
          <AuiIf condition={(state) => state.thread.isRunning}>
            <ComposerPrimitive.Cancel asChild>
              <TooltipIconButton tooltip="停止生成" className="h-8 w-8 rounded-control bg-agent-surface text-agent-text hover:bg-agent-panel border border-agent-border-soft">
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
  <MessagePrimitive.Root className="relative mx-auto w-full max-w-[var(--thread-max-width)] mb-4" data-role="assistant">
    <div className="px-4 py-2 leading-relaxed text-[14px] text-agent-text [contain-intrinsic-size:auto_24px] [content-visibility:auto]">
      <MessagePrimitive.Parts>
        {({ part }) => {
          if (part.type === "text") return <MarkdownText />;
          if (part.type === "tool-call") return part.toolUI ?? <ToolFallback {...part} />;
          return null;
        }}
      </MessagePrimitive.Parts>
      <AuiIf condition={(state) => state.message.status?.type === "running" && state.message.parts.length === 0}>
        <span className="animate-pulse font-sans text-agent-subtle" aria-label="Agent 正在生成">
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
    className="flex gap-1 text-agent-subtle opacity-0 transition group-hover:opacity-100"
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
    className="mx-auto grid w-full max-w-[var(--thread-max-width)] auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-4 mb-4 [&:where(>*)]:col-start-2"
    data-role="user"
  >
    <div className="relative col-start-2 min-w-0">
      <div className="peer rounded-card bg-agent-surface px-4 py-3 text-[14px] text-agent-text empty:hidden">
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
    <ComposerPrimitive.Root className="ms-auto flex w-full max-w-[85%] flex-col rounded-card border border-agent-border bg-agent-panel shadow-sm">
      <ComposerPrimitive.Input className="min-h-14 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-[13px] text-agent-text outline-none" autoFocus />
      <div className="mx-3 mb-3 mt-2 flex items-center justify-end gap-2">
        <ComposerPrimitive.Cancel asChild>
          <Button type="button" variant="ghost" className="h-7 text-agent-subtle hover:text-agent-text hover:bg-agent-surface">取消</Button>
        </ComposerPrimitive.Cancel>
        <ComposerPrimitive.Send asChild>
          <Button type="button" className="h-7 bg-agent-accent text-white hover:brightness-110">更新</Button>
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  </MessagePrimitive.Root>
);

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({ className, ...rest }) => (
  <BranchPickerPrimitive.Root
    hideWhenSingleBranch
    className={cn("-ms-2 me-2 inline-flex items-center text-xs font-medium text-agent-subtle", className)}
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
