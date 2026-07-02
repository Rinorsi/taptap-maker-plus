import { Archive, Calendar, Check, Search, MessageSquare, AtSign, ChevronLeft, ChevronRight, FolderOpen, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import type { ComponentType } from "react";
import type { AgentSessionRecord } from "../api";
import type { ProjectSummary } from "../../../api";
import { cn } from "../../../lib/utils";
import { formatShortTime } from "../utils";
import { motion, AnimatePresence } from "framer-motion";

export function AgentSessionSidebar({
  collapsed,
  sessions,
  projects,
  activeSessionId,
  previewProjectId,
  previewInstanceActive = false,
  previewInstanceMuted = false,
  loading,
  onToggleCollapsed,
  onNewSession,
  onSelectSession,
  onRenameSession,
  onArchiveSession
}: {
  collapsed: boolean;
  sessions: AgentSessionRecord[];
  projects: ProjectSummary[];
  activeSessionId?: string;
  previewProjectId?: string;
  previewInstanceActive?: boolean;
  previewInstanceMuted?: boolean;
  loading: boolean;
  onToggleCollapsed: () => void;
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
  onRenameSession: (sessionId: string, title: string) => void;
  onArchiveSession: (sessionId?: string) => void;
}) {
  const [editingSessionId, setEditingSessionId] = useState<string>();
  const [editingTitle, setEditingTitle] = useState("");

  function beginRename(session: AgentSessionRecord) {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  }

  function cancelRename() {
    setEditingSessionId(undefined);
    setEditingTitle("");
  }

  function submitRename(sessionId: string) {
    const title = editingTitle.trim();
    if (title) onRenameSession(sessionId, title);
    cancelRename();
  }

  // Group sessions by projectId
  const sessionsByProject = sessions.reduce((acc, session) => {
    const pId = session.projectId || "unassigned";
    if (!acc[pId]) acc[pId] = [];
    acc[pId].push(session);
    return acc;
  }, {} as Record<string, AgentSessionRecord[]>);

  const getProjectName = (pId: string) => {
    if (pId === "unassigned") return "未分配项目";
    const p = projects.find((x) => x.id === pId);
    return p ? p.name : pId;
  };
  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-agent-panel border-r border-agent-border text-agent-text relative group transition-all">
      <div className={cn("mt-4 flex shrink-0 flex-col gap-1.5 transition-[padding] duration-300 ease-out", collapsed ? "items-center px-2" : "px-3")}>
        <SidebarItem icon={Search} label="搜索" badge="待接入" collapsed={collapsed} disabled />
        <SidebarItem icon={Calendar} label="已安排" badge="待接入" collapsed={collapsed} disabled />
        <SidebarItem icon={AtSign} label="插件" badge="待接入" collapsed={collapsed} disabled />
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-2 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-agent-subtle overflow-hidden"
            >
              <span className="min-w-0 flex-1 truncate py-1">主会话区 (Session)</span>
              <button
                type="button"
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-agent-subtle transition-colors hover:bg-agent-surface hover:text-agent-text"
                title="选择工作区"
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {Object.keys(sessionsByProject).length > 0 ? (
          Object.entries(sessionsByProject).map(([pId, groupSessions]) => (
            <div key={pId} className="mb-4">
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-1 flex items-center gap-2 px-2 text-[12px] font-medium text-agent-muted overflow-hidden"
                  >
                    <span className="truncate py-1">{getProjectName(pId)}</span>
                    {previewInstanceActive && pId === previewProjectId ? (
                      <PreviewInstanceDot muted={previewInstanceMuted} />
                    ) : null}
                    <button
                      type="button"
                      onClick={onNewSession}
                      disabled={loading}
                      className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-agent-subtle transition-colors hover:bg-agent-surface hover:text-agent-text disabled:opacity-50"
                      title="新建对话"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex flex-col gap-0.5">
                {groupSessions.map((session) => (
                  <div
                    key={session.id}
                    title={previewInstanceActive && session.projectId === previewProjectId ? `${session.title}。活跃实例：运行中；静音：${previewInstanceMuted ? "是" : "否"}` : session.title}
                    className={cn(
                      "group/session relative flex w-full items-center gap-2.5 rounded-control text-left transition-colors duration-200",
                      collapsed ? "h-9 justify-center px-0" : "h-9 px-3",
                      session.id === activeSessionId
                        ? "bg-agent-surface text-agent-text font-semibold shadow-sm border border-agent-border-soft"
                        : "text-agent-muted hover:bg-agent-surface hover:text-agent-text border border-transparent"
                    )}
                  >
                    {collapsed ? (
                      <button
                        type="button"
                        onClick={() => onSelectSession(session.id)}
                        className="flex h-full w-full items-center justify-center"
                        title={session.title}
                      >
                        <MessageSquare className={cn("h-4 w-4 shrink-0 transition-colors duration-200", session.id === activeSessionId ? "text-agent-accent" : "opacity-80")} />
                        {previewInstanceActive && session.projectId === previewProjectId ? (
                          <PreviewInstanceDot muted={previewInstanceMuted} collapsed />
                        ) : null}
                      </button>
                    ) : editingSessionId === session.id ? (
                      <>
                        <input
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") submitRename(session.id);
                            if (event.key === "Escape") cancelRename();
                          }}
                          className="min-w-0 flex-1 rounded-control border border-agent-border bg-agent-bg px-2 py-1 text-[13px] font-medium text-agent-text outline-none focus:border-agent-accent"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => submitRename(session.id)}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-agent-muted hover:bg-agent-panel hover:text-agent-text"
                          title="保存名称"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelRename}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-control text-agent-muted hover:bg-agent-panel hover:text-agent-text"
                          title="取消重命名"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onSelectSession(session.id)}
                          className="min-w-0 flex-1 truncate text-left text-[13px] font-medium"
                        >
                          {session.title}
                        </button>
                        <span className="shrink-0 text-[10px] text-agent-subtle group-hover/session:hidden">
                          {formatShortTime(session.updatedAt)}
                        </span>
                        <span className="hidden shrink-0 items-center gap-0.5 group-hover/session:flex">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              beginRename(session);
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-control text-agent-subtle hover:bg-agent-panel hover:text-agent-text"
                            title="重命名会话"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onArchiveSession(session.id);
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded-control text-agent-subtle hover:bg-agent-panel hover:text-agent-warning"
                            title="归档会话"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className={cn("text-center text-xs text-agent-muted", collapsed ? "p-2" : "p-4")}>
            {collapsed ? "-" : "暂无对话"}
          </div>
        )}
      </div>

      <div className={cn("mt-auto flex shrink-0 flex-col gap-1.5 border-t border-agent-border-soft p-2 transition-[padding] duration-300 ease-out", collapsed ? "items-center" : "px-3")}>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            "flex h-9 items-center rounded-control text-agent-muted hover:bg-agent-surface hover:text-agent-text transition-colors",
            collapsed ? "w-9 justify-center" : "w-full justify-between px-3"
          )}
          title={collapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {!collapsed && <span className="text-[13px] font-medium">收起侧边栏</span>}
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}

function PreviewInstanceDot({ muted, collapsed = false }: { muted: boolean; collapsed?: boolean }) {
  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full border shadow-[0_0_8px_rgba(0,217,197,0.85)]",
        muted ? "border-amber-200 bg-amber-300" : "border-[#00ffeb] bg-[#00d9c5]",
        collapsed && "absolute right-2 top-2",
      )}
      title={`活跃实例：运行中；静音：${muted ? "是" : "否"}`}
      aria-label={`活跃实例，静音${muted ? "开启" : "关闭"}`}
    />
  );
}

function SidebarItem({
  icon: Icon,
  label,
  badge,
  onClick,
  disabled,
  collapsed,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
  onClick?: () => void;
  disabled?: boolean;
  collapsed: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 rounded-control text-left transition-colors text-agent-muted hover:bg-agent-surface hover:text-agent-text disabled:opacity-50 disabled:pointer-events-none relative overflow-hidden",
        collapsed ? "h-9 w-9 justify-center" : "w-full h-9 px-3"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-[16px] w-[16px] shrink-0 opacity-80" />
      <AnimatePresence>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            className="min-w-0 flex-1 flex justify-between items-center text-[13px] font-medium whitespace-nowrap"
          >
            <span className="truncate pr-2">{label}</span>
            {badge && <span className="shrink-0 rounded bg-agent-surface px-1.5 py-0.5 text-[10px] font-medium text-agent-subtle">{badge}</span>}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}
