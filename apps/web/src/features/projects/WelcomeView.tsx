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
    <div className="relative flex-1 w-full h-full bg-surface-app text-text overflow-y-auto scrollbar-thin">
      <div className="relative max-w-4xl mx-auto w-full min-h-full flex flex-col p-8 md:p-12 xl:p-16">
        
        {/* 居中标题区 */}
        <div className="flex flex-col items-center justify-center text-center mb-14 animate-in fade-in slide-in-from-bottom-4 duration-700 pt-8 md:pt-12">
          <img src="https://maker.taptap.cn/taptap-maker.svg" alt="TapTap Maker" className="h-[52px] object-contain pointer-events-none select-none mb-5" />
          <p className="text-[15px] text-text-subtle font-medium tracking-wide">本地 MCP 智能开发工作台。快速载入项目，开启资产、工作流与构建。</p>
        </div>

        {/* 核心操作区 */}
        <div className="w-full mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
          <button 
            onClick={onScanProjects} 
            disabled={busy} 
            className="group relative w-full flex items-center justify-between p-8 bg-surface-panel hover:bg-surface-muted border border-border hover:border-brand/40 rounded-2xl shadow-sm transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer overflow-hidden"
            type="button"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 blur-3xl rounded-full pointer-events-none" />
            <div className="flex items-center gap-6 z-10">
              <div className="w-16 h-16 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-brand/20 transition-all duration-300">
                <FolderSync className="w-7 h-7 text-brand-strong" />
              </div>
              <div>
                <strong className="block text-[20px] font-bold text-text group-hover:text-brand-strong transition-colors">扫描本地工程</strong>
                <span className="block text-[14px] text-text-muted mt-1.5">从本地目录加载 Maker 配置，自动进入智能工作区</span>
              </div>
            </div>
            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-surface-raised border border-border-soft group-hover:border-brand/40 group-hover:bg-brand/5 transition-all z-10">
              <ChevronRight className="w-6 h-6 text-text-subtle group-hover:text-brand transition-colors group-hover:translate-x-1" />
            </div>
          </button>
        </div>

        {/* 最近项目网格 */}
        <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200 flex-1">
          <h2 className="text-[14px] font-bold text-text-subtle mb-5 flex items-center gap-2 border-b border-border-soft pb-3">
            <Terminal className="w-4 h-4" /> 最近开发的游戏
          </h2>
          
          {projects.length === 0 ? (
            <div className="w-full flex flex-col items-center justify-center p-16 text-center opacity-70 bg-surface-panel border border-border-soft rounded-2xl border-dashed">
              <Folder className="w-12 h-12 text-text-muted mb-4 opacity-50" />
              <p className="text-[15px] text-text-subtle font-medium">尚无最近项目</p>
              <p className="text-[13px] text-text-muted mt-1">请点击上方按钮扫描本地工程</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className="group flex items-center justify-between p-5 bg-surface-panel hover:bg-surface-muted border border-border hover:border-brand/40 rounded-2xl text-left transition-all duration-200 cursor-pointer shadow-sm hover:shadow"
                  type="button"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {(project as any).iconUrl ? (
                      <div className="w-[56px] h-[56px] flex items-center justify-center shrink-0 rounded-xl group-hover:shadow-md transition-all border border-border-soft overflow-hidden bg-surface-muted">
                        <img src={(project as any).iconUrl} alt="icon" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                    ) : (
                      <div className="w-[56px] h-[56px] flex items-center justify-center shrink-0 bg-surface-raised rounded-xl group-hover:bg-brand/10 transition-colors border border-border-soft group-hover:border-brand/30">
                        <span className="text-[24px] font-bold text-text-muted group-hover:text-brand-strong transition-colors">
                          {project.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <strong className="block text-[16px] font-bold text-text truncate group-hover:text-brand-strong transition-colors">{project.name}</strong>
                      <span className="block text-[12px] text-text-subtle truncate mt-1 opacity-70 font-mono" title={project.rootPath}>{project.rootPath}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 底部链接 */}
        <div className="mt-12 flex items-center justify-center gap-8 border-t border-border-soft pt-8 animate-in fade-in duration-700 delay-300">
          <a href="https://developer.taptap.cn/" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px] text-text-muted hover:text-text transition-colors">
            <BookOpen className="w-4 h-4" /> 官方文档
          </a>
          <a href="https://developer.taptap.cn/" target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px] text-text-muted hover:text-text transition-colors">
            <HelpCircle className="w-4 h-4" /> 获取帮助
          </a>
        </div>

      </div>
    </div>
  );
}