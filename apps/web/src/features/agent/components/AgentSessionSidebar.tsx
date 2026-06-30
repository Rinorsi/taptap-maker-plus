import { Archive, Calendar, Check, Search, SquarePen, MessageSquare, AtSign, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";
import { useState } from "react";
import type { ComponentType } from "react";
import type { AgentSessionRecord } from "../api";
import type { ProjectSummary } from "../../../api";
import { cn } from "../../../lib/utils";
import { formatShortTime } from "../utils";

export function AgentSessionSidebar({
  collapsed,
  sessions,
  projects,
  activeSessionId,
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
        <div className="flex items-center gap-1 w-full">
          <div className="flex-1 min-w-0">
            <SidebarItem icon={SquarePen} label="新对话" onClick={onNewSession} disabled={loading} collapsed={collapsed} />
          </div>
          {!collapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-agent-subtle hover:bg-agent-surface hover:text-agent-text transition-colors"
              title="折叠会话栏"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {collapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-agent-subtle hover:bg-agent-surface hover:text-agent-text transition-colors"
              title="展开会话栏"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
        <SidebarItem icon={Search} label="搜索" badge="待接入" collapsed={collapsed} disabled />
        <SidebarItem icon={Calendar} label="已安排" badge="待接入" collapsed={collapsed} disabled />
        <SidebarItem icon={AtSign} label="插件" badge="待接入" collapsed={collapsed} disabled />
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {!collapsed && (
          <div className="mb-2 px-2 text-[11px] font-semibold text-agent-subtle uppercase tracking-wider">
            主会话区 (Session)
          </div>
        )}
        {Object.keys(sessionsByProject).length > 0 ? (
          Object.entries(sessionsByProject).map(([pId, groupSessions]) => (
            <div key={pId} className="mb-4">
              {!collapsed && (
                <div className="mb-1 flex items-center gap-2 px-2 text-[12px] font-medium text-agent-muted">
                  <span className="truncate">{getProjectName(pId)}</span>
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {groupSessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "group/session relative flex w-full items-center gap-2.5 rounded-control text-left transition-colors duration-200",
                      collapsed ? "h-9 justify-center px-0" : "px-3 py-1.5",
                      session.id === activeSessionId
                        ? "bg-agent-surface text-agent-text border-l-[3px] border-agent-accent rounded-l-none"
                        : "text-agent-muted hover:bg-agent-surface hover:text-agent-text"
                    )}
                    title={session.title}
                  >
                    {collapsed ? (
                      <button
                        type="button"
                        onClick={() => onSelectSession(session.id)}
                        className="flex h-full w-full items-center justify-center"
                        title={session.title}
                      >
                        <MessageSquare className={cn("h-4 w-4 shrink-0 transition-colors duration-200", session.id === activeSessionId ? "text-agent-accent" : "opacity-80")} />
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
    </aside>
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
        "flex items-center gap-3 rounded-control text-left transition-colors text-agent-muted hover:bg-agent-surface hover:text-agent-text disabled:opacity-50 disabled:pointer-events-none",
        collapsed ? "h-9 w-9 justify-center" : "w-full px-3 py-1.5"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-[16px] w-[16px] shrink-0 opacity-80" />
      {!collapsed && (
        <span className="min-w-0 flex-1 flex justify-between items-center text-[13px] font-medium">
          {label}
          {badge && <span className="rounded bg-agent-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-agent-accent">{badge}</span>}
        </span>
      )}
    </button>
  );
}
