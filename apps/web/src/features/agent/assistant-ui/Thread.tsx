import {
  ActionBarPrimitive,
  AuiIf,
  type AssistantState,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  Loader2Icon,
  LogsIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  SquareIcon,
  Gamepad2Icon,
  ImagePlusIcon,
  UploadIcon,
  FileUpIcon,
  FolderUpIcon,
} from "lucide-react";
import { useState, type FC } from "react";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";
import type { AgentWorkspaceTab } from "../types";
import { MarkdownText } from "./MarkdownText";
import { ToolFallback } from "./ToolFallback";
import { TooltipIconButton } from "./TooltipIconButton";
import { motion, AnimatePresence } from "framer-motion";

const isNewChatView = (state: AssistantState) =>
  state.thread.messages.length === 0 && (!state.thread.isLoading || state.threads.isLoading);

type ThreadProps = {
  activeRunCount: number;
  pendingPreviewCount: number;
  error: string;
  showWelcome: boolean;
  onOpenWorkspaceTab: (tab: AgentWorkspaceTab) => void;
};

export const Thread: FC<ThreadProps> = ({
  activeRunCount,
  pendingPreviewCount,
  error,
  showWelcome,
  onOpenWorkspaceTab,
}) => {
  const isEmpty = useAuiState(isNewChatView);
  const showEmptyWelcome = showWelcome && isEmpty;

  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root flex h-full min-h-0 flex-col bg-transparent"
      style={{
        ["--thread-max-width" as string]: showEmptyWelcome ? "860px" : "100%",
        ["--composer-bg" as string]: "color-mix(in srgb, var(--agent-panel) 92%, transparent)",
        ["--composer-radius" as string]: "18px",
        ["--composer-padding" as string]: "10px",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
          className={cn(
            "relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto scroll-smooth px-4 pt-4",
            showEmptyWelcome && "justify-center pb-[12vh]"
          )}
      >
        {showEmptyWelcome ? (
          <ThreadWelcome onOpenWorkspaceTab={onOpenWorkspaceTab} />
        ) : null}

        <div className="mb-10 flex flex-col gap-y-5 empty:hidden">
          <AnimatePresence mode="popLayout">
            <ThreadPrimitive.Messages>{() => <ThreadMessage />}</ThreadPrimitive.Messages>
            <ThinkingIndicator activeRunCount={activeRunCount} />
          </AnimatePresence>
        </div>

        <ThreadPrimitive.ViewportFooter
          className={cn(
            "mx-auto flex w-full max-w-[var(--thread-max-width)] shrink-0 flex-col gap-4 overflow-visible bg-transparent pb-4 md:pb-5 relative z-10",
            showEmptyWelcome ? "mt-7" : "sticky bottom-0 mt-auto"
          )}
        >
          <ThreadScrollToBottom />
          <div className="relative w-full">
            <ComposerStatusLine activeRunCount={activeRunCount} pendingPreviewCount={pendingPreviewCount} error={error} />
            <Composer onOpenWorkspaceTab={onOpenWorkspaceTab} />
          </div>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

const ThreadMessage: FC = () => {
  const role = useAuiState((state) => state.message.role);
  const isEditing = useAuiState((state) => state.message.composer.isEditing);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      {isEditing ? <EditComposer /> : role === "user" ? <UserMessage /> : <AssistantMessage />}
    </motion.div>
  );
};

const ThreadScrollToBottom: FC = () => (
  <ThreadPrimitive.ScrollToBottom asChild>
    <TooltipIconButton
      tooltip="滚动到底部"
      variant="outline"
      className="absolute -top-14 z-20 self-center !h-10 !w-10 !p-2.5 rounded-full border border-[#00d1bf]/20 bg-[#f4f6fb]/90 text-[#00d1bf] shadow-xl backdrop-blur-xl disabled:invisible hover:bg-white hover:text-[#00c6b5] transition-all dark:bg-[#27292f]/80 dark:border-white/10"
    >
      <ArrowDownIcon className="h-5 w-5" />
    </TooltipIconButton>
  </ThreadPrimitive.ScrollToBottom>
);

const ThreadWelcome: FC<{ onOpenWorkspaceTab: (tab: AgentWorkspaceTab) => void }> = ({ onOpenWorkspaceTab }) => (
  <div className="pointer-events-none mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col items-center justify-center px-4">
    <h1 className="m-0 text-center text-[26px] font-semibold tracking-normal text-[#101217] dark:text-agent-text">
      你想做一个什么样的游戏？
    </h1>
  </div>
);

const ComposerStatusLine: FC<{
  activeRunCount: number;
  pendingPreviewCount: number;
  error: string;
}> = ({ activeRunCount, pendingPreviewCount, error }) => {
  if (error) {
    return (
      <div className="absolute -top-10 left-4 z-10 flex h-7 items-center gap-2 rounded-full border border-[#b03939]/25 bg-[#b03939]/10 px-3 text-[11px] text-[#b03939] shadow-sm backdrop-blur-md">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#b03939]" />
        <span className="truncate">Needs input · {error}</span>
      </div>
    );
  }
  if (pendingPreviewCount > 0) {
    return (
      <div className="absolute -top-10 left-4 z-10 flex h-7 items-center gap-2 rounded-full border border-agent-warning/25 bg-agent-warning/10 px-3 text-[11px] text-agent-warning shadow-sm backdrop-blur-md">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-agent-warning" />
        <span className="truncate">Needs input · {pendingPreviewCount} 个动作待审批</span>
      </div>
    );
  }
  return null;
};

const ThinkingIndicator: FC<{ activeRunCount: number }> = ({ activeRunCount }) => {
  const isRunning = useAuiState((state) => state.thread.isRunning);
  if (!isRunning && activeRunCount === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="group relative mx-auto mb-5 flex w-full max-w-[var(--thread-max-width)] gap-3 px-5"
    >
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
        <img
          src="/taptap-maker/tap-BM8wfTgR.webp"
          alt="Bot Avatar"
          className="h-full w-full rounded-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1 pt-3">
        <div className="flex h-4 items-center gap-1.5 px-1 opacity-70">
          <motion.span animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0 }} className="h-1.5 w-1.5 rounded-full bg-[#00d1bf] dark:bg-[#00c6b5]" />
          <motion.span animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }} className="h-1.5 w-1.5 rounded-full bg-[#00d1bf] dark:bg-[#00c6b5]" />
          <motion.span animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }} className="h-1.5 w-1.5 rounded-full bg-[#00d1bf] dark:bg-[#00c6b5]" />
        </div>
      </div>
    </motion.div>
  );
};

const Composer: FC<{ onOpenWorkspaceTab: (tab: AgentWorkspaceTab) => void }> = ({ onOpenWorkspaceTab }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <ComposerPrimitive.Root className="relative flex w-full flex-col px-4">
      <div className="agent-composer-shell flex w-full flex-col rounded-[18px] border border-[#d6d9de] bg-white shadow-[0_4px_18px_rgba(15,23,42,0.12)] transition-shadow hover:shadow-[0_8px_24px_rgba(15,23,42,0.14)] focus-within:shadow-[0_8px_24px_rgba(15,23,42,0.14)] dark:border-white/12 dark:bg-[#2a2b30] dark:shadow-[0_10px_28px_rgba(0,0,0,0.24)]">
        <ComposerPrimitive.Input
          placeholder="提出创意、问题，或随便聊聊..."
          className="max-h-[180px] min-h-[58px] w-full resize-none overflow-y-auto bg-transparent px-4 pt-4 font-sans text-[15px] font-normal leading-relaxed text-[#1f2328] outline-none placeholder:font-normal placeholder:text-[#8b8f97] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 md:text-[15px] dark:text-[#f4f6fb] dark:placeholder:text-[#8f949f]"
          rows={1}
          autoFocus
          aria-label="Agent Message Input"
        />
        <div className="flex items-center justify-between gap-2 px-4 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative flex shrink-0 items-center">
              <TooltipIconButton
                tooltip="添加附件"
                className={cn("h-8 w-8 rounded-full bg-gray-100 text-[#4b5563] shadow-sm transition-all duration-300 hover:bg-gray-200 dark:bg-[#3a3b40] dark:text-agent-muted dark:hover:bg-[#4a4b50]", isExpanded && "rotate-45")}
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <PlusIcon className="h-4 w-4 shrink-0" />
              </TooltipIconButton>
              <AnimatePresence>
                {isExpanded && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsExpanded(false)} />
                    <motion.div
                      className="absolute bottom-full left-0 z-50 mb-2 flex w-36 flex-col overflow-hidden rounded-xl border border-black/10 bg-white p-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-[#2b2c30]"
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      <button
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] text-agent-text transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        onClick={() => { setIsExpanded(false); onOpenWorkspaceTab("files"); }}
                      >
                        <FileUpIcon className="h-4 w-4 shrink-0 text-agent-muted" />
                        上传文件
                      </button>
                      <button
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] text-agent-text transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        onClick={() => { setIsExpanded(false); onOpenWorkspaceTab("files"); }}
                      >
                        <FolderUpIcon className="h-4 w-4 shrink-0 text-agent-muted" />
                        上传文件夹
                      </button>
                      <div className="my-1 h-[1px] w-full bg-black/5 dark:bg-white/5" />
                      <button
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] text-agent-text transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        onClick={() => { setIsExpanded(false); onOpenWorkspaceTab("overview"); }}
                      >
                        <Gamepad2Icon className="h-4 w-4 shrink-0 text-agent-muted" />
                        项目设定
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
            <div className="flex h-7 items-center gap-1.5 rounded-full border border-black/5 bg-gray-50/50 px-2.5 text-[12px] font-medium text-agent-muted dark:border-white/5 dark:bg-[#323337]/50">
              <span className="flex h-1.5 w-1.5 rounded-full bg-[#00d1bf]"></span>
              TapTap Engine
            </div>
            <button
              className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-agent-muted transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => onOpenWorkspaceTab("files")}
            >
              <FolderUpIcon className="h-3.5 w-3.5 shrink-0" />
              工作区已连接
            </button>
          </div>

          <div className="flex shrink-0 items-center">
            <AuiIf condition={(state) => !state.thread.isRunning}>
              <ComposerPrimitive.Send asChild>
                <TooltipIconButton tooltip="发送消息" className="h-9 w-9 rounded-full bg-[#00d1bf] text-[#062421] shadow-[0_0_12px_rgba(0,209,191,0.4)] transition-all hover:bg-[#00e2cf] hover:shadow-[0_0_16px_rgba(0,209,191,0.6)]">
                  <ArrowUpIcon className="h-5 w-5 shrink-0" />
                </TooltipIconButton>
              </ComposerPrimitive.Send>
            </AuiIf>
            <AuiIf condition={(state) => state.thread.isRunning}>
              <ComposerPrimitive.Cancel asChild>
                <TooltipIconButton tooltip="停止生成" className="h-8 w-8 rounded-full border border-agent-border bg-agent-panel text-agent-text shadow-sm hover:bg-agent-surface">
                  <SquareIcon className="h-4 w-4 shrink-0 fill-current" />
                </TooltipIconButton>
              </ComposerPrimitive.Cancel>
            </AuiIf>
          </div>
        </div>
      </div>
    </ComposerPrimitive.Root>
  );
};

const MessageError: FC = () => (
  <MessagePrimitive.Error>
    <ErrorPrimitive.Root className="mt-2 rounded-card border border-[#d95f5f]/30 bg-[#d95f5f]/10 p-3 text-sm text-[#b03939]">
      <ErrorPrimitive.Message className="line-clamp-2" />
    </ErrorPrimitive.Root>
  </MessagePrimitive.Error>
);

const AssistantMessage: FC = () => (
  <MessagePrimitive.Root className="group relative mx-auto mb-5 flex w-full max-w-[var(--thread-max-width)] gap-3 px-5" data-role="assistant">
    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
      <img
        src="/taptap-maker/tap-BM8wfTgR.webp"
        alt="Bot Avatar"
        className="h-full w-full rounded-full object-cover"
      />
    </div>
    <div className="min-w-0 flex-1 pt-1">
      <div className="min-w-0 max-w-full break-words rounded-none p-0 text-[15px] leading-7 text-[#1f2328] shadow-none [contain-intrinsic-size:auto_24px] [content-visibility:auto] dark:text-agent-text">
        <MessagePrimitive.Parts>
          {({ part }) => {
            if (part.type === "text") return <MarkdownText />;
            if (part.type === "tool-call") return part.toolUI ?? <ToolFallback {...part} />;
            return null;
          }}
        </MessagePrimitive.Parts>
        <MessageError />
      </div>
      <div className="mt-2 flex min-h-7 items-center gap-2">
        <AssistantActionBar />
        <BranchPicker />
      </div>
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
    className="fade-in slide-in-from-bottom-1 animate-in group mx-auto mb-5 grid w-full max-w-[var(--thread-max-width)] grid-cols-[minmax(42px,1fr)_auto] content-start gap-y-1.5 px-5 duration-150 [&:where(>*)]:col-start-2"
    data-role="user"
  >
    <div className="relative col-start-2 min-w-0">
      <div className="peer relative max-w-[340px] rounded-[18px] rounded-br-[4px] border border-[#a7eae2] bg-gradient-to-br from-[#e6fcf9] to-[#d0f5f1] px-4 py-2 text-[15px] leading-6 text-[#093530] shadow-sm empty:hidden dark:border-white/5 dark:from-[#21242d] dark:to-[#262a35] dark:text-[#f4f6fb]">
        <div className="min-h-0 min-w-0 max-w-full break-words rounded-none p-0 shadow-none">
          <div className="whitespace-pre-wrap text-[15px] leading-6">
        <MessagePrimitive.Parts />
          </div>
        </div>
      </div>
      <div className="absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2 peer-empty:hidden">
        <UserActionBar />
      </div>
    </div>
    <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
  </MessagePrimitive.Root>
);

const UserActionBar: FC = () => (
  <ActionBarPrimitive.Root hideWhenRunning autohide="not-last" className="flex gap-1 text-agent-subtle opacity-0 transition group-hover:opacity-100">
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
      <ComposerPrimitive.Input className="min-h-14 w-full resize-none bg-transparent px-4 pt-3 pb-1 font-sans text-[13px] font-normal text-agent-text outline-none" autoFocus />
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
