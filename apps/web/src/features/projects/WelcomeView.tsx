import { FolderSync, ChevronRight, HelpCircle, BookOpen, Terminal, Folder } from "lucide-react";
import type { ProjectSummary } from "../../api";
import type { WorkbenchModule } from "../../app/routes";

type Props = {
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
  onScanProjects: () => void;
  onOpenModule: (module: WorkbenchModule) => void;
  busy: boolean;
};

export function WelcomeView({ projects, onSelectProject, onScanProjects, busy }: Props) {
  return (
    <div className="relative flex-1 w-full h-full text-text overflow-hidden flex flex-col items-center justify-center">
      {/* Subtle background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative w-full max-w-[1100px] max-h-full flex flex-col lg:flex-row p-8 lg:p-12 gap-16 lg:gap-24">
        
        {/* Left Column: Header & Projects */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          
          {/* Minimalist Header */}
          <div className="mb-12 shrink-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-2 mb-4 select-none pointer-events-none">
              <img src="/files.png" alt="Plus" className="h-[42px] rounded-lg object-contain" />
              <img src="/logo-text.png" alt="TapTap Maker Plus" className="h-[38px] object-contain" />
            </div>
            <p className="text-[14px] text-text-subtle font-medium tracking-wide ml-1">本地 MCP 智能开发工作台</p>
          </div>

          {/* Flattened Projects Area */}
          <div className="flex flex-col flex-1 min-h-0 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[13px] font-bold text-text-subtle uppercase tracking-wider flex items-center gap-2">
                最近开发的游戏
              </h2>
            </div>
            
            <div className="overflow-y-auto scrollbar-thin pr-4 -mr-4" style={{ maxHeight: '400px' }}>
              {projects.length === 0 ? (
                <div className="w-full py-12 flex flex-col items-center justify-center text-center opacity-60">
                  <Folder className="w-12 h-12 text-text-muted mb-4 opacity-50" />
                  <p className="text-[14px] font-bold text-text mb-1">空空如也</p>
                  <p className="text-[12px] text-text-subtle">点击右侧扫描本地工程以载入</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pb-8">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => onSelectProject(project.id)}
                      className="group flex items-center gap-4 p-3 rounded-lg hover:bg-surface-panel transition-all duration-200 cursor-pointer text-left ring-1 ring-transparent hover:ring-border-soft"
                      type="button"
                    >
                      {project.iconUrl ? (
                        <div className="w-10 h-10 flex items-center justify-center shrink-0 rounded-md overflow-hidden bg-surface-muted ring-1 ring-border-soft/50 shadow-sm">
                          <img src={project.iconUrl} alt="icon" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 flex items-center justify-center shrink-0 rounded-md bg-surface-panel group-hover:bg-brand/10 transition-colors ring-1 ring-border-soft/50 group-hover:ring-brand/30 shadow-sm">
                          <span className="text-[16px] font-bold text-text-muted group-hover:text-brand-strong transition-colors">
                            {project.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <strong className="block text-[14px] font-medium text-text truncate group-hover:text-brand-strong transition-colors">{project.name}</strong>
                        <span className="block text-[11px] text-text-muted truncate mt-0.5 font-mono" title={project.rootPath}>{project.rootPath}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Quick Start */}
        <div className="w-full lg:w-[280px] flex flex-col shrink-0 gap-10 lg:pt-4 animate-in fade-in slide-in-from-right-8 duration-700 delay-200">
          
          <div className="flex flex-col gap-3">
            <h3 className="text-[13px] font-bold text-text-subtle uppercase tracking-wider mb-1">开始</h3>
            <button 
              onClick={onScanProjects} 
              disabled={busy} 
              className="group flex items-center gap-3 p-3 w-full rounded-lg hover:bg-brand/10 text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ring-1 ring-transparent hover:ring-brand/30"
              type="button"
            >
              <div className="w-8 h-8 rounded-md bg-brand/10 flex items-center justify-center shrink-0 text-brand group-hover:scale-110 transition-transform">
                <FolderSync className="w-4 h-4" />
              </div>
              <div>
                <strong className="block text-[13px] font-semibold text-text group-hover:text-brand transition-colors">扫描本地工程</strong>
                <span className="block text-[11px] text-text-subtle mt-0.5">加载现有的 Maker 项目</span>
              </div>
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-[13px] font-bold text-text-subtle uppercase tracking-wider mb-1">资源</h3>
            <a href="https://developer.taptap.cn/" target="_blank" rel="noreferrer" className="group flex items-center gap-3 p-3 w-full rounded-lg hover:bg-surface-panel text-left transition-all duration-200 ring-1 ring-transparent hover:ring-border-soft">
              <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-text-muted group-hover:text-text transition-colors">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <strong className="block text-[13px] font-semibold text-text">官方文档</strong>
                <span className="block text-[11px] text-text-subtle mt-0.5">API 与开发指南</span>
              </div>
            </a>
            <a href="https://developer.taptap.cn/" target="_blank" rel="noreferrer" className="group flex items-center gap-3 p-3 w-full rounded-lg hover:bg-surface-panel text-left transition-all duration-200 ring-1 ring-transparent hover:ring-border-soft">
              <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 text-text-muted group-hover:text-text transition-colors">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <strong className="block text-[13px] font-semibold text-text">获取帮助</strong>
                <span className="block text-[11px] text-text-subtle mt-0.5">开发者社区与支持</span>
              </div>
            </a>
          </div>

        </div>
      </div>
      
      {/* Absolute Bottom Right Watermark */}
      <div className="absolute bottom-6 right-8 flex items-center gap-2 opacity-30 select-none pointer-events-none">
        <span className="text-[10px] font-mono font-bold tracking-[0.15em] uppercase text-text">Maker Plus v0.1.0-alpha</span>
      </div>
    </div>
  );
}
