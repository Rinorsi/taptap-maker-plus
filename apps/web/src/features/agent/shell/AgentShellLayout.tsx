import {
  Camera,
  EyeOff,
  Folder,
  Gamepad2,
  History,
  Maximize2,
  Menu,
  MessageSquarePlus,
  Monitor,
  MonitorSmartphone,
  PackageOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  RefreshCw,
  RotateCw,
  Smartphone,
  Share2,
  Tablet,
  Video,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion } from "framer-motion";
import type { AgentWorkspaceTab } from "../types";
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
import { AgentToolPanel } from "../components/AgentToolPanel";
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
} from "../remoteMakerPreview";

type PreviewDeviceId = "adaptive" | "pc" | "phone" | "tablet";
type PreviewOrientation = "portrait" | "landscape";
type PreviewChrome = "none" | "capsule" | "island";

type PreviewSettings = {
  deviceId: PreviewDeviceId;
  orientation: PreviewOrientation;
  scale: number;
  chrome: PreviewChrome;
};

type PreviewDevicePreset = {
  id: PreviewDeviceId;
  label: string;
  width?: number;
  height?: number;
};

const previewDevicePresets: PreviewDevicePreset[] = [
  { id: "adaptive", label: "自适应" },
  { id: "pc", label: "PC", width: 1920, height: 1080 },
  { id: "phone", label: "手机", width: 390, height: 867 },
  { id: "tablet", label: "平板", width: 820, height: 1180 },
];

const MAKER_PREVIEW_INSTANCE_EVENT = "taptap:maker-preview-instance";
const MAKER_PREVIEW_LOAD_EVENT = "taptap:maker-preview-load";
const MAKER_PREVIEW_RESYNC_EVENT = "taptap:maker-preview-resync";
const MAKER_PREVIEW_HIDDEN_STORAGE_PREFIX = "taptap.makerPreview.hidden.";

type MakerPreviewInstanceState = {
  active: boolean;
  projectId?: string;
  muted: boolean;
};

function dispatchMakerPreviewInstanceState(detail: { active: boolean; projectId?: string; muted: boolean }) {
  window.dispatchEvent(new CustomEvent(MAKER_PREVIEW_INSTANCE_EVENT, { detail }));
}

function shouldKeepMakerPreviewInBackground() {
  return readStoredPreference("makerPreviewBackground") === "keep";
}

function makerPreviewHiddenStorageKey(projectId: string) {
  return `${MAKER_PREVIEW_HIDDEN_STORAGE_PREFIX}${projectId}`;
}

function readStoredMakerPreviewHidden(projectId?: string) {
  if (!projectId) return false;
  return localStorage.getItem(makerPreviewHiddenStorageKey(projectId)) === "true";
}

function writeStoredMakerPreviewHidden(projectId: string | undefined, hidden: boolean) {
  if (!projectId) return;
  localStorage.setItem(makerPreviewHiddenStorageKey(projectId), String(hidden));
}

export function AgentShellLayout({
  sessionRailCollapsed,
  activeTab,
  openWorkspaceTabs,
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
  onActiveTabChange,
  onCloseWorkspaceTab,
  onArchiveSession,
  onDecideActionPreview,
  onCreateActionPreview,
  onExecuteActionPreview,
  onSynced,
}: {
  sessionRailCollapsed: boolean;
  activeTab: AgentWorkspaceTab;
  openWorkspaceTabs: AgentWorkspaceTab[];
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
  onActiveTabChange: (tab: AgentWorkspaceTab) => void;
  onCloseWorkspaceTab: (tab: AgentWorkspaceTab) => void;
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
  const [previewSettings, setPreviewSettings] = useState<PreviewSettings>({
    deviceId: "adaptive",
    orientation: "landscape",
    scale: 1,
    chrome: "none",
  });
  const [toolsOpen, setToolsOpen] = useState(false);
  const [chatPanelCollapsed, setChatPanelCollapsed] = useState(false);
  const [chatPanelWidth, setChatPanelWidth] = useState(520);
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false);
  const [previewReloadSignal, setPreviewReloadSignal] = useState(0);
  const [previewHideSignal, setPreviewHideSignal] = useState(0);
  const [previewManuallyHidden, setPreviewManuallyHidden] = useState(() =>
    readStoredMakerPreviewHidden(selectedProject?.makerProjectId),
  );
  const [makerPreviewInstance, setMakerPreviewInstance] = useState<MakerPreviewInstanceState>({
    active: false,
    muted: false,
  });
  const previousActiveTabRef = useRef<AgentWorkspaceTab>(activeTab);
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

  useEffect(() => {
    previousActiveTabRef.current = activeTab;
    if (activeTab !== "closed" && activeTab !== "launcher") setToolsOpen(true);
  }, [activeTab]);

  useEffect(() => {
    if (previewSettings.deviceId !== "adaptive") return;
    if (previewSettings.chrome === "none" && previewSettings.scale === 1) return;
    setPreviewSettings((settings) => ({ ...settings, chrome: "none", scale: 1 }));
  }, [previewSettings.chrome, previewSettings.deviceId, previewSettings.scale]);

  function toggleTools() {
    if (toolsOpen) {
      setToolsOpen(false);
      onActiveTabChange("closed");
      return;
    }
    setToolsOpen(true);
    const previous = previousActiveTabRef.current;
    onActiveTabChange(previous === "closed" ? "overview" : previous);
  }

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
        className="hidden"
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
              onClick={() => setSessionsOpen(true)}
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
              onOpenWorkspaceTab={onActiveTabChange}
            />
            <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-5 text-[13px] text-[#8a94a6] md:flex">
              <span>TapTap 制造论坛</span>
              <span>加入交流群</span>
            </div>
          </div>
        ) : (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
          {!chatPanelCollapsed ? (
          <motion.section
            initial={false}
            animate={{ width: chatPanelWidth }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="relative flex min-h-[44%] min-w-0 flex-col border-b border-black/10 bg-white lg:min-h-0 lg:shrink-0 lg:border-b-0 lg:border-r dark:border-white/10 dark:bg-[#202124]"
          >
            <ConversationHeader
              projectName={selectedProject?.name ?? "未命名游戏"}
              publishActive={activeTab === "overview"}
              onOpenSessions={() => setSessionsOpen(true)}
              onOpenPublish={() => onActiveTabChange("overview")}
            />
            <div className="grid h-9 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-black/10 bg-white px-3 dark:border-white/10 dark:bg-[#202124]">
              <div className="flex min-w-0 items-center justify-self-start">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#65627a] hover:bg-black/5 hover:text-[#272536] dark:text-[#b8bbc5] dark:hover:bg-white/10 dark:hover:text-white"
                  title="重载对话"
                  onClick={() => onActiveTabChange("overview")}
                >
                  <History className="h-4 w-4" />
                </button>
              </div>
              <div className="flex min-w-0 items-center gap-1.5 justify-self-center text-[13px] text-agent-muted">
                <span className="truncate">
                  {sending ? "正在制作..." : loading ? "正在加载对话..." : "对话"}
                </span>
                <button
                  type="button"
                  className="rounded p-0.5 text-agent-subtle hover:bg-black/5 hover:text-agent-text dark:hover:bg-white/10"
                  title="编辑名称"
                  disabled
                >
                  <Pencil className="h-3 w-3" />
                </button>
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
                onOpenWorkspaceTab={onActiveTabChange}
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
          ) : null}

          <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-[#f7f7f8] lg:basis-[54%] dark:bg-[#111214]">
            <GamePreviewHeader
              previewSettings={previewSettings}
              runtimeStatus={runtimeStatus}
              chatPanelCollapsed={chatPanelCollapsed}
              deviceSettingsOpen={deviceSettingsOpen}
              previewManuallyHidden={previewManuallyHidden}
              onPreviewSettingsChange={setPreviewSettings}
              onToggleDeviceSettings={() => setDeviceSettingsOpen((value) => !value)}
              onToggleChatPanel={() => setChatPanelCollapsed((value) => !value)}
              onReloadPreview={() => setPreviewReloadSignal((value) => value + 1)}
              onHidePreview={() => setPreviewHideSignal((value) => value + 1)}
            />
            <GamePreviewSurface
              projectName={selectedProject?.name}
              makerProjectId={selectedProject?.makerProjectId}
              runtimeStatus={runtimeStatus}
              previewSettings={previewSettings}
              reloadSignal={previewReloadSignal}
              hideSignal={previewHideSignal}
              pendingPreviewCount={pendingPreviewCount}
              onOpenTools={() => onActiveTabChange("overview")}
              onPreviewHiddenChange={setPreviewManuallyHidden}
            />

            {toolsOpen ? (
              <div className="absolute inset-y-0 right-0 z-20 flex w-full max-w-[420px] flex-col border-l border-black/10 bg-white shadow-[-18px_0_40px_rgba(6,10,38,0.12)] dark:border-white/10 dark:bg-[#222326]">
                <div className="flex h-11 shrink-0 items-center justify-between border-b border-black/10 px-3 dark:border-white/10">
                  <div className="flex items-center gap-2 text-[13px] font-semibold">
                    <PackageOpen className="h-4 w-4 text-agent-muted" />
                    辅助面板
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-agent-muted hover:bg-black/5 hover:text-agent-text dark:hover:bg-white/10"
                    title="关闭"
                    onClick={toggleTools}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="min-h-0 flex-1">
                  <AgentToolPanel
                    activeTab={activeTab === "closed" ? "overview" : activeTab}
                    openTabs={openWorkspaceTabs}
                    onActiveTabChange={onActiveTabChange}
                    onCloseTab={onCloseWorkspaceTab}
                    context={context}
                    compressedContext={compressedContext}
                    compressedContextSnapshotId={compressedContextSnapshotId}
                    readiness={readiness}
                    pi={pi}
                    actionPreviews={actionPreviews}
                    contextRows={contextRows}
                    pendingPreviews={pendingPreviews}
                    selectedProject={selectedProject}
                    runtimeStatus={runtimeStatus}
                    messages={messages}
                    page={page}
                    onDecideActionPreview={onDecideActionPreview}
                    onCreateActionPreview={onCreateActionPreview}
                    onExecuteActionPreview={onExecuteActionPreview}
                  />
                </div>
              </div>
            ) : null}
          </section>
        </div>
        )}
      </div>
    </div>
  );
}

function ConversationHeader({
  projectName,
  publishActive,
  onOpenSessions,
  onOpenPublish,
}: {
  projectName: string;
  publishActive: boolean;
  onOpenSessions: () => void;
  onOpenPublish: () => void;
}) {
  return (
    <header className="flex h-11 shrink-0 items-center border-b border-black/10 bg-white px-4 dark:border-white/10 dark:bg-[#202124]">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-agent-muted hover:bg-black/5 hover:text-agent-text dark:hover:bg-white/10"
          title="打开侧栏"
          onClick={onOpenSessions}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[16px] font-semibold text-agent-text">
            {projectName}
          </span>
          <button
            type="button"
            className="rounded p-0.5 text-agent-subtle hover:bg-black/5 hover:text-agent-text dark:hover:bg-white/10"
            title="编辑名称"
            disabled
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium transition-colors",
            publishActive
              ? "bg-[#00d1bf] text-white hover:bg-[#00c6b5] dark:bg-[#00d1bf] dark:text-[#062421] dark:hover:bg-[#00c6b5]"
              : "bg-[#dffdf9] text-[#00cdbb] hover:bg-[#c9fbf5] dark:bg-[#173d3a] dark:text-[#70f4e8] dark:hover:bg-[#1d4b47]",
          )}
          onClick={onOpenPublish}
        >
          <PublishPlaneIcon />
          发布
        </button>
      </div>
    </header>
  );
}

function PublishPlaneIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="-0.5 0 12 11"
      xmlns="http://www.w3.org/2000/svg"
      className="h-3 w-3 fill-current"
      aria-hidden="true"
    >
      <path d="M11.0087 0.660044C10.9117 0.46611 10.6751 0.385584 10.4795 0.48255L0.171762 5.60192C-0.0221713 5.69889 -0.102698 5.93554 -0.00573077 6.13111C0.0156354 6.17383 0.0435778 6.21164 0.076446 6.24287C0.119166 6.28397 0.170112 6.31518 0.230935 6.3349L3.69863 7.42451L4.23111 6.76384L1.40109 5.87472L9.16477 2.01589L5.01174 7.04322C5.00206 7.05458 4.99327 7.06667 4.98544 7.07938L4.50555 7.67594V10.151C4.50555 10.3696 4.6814 10.5454 4.89998 10.5454C5.11855 10.5454 5.29441 10.3696 5.29441 10.151V7.92245L9.06615 9.10573C9.11052 9.11888 9.1549 9.12544 9.19926 9.12379C9.3899 9.12872 9.56246 8.99396 9.59862 8.80004L11.0432 0.909811C11.0481 0.883519 11.0498 0.855577 11.0498 0.829285C11.0481 0.7734 11.0366 0.71424 11.0087 0.660018L11.0087 0.660044ZM8.90178 8.22815L5.84988 7.27001L9.99796 2.24761L8.90177 8.22814L8.90178 8.22815Z" />
    </svg>
  );
}

function GamePreviewHeader({
  previewSettings,
  runtimeStatus,
  chatPanelCollapsed,
  deviceSettingsOpen,
  previewManuallyHidden,
  onPreviewSettingsChange,
  onToggleDeviceSettings,
  onToggleChatPanel,
  onReloadPreview,
  onHidePreview,
}: {
  previewSettings: PreviewSettings;
  runtimeStatus: RuntimeStatus;
  chatPanelCollapsed: boolean;
  deviceSettingsOpen: boolean;
  previewManuallyHidden: boolean;
  onPreviewSettingsChange: (settings: PreviewSettings | ((settings: PreviewSettings) => PreviewSettings)) => void;
  onToggleDeviceSettings: () => void;
  onToggleChatPanel: () => void;
  onReloadPreview: () => void;
  onHidePreview: () => void;
}) {
  const toolbarButtonClass = "inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 bg-white text-[#6b7280] shadow-[0_2px_8px_rgba(15,23,42,0.12)] transition-colors hover:bg-black/5 hover:text-agent-text dark:border-white/10 dark:bg-[#2b2c30] dark:text-[#c8ccd3] dark:shadow-none dark:hover:bg-white/10 dark:hover:text-white";
  const selectedPreset = getPreviewDevicePreset(previewSettings.deviceId);
  const dimensions = getPreviewDimensions(previewSettings);
  const scaleLabel = `${Math.round(previewSettings.scale * 100)}%`;
  const sizeLabel = dimensions ? `${dimensions.width} x ${dimensions.height}` : "填满窗口";
  const canRotate = previewSettings.deviceId !== "adaptive";
  const DeviceIcon = getPreviewDeviceIcon(previewSettings.deviceId);

  return (
    <div className="shrink-0 border-b border-black/10 bg-white dark:border-white/10 dark:bg-[#202124]">
      <div className="grid h-12 grid-cols-[32px_1fr_32px] items-center px-2">
        <button
          type="button"
          className={cn("justify-self-start", agentIconButtonClass)}
          title={chatPanelCollapsed ? "展开对话面板" : "收起对话面板"}
          aria-label={chatPanelCollapsed ? "展开对话面板" : "收起对话面板"}
          onClick={onToggleChatPanel}
        >
          {chatPanelCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>

        <div className="flex items-center justify-center gap-3">
          <button type="button" className={toolbarButtonClass} title="重载预览" aria-label="重载预览" onClick={onReloadPreview}>
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn(
              toolbarButtonClass,
              previewManuallyHidden &&
                "border-[#00d9c5] bg-[#00d9c5] text-white hover:bg-[#00d9c5] hover:text-white dark:border-[#00d9c5] dark:bg-[#00d9c5] dark:text-white dark:hover:bg-[#00d9c5]",
            )}
            title={previewManuallyHidden ? "预览已隐藏" : "隐藏预览"}
            aria-label={previewManuallyHidden ? "预览已隐藏" : "隐藏预览"}
            aria-pressed={previewManuallyHidden}
            onClick={onHidePreview}
          >
            <EyeOff className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={cn(toolbarButtonClass, deviceSettingsOpen && "border-[#00d9c5] bg-[#00d9c5] text-white hover:bg-[#00d9c5] hover:text-white dark:border-[#00d9c5] dark:bg-[#00d9c5] dark:text-white dark:hover:bg-[#00d9c5]")}
            title={deviceSettingsOpen ? "收起设备预览设置" : "打开设备预览设置"}
            aria-label={deviceSettingsOpen ? "收起设备预览设置" : "打开设备预览设置"}
            onClick={onToggleDeviceSettings}
          >
            <MonitorSmartphone className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass} title="截图" aria-label="截图">
            <Camera className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass} title="录制" aria-label="录制">
            <Video className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass} title="全屏" aria-label="全屏">
            <Maximize2 className="h-4 w-4" />
          </button>
          <button type="button" className={toolbarButtonClass} title="分享" aria-label="分享">
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {deviceSettingsOpen ? (
      <div className="flex h-12 items-center justify-center gap-3 border-t border-black/10 bg-[#f8f9fb] px-3 text-[13px] text-agent-muted dark:border-white/10 dark:bg-[#202124]">
        <span className="hidden shrink-0 sm:inline">设备：</span>
        <select
          className="h-8 rounded-md border border-black/10 bg-white px-2 text-[13px] text-agent-text shadow-sm outline-none hover:bg-black/5 dark:border-white/10 dark:bg-[#222326] dark:hover:bg-white/10"
          value={previewSettings.deviceId}
          title="设备预设"
          onChange={(event) => {
            const deviceId = event.target.value as PreviewDeviceId;
            const nextPreset = getPreviewDevicePreset(deviceId);
            onPreviewSettingsChange((settings) => ({
              ...settings,
              deviceId,
              chrome: deviceId === "adaptive" ? "none" : settings.chrome,
              scale: deviceId === "adaptive" ? 1 : settings.scale,
              orientation: nextPreset.id === "pc" || nextPreset.id === "adaptive" ? "landscape" : settings.orientation,
            }));
          }}
        >
          {previewDevicePresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}{preset.width && preset.height ? ` (${preset.width}x${preset.height})` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="inline-flex h-8 w-9 items-center justify-center rounded-md border border-black/10 bg-white text-agent-text shadow-sm hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-[#222326] dark:hover:bg-white/10"
          title={canRotate ? "横竖屏切换" : "自适应模式不需要横竖屏"}
          disabled={!canRotate}
          onClick={() => onPreviewSettingsChange((settings) => ({
            ...settings,
            orientation: settings.orientation === "portrait" ? "landscape" : "portrait",
          }))}
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <span className="hidden shrink-0 md:inline">
          尺寸：{sizeLabel}
        </span>
        <select
          className="h-8 rounded-md border border-black/10 bg-white px-2 text-[13px] text-agent-text shadow-sm outline-none hover:bg-black/5 dark:border-white/10 dark:bg-[#222326] dark:hover:bg-white/10"
          value={String(previewSettings.scale)}
          title="窗口百分比"
          disabled={previewSettings.deviceId === "adaptive"}
          onChange={(event) => {
            const scale = Number(event.target.value);
            onPreviewSettingsChange((settings) => ({ ...settings, scale }));
          }}
        >
          <option value="1">100%</option>
          <option value="0.89">89%</option>
          <option value="0.75">75%</option>
          <option value="0.5">50%</option>
        </select>
        <select
          className="h-8 rounded-md border border-black/10 bg-white px-2 text-[13px] text-agent-text shadow-sm outline-none hover:bg-black/5 dark:border-white/10 dark:bg-[#222326] dark:hover:bg-white/10"
          value={previewSettings.chrome}
          title="浏览器壳"
          disabled={previewSettings.deviceId === "adaptive"}
          onChange={(event) => {
            const chrome = event.target.value as PreviewChrome;
            onPreviewSettingsChange((settings) => ({ ...settings, chrome }));
          }}
        >
          <option value="none">无外壳</option>
          <option value="capsule">胶囊</option>
          <option value="island">灵动岛</option>
        </select>
        <span className="hidden shrink-0 rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-[13px] text-agent-muted shadow-sm lg:inline-flex lg:items-center lg:gap-1.5 dark:border-white/10 dark:bg-[#222326]">
          <DeviceIcon className="h-3.5 w-3.5" />
          {selectedPreset.label} · {scaleLabel} · {runtimeStatus === "ready" ? "Running" : "Standby"}
        </span>
        <button type="button" className="inline-flex h-8 w-10 items-center justify-center rounded-md border border-black/10 bg-white text-agent-muted shadow-sm hover:bg-black/5 dark:border-white/10 dark:bg-[#222326] dark:hover:bg-white/10" title="复制预览">
          <CopyPreviewIcon />
        </button>
      </div>
      ) : null}
    </div>
  );
}

const agentIconButtonClass = "inline-flex h-7 w-7 items-center justify-center rounded-md text-[#65627a] transition-colors hover:bg-black/5 hover:text-[#272536] dark:text-[#b8bbc5] dark:hover:bg-white/10 dark:hover:text-white";
const newChatButtonClass = "inline-flex h-7 w-7 items-center justify-center rounded-md bg-transparent text-[#5f5b78] transition-colors hover:bg-black/5 hover:text-[#272536] dark:text-[#d8dcdf] dark:hover:bg-white/10 dark:hover:text-white";

function CopyPreviewIcon() {
  return (
    <span className="relative block h-4 w-4">
      <span className="absolute left-1 top-0 h-3.5 w-3 rounded-[3px] border border-current" />
      <span className="absolute left-0 top-1 h-3.5 w-3 rounded-[3px] border border-current bg-white dark:bg-[#222326]" />
    </span>
  );
}

function getPreviewDevicePreset(deviceId: PreviewDeviceId) {
  return previewDevicePresets.find((preset) => preset.id === deviceId) ?? previewDevicePresets[0];
}

function getPreviewDeviceIcon(deviceId: PreviewDeviceId) {
  if (deviceId === "pc") return Monitor;
  if (deviceId === "tablet") return Tablet;
  if (deviceId === "phone") return Smartphone;
  return Maximize2;
}

function getPreviewDimensions(settings: PreviewSettings) {
  const preset = getPreviewDevicePreset(settings.deviceId);
  if (!preset.width || !preset.height) return null;
  const portraitWidth = Math.min(preset.width, preset.height);
  const portraitHeight = Math.max(preset.width, preset.height);
  if (settings.orientation === "landscape") {
    return {
      width: portraitHeight,
      height: portraitWidth,
    };
  }
  return {
    width: portraitWidth,
    height: portraitHeight,
  };
}

function getPreviewChromeHeight(settings: PreviewSettings) {
  if (settings.chrome === "none") return 0;
  if (settings.deviceId === "pc") return 44;
  if (settings.deviceId === "tablet") return 38;
  if (settings.deviceId === "phone") return settings.chrome === "island" ? 46 : 40;
  return 36;
}

function getPreviewFrameStyle(settings: PreviewSettings) {
  const dimensions = getPreviewDimensions(settings);
  if (!dimensions) {
    return {
      height: "100%",
      width: "100%",
      maxHeight: "100%",
      maxWidth: "100%",
    };
  }

  const aspectRatio = `${dimensions.width} / ${dimensions.height}`;
  if (dimensions.width >= dimensions.height) {
    return {
      aspectRatio,
      maxWidth: `${Math.round(settings.scale * 100)}%`,
      maxHeight: `${Math.round(settings.scale * 100)}%`,
    };
  }

  return {
    aspectRatio,
    maxHeight: `${Math.round(settings.scale * 100)}%`,
    maxWidth: `${Math.round(settings.scale * 100)}%`,
  };
}

function PreviewDeviceChrome({
  deviceId,
  chrome,
  height,
  label,
}: {
  deviceId: PreviewDeviceId;
  chrome: PreviewChrome;
  height: number;
  label: string;
}) {
  if (height <= 0) return null;
  const showPhoneControl = deviceId === "phone" || deviceId === "tablet";

  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#111217]/96 px-3 text-white/60"
      style={{ height }}
      aria-hidden="true"
    >
      <div className="flex min-w-0 items-center gap-2">
        {deviceId === "pc" ? (
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
        ) : null}
        <span className="truncate text-[11px]">{label}</span>
      </div>
      {showPhoneControl ? (
        <div
          className={cn(
            "flex items-center justify-center bg-black/72 shadow-[0_10px_24px_rgba(0,0,0,0.24)]",
            chrome === "island"
              ? "h-7 w-24 rounded-full"
              : "h-7 w-[88px] rounded-full border border-white/12",
          )}
        >
          {chrome === "capsule" ? (
            <div className="flex items-center gap-3">
              <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
              <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
              <span className="h-4 w-4 rounded-full border-2 border-white/85" />
            </div>
          ) : (
            <span className="h-2.5 w-10 rounded-full bg-white/12" />
          )}
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 justify-center px-4">
          <div className="h-6 w-full max-w-[460px] rounded-md bg-white/8" />
        </div>
      )}
      <div className="h-2 w-8 rounded-full bg-white/12" />
    </div>
  );
}

function GamePreviewSurface({
  projectName,
  makerProjectId,
  runtimeStatus,
  previewSettings,
  reloadSignal,
  hideSignal,
  pendingPreviewCount,
  onOpenTools,
  onPreviewHiddenChange,
}: {
  projectName?: string;
  makerProjectId?: string;
  runtimeStatus: RuntimeStatus;
  previewSettings: PreviewSettings;
  reloadSignal: number;
  hideSignal: number;
  pendingPreviewCount: number;
  onOpenTools: () => void;
  onPreviewHiddenChange?: (hidden: boolean) => void;
}) {
  const ready = runtimeStatus === "ready";

  return (
    <div
      className={cn(
        "agent-preview-background relative flex min-h-0 flex-1 items-center justify-center overflow-hidden",
        previewSettings.deviceId === "adaptive" ? "p-0" : "p-5",
      )}
    >
      <RemoteMakerPreviewFrame
        makerProjectId={makerProjectId}
        projectName={projectName}
        previewSettings={previewSettings}
        reloadSignal={reloadSignal}
        hideSignal={hideSignal}
        runtimeReady={ready}
        pendingPreviewCount={pendingPreviewCount}
        onOpenTools={onOpenTools}
        onPreviewHiddenChange={onPreviewHiddenChange}
      />

      <div className="pointer-events-none absolute bottom-4 left-4 hidden rounded-full bg-black/5 px-3 py-1.5 text-[11px] text-agent-muted dark:bg-white/10 lg:block">
        对话驱动制作，预览只呈现结果
      </div>
    </div>
  );
}

function RemoteMakerPreviewFrame({
  makerProjectId,
  projectName,
  previewSettings,
  reloadSignal,
  hideSignal,
  runtimeReady,
  pendingPreviewCount,
  onOpenTools,
  onPreviewHiddenChange,
}: {
  makerProjectId?: string;
  projectName?: string;
  previewSettings: PreviewSettings;
  reloadSignal: number;
  hideSignal: number;
  runtimeReady: boolean;
  pendingPreviewCount: number;
  onOpenTools: () => void;
  onPreviewHiddenChange?: (hidden: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nativeViewportRef = useRef<HTMLDivElement | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [nativePreviewStarted, setNativePreviewStarted] = useState(false);
  const [previewManuallyHidden, setPreviewManuallyHidden] = useState(() => readStoredMakerPreviewHidden(makerProjectId));
  const [previewMaskVisible, setPreviewMaskVisible] = useState(false);
  const nativePreviewOpenedRef = useRef(false);
  const nativePreviewReadyRef = useRef(false);
  const previewMaskTimerRef = useRef<number | undefined>(undefined);
  const syncPulseTimerRef = useRef<number | undefined>(undefined);
  const lastReloadSignalRef = useRef(reloadSignal);
  const lastHideSignalRef = useRef(hideSignal);
  const nativePreviewAvailable = isMakerPreviewWebViewAvailable();
  const remoteUrl = makerProjectId ? makerPreviewUrl(makerProjectId) : "";
  const dimensions = getPreviewDimensions(previewSettings);
  const chromeHeight = getPreviewChromeHeight(previewSettings);
  const frameStyle = getPreviewFrameStyle(previewSettings);
  const frameLabel = dimensions ? `${dimensions.width} x ${dimensions.height}` : "自适应";
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
    const active = Boolean(makerProjectId && nativePreviewAvailable);
    const manuallyHidden = readStoredMakerPreviewHidden(makerProjectId);
    setPreviewManuallyHidden(manuallyHidden);
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
      if (shouldKeepMakerPreviewInBackground()) {
        void hideMakerPreview().catch(() => undefined);
        return;
      }
      dispatchMakerPreviewInstanceState({ active: false, projectId: makerProjectId, muted: false });
      void hideMakerPreview().catch(() => undefined);
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
      if (shouldKeepMakerPreviewInBackground()) {
        void hideMakerPreview().catch(() => undefined);
        return;
      }
      dispatchMakerPreviewInstanceState({ active: false, projectId: makerProjectId, muted: false });
      void hideMakerPreview().catch(() => undefined);
    };
  }, [clearPreviewMask, makerProjectId, nativePreviewAvailable, nativePreviewStarted, showPreviewMask, startSyncPulse, stopSyncPulse, syncBounds]);

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
        listen<{ event?: string }>(MAKER_PREVIEW_LOAD_EVENT, (event) => {
          if (disposed) return;
          if (event.payload?.event === "started") {
            setPreviewMaskVisible(true);
            nativePreviewReadyRef.current = false;
            return;
          }
          if (event.payload?.event === "finished") {
            nativePreviewOpenedRef.current = true;
            startSyncPulse();
            return;
          }
          if (event.payload?.event === "ready") {
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
            nativePreviewReadyRef.current = false;
            stopSyncPulse();
            setPreviewError("TapTap Maker 已发出声音但没有交出可嵌入的游戏画面，请点击刷新重新抓取预览容器。");
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
  }, [clearPreviewMask, nativePreviewAvailable, nativePreviewStarted, startSyncPulse, stopSyncPulse, syncBounds]);

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
      className={cn(
        "relative flex shrink-0 flex-col overflow-hidden bg-[#15171c] transition-all",
        dimensions ? "rounded-[18px] border border-black/10 shadow-[0_22px_70px_rgba(6,10,38,0.22)] dark:border-white/10" : "rounded-none border-0 shadow-none",
        dimensions
          ? dimensions.width >= dimensions.height
            ? "w-full"
            : "h-full"
          : "h-full w-full",
      )}
      style={frameStyle}
    >
      <div
        ref={nativeViewportRef}
        className="pointer-events-none absolute bg-[#050608]"
        style={{
          left: dimensions ? 8 : 0,
          right: dimensions ? 8 : 0,
          top: dimensions ? chromeHeight + 8 : chromeHeight,
          bottom: dimensions ? 8 : 0,
        }}
        aria-hidden="true"
      />
      {previewSettings.chrome !== "none" ? (
        <PreviewDeviceChrome
          deviceId={previewSettings.deviceId}
          chrome={previewSettings.chrome}
          height={chromeHeight}
          label={frameLabel}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 z-10 rounded-[18px] ring-1 ring-white/10" />
      {!nativePreviewAvailable && makerProjectId ? (
        <div className="relative z-20 flex h-full flex-col items-center justify-center bg-[#17181d] px-8 text-center text-white">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] border border-white/15 bg-white/10 backdrop-blur">
            <Gamepad2 className="h-7 w-7" />
          </div>
          <h2 className="m-0 text-[20px] font-semibold">桌面原生预览未启用</h2>
          <p className="m-0 mt-2 max-w-[420px] text-[13px] leading-6 text-white/58">
            当前页面没有连接到桌面端原生 WebView，无法承载同一个登录会话。
          </p>
          <button
            type="button"
            onClick={openLoginWindow}
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-[13px] font-medium text-white transition-colors hover:bg-white/16"
          >
            <Folder className="h-4 w-4" />
            打开 TapTap Maker
          </button>
        </div>
      ) : previewManuallyHidden ? (
        <div className="relative z-20 flex h-full flex-col items-center justify-center bg-[#17181d] px-8 text-center text-white">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] border border-white/15 bg-white/10 backdrop-blur">
            <EyeOff className="h-7 w-7" />
          </div>
          <h2 className="m-0 text-[20px] font-semibold">预览已隐藏</h2>
          <p className="m-0 mt-2 max-w-[420px] text-[13px] leading-6 text-white/58">
            游戏预览已中断，后台 iframe 不会继续播放声音。
          </p>
          <button
            type="button"
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-[#8df3ea] px-4 text-[13px] font-medium text-[#062421] transition-colors hover:bg-[#a3fff6]"
            onClick={confirmLoggedInAndRefreshPreview}
          >
            <RefreshCw className="h-4 w-4" />
            重新载入预览
          </button>
        </div>
      ) : !makerProjectId || previewError ? (
        <div className="relative z-20 flex h-full flex-col items-center justify-center bg-[#17181d] px-8 text-center text-white">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] border border-white/15 bg-white/10 backdrop-blur">
            <Wrench className="h-7 w-7" />
          </div>
          <h2 className="m-0 text-[20px] font-semibold">
            {!makerProjectId ? "未绑定 Maker 项目" : "远程预览暂不可用"}
          </h2>
          <p className="m-0 mt-2 max-w-[420px] text-[13px] leading-6 text-white/58">
            {!makerProjectId
              ? "当前项目缺少 makerProjectId，无法打开 TapTap Maker 远程预览。"
              : previewError}
          </p>
          <button
            type="button"
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-[13px] font-medium text-white transition-colors hover:bg-white/16"
            onClick={makerProjectId ? openLoginWindow : onOpenTools}
          >
            <Folder className="h-4 w-4" />
            {makerProjectId ? "打开登录窗口" : "查看制作状态"}
          </button>
          {makerProjectId ? (
            <button
              type="button"
              className="mt-2 inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-[#8df3ea] px-4 text-[13px] font-medium text-[#062421] transition-colors hover:bg-[#a3fff6]"
              onClick={confirmLoggedInAndRefreshPreview}
            >
              <RefreshCw className="h-4 w-4" />
              我已登录，刷新预览
            </button>
          ) : null}
        </div>
      ) : nativePreviewStarted ? (
        previewMaskVisible ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#111217] px-8 text-center text-white">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[16px] border border-white/12 bg-white/8">
              <Gamepad2 className="h-6 w-6" />
            </div>
            <h2 className="m-0 text-[19px] font-semibold">正在刷新预览</h2>
            <p className="m-0 mt-2 max-w-[360px] text-[13px] leading-6 text-white/56">
              正在载入游戏画面。
            </p>
          </div>
        ) : null
      ) : (
        <div className="relative z-20 flex h-full flex-col items-center justify-center bg-[#17181d] px-8 text-center text-white">
          <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[12px] font-medium text-white/70 backdrop-blur">
            {projectName ?? "远程预览"}
            <span className="ml-2 text-white/45">{runtimeReady ? "Running" : "TapTap Maker"}</span>
          </div>
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[18px] border border-white/15 bg-white/10 backdrop-blur">
            <Gamepad2 className="h-7 w-7" />
          </div>
          <h2 className="m-0 text-[20px] font-semibold">{nativePreviewStarted ? "正在打开 TapTap Maker" : "TapTap Maker 预览"}</h2>
          <p className="m-0 mt-2 max-w-[420px] text-[13px] leading-6 text-white/58">
            {nativePreviewStarted
              ? "正在载入右侧原生预览；若仍停留在登录页，请先完成登录。"
              : "先打开 TapTap Maker 登录窗口，登录完成后点击我已登录。"}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={openLoginWindow}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-[13px] font-medium text-white transition-colors hover:bg-white/16"
            >
              <Folder className="h-4 w-4" />
              打开登录窗口
            </button>
            <button
              type="button"
              onClick={confirmLoggedInAndRefreshPreview}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-[#8df3ea] px-4 text-[13px] font-medium text-[#062421] transition-colors hover:bg-[#a3fff6]"
            >
              <RefreshCw className="h-4 w-4" />
              我已登录，刷新预览
            </button>
          </div>
        </div>
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
