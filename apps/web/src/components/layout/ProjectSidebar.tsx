import { motion } from "framer-motion";
import { Menu, FolderSync, LayoutDashboard, Home, Image as ImageIcon, Video, Music, Box, Hammer, Settings2, GitBranch, Activity } from "lucide-react";
import type { ProjectSummary, TaskRecord } from "../../api";
import { workbenchRoutes, type WorkbenchModule } from "../../app/routes";
import { cn } from "../../lib/utils";

type Props = {
  projects: ProjectSummary[];
  selectedProjectId: string;
  activeModule: WorkbenchModule;
  tasks: TaskRecord[];
  collapsed: boolean;
  width: number;
  onToggleCollapsed: () => void;
  onSelectProject: (projectId: string) => void;
  onSelectModule: (module: WorkbenchModule) => void;
  onScanProjects: () => void;
};

const moduleIcons: Record<string, React.ElementType> = {
  "home": Home,
  "workspace": LayoutDashboard,
  "assets": LayoutDashboard,
  "studio-image": ImageIcon,
  "studio-video": Video,
  "studio-music": Music,
  "studio-3d": Box,
  "workflow": GitBranch,
  "build": Hammer,
  "runs": Activity,
  "settings": Settings2,
};

export function ProjectSidebar({ projects, selectedProjectId, activeModule, tasks, collapsed, width, onToggleCollapsed, onSelectProject, onSelectModule, onScanProjects }: Props) {
  
  const activeProject = projects.find(p => p.id === selectedProjectId);

  // 核心逻辑：是否处于“已打开项目”状态
  const isProjectOpened = !!activeProject;

  return (
    <motion.aside 
      initial={false}
      animate={{ width: collapsed ? 56 : width }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col bg-surface-panel shrink-0 overflow-hidden border-r border-border relative h-full select-none"
    >
      {/* 顶栏 (Header) */}
      <div className="flex h-[52px] shrink-0 items-center justify-between px-3 overflow-hidden bg-surface-app border-b border-border-soft">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button 
            onClick={onToggleCollapsed}
            className={cn("inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors cursor-pointer rounded-md text-xs h-8 w-8 shrink-0 p-0 hover:bg-surface-muted text-text focus-visible:outline-none", collapsed ? "mx-auto" : "")}
            title={collapsed ? "展开侧栏" : "收起侧栏"}
          >
            <Menu className="w-4 h-4" />
          </button>
          
          {!collapsed && (
            <div className="flex items-center gap-2 group min-w-0 flex-1">
              {isProjectOpened ? (
                // 状态 B: 已打开项目，显示带官方图标的项目名称
                <>
                  {(activeProject as any).iconUrl ? (
                    <img src={(activeProject as any).iconUrl} alt="Game Icon" className="w-5 h-5 rounded object-cover shadow-sm border border-border" />
                  ) : (
                    <div className="w-5 h-5 flex items-center justify-center shrink-0 bg-surface-muted rounded border border-border-soft">
                      <span className="text-[10px] font-bold text-text-muted">{activeProject.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <span className="text-[14px] font-semibold text-text truncate">
                    {activeProject.name}
                  </span>
                  <button 
                    type="button" 
                    className="flex items-center opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 hover:bg-surface-muted rounded transition-opacity cursor-pointer text-text-muted hover:text-text shrink-0" 
                    title="退出当前项目"
                    onClick={() => {
                      onSelectProject("");
                      onSelectModule("home");
                    }}
                  >
                    <FolderSync className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                // 状态 A: 未打开项目，显示纯净的 Logo 文字
                <span className="text-[14px] font-bold text-text truncate px-1">
                  TapTap MCP
                </span>
              )}
            </div>
          )}
        </div>
        
        {/* 仅在打开项目且未折叠时，显示发布按钮 */}
        {!collapsed && isProjectOpened && (
          <div className="flex shrink-0 items-center gap-2 pl-1">
            <button className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-[12px] font-medium transition-colors cursor-pointer text-text-muted bg-surface-muted hover:bg-border-soft hover:text-text px-3 py-1 h-7 rounded-full">
              <svg width="10" height="10" viewBox="-0.5 0 12 11" xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 fill-current opacity-80">
                <path d="M11.0087 0.660044C10.9117 0.46611 10.6751 0.385584 10.4795 0.48255L0.171762 5.60192C-0.0221713 5.69889 -0.102698 5.93554 -0.00573077 6.13111C0.0156354 6.17383 0.0435778 6.21164 0.076446 6.24287C0.119166 6.28397 0.170112 6.31518 0.230935 6.3349L3.69863 7.42451L4.23111 6.76384L1.40109 5.87472L9.16477 2.01589L5.01174 7.04322C5.00206 7.05458 4.99327 7.06667 4.98544 7.07938L4.50555 7.67594V10.151C4.50555 10.3696 4.6814 10.5454 4.89998 10.5454C5.11855 10.5454 5.29441 10.3696 5.29441 10.151V7.92245L9.06615 9.10573C9.11052 9.11888 9.1549 9.12544 9.19926 9.12379C9.3899 9.12872 9.56246 8.99396 9.59862 8.80004L11.0432 0.909811C11.0481 0.883519 11.0498 0.855577 11.0498 0.829285C11.0481 0.7734 11.0366 0.71424 11.0087 0.660018L11.0087 0.660044ZM8.90178 8.22815L5.84988 7.27001L9.99796 2.24761L8.90177 8.22814L8.90178 8.22815Z"></path>
              </svg>
              <span>发布</span>
            </button>
          </div>
        )}
      </div>

      {/* 主区域列表 */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
         <div className={cn("p-3 pb-0", collapsed ? "px-2" : "px-3")}>
            <ul className="space-y-1">
              {workbenchRoutes.map((route) => {
                const isHomeOrSettings = route.id === "home" || route.id === "settings";
                
                // 双状态逻辑核心：
                // 如果未打开项目，则完全不渲染那些与项目相关的模块，保持界面纯净
                if (!isProjectOpened && !isHomeOrSettings) {
                  return null;
                }

                const isActive = activeModule === route.id;
                const Icon = moduleIcons[route.id] || LayoutDashboard;
                
                return (
                  <li key={route.id}>
                    <button 
                      type="button" 
                      title={route.label} 
                      className={cn(
                        "flex w-full cursor-pointer select-none items-center rounded-lg transition-colors outline-none",
                        // 采用更舒展的内边距和字号，匹配官方 TapTap 侧边栏视觉
                        collapsed ? "justify-center h-[44px] p-0" : "py-[10px] px-3 gap-3",
                        isActive 
                          ? "bg-surface-muted text-text font-semibold" 
                          : "text-text-muted hover:bg-surface-muted hover:text-text"
                      )}
                      onClick={() => onSelectModule(route.id)}
                    >
                      <Icon className={cn("shrink-0", collapsed ? "w-[20px] h-[20px]" : "w-[20px] h-[20px]")} strokeWidth={isActive ? 2.5 : 2} />
                      {!collapsed && (
                        <span className="text-[14px] truncate">{route.label}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
         </div>
      </div>
    </motion.aside>
  );
}
