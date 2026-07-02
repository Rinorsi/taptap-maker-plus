import {
  EyeOff,
  Folder,
  Gamepad2,
  History,
  Menu,
  MessageSquarePlus,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AgentChatPanel } from "../components/AgentChatPanel";
import { AgentSessionSidebar } from "../components/AgentSessionSidebar";
import type {
  AgentActionKind,
  AgentActionPreviewRecord,
  AgentContextSnapshot,
  AgentMessageRecord,
  AgentPageState,
  AgentSessionRecord,
  CompressedAgentContext,
  PiAgentRuntimeStatus,
} from "../api";
import type {
  DesktopReadiness,
  ProjectSummary,
  RuntimeStatus,
} from "../../../api";
import { cn } from "../../../lib/utils";
import { openExternalUrl } from "../../../lib/externalLinks";
import { readStoredPreference } from "../../settings/preferences";
import {
  closeMakerPreview,
  hideMakerPreview,
  isMakerPreviewWebViewAvailable,
  makerPreviewUrl,
  openMakerPreview,
  openMakerPreviewLogin,
  reloadMakerPreview,
  setMakerPreviewBounds,
  setMakerPreviewTheme,
} from "../remoteMakerPreview";

const MAKER_PREVIEW_INSTANCE_EVENT = "taptap:maker-preview-instance";
const MAKER_PREVIEW_LOAD_EVENT = "taptap:maker-preview-load";
const MAKER_PREVIEW_RESYNC_EVENT = "taptap:maker-preview-resync";
const MAKER_PREVIEW_HIDDEN_STORAGE_PREFIX = "taptap.makerPreview.hidden.";
const MAKER_PREVIEW_GAME_IFRAME_STORAGE_PREFIX = "taptap.makerPreview.gameIframeSrc.";

type MakerPreviewInstanceState = {
  active: boolean;
  projectId?: string;
  muted: boolean;
};

type MakerPreviewLoadPayload = {
  event?: string;
  url?: string;
  href?: string | null;
  gameIframeSrc?: string | null;
  gamePage?: boolean;
  shellInstalled?: boolean;
  shellHasViewport?: boolean;
  shellChildCount?: number;
  probeSnapshot?: string | null;
  probeError?: string | null;
};

function dispatchMakerPreviewInstanceState(detail: { active: boolean; projectId?: string; muted: boolean }) {
  window.dispatchEvent(new CustomEvent(MAKER_PREVIEW_INSTANCE_EVENT, { detail }));
}

function shouldKeepMakerPreviewInBackground() {
  return readStoredPreference("makerPreviewBackground") === "keep";
}

function shouldCloseMakerPreviewOnBackground() {
  return readStoredPreference("makerPreviewBackground") !== "keep" || readStoredPreference("makerPreviewBackgroundAudio") === "mute";
}

function makerPreviewHiddenStorageKey(projectId: string) {
  return `${MAKER_PREVIEW_HIDDEN_STORAGE_PREFIX}${projectId}`;
}

function makerPreviewGameIframeStorageKey(projectId: string) {
  return `${MAKER_PREVIEW_GAME_IFRAME_STORAGE_PREFIX}${projectId}`;
}

function readStoredMakerPreviewHidden(projectId?: string) {
  if (!projectId) return false;
  return localStorage.getItem(makerPreviewHiddenStorageKey(projectId)) === "true";
}

function writeStoredMakerPreviewHidden(projectId: string | undefined, hidden: boolean) {
  if (!projectId) return;
  localStorage.setItem(makerPreviewHiddenStorageKey(projectId), String(hidden));
}

function readStoredMakerPreviewGameIframeSrc(projectId?: string) {
  if (!projectId) return "";
  return localStorage.getItem(makerPreviewGameIframeStorageKey(projectId)) ?? "";
}

function writeStoredMakerPreviewGameIframeSrc(projectId: string | undefined, src: string | undefined | null) {
  if (!projectId || !src) return;
  localStorage.setItem(makerPreviewGameIframeStorageKey(projectId), src);
}

export function AgentShellLayout({
  sessionRailCollapsed,
  theme,
  pendingPreviewCount,
  sessions,
  activeSession,
  loading,
  messages,
  actionPreviews,
  context,
  compressedContext,
  compressedContextSnapshotId,
  readiness,
  pi,
  contextRows,
  pendingPreviews,
  selectedProject,
  runtimeStatus,
  page,
  sending,
  error,
  onToggleSessionRail,
  onNewSession,
  onSendMessage,
  onSelectSession,
  onRenameSession,
  onArchiveSession,
  onDecideActionPreview,
  onCreateActionPreview,
  onExecuteActionPreview,
  onSynced,
}: {
  sessionRailCollapsed: boolean;
  theme: "light" | "dark";
  pendingPreviewCount: number;
  sessions: AgentSessionRecord[];
  activeSession?: AgentSessionRecord;
  loading: boolean;
  messages: AgentMessageRecord[];
  actionPreviews: AgentActionPreviewRecord[];
  context?: AgentContextSnapshot;
  compressedContext?: CompressedAgentContext;
  compressedContextSnapshotId?: string;
  readiness?: DesktopReadiness;
  pi?: PiAgentRuntimeStatus;
  contextRows: Array<{ label: string; value: string }>;
  pendingPreviews: AgentActionPreviewRecord[];
  selectedProject?: ProjectSummary;
  runtimeStatus: RuntimeStatus;
  page: AgentPageState;
  sending: boolean;
  error: string;
  onToggleSessionRail: () => void;
  onNewSession: () => void;
  onSendMessage: (content: string) => Promise<void>;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onArchiveSession: (sessionId?: string) => void;
  onDecideActionPreview: (
    previewId: string,
    decision: "approved" | "rejected",
  ) => void;
  onCreateActionPreview: (input: {
    actionKind: AgentActionKind;
    projectId?: string;
    args?: Record<string, unknown>;
  }) => void;
  onExecuteActionPreview: (previewId: string) => void;
  onSynced: () => void;
}) {
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [chatPanelCollapsed, setChatPanelCollapsed] = useState(false);
  const [chatPanelWidth, setChatPanelWidth] = useState(520);
  const [previewReloadSignal, setPreviewReloadSignal] = useState(0);
  const [previewHideSignal, setPreviewHideSignal] = useState(0);
  const [previewManuallyHidden, setPreviewManuallyHidden] = useState(() =>
    readStoredMakerPreviewHidden(selectedProject?.makerProjectId),
  );
  const [makerPreviewInstance, setMakerPreviewInstance] = useState<MakerPreviewInstanceState>({
    active: false,
    muted: false,
  });
  const hasActiveConversation = Boolean(activeSession);
  const previewInstanceActive = makerPreviewInstance.active;
  const previewInstanceMuted = makerPreviewInstance.muted;

  useEffect(() => {
    function handleMakerPreviewInstance(event: Event) {
      const detail = (event as CustomEvent<Partial<MakerPreviewInstanceState>>).detail;
      setMakerPreviewInstance({
        active: Boolean(detail?.active),
        projectId: typeof detail?.projectId === "string" ? detail.projectId : undefined,
        muted: Boolean(detail?.muted),
      });
    }

    window.addEventListener(MAKER_PREVIEW_INSTANCE_EVENT, handleMakerPreviewInstance);
    return () => {
      window.removeEventListener(MAKER_PREVIEW_INSTANCE_EVENT, handleMakerPreviewInstance);
    };
  }, []);



  function startChatPanelResize(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = chatPanelWidth;
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(760, Math.max(420, startWidth + moveEvent.clientX - startX));
      setChatPanelWidth(nextWidth);
    };
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-[#f6f7f8] text-agent-text dark:bg-[#191a1c]">
      <motion.aside
        initial={false}
        animate={{ width: sessionRailCollapsed ? 76 : 260 }}
        transition={{ type: "spring", stiffness: 350, damping: 30 }}
        className="hidden md:flex flex-col border-r border-black/10 bg-agent-panel dark:border-white/10 z-10"
      >
        <div className="min-h-0 flex-1">
          <AgentSessionSidebar
            collapsed={sessionRailCollapsed}
            sessions={sessions}
            projects={context?.projects || []}
            activeSessionId={activeSession?.id}
            previewProjectId={selectedProject?.id}
            previewInstanceActive={previewInstanceActive}
            previewInstanceMuted={previewInstanceMuted}
            loading={loading}
            onToggleCollapsed={onToggleSessionRail}
            onNewSession={() => {
              onNewSession();
              setSessionsOpen(false);
            }}
            onSelectSession={onSelectSession}
            onRenameSession={onRenameSession}
            onArchiveSession={onArchiveSession}
          />
        </div>
      </motion.aside>

      {sessionsOpen ? (
        <div
          className="absolute inset-0 z-40 bg-black/25"
          onClick={() => setSessionsOpen(false)}
        >
          <div
            className="h-full w-[307px] border-r border-black/10 bg-white shadow-2xl dark:border-white/10 dark:bg-[#222326]"
            onClick={(event) => event.stopPropagation()}
          >
            <AgentSessionSidebar
              collapsed={false}
              sessions={sessions}
              projects={context?.projects || []}
              activeSessionId={activeSession?.id}
              previewProjectId={selectedProject?.id}
              previewInstanceActive={previewInstanceActive}
              previewInstanceMuted={previewInstanceMuted}
              loading={loading}
              onToggleCollapsed={() => setSessionsOpen(false)}
              onNewSession={() => {
                onNewSession();
                setSessionsOpen(false);
              }}
              onSelectSession={(sessionId) => {
                onSelectSession(sessionId);
                setSessionsOpen(false);
              }}
              onRenameSession={onRenameSession}
              onArchiveSession={onArchiveSession}
            />
          </div>
        </div>
      ) : null}

      <div className={cn("min-h-0 min-w-0 flex-1", hasActiveConversation ? "flex bg-white dark:bg-[#191a1c]" : "app-background relative flex flex-col")}>
        {!hasActiveConversation ? (
          <div className="min-h-0 flex-1">
            <button
              type="button"
              className="absolute left-7 top-5 z-20 inline-flex h-8 w-8 items-center justify-center rounded-md text-agent-muted transition-colors hover:bg-black/5 hover:text-agent-text dark:text-[#b8bbc5] dark:hover:bg-white/10 dark:hover:text-white"
              title="打开侧栏"
              onClick={() => {
                if (window.innerWidth >= 768) {
                  onToggleSessionRail();
                } else {
                  setSessionsOpen(true);
                }
              }}
            >
              <Menu className="h-5 w-5" />
            </button>
            <AgentChatPanel
              projectName={selectedProject?.name}
              projectId={selectedProject?.id}
              page={page}
              activeSession={activeSession}
              messages={messages}
              actionPreviews={actionPreviews}
              loading={loading}
              onDecideActionPreview={onDecideActionPreview}
              onExecuteActionPreview={onExecuteActionPreview}
              onSynced={onSynced}
              onSendMessage={onSendMessage}
              pendingPreviewCount={pendingPreviewCount}
              activeRunCount={sending ? 1 : 0}
              error={error}
              showWelcome
              onOpenWorkspaceTab={() => {}}
            />
            <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-5 text-[13px] text-[#8a94a6] md:flex">
              <span>TapTap 制造论坛</span>
              <span>加入交流群</span>
            </div>
          </div>
        ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
          <AnimatePresence initial={false}>
            {!chatPanelCollapsed && (
              <motion.section
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: chatPanelWidth, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="relative flex min-h-[44%] min-w-0 flex-col border-b border-black/10 bg-white lg:min-h-0 lg:shrink-0 lg:border-b-0 lg:border-r dark:border-white/10 dark:bg-[#202124] overflow-hidden"
              >
            <ConversationHeader
              projectName={selectedProject?.name ?? "未命名游戏"}
              previewInstanceActive={previewInstanceActive}
              onOpenSessions={() => {
                if (window.innerWidth >= 768) {
                  onToggleSessionRail();
                } else {
                  setSessionsOpen(true);
                }
              }}
            />
            <div className="grid h-9 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-black/10 bg-white px-3 dark:border-white/10 dark:bg-[#202124]">
              <div className="flex min-w-0 items-center justify-self-start">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#65627a] hover:bg-black/5 hover:text-[#272536] dark:text-[#b8bbc5] dark:hover:bg-white/10 dark:hover:text-white"
                  title="重新加载"
                >
                  <History className="h-4 w-4" />
                </button>
              </div>
              <div className="flex min-w-0 items-center justify-self-center text-[13px] text-agent-muted">
                <span className="truncate">
                  {sending ? "正在制作..." : loading ? "正在加载对话..." : "对话"}
                </span>
              </div>
              <button
                type="button"
                className={cn("justify-self-end", newChatButtonClass)}
                title="新建对话"
                aria-label="新建对话"
                onClick={onNewSession}
              >
                <MessageSquarePlus className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1">
              <AgentChatPanel
                projectName={selectedProject?.name}
                projectId={selectedProject?.id}
                page={page}
                activeSession={activeSession}
                messages={messages}
                actionPreviews={actionPreviews}
                loading={loading}
                onDecideActionPreview={onDecideActionPreview}
                onExecuteActionPreview={onExecuteActionPreview}
                onSynced={onSynced}
                onSendMessage={onSendMessage}
                pendingPreviewCount={pendingPreviewCount}
                activeRunCount={sending ? 1 : 0}
                error={error}
                showWelcome={false}
                onOpenWorkspaceTab={() => {}}
              />
            </div>
            <div
              className="absolute right-[-3px] top-0 z-20 hidden h-full w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-[#00d1bf]/50 lg:block"
              role="separator"
              aria-orientation="vertical"
              title="调整对话区宽度"
              onPointerDown={startChatPanelResize}
            />
          </motion.section>
            )}
          </AnimatePresence>

          <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#f7f7f8] lg:basis-[54%] dark:bg-[#111214]">
            <GamePreviewSurface
              projectName={selectedProject?.name}
              makerProjectId={selectedProject?.makerProjectId}
              theme={theme}
              runtimeStatus={runtimeStatus}
              reloadSignal={previewReloadSignal}
              hideSignal={previewHideSignal}
              pendingPreviewCount={pendingPreviewCount}
              onPreviewHiddenChange={setPreviewManuallyHidden}
            />
          </section>
        </div>
        )}
      </div>
    </div>
  );
}

function ConversationHeader({
  projectName,
  previewInstanceActive,
  onOpenSessions,
}: {
  projectName: string;
  previewInstanceActive?: boolean;
  onOpenSessions: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center border-b border-black/10 bg-white px-4 dark:border-white/10 dark:bg-[#202124]">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <button
          type="button"
          className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-agent-muted hover:bg-black/5 hover:text-agent-text dark:hover:bg-white/10"
          title="打开侧栏"
          onClick={onOpenSessions}
        >
          <Menu className="h-5 w-5" />
          {previewInstanceActive ? (
            <span className="absolute right-1 top-1.5 h-1.5 w-1.5 rounded-full bg-[#00d9c5] shadow-[0_0_6px_rgba(0,217,197,0.8)]" />
          ) : null}
        </button>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[15px] font-medium text-agent-text">
            {projectName}
          </span>
        </div>
      </div>
    </header>
  );
}

const agentIconButtonClass = "inline-flex h-7 w-7 items-center justify-center rounded-md text-[#65627a] transition-colors hover:bg-black/5 hover:text-[#272536] dark:text-[#b8bbc5] dark:hover:bg-white/10 dark:hover:text-white";
const newChatButtonClass = "inline-flex h-7 w-7 items-center justify-center rounded-md bg-transparent text-[#5f5b78] transition-colors hover:bg-black/5 hover:text-[#272536] dark:text-[#d8dcdf] dark:hover:bg-white/10 dark:hover:text-white";

function GamePreviewSurface({
  projectName,
  makerProjectId,
  theme,
  runtimeStatus,
  reloadSignal,
  hideSignal,
  pendingPreviewCount,
  onPreviewHiddenChange,
}: {
  projectName?: string;
  makerProjectId?: string;
  theme: "light" | "dark";
  runtimeStatus: RuntimeStatus;
  reloadSignal: number;
  hideSignal: number;
  pendingPreviewCount: number;
  onPreviewHiddenChange?: (hidden: boolean) => void;
}) {
  const ready = runtimeStatus === "ready";

  return (
    <div
      className="agent-preview-background relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
    >
      <RemoteMakerPreviewFrame
        makerProjectId={makerProjectId}
        projectName={projectName}
        theme={theme}
        reloadSignal={reloadSignal}
        hideSignal={hideSignal}
        runtimeReady={ready}
        pendingPreviewCount={pendingPreviewCount}
        onPreviewHiddenChange={onPreviewHiddenChange}
      />

      <div className="pointer-events-none absolute bottom-4 left-4 hidden rounded-full bg-black/5 px-3 py-1.5 text-[11px] text-agent-muted dark:bg-white/10 lg:block">
        对话驱动制作，预览只呈现结果
      </div>
    </div>
  );
}

function GamepadSvgAnimation({ className, glowColor }: { className?: string; glowColor?: string }) {
  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial="hidden"
      animate="visible"
    >
      {glowColor && (
        <defs>
          <filter id="svg-glow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      <motion.path
        d="M21 15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          visible: {
            pathLength: 1,
            opacity: 1,
            transition: { duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatType: "loop", repeatDelay: 1 }
          }
        }}
        filter={glowColor ? "url(#svg-glow)" : undefined}
      />
      <motion.line
        x1="6" y1="12" x2="10" y2="12"
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          visible: { pathLength: 1, opacity: 1, transition: { duration: 1, delay: 0.5, repeat: Infinity, repeatDelay: 1.5 } }
        }}
      />
      <motion.line
        x1="8" y1="10" x2="8" y2="14"
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          visible: { pathLength: 1, opacity: 1, transition: { duration: 1, delay: 0.5, repeat: Infinity, repeatDelay: 1.5 } }
        }}
      />
      <motion.circle cx="15" cy="11" r="1" fill="currentColor" variants={{ hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, transition: { duration: 0.5, delay: 0.8, repeat: Infinity, repeatType: "reverse" } } }} />
      <motion.circle cx="17" cy="13" r="1" fill="currentColor" variants={{ hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1, transition: { duration: 0.5, delay: 1, repeat: Infinity, repeatType: "reverse" } } }} />
    </motion.svg>
  );
}

function RemoteMakerPreviewFrame({
  makerProjectId,
  projectName,
  theme,
  reloadSignal,
  hideSignal,
  runtimeReady,
  pendingPreviewCount,
  onPreviewHiddenChange,
}: {
  makerProjectId?: string;
  projectName?: string;
  theme: "light" | "dark";
  reloadSignal: number;
  hideSignal: number;
  runtimeReady: boolean;
  pendingPreviewCount: number;
  onPreviewHiddenChange?: (hidden: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nativeViewportRef = useRef<HTMLDivElement | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [nativePreviewStarted, setNativePreviewStarted] = useState(false);
  const [previewManuallyHidden, setPreviewManuallyHidden] = useState(() => readStoredMakerPreviewHidden(makerProjectId));
  const [previewMaskVisible, setPreviewMaskVisible] = useState(false);
  const [gameIframeSrc, setGameIframeSrc] = useState(() => readStoredMakerPreviewGameIframeSrc(makerProjectId));
  const nativePreviewOpenedRef = useRef(false);
  const nativePreviewReadyRef = useRef(false);
  const previewManuallyHiddenRef = useRef(previewManuallyHidden);
  const previewMaskVisibleRef = useRef(previewMaskVisible);
  const previewMaskTimerRef = useRef<number | undefined>(undefined);
  const syncPulseTimerRef = useRef<number | undefined>(undefined);
  const lastReloadSignalRef = useRef(reloadSignal);
  const lastHideSignalRef = useRef(hideSignal);
  const nativePreviewAvailable = isMakerPreviewWebViewAvailable();
  const remoteUrl = makerProjectId ? makerPreviewUrl(makerProjectId) : "";
  const openRemotePreview = useCallback(() => {
    if (!remoteUrl) return;
    void openExternalUrl(remoteUrl);
  }, [remoteUrl]);
  const syncBounds = useCallback(() => {
    if (!nativePreviewAvailable) return;
    if (!nativePreviewOpenedRef.current) return;
    const element = nativeViewportRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    if (previewMaskVisibleRef.current || previewManuallyHiddenRef.current) {
      void hideMakerPreview().catch(() => undefined);
      return;
    }
    void setMakerPreviewBounds({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      scaleFactor: window.devicePixelRatio || 1,
    }).catch((error) => {
      setPreviewError(formatPreviewError(error));
    });
  }, [nativePreviewAvailable]);
  const syncPreviewTheme = useCallback(() => {
    if (!nativePreviewAvailable) return;
    void setMakerPreviewTheme(theme).catch(() => undefined);
  }, [nativePreviewAvailable, theme]);
  const stopSyncPulse = useCallback(() => {
    if (syncPulseTimerRef.current) {
      window.clearInterval(syncPulseTimerRef.current);
      syncPulseTimerRef.current = undefined;
    }
  }, []);
  const startSyncPulse = useCallback(() => {
    stopSyncPulse();
    let remainingTicks = 20;
    syncPulseTimerRef.current = window.setInterval(() => {
      syncBounds();
      remainingTicks -= 1;
      if (remainingTicks <= 0) {
        stopSyncPulse();
      }
    }, 120);
  }, [stopSyncPulse, syncBounds]);
  const openLoginWindow = useCallback(() => {
    if (!makerProjectId) return;
    if (!nativePreviewAvailable) {
      openRemotePreview();
      return;
    }
    void openMakerPreviewLogin(makerProjectId).catch((error) => {
      setPreviewError(formatPreviewError(error));
    });
  }, [makerProjectId, nativePreviewAvailable, openRemotePreview]);
  const confirmLoggedInAndRefreshPreview = useCallback(() => {
    if (!makerProjectId) return;
    if (!nativePreviewAvailable) {
      openRemotePreview();
      return;
    }
    writeStoredMakerPreviewHidden(makerProjectId, false);
    setPreviewManuallyHidden(false);
    onPreviewHiddenChange?.(false);
    setPreviewError("");
    setNativePreviewStarted(true);
  }, [makerProjectId, nativePreviewAvailable, onPreviewHiddenChange, openRemotePreview]);
  const showPreviewMask = useCallback(() => {
    if (previewMaskTimerRef.current) {
      window.clearTimeout(previewMaskTimerRef.current);
      previewMaskTimerRef.current = undefined;
    }
    setPreviewMaskVisible(true);
    previewMaskTimerRef.current = window.setTimeout(() => {
      setPreviewMaskVisible(false);
      previewMaskTimerRef.current = undefined;
    }, 8000);
  }, []);
  const clearPreviewMask = useCallback(() => {
    if (previewMaskTimerRef.current) {
      window.clearTimeout(previewMaskTimerRef.current);
      previewMaskTimerRef.current = undefined;
    }
    setPreviewMaskVisible(false);
  }, []);

  useEffect(() => {
    previewManuallyHiddenRef.current = previewManuallyHidden;
  }, [previewManuallyHidden]);

  useEffect(() => {
    previewMaskVisibleRef.current = previewMaskVisible;
    if (previewMaskVisible) {
      void hideMakerPreview().catch(() => undefined);
      return;
    }
    window.requestAnimationFrame(syncBounds);
  }, [previewMaskVisible, syncBounds]);

  useEffect(() => {
    const active = Boolean(makerProjectId && nativePreviewAvailable);
    const manuallyHidden = readStoredMakerPreviewHidden(makerProjectId);
    setPreviewManuallyHidden(manuallyHidden);
    setGameIframeSrc(readStoredMakerPreviewGameIframeSrc(makerProjectId));
    onPreviewHiddenChange?.(manuallyHidden);
    setNativePreviewStarted(active && !manuallyHidden);
    dispatchMakerPreviewInstanceState({ active: active && !manuallyHidden, projectId: makerProjectId, muted: false });
    if (!active) {
      nativePreviewOpenedRef.current = false;
      nativePreviewReadyRef.current = false;
      stopSyncPulse();
      void hideMakerPreview().catch(() => undefined);
    }
    return () => {
      nativePreviewOpenedRef.current = false;
      nativePreviewReadyRef.current = false;
      clearPreviewMask();
      stopSyncPulse();
      if (!shouldCloseMakerPreviewOnBackground() && shouldKeepMakerPreviewInBackground()) {
        void hideMakerPreview().catch(() => undefined);
        return;
      }
      dispatchMakerPreviewInstanceState({ active: false, projectId: makerProjectId, muted: false });
      void closeMakerPreview().catch(() => undefined);
    };
  }, [clearPreviewMask, makerProjectId, nativePreviewAvailable, onPreviewHiddenChange, stopSyncPulse]);

  useEffect(() => {
    if (!nativePreviewAvailable || !nativePreviewStarted) return;
    if (!makerProjectId) {
      void hideMakerPreview().catch(() => undefined);
      return;
    }

    let disposed = false;
    nativePreviewOpenedRef.current = false;
    nativePreviewReadyRef.current = false;
    setPreviewError("");
    showPreviewMask();
    void openMakerPreview(makerProjectId)
      .then(() => {
        nativePreviewOpenedRef.current = true;
        dispatchMakerPreviewInstanceState({ active: true, projectId: makerProjectId, muted: false });
        if (!disposed) {
          syncPreviewTheme();
          syncBounds();
          startSyncPulse();
        }
      })
      .catch((error) => {
        if (!disposed) {
          clearPreviewMask();
          setPreviewError(formatPreviewError(error));
        }
      });

    return () => {
      disposed = true;
      nativePreviewOpenedRef.current = false;
      nativePreviewReadyRef.current = false;
      stopSyncPulse();
      if (!shouldCloseMakerPreviewOnBackground() && shouldKeepMakerPreviewInBackground()) {
        void hideMakerPreview().catch(() => undefined);
        return;
      }
      dispatchMakerPreviewInstanceState({ active: false, projectId: makerProjectId, muted: false });
      void closeMakerPreview().catch(() => undefined);
    };
  }, [clearPreviewMask, makerProjectId, nativePreviewAvailable, nativePreviewStarted, showPreviewMask, startSyncPulse, stopSyncPulse, syncBounds, syncPreviewTheme]);

  useEffect(() => {
    if (!nativePreviewAvailable || !nativePreviewStarted) return;
    syncPreviewTheme();
  }, [nativePreviewAvailable, nativePreviewStarted, syncPreviewTheme]);

  useEffect(() => {
    if (reloadSignal === lastReloadSignalRef.current) return;
    lastReloadSignalRef.current = reloadSignal;
    if (!nativePreviewAvailable || !makerProjectId) return;
    writeStoredMakerPreviewHidden(makerProjectId, false);
    setPreviewManuallyHidden(false);
    onPreviewHiddenChange?.(false);
    if (!nativePreviewStarted) {
      setPreviewError("");
      setNativePreviewStarted(true);
      return;
    }
    showPreviewMask();
    nativePreviewReadyRef.current = false;
    void hideMakerPreview().catch(() => undefined);
    void reloadMakerPreview()
      .then(() => {
        syncBounds();
        startSyncPulse();
      })
      .catch((error) => setPreviewError(formatPreviewError(error)));
  }, [makerProjectId, nativePreviewAvailable, nativePreviewStarted, onPreviewHiddenChange, reloadSignal, showPreviewMask, startSyncPulse, syncBounds]);

  useEffect(() => {
    if (hideSignal === lastHideSignalRef.current) return;
    lastHideSignalRef.current = hideSignal;
    setNativePreviewStarted(false);
    setPreviewManuallyHidden(true);
    onPreviewHiddenChange?.(true);
    writeStoredMakerPreviewHidden(makerProjectId, true);
    nativePreviewOpenedRef.current = false;
    nativePreviewReadyRef.current = false;
    clearPreviewMask();
    stopSyncPulse();
    dispatchMakerPreviewInstanceState({ active: false, projectId: makerProjectId, muted: false });
    void closeMakerPreview().catch((error) => setPreviewError(formatPreviewError(error)));
  }, [clearPreviewMask, hideSignal, makerProjectId, onPreviewHiddenChange, stopSyncPulse]);

  useEffect(() => {
    if (!nativePreviewAvailable || !nativePreviewStarted) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<MakerPreviewLoadPayload>(MAKER_PREVIEW_LOAD_EVENT, (event) => {
          if (disposed) return;
          if (event.payload?.event === "started") {
            setPreviewMaskVisible(true);
            nativePreviewReadyRef.current = false;
            return;
          }
          if (event.payload?.event === "finished") {
            nativePreviewOpenedRef.current = true;
            syncPreviewTheme();
            startSyncPulse();
            return;
          }
          if (event.payload?.event === "ready") {
            syncPreviewTheme();
            if (event.payload.gameIframeSrc) {
              writeStoredMakerPreviewGameIframeSrc(makerProjectId, event.payload.gameIframeSrc);
              setGameIframeSrc(event.payload.gameIframeSrc);
            }
            nativePreviewOpenedRef.current = true;
            nativePreviewReadyRef.current = true;
            window.requestAnimationFrame(() => {
              if (disposed) return;
              syncBounds();
              clearPreviewMask();
            });
            return;
          }
          if (event.payload?.event === "ready-timeout") {
            nativePreviewOpenedRef.current = false;
            nativePreviewReadyRef.current = false;
            stopSyncPulse();
            if (event.payload.gameIframeSrc) {
              writeStoredMakerPreviewGameIframeSrc(makerProjectId, event.payload.gameIframeSrc);
              setGameIframeSrc(event.payload.gameIframeSrc);
            }
            setPreviewError("TapTap Maker 预览 WebView shell 没有接管到游戏画面，请重新载入预览。");
            setNativePreviewStarted(false);
            dispatchMakerPreviewInstanceState({ active: false, projectId: makerProjectId, muted: false });
            void closeMakerPreview().catch(() => undefined);
            clearPreviewMask();
          }
        }),
      )
      .then((handler) => {
        unlisten = handler;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [clearPreviewMask, makerProjectId, nativePreviewAvailable, nativePreviewStarted, startSyncPulse, stopSyncPulse, syncBounds, syncPreviewTheme]);

  useEffect(() => {
    if (!nativePreviewAvailable || !nativePreviewStarted) return;
    function handlePreviewResync() {
      syncBounds();
    }
    window.addEventListener(MAKER_PREVIEW_RESYNC_EVENT, handlePreviewResync);
    return () => {
      window.removeEventListener(MAKER_PREVIEW_RESYNC_EVENT, handlePreviewResync);
    };
  }, [nativePreviewAvailable, nativePreviewStarted, syncBounds]);

  useEffect(() => {
    if (!nativePreviewAvailable || !nativePreviewStarted) return;
    const element = nativeViewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(syncBounds);
    let disposed = false;
    const unlisteners: Array<() => void> = [];
    void import("@tauri-apps/api/window")
      .then(async ({ getCurrentWindow }) => {
        if (disposed) return;
        const currentWindow = getCurrentWindow();
        const [unlistenMoved, unlistenResized, unlistenScaleChanged] = await Promise.all([
          currentWindow.onMoved(syncBounds),
          currentWindow.onResized(syncBounds),
          currentWindow.onScaleChanged(syncBounds),
        ]);
        if (disposed) {
          unlistenMoved();
          unlistenResized();
          unlistenScaleChanged();
          return;
        }
        unlisteners.push(unlistenMoved, unlistenResized, unlistenScaleChanged);
      })
      .catch(() => undefined);
    observer.observe(element);
    window.addEventListener("resize", syncBounds);
    window.addEventListener("scroll", syncBounds, true);
    syncBounds();
    const animationFrameId = window.requestAnimationFrame(syncBounds);
    return () => {
      disposed = true;
      for (const unlisten of unlisteners) unlisten();
      window.cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener("resize", syncBounds);
      window.removeEventListener("scroll", syncBounds, true);
    };
  }, [nativePreviewAvailable, nativePreviewStarted, syncBounds]);

  useEffect(() => {
    if (!nativePreviewAvailable || !nativePreviewStarted) return;
    function hideWhenPageLeavesFocus() {
      if (document.visibilityState === "hidden") {
        void hideMakerPreview().catch(() => undefined);
      }
    }
    document.addEventListener("visibilitychange", hideWhenPageLeavesFocus);
    return () => {
      document.removeEventListener("visibilitychange", hideWhenPageLeavesFocus);
    };
  }, [nativePreviewAvailable, nativePreviewStarted]);

  return (
    <div
      ref={containerRef}
      data-game-iframe-src={gameIframeSrc || undefined}
      className={cn(
        "relative flex h-full w-full shrink-0 flex-col overflow-hidden bg-[#15171c] transition-shadow duration-300",
      )}
    >
      <div
        ref={nativeViewportRef}
        className="pointer-events-none absolute inset-0 bg-[#050608]"
        aria-hidden="true"
      />
      {!nativePreviewAvailable && makerProjectId ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#050608] px-8 text-center text-white pointer-events-auto"
        >
          <motion.div
            animate={{ y: [-8, 8, -8] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
            className="mb-12 relative flex items-center justify-center"
          >
            <div className="absolute inset-0 scale-150 bg-white/5 blur-[80px] rounded-full" />
            <GamepadSvgAnimation className="h-32 w-32 text-white/50 relative z-10 drop-shadow-2xl" glowColor="rgba(255,255,255,0.2)" />
          </motion.div>
          <h2 className="m-0 text-[26px] font-semibold tracking-tight text-white/90">桌面原生预览未启用</h2>
          <p className="m-0 mt-4 max-w-[420px] text-[15px] leading-relaxed text-white/40">
            当前页面没有连接到桌面端原生 WebView，无法承载同一个登录会话。
          </p>
          <button
            type="button"
            onClick={openLoginWindow}
            className="mt-10 inline-flex h-11 items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-8 text-[14px] font-medium text-white transition-all hover:bg-white/10 hover:scale-105 active:scale-95"
          >
            <Folder className="h-4.5 w-4.5" />
            打开 TapTap Maker
          </button>
        </motion.div>
      ) : previewManuallyHidden ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#050608] px-8 text-center text-white pointer-events-auto"
        >
          <motion.div
            animate={{ y: [-6, 6, -6] }}
            transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
            className="mb-12 relative flex items-center justify-center"
          >
            <div className="absolute inset-0 scale-150 bg-white/5 blur-[80px] rounded-full" />
            <EyeOff className="h-32 w-32 text-white/30 relative z-10 drop-shadow-2xl" strokeWidth={1} />
          </motion.div>
          <h2 className="m-0 text-[26px] font-semibold tracking-tight text-white/70">预览已隐藏</h2>
          <p className="m-0 mt-4 max-w-[420px] text-[15px] leading-relaxed text-white/30">
            游戏预览已中断，后台 iframe 不会继续播放声音。
          </p>
          <button
            type="button"
            className="mt-10 inline-flex h-11 items-center gap-2.5 rounded-full bg-[#00d1bf] px-8 text-[14px] font-medium text-[#062421] transition-all hover:bg-[#00c6b5] hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(0,209,191,0.3)]"
            onClick={confirmLoggedInAndRefreshPreview}
          >
            <RefreshCw className="h-4.5 w-4.5" />
            重新载入预览
          </button>
        </motion.div>
      ) : !makerProjectId || previewError ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-[100] flex flex-col items-center overflow-y-auto bg-[#050608] px-8 py-8 text-center text-white pointer-events-auto"
        >
          <motion.div
            animate={{ y: [-8, 8, -8] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
            className="mb-12 relative flex items-center justify-center"
          >
            <div className="absolute inset-0 scale-150 bg-rose-500/10 blur-[80px] rounded-full" />
            <Wrench className="h-32 w-32 text-rose-400/60 relative z-10 drop-shadow-2xl" strokeWidth={1} />
          </motion.div>
          <h2 className="m-0 text-[26px] font-semibold tracking-tight text-white/90">
            {!makerProjectId ? "未绑定 Maker 项目" : "预览未连接"}
          </h2>
          <p className="m-0 mt-4 max-w-[560px] text-[15px] leading-relaxed text-white/42">
            {!makerProjectId
              ? "当前项目没有 makerProjectId，右侧预览没有可打开的 Maker 地址。"
              : previewError || "没有获取到游戏预览页面。"}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-8 text-[14px] font-medium text-white transition-all hover:bg-white/10 hover:scale-105 active:scale-95"
              onClick={makerProjectId ? openLoginWindow : undefined}
            >
              <Folder className="h-4.5 w-4.5" />
              {makerProjectId ? "打开登录窗口" : "暂无项目"}
            </button>
            {makerProjectId ? (
              <button
                type="button"
                className="inline-flex h-11 items-center gap-2.5 rounded-full bg-[#00d1bf] px-8 text-[14px] font-medium text-[#062421] transition-all hover:bg-[#00c6b5] hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(0,209,191,0.3)]"
                onClick={confirmLoggedInAndRefreshPreview}
              >
                <RefreshCw className="h-4.5 w-4.5" />
                我已登录，刷新预览
              </button>
            ) : null}
          </div>
        </motion.div>
      ) : nativePreviewStarted ? (
        previewMaskVisible ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#050608] px-8 text-center text-white pointer-events-auto"
          >
            <motion.div
              animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1, 0.95] }}
              transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
              className="mb-12 relative flex items-center justify-center"
            >
              <div className="absolute inset-0 scale-150 bg-[#00d1bf]/20 blur-[80px] rounded-full" />
              <GamepadSvgAnimation className="h-32 w-32 text-[#00d1bf] relative z-10 drop-shadow-[0_0_20px_rgba(0,209,191,0.6)]" glowColor="#00d1bf" />
            </motion.div>
            <h2 className="m-0 text-[26px] font-semibold tracking-tight text-white/90">正在刷新预览</h2>
            <p className="m-0 mt-4 max-w-[360px] text-[15px] leading-relaxed text-white/40">
              正在与游戏引擎建立连接，获取原生画面。
            </p>
          </motion.div>
        ) : null
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#050608] px-8 text-center text-white pointer-events-auto"
        >
          <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/5 bg-white/5 px-4 py-2 text-[12px] font-medium text-white/60 backdrop-blur">
            {projectName ?? "远程预览"}
            <span className="ml-2 text-white/30">{runtimeReady ? "Running" : "TapTap Maker"}</span>
          </div>
          <motion.div
            animate={{ y: [-8, 8, -8] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
            className="mb-12 relative flex items-center justify-center"
          >
            <div className="absolute inset-0 scale-150 bg-[#00d1bf]/10 blur-[80px] rounded-full" />
            <GamepadSvgAnimation className="h-32 w-32 text-[#00d1bf]/60 relative z-10 drop-shadow-2xl" glowColor="rgba(0,209,191,0.2)" />
          </motion.div>
          <h2 className="m-0 text-[26px] font-semibold tracking-tight text-white/90">TapTap Maker 预览</h2>
          <p className="m-0 mt-4 max-w-[420px] text-[15px] leading-relaxed text-white/40">
            如登录态失效，先打开 TapTap Maker 登录窗口；登录完成后刷新预览。
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={openLoginWindow}
              className="inline-flex h-11 items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-8 text-[14px] font-medium text-white transition-all hover:bg-white/10 hover:scale-105 active:scale-95"
            >
              <Folder className="h-4.5 w-4.5" />
              打开登录窗口
            </button>
            <button
              type="button"
              onClick={confirmLoggedInAndRefreshPreview}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-[#00d1bf] px-5 text-[13px] font-medium text-[#062421] transition-colors hover:bg-[#00c6b5]"
            >
              <RefreshCw className="h-4 w-4" />
              我已登录，刷新预览
            </button>
          </div>
        </motion.div>
      )}

      {pendingPreviewCount > 0 ? (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-amber-300/30 bg-amber-300/12 px-3 py-1.5 text-[12px] font-medium text-amber-100 backdrop-blur">
          {pendingPreviewCount} 个操作需要确认
        </div>
      ) : null}

    </div>
  );
}

function formatPreviewError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "无法连接桌面端远程预览 WebView。";
}
