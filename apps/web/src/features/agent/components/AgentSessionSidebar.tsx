import { Calendar, Search, SquarePen, MessageSquare, Puzzle, AtSign, ChevronLeft, ChevronRight } from "lucide-react";
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
  onSelectSession
}: {
  collapsed: boolean;
  sessions: AgentSessionRecord[];
  projects: ProjectSummary[];
  activeSessionId?: string;
  loading: boolean;
  onToggleCollapsed: () => void;
  onNewSession: () => void;
  onSelectSession: (sessionId: string) => void;
}) {
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
    <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-surface-panel border-r border-border text-text relative group transition-all">
      <div className={cn("mt-4 flex shrink-0 flex-col gap-1.5 transition-[padding] duration-300 ease-out", collapsed ? "items-center px-2" : "px-3")}>
        <div className="flex items-center gap-1 w-full">
          <div className="flex-1 min-w-0">
            <SidebarItem icon={SquarePen} label="新对话" onClick={onNewSession} disabled={loading} collapsed={collapsed} />
          </div>
          {!collapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-text-subtle hover:bg-surface-muted hover:text-text transition-colors"
              title="折叠会话栏"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {collapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-text-subtle hover:bg-surface-muted hover:text-text transition-colors"
              title="展开会话栏"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
        <SidebarItem icon={Search} label="搜索" badge="待接入" collapsed={collapsed} disabled />
        <SidebarItem icon={Puzzle} label="并行任务" badge="骨架" collapsed={collapsed} disabled />
        <SidebarItem icon={Calendar} label="已安排" badge="待接入" collapsed={collapsed} disabled />
        <SidebarItem icon={AtSign} label="插件" badge="待接入" collapsed={collapsed} disabled />
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {!collapsed && (
          <div className="mb-2 px-2 text-[11px] font-semibold text-text-subtle">
            项目
          </div>
        )}
        {Object.keys(sessionsByProject).length > 0 ? (
          Object.entries(sessionsByProject).map(([pId, groupSessions]) => (
            <div key={pId} className="mb-4">
              {!collapsed && (
                <div className="mb-1 flex items-center gap-2 px-2 text-[12px] font-medium text-text-muted">
                  <span className="truncate">{getProjectName(pId)}</span>
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                {groupSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => onSelectSession(session.id)}
                    className={cn(
                      "group relative flex w-full items-center gap-2.5 rounded-control text-left transition-colors duration-200",
                      collapsed ? "h-9 justify-center px-0" : "px-3 py-1.5",
                      session.id === activeSessionId
                        ? "bg-surface-muted text-text border-l-[3px] border-brand rounded-l-none"
                        : "text-text-muted hover:bg-surface-muted hover:text-text"
                    )}
                    title={session.title}
                  >
                    {collapsed ? (
                      <MessageSquare className={cn("h-4 w-4 shrink-0 transition-colors duration-200", session.id === activeSessionId ? "text-brand" : "opacity-80")} />
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{session.title}</span>
                        <span className="shrink-0 text-[10px] text-text-subtle group-hover:text-text-muted">
                          {formatShortTime(session.updatedAt)}
                        </span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className={cn("text-center text-xs text-text-muted", collapsed ? "p-2" : "p-4")}>
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
        "flex items-center gap-3 rounded-control text-left transition-colors text-text-muted hover:bg-surface-muted hover:text-text disabled:opacity-50 disabled:pointer-events-none",
        collapsed ? "h-9 w-9 justify-center" : "w-full px-3 py-1.5"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-[16px] w-[16px] shrink-0 opacity-80" />
      {!collapsed && (
        <span className="min-w-0 flex-1 flex justify-between items-center text-[13px] font-medium">
          {label}
          {badge && <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-bold text-brand">{badge}</span>}
        </span>
      )}
    </button>
  );
}
