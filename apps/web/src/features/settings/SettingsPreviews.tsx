import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Bell, Box, Cpu, FolderCog, Globe, Images, Info, PlaySquare, RefreshCw } from "lucide-react";
import { SelectField } from "../../components/ui/SelectField";
import { cn } from "../../lib/utils";
import type { SettingsPreferences } from "./preferences";

export function ThemeSelectorPreview({ prefs, onChange }: { prefs: SettingsPreferences, onChange: (v: string) => void }) {
  return (
    <div className="flex gap-4 p-8 items-center justify-center w-full">
       <ThemeCard type="system" label="跟随系统" active={prefs.themePreference === "system"} onClick={() => onChange("system")} />
       <ThemeCard type="light" label="浅色" active={prefs.themePreference === "light"} onClick={() => onChange("light")} />
       <ThemeCard type="dark" label="深色" active={prefs.themePreference === "dark"} onClick={() => onChange("dark")} />
    </div>
  );
}

function ThemeCard({ type, label, active, onClick }: { type: "system" | "light" | "dark", label: string, active: boolean, onClick: () => void }) {
  const isSystemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = type === "dark" || (type === "system" && isSystemDark);
  return (
    <button type="button" className="flex flex-col gap-2 items-center cursor-pointer" onClick={onClick}>
      <div className={cn("w-28 h-20 rounded-md border-2 p-1 overflow-hidden transition-all duration-200",
        active ? "border-brand ring-2 ring-brand/20" : "border-border-soft hover:border-text-muted",
        isDark ? "bg-[#1e1e1e]" : "bg-gray-100"
      )}>
        <div className={cn("w-full h-full rounded flex flex-col gap-1 p-1", isDark ? "bg-[#252526]" : "bg-white")}>
           <div className={cn("w-full h-2.5 rounded-sm flex items-center px-1 gap-1", isDark ? "bg-[#333]" : "bg-gray-200")}>
              <div className={cn("w-1 h-1 rounded-full", isDark ? "bg-[#555]" : "bg-gray-400")}></div>
              <div className={cn("w-1 h-1 rounded-full", isDark ? "bg-[#555]" : "bg-gray-400")}></div>
           </div>
           <div className="flex flex-1 gap-1">
              <div className={cn("w-1/3 h-full rounded-sm", isDark ? "bg-[#333]" : "bg-gray-200")}></div>
              <div className={cn("flex-1 h-full rounded-sm border", isDark ? "bg-[#1e1e1e] border-[#333]" : "bg-gray-50 border-gray-200")}></div>
           </div>
        </div>
      </div>
      <span className={cn("text-[12px] font-medium transition-colors", active ? "text-brand" : "text-text-subtle")}>{label}</span>
    </button>
  );
}

export function WorkbenchPreview({ prefs }: { prefs: SettingsPreferences }) {
  const isDark = prefs.themePreference === "dark" || (prefs.themePreference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const bg = isDark ? "bg-[#1e1e1e]" : "bg-[#f3f4f6]";
  const border = isDark ? "border-[#333]" : "border-gray-200";
  const panelBg = isDark ? "bg-[#252526]" : "bg-white";
  const activeColor = isDark ? "bg-brand/30" : "bg-brand/20";
  const itemColor = isDark ? "bg-[#333]" : "bg-gray-100";

  const sidebarWidth = prefs.sidebarPreference === "collapsed" ? "w-4" : "w-12";
  const inspectorWidth = prefs.inspectorPreference === "collapsed" ? "w-0 overflow-hidden border-l-0" : "w-16";
  const itemHeight = prefs.density === "comfortable" ? "h-3" : prefs.density === "compact" ? "h-1.5" : "h-2";
  const gap = prefs.density === "comfortable" ? "gap-2" : prefs.density === "compact" ? "gap-0.5" : "gap-1";

  return (
    <div className="flex flex-col items-center justify-center w-full">
       <div className={cn("w-[240px] h-[140px] rounded-lg border-2 shadow-sm overflow-hidden flex flex-col transition-all duration-300", border, bg)}>
          {/* Topbar */}
          <div className={cn("h-4 w-full border-b flex items-center px-1 gap-1", border, panelBg)}>
             <div className={cn("w-1.5 h-1.5 rounded-full", itemColor)}></div>
             <div className={cn("w-1.5 h-1.5 rounded-full", itemColor)}></div>
             <div className="flex-1"></div>
             <div className={cn("w-4 h-1.5 rounded-full", itemColor)}></div>
          </div>
          {/* Main Area */}
          <div className="flex flex-1 min-h-0">
             {/* Sidebar */}
             <div className={cn("h-full border-r flex flex-col items-center pt-2 transition-all duration-300", border, panelBg, sidebarWidth, gap)}>
                <div className={cn("w-2.5 rounded-sm transition-all duration-300", itemHeight, activeColor)}></div>
                <div className={cn("w-2.5 rounded-sm transition-all duration-300", itemHeight, itemColor)}></div>
                <div className={cn("w-2.5 rounded-sm transition-all duration-300", itemHeight, itemColor)}></div>
             </div>
             {/* Content */}
             <div className="flex-1 flex flex-col p-2 gap-2 overflow-hidden">
                <div className={cn("w-full h-8 rounded border", border, panelBg)}></div>
                <div className={cn("w-full flex-1 rounded border", border, panelBg)}></div>
             </div>
             {/* Inspector */}
             <div className={cn("h-full border-l flex flex-col p-1.5 transition-all duration-300", border, panelBg, inspectorWidth, gap)}>
                <div className={cn("w-full rounded-sm transition-all duration-300", itemHeight, itemColor)}></div>
                <div className={cn("w-3/4 rounded-sm transition-all duration-300", itemHeight, itemColor)}></div>
                <div className={cn("w-1/2 rounded-sm transition-all duration-300", itemHeight, itemColor)}></div>
             </div>
          </div>
       </div>
    </div>
  );
}

export function CodeEditorPreview({ prefs }: { prefs: SettingsPreferences }) {
  const isDark = prefs.codeEditorTheme === "dark" || prefs.codeEditorTheme === "high-contrast" || (prefs.codeEditorTheme === "app" && (prefs.themePreference === "dark" || (prefs.themePreference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)));
  const isHc = prefs.codeEditorTheme === "high-contrast";
  const bg = isHc ? "bg-black border-gray-600" : isDark ? "bg-[#1e1e1e] border-[#333]" : "bg-white border-gray-200";
  const text = isHc ? "text-white" : isDark ? "text-gray-300" : "text-gray-700";
  const keyword = isHc ? "text-pink-500" : isDark ? "text-[#c678dd]" : "text-blue-600";
  const stringColor = isHc ? "text-yellow-400" : isDark ? "text-[#98c379]" : "text-green-600";
  const lineNoColor = isHc ? "text-gray-400 border-gray-700" : isDark ? "text-gray-600 border-[#333]" : "text-gray-400 border-gray-200";
  const lineBg = isHc ? "bg-gray-900" : isDark ? "bg-[#252526]" : "bg-gray-50";
  const headerBg = isHc ? "bg-gray-800" : isDark ? "bg-[#2d2d2d]" : "bg-gray-100";

  const textSize = prefs.codeEditorFontSize === "small" ? "text-[10px]" : prefs.codeEditorFontSize === "large" ? "text-[14px]" : "text-[12px]";
  const wrap = prefs.codeEditorWrap === "wrap" ? "whitespace-pre-wrap break-all" : "whitespace-pre overflow-x-hidden";

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className={cn("w-[260px] rounded-lg border shadow-sm flex flex-col overflow-hidden transition-all duration-300", bg)}>
        <div className={cn("h-6 w-full flex items-center px-2 gap-1.5 border-b border-inherit", headerBg)}>
           <div className="w-2 h-2 rounded-full bg-red-400/80"></div>
           <div className="w-2 h-2 rounded-full bg-yellow-400/80"></div>
           <div className="w-2 h-2 rounded-full bg-green-400/80"></div>
           <div className="flex-1 text-center text-[9px] font-medium opacity-60">example.js</div>
        </div>
        <div className={cn("flex font-mono leading-relaxed transition-all duration-300", textSize)}>
          {prefs.codeEditorLineNumbers === "show" && (
            <div className={cn("flex flex-col items-end px-2 py-2 border-r shrink-0 select-none", lineBg, lineNoColor)}>
              <span>1</span>
              <span>2</span>
              <span>3</span>
              {prefs.codeEditorWrap === "wrap" ? <><span>4</span><span>5</span></> : <span>4</span>}
            </div>
          )}
          <div className={cn("flex-1 p-2", wrap, text)}>
            <div><span className={keyword}>function</span> demoSettings() {'{'}</div>
            <div className="pl-4"><span className={keyword}>const</span> sample = <span className={stringColor}>"A long string to demonstrate wrapping..."</span>;</div>
            <div className="pl-4">console.log(sample);</div>
            <div className="pl-4">return true;</div>
            <div>{'}'}</div>
          </div>
        </div>
      </div>

    </div>
  );
}

export function CanvasPreview({ prefs }: { prefs: SettingsPreferences }) {
  const isDark = prefs.themePreference === "dark" || (prefs.themePreference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const bg = isDark ? "bg-[#121212]" : "bg-gray-100";
  const nodeBg = isDark ? "bg-[#2a2a2a] border-[#444]" : "bg-white border-gray-300";
  const grid = prefs.canvasGrid === "visible" ? (isDark ? "[background-size:8px_8px] [background-image:radial-gradient(#444_1px,transparent_1px)]" : "[background-size:8px_8px] [background-image:radial-gradient(#ccc_1px,transparent_1px)]") : "";
  const sideWidth = prefs.canvasSidebarBehavior === "collapse-both" ? "w-0 border-0" : prefs.canvasSidebarBehavior === "collapse-left" ? "w-0 border-0" : "w-10";
  const sideRightWidth = prefs.canvasSidebarBehavior === "collapse-both" ? "w-0 border-0" : "w-12";
  const border = isDark ? "border-[#333]" : "border-gray-200";

  return (
    <div className="flex flex-col items-center justify-center w-full">
       <div className={cn("w-[260px] h-[140px] rounded-lg border-2 shadow-sm overflow-hidden flex transition-all duration-300", isDark ? "border-[#444]" : "border-gray-300", isDark ? "bg-[#1e1e1e]" : "bg-white")}>
          {/* Left Sidebar */}
          <div className={cn("h-full border-r transition-all duration-300 flex flex-col p-1 gap-1", border, isDark ? "bg-[#252526]" : "bg-gray-50", sideWidth, prefs.canvasSidebarBehavior === "keep" ? "opacity-100" : "opacity-0 overflow-hidden p-0")}>
             <div className={cn("w-full h-2 rounded-sm", isDark ? "bg-[#444]" : "bg-gray-200")}></div>
             <div className={cn("w-full h-2 rounded-sm", isDark ? "bg-[#444]" : "bg-gray-200")}></div>
          </div>
          {/* Canvas Area */}
          <div className={cn("flex-1 relative overflow-hidden transition-all duration-300", bg, grid)}>
             {/* Nodes */}
             <div className={cn("absolute top-3 left-4 w-12 h-6 rounded border shadow-sm", nodeBg)}></div>
             <div className={cn("absolute top-10 left-16 w-14 h-8 rounded border shadow-sm", nodeBg)}></div>
             {/* Line */}
             <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
               <path d="M 28 20 C 40 20, 40 40, 64 40" fill="none" stroke={isDark ? "#888" : "#999"} strokeWidth="1.5" />
             </svg>
             {/* Minimap */}
             {prefs.canvasMiniMap === "visible" && (
                <div className={cn("absolute bottom-1 right-1 w-10 h-8 rounded border shadow-sm bg-black/5 dark:bg-white/5", isDark ? "border-[#444]" : "border-gray-300")}>
                   <div className="absolute top-1 left-1 w-2 h-1 bg-brand/50 rounded-sm"></div>
                   <div className="absolute top-3 left-3 w-3 h-1.5 bg-brand/50 rounded-sm"></div>
                   <div className="absolute top-0 left-0 w-6 h-5 border border-brand/80 bg-brand/10"></div>
                </div>
             )}
          </div>
          {/* Right Sidebar */}
          <div className={cn("h-full border-l transition-all duration-300 flex flex-col p-1 gap-1", border, isDark ? "bg-[#252526]" : "bg-gray-50", sideRightWidth, prefs.canvasSidebarBehavior === "collapse-both" ? "opacity-0 overflow-hidden p-0" : "opacity-100")}>
             <div className={cn("w-full h-1.5 rounded-sm", isDark ? "bg-[#444]" : "bg-gray-200")}></div>
             <div className={cn("w-2/3 h-1.5 rounded-sm", isDark ? "bg-[#444]" : "bg-gray-200")}></div>
          </div>
       </div>
    </div>
  );
}

export function GeneralSettingsPreview({ prefs }: { prefs: SettingsPreferences }) {
  const isCompact = prefs.density === "compact";
  const isLoose = prefs.density === "comfortable";
  const [rememberSidebarCollapsed, setRememberSidebarCollapsed] = useState(false);
  const [rememberInspectorCollapsed, setRememberInspectorCollapsed] = useState(false);
  const [previewSource, setPreviewSource] = useState<"startup" | "workspace">("startup");
  const previousStartupPreferenceRef = useRef(prefs.startupPreference);
  const previousDefaultWorkspaceRef = useRef(prefs.defaultWorkspace);

  const gap = isCompact ? "gap-1" : isLoose ? "gap-2" : "gap-1.5";
  const padding = isCompact ? "p-1.5" : isLoose ? "p-2.5" : "p-2";
  const borderRadius = isCompact ? "rounded-sm" : isLoose ? "rounded-lg" : "rounded-md";
  const showPicker = previewSource === "startup" && prefs.startupPreference === "home-picker";
  const isHome = previewSource === "startup" && prefs.startupPreference === "home";
  const showWorkspace = previewSource === "workspace" || (previewSource === "startup" && prefs.startupPreference === "last-project");
  const sidebarCollapsed = prefs.sidebarPreference === "remember" ? rememberSidebarCollapsed : prefs.sidebarPreference === "collapsed";
  const inspectorCollapsed = prefs.inspectorPreference === "remember" ? rememberInspectorCollapsed : prefs.inspectorPreference === "collapsed";
  const activeModule = prefs.defaultWorkspace;
  const navItems = ["home", "assets", "studio-video", "studio-image", "studio-music", "studio-3d"];
  const canToggleSidebar = prefs.sidebarPreference === "remember";
  const canToggleInspector = prefs.inspectorPreference === "remember";
  const panelsExpanded = !sidebarCollapsed || !inspectorCollapsed;

  useEffect(() => {
    const startupChanged = previousStartupPreferenceRef.current !== prefs.startupPreference;
    const workspaceChanged = previousDefaultWorkspaceRef.current !== prefs.defaultWorkspace;

    if (workspaceChanged) {
      setPreviewSource("workspace");
    } else if (startupChanged) {
      setPreviewSource("startup");
    }

    previousStartupPreferenceRef.current = prefs.startupPreference;
    previousDefaultWorkspaceRef.current = prefs.defaultWorkspace;
  }, [prefs.startupPreference, prefs.defaultWorkspace]);

  return (
    <div className="flex h-[260px] w-full items-center justify-center px-1 py-3 sm:px-2">
      <div
        className={cn(
          "relative flex h-full w-full max-w-[360px] flex-col overflow-hidden bg-surface-panel shadow-md ring-1 ring-border transition-all duration-500 sm:max-w-[430px]",
          borderRadius,
          isCompact ? "scale-95" : "scale-100"
        )}
      >
        <div className="flex h-[28px] shrink-0 items-center justify-between border-b border-border-soft bg-surface-app px-2">
          <div className="flex items-center gap-1.5">
            <div className={cn("h-3 w-3 border border-border-soft bg-surface-muted", borderRadius)} />
            <div className={cn("h-1.5 w-20 bg-text/70", borderRadius)} />
          </div>
          <div className="flex items-center gap-1">
            <div className={cn("h-1.5 w-10 bg-surface-muted", borderRadius)} />
            <div className={cn("h-1.5 w-7 bg-brand/60", borderRadius)} />
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <div
            className={cn(
              "flex h-full shrink-0 flex-col border-r border-border-soft bg-surface-panel transition-all duration-500",
              sidebarCollapsed ? "w-7 items-center px-1 py-2" : "w-12 px-1.5 py-2 sm:w-[68px] sm:px-2",
              gap,
            )}
          >
            <div className={cn("relative flex w-full", sidebarCollapsed ? "justify-center" : "justify-start")}>
              <button
                type="button"
                disabled={!canToggleSidebar}
                onClick={() => setRememberSidebarCollapsed((value) => !value)}
                className={cn(
                  "relative h-4 transition-all",
                  sidebarCollapsed ? "w-4" : "w-8 sm:w-11",
                  borderRadius,
                  canToggleSidebar
                    ? "cursor-pointer bg-brand/25 ring-1 ring-brand/45 shadow-[0_0_12px_rgba(0,217,197,0.22)] hover:bg-brand/35"
                    : "cursor-default bg-surface-muted",
                )}
                title={canToggleSidebar ? "点击模拟左栏折叠/展开" : "左栏状态由当前设置固定"}
              />
              {canToggleSidebar ? (
                <span className="pointer-events-none absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-brand shadow-[0_0_10px_rgba(0,217,197,0.65)]" />
              ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-1 pt-1">
              {navItems.map((id) => (
                <div
                  key={id}
                  className={cn(
                    "flex h-5 items-center transition-all duration-500",
                    sidebarCollapsed ? "w-5 justify-center" : "w-full gap-1 px-1 sm:gap-1.5",
                    borderRadius,
                    (showWorkspace && activeModule === id) || (!showWorkspace && id === "home")
                      ? "bg-brand/20 text-brand ring-1 ring-brand/30"
                      : "text-text-muted",
                  )}
                >
                  <div className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-current opacity-45" />
                  {!sidebarCollapsed ? <div className={cn("h-1.5 flex-1 bg-current opacity-25", borderRadius)} /> : null}
                </div>
              ))}
            </div>
          </div>

          <div className={cn("flex-1 h-full flex flex-col bg-surface-panel transition-all duration-500 relative overflow-hidden", padding, gap)}>
            <div className={cn("absolute inset-0 flex flex-col transition-all duration-700", padding, gap, isHome && !showPicker ? "opacity-100 scale-100 z-10" : "opacity-0 scale-95 z-0 pointer-events-none")}>
               <div className={cn("w-1/4 h-2 bg-text transition-all duration-500", borderRadius)} />
               <div className={cn("flex-1 grid grid-cols-3 transition-all duration-500", gap)}>
                 {[1,2,3,4,5,6].map(i => <div key={i} className={cn("bg-surface-app ring-1 ring-border-soft", borderRadius)} />)}
               </div>
            </div>

            <div className={cn("absolute inset-0 flex transition-all duration-700", showWorkspace && activeModule === "assets" ? "opacity-100 scale-100 z-10" : "opacity-0 scale-95 z-0 pointer-events-none")}>
               <div className="w-1/4 h-full border-r border-border-soft flex flex-col p-1.5 gap-1.5 bg-surface-app/30">
                 {[1,2,3,4].map(i => <div key={i} className={cn("w-full h-1.5 bg-surface-muted", borderRadius)} />)}
               </div>
               <div className={cn("flex-1 h-full p-2 grid gap-1.5", panelsExpanded ? "grid-cols-2 grid-rows-4" : "grid-cols-3 grid-rows-3")}>
                 {(panelsExpanded ? [1,2,3,4,5,6,7,8] : [1,2,3,4,5,6,7,8,9]).map(i => <div key={i} className={cn("bg-surface-muted/50", borderRadius)} />)}
               </div>
            </div>

            <div className={cn("absolute inset-0 flex flex-col transition-all duration-700", showWorkspace && activeModule === "studio-video" ? "opacity-100 scale-100 z-10" : "opacity-0 scale-95 z-0 pointer-events-none")}>
               <div className="flex-1 p-2 flex items-center justify-center">
                 <div className={cn("w-3/4 h-full bg-black/80 flex items-center justify-center shadow-inner", borderRadius)}>
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center pl-0.5">
                       <div className="w-0 h-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-white"></div>
                    </div>
                 </div>
               </div>
               <div className="h-1/3 border-t border-border-soft bg-surface-app/50 p-1.5 flex flex-col gap-1 relative">
                 <div className="absolute top-0 bottom-0 left-1/3 w-[1px] bg-red-500/80 z-10">
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-red-500"></div>
                 </div>
                 <div className={cn("w-[90%] h-1.5 bg-brand/40 ml-2 relative", borderRadius)}>
                   <div className="absolute inset-y-0 left-2 w-8 bg-brand/60 rounded-sm"></div>
                 </div>
                 <div className={cn("w-3/4 h-1.5 bg-blue-500/40 ml-4", borderRadius)}></div>
                 <div className={cn("w-1/2 h-1.5 bg-green-500/40 ml-10 relative", borderRadius)}>
                   <div className="absolute inset-y-0 left-4 w-6 bg-green-500/60 rounded-sm"></div>
                 </div>
               </div>
            </div>

            <div className={cn("absolute inset-0 flex transition-all duration-700", showWorkspace && activeModule === "studio-image" ? "opacity-100 scale-100 z-10" : "opacity-0 scale-95 z-0 pointer-events-none")}>
               <div className="w-8 h-full bg-surface-panel border-r border-border-soft flex flex-col items-center py-2 gap-1.5 shrink-0 z-20">
                  <div className="w-3.5 h-3.5 rounded-sm border border-text-muted"></div>
                  <div className="w-3.5 h-3.5 rounded-full border border-text-muted"></div>
                  <div className="w-3.5 h-3.5 bg-text-muted/30"></div>
               </div>
               <div className="flex-1 relative flex items-center justify-center bg-surface-app/30 pattern-dots pattern-border-soft pattern-size-2">
                 <div className={cn("w-3/4 h-3/4 bg-white ring-1 ring-border shadow-sm overflow-hidden relative", borderRadius)}>
                    <div className="absolute top-2 right-3 w-5 h-5 rounded-full bg-amber-400"></div>
                    <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-blue-400/20"></div>
                    <div className="absolute bottom-0 left-[-10%] w-[60%] h-[70%] bg-emerald-500/80 rotate-45 origin-bottom-left"></div>
                    <div className="absolute bottom-0 right-[-10%] w-[70%] h-[50%] bg-emerald-400/80 -rotate-45 origin-bottom-right"></div>
                 </div>
               </div>
            </div>

            <div className={cn("absolute inset-0 flex flex-col justify-center transition-all duration-700 p-2 gap-2", showWorkspace && activeModule === "studio-music" ? "opacity-100 scale-100 z-10" : "opacity-0 scale-95 z-0 pointer-events-none")}>
               {[1,2,3].map(track => (
                 <div key={track} className={cn("w-full h-5 bg-surface-app ring-1 ring-border-soft flex items-center p-0.5 gap-1 overflow-hidden", borderRadius)}>
                    <div className="w-6 h-full bg-surface-panel flex flex-col items-center justify-center gap-[2px] shrink-0 border-r border-border-soft z-20">
                      <div className="w-2 h-1 bg-text-muted/40 rounded-sm"></div>
                      <div className="w-2 h-1 border border-text-muted/40 rounded-sm"></div>
                    </div>
                    <div className="flex-1 h-full flex items-center relative pl-1 overflow-hidden">
                      <div className="absolute top-0 bottom-0 left-1/3 w-[1px] bg-red-500/50 z-10 pointer-events-none"></div>
                      <div className={cn("h-3.5 bg-brand/20 flex items-center px-1 overflow-hidden", borderRadius, track === 1 ? "w-[95%] ml-0" : track === 2 ? "w-[75%] ml-4" : "w-[65%] ml-2")}>
                         {Array.from({length: 12}).map((_, i) => <div key={i} className="flex-1 mx-[1px] bg-brand/50 rounded-full" style={{height: `${30 + ((i * 17 + track * 11) % 70)}%`}}></div>)}
                      </div>
                    </div>
                 </div>
               ))}
            </div>

            <div className={cn("absolute inset-0 flex transition-all duration-700", showWorkspace && activeModule === "studio-3d" ? "opacity-100 scale-100 z-10" : "opacity-0 scale-95 z-0 pointer-events-none")}>
               <div className="w-8 h-full bg-surface-panel border-r border-border-soft flex flex-col items-center py-2 gap-1.5 shrink-0 z-20">
                  <div className="w-3.5 h-3.5 border border-text-muted bg-text-muted/10"></div>
                  <div className="w-3.5 h-3.5 rounded-full border border-text-muted"></div>
               </div>
               <div className="flex-1 relative flex items-center justify-center bg-surface-app/10 overflow-hidden">
                 {/* Floor Grid */}
                 <div className="absolute inset-0 [background-image:linear-gradient(to_right,#8882_1px,transparent_1px),linear-gradient(to_bottom,#8882_1px,transparent_1px)] [background-size:12px_12px] [transform:rotateX(60deg)_rotateZ(45deg)] scale-150 transform-gpu opacity-50"></div>

                 {/* 3D Wireframe Box */}
                 <div className="w-12 h-12 relative z-10 opacity-80">
                    {/* Top */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-[1.5px] border-brand/80 [transform:rotateX(60deg)_rotateZ(45deg)]"></div>
                    {/* Bottom */}
                    <div className="absolute top-4 left-0 w-8 h-8 border-[1.5px] border-brand/30 [transform:rotateX(60deg)_rotateZ(45deg)]"></div>
                    {/* Pillars */}
                    <div className="absolute top-2 left-[5px] w-[1.5px] h-4 bg-brand/50"></div>
                    <div className="absolute top-2 left-[27px] w-[1.5px] h-4 bg-brand/50"></div>
                    <div className="absolute top-5 left-[16px] w-[1.5px] h-4 bg-brand/50"></div>
                 </div>

                 {/* Fake 3D Gizmo */}
                 <div className="absolute top-2 right-2 w-6 h-6 z-20">
                   <div className="absolute top-1/2 left-1/2 w-[1px] h-3 bg-green-500 origin-bottom -translate-x-1/2 -translate-y-full" />
                   <div className="absolute top-1/2 left-1/2 w-3 h-[1px] bg-red-500 origin-left" />
                   <div className="absolute top-1/2 left-1/2 w-2.5 h-[1px] bg-blue-500 origin-left rotate-45" />
                 </div>
               </div>
            </div>

          </div>

          <div
            className={cn(
              "flex h-full shrink-0 flex-col border-l border-border bg-surface-panel transition-all duration-500",
              inspectorCollapsed ? "w-5 items-center p-1" : "w-10 p-1 sm:w-14 sm:p-1.5",
              gap,
            )}
          >
            <div className="relative flex w-full justify-center">
              <button
                type="button"
                disabled={!canToggleInspector}
                onClick={() => setRememberInspectorCollapsed((value) => !value)}
                className={cn(
                  "relative h-4 transition-all",
                  inspectorCollapsed ? "w-3" : "w-6 sm:w-8",
                  borderRadius,
                  canToggleInspector
                    ? "cursor-pointer bg-brand/25 ring-1 ring-brand/45 shadow-[0_0_12px_rgba(0,217,197,0.22)] hover:bg-brand/35"
                    : "cursor-default bg-text/35",
                )}
                title={canToggleInspector ? "点击模拟右栏折叠/展开" : "右栏状态由当前设置固定"}
              />
              {canToggleInspector ? (
                <span className="pointer-events-none absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-brand shadow-[0_0_10px_rgba(0,217,197,0.65)]" />
              ) : null}
            </div>
            {!inspectorCollapsed ? (
              <>
                <div className={cn("h-8 bg-surface-app ring-1 ring-border-soft", borderRadius)} />
                <div className={cn("h-4 bg-surface-muted", borderRadius)} />
                <div className={cn("h-4 bg-surface-muted", borderRadius)} />
                <div className={cn("mt-auto h-5 bg-brand/20 ring-1 ring-brand/20", borderRadius)} />
              </>
            ) : (
              <div className={cn("mt-2 h-14 w-2 bg-surface-muted", borderRadius)} />
            )}
          </div>
        </div>

        <div
          className={cn(
            "absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center transition-all duration-500 z-20",
            showPicker ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
        >
          <div className={cn("w-[70%] h-[70%] bg-surface-panel ring-1 ring-border shadow-popover flex flex-col p-2 transform transition-all duration-500 delay-100", borderRadius, showPicker ? "scale-100 translate-y-0" : "scale-95 translate-y-2")}>
             <div className="w-full flex justify-between items-center mb-2 px-1">
               <div className={cn("w-1/3 h-1.5 bg-text", borderRadius)} />
               <div className={cn("w-1/6 h-1.5 bg-surface-muted", borderRadius)} />
             </div>
             <div className="flex-1 grid grid-cols-2 gap-1.5">
               {[1,2,3,4].map(i => <div key={i} className={cn("bg-surface-app ring-1 ring-border-soft", borderRadius)} />)}
             </div>
          </div>
        </div>

        <div
          className={cn(
            "absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center transition-all duration-300 z-30",
            prefs.confirmationPreference === "strict" ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
        >
          <div className={cn("w-[50%] h-[40%] bg-surface-panel ring-1 ring-border flex flex-col justify-center items-center gap-2 shadow-popover transform transition-all duration-500", borderRadius, prefs.confirmationPreference === "strict" ? "scale-100 translate-y-0" : "scale-90 translate-y-2")}>
             <div className="w-5 h-5 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
               <AlertTriangle className="w-3 h-3" />
             </div>
             <div className={cn("w-2/3 h-1.5 bg-text transition-all", borderRadius)} />
             <div className="flex gap-1.5 mt-1">
                <div className={cn("w-6 h-2 bg-surface-muted transition-all", borderRadius)} />
                <div className={cn("w-6 h-2 bg-red-500 transition-all", borderRadius)} />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AssetDropPreview({ prefs }: { prefs: SettingsPreferences }) {

  const isDark = prefs.themePreference === "dark" || (prefs.themePreference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const ask = prefs.assetDropBehavior === "ask";
  const scan = prefs.assetReferenceCheck === "scan";

  const boxBg = isDark ? "bg-[#252526] border-[#444]" : "bg-white border-gray-200";

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => (t + 1) % 7), 1000);
    return () => clearInterval(timer);
  }, []);

  const fileX = tick <= 1 ? "16px" : ask ? "124px" : "232px";
  const fileOpacity = tick === 0 || tick >= 4 ? 0 : 1;

  const showDialog = ask && tick >= 3 && tick < 6;
  const flashFolder = !ask && tick === 3;

  const isScanning = scan && tick === 4;
  const showScanSuccess = scan && tick >= 5;

  return (
    <div className="flex flex-col items-center justify-center w-full gap-5 mt-2">
       <div className="flex items-center justify-between w-full max-w-[280px] relative">

          <div
             className="absolute top-4 z-20 w-8 h-8 rounded bg-brand flex items-center justify-center text-white shadow-md transition-all duration-700 ease-in-out"
             style={{ transform: `translateX(${fileX})`, opacity: fileOpacity }}
          >
             <Images className="w-4 h-4" />
          </div>

          <div className={cn("absolute left-1/2 -translate-x-1/2 -top-8 w-28 p-1.5 rounded shadow-xl border flex flex-col gap-1 transition-all duration-300 origin-bottom z-30",
             showDialog ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-50 translate-y-4 pointer-events-none",
             isDark ? "bg-[#333] border-[#444]" : "bg-white border-gray-200"
          )}>
             <div className="text-[10px] font-medium text-center mb-0.5 text-text">外部拖入资产</div>
             <div className="flex gap-1">
                <div className="flex-1 text-center bg-brand text-white text-[9px] py-0.5 rounded cursor-default">复制</div>
                <div className={cn("flex-1 text-center text-[9px] py-0.5 rounded cursor-default", isDark ? "bg-[#444] text-gray-300" : "bg-gray-100 text-gray-600")}>取消</div>
             </div>
          </div>

          <div className={cn("w-16 h-16 rounded-lg border-2 border-dashed flex flex-col items-center justify-center text-text-subtle", isDark ? "border-gray-600 bg-gray-800/50" : "border-gray-300 bg-gray-50")}>
             <Images className={cn("w-5 h-5 mb-1 transition-opacity", tick === 0 ? "opacity-70" : "opacity-30")} />
             <span className="text-[9px] font-medium">外部文件</span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center relative px-2">
             <div className="text-[10px] font-bold text-brand mb-1 whitespace-nowrap bg-brand/10 px-2 py-0.5 rounded-full border border-brand/20 shadow-sm">
                {ask ? "每次询问" : "自动复制"}
             </div>
             <div className="w-full h-[2px] bg-brand/40 relative flex items-center justify-end">
                <div className="w-2 h-2 border-t-2 border-r-2 border-brand/40 rotate-45 -mr-[1px]"></div>
             </div>
          </div>

          <div className={cn("w-16 h-16 rounded-lg border flex flex-col items-center justify-center shadow-sm text-text transition-all duration-300", boxBg, flashFolder ? "scale-110 border-brand text-brand" : "")}>
             <FolderCog className="w-5 h-5 mb-1" />
             <span className="text-[9px] font-medium">项目资产</span>
          </div>
       </div>

       <div className={cn("w-full max-w-[280px] p-2.5 rounded border relative transition-all duration-300", boxBg, isScanning ? "border-brand/50" : "")}>
          <div className="flex items-center justify-between">
             <div className="flex items-center gap-2 text-[11px] text-text-subtle">
                <RefreshCw className={cn("w-3.5 h-3.5", isScanning && "animate-spin text-brand")} /> 移动/删除检查
             </div>
             <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border transition-all duration-300",
               scan ? "text-gray-500 bg-gray-500/10 border-gray-500/20" : "text-gray-400 bg-transparent border-transparent"
             )}>
                {scan ? "扫描依赖" : "跳过检查"}
             </span>
          </div>

          <div className={cn("absolute bottom-[120%] left-1/2 -translate-x-1/2 w-48 p-1.5 rounded shadow-xl border flex flex-col gap-1 transition-all duration-300 origin-bottom z-30",
             isDark ? "bg-[#333] border-[#444]" : "bg-white border-gray-200",
             showScanSuccess ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-50 translate-y-4 pointer-events-none"
          )}>
             <div className="text-[10px] font-medium text-center text-orange-500 mb-0.5">⚠️ 发现依赖引用</div>
             <div className="text-[9px] text-center text-text-subtle mb-1">该资产被 'Scene_01' 等引用，是否继续？</div>
             <div className="flex gap-1">
                <div className="flex-1 text-center bg-orange-500 text-white text-[9px] py-0.5 rounded cursor-default">强制执行</div>
                <div className={cn("flex-1 text-center text-[9px] py-0.5 rounded cursor-default", isDark ? "bg-[#444] text-gray-300" : "bg-gray-100 text-gray-600")}>取消</div>
             </div>
          </div>
       </div>
    </div>
  );
}

export function TaskInspectorPreview({ prefs }: { prefs: SettingsPreferences }) {
  const isDark = prefs.themePreference === "dark" || (prefs.themePreference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const bg = isDark ? "bg-[#252526]" : "bg-white";
  const border = isDark ? "border-[#333]" : "border-gray-200";
  const headerBg = isDark ? "bg-[#2d2d2d]" : "bg-gray-100";

  const defaultTab = prefs.taskDefaultPanel;
  const autoErrors = prefs.autoOpenErrors;
  const notify = prefs.failureNotifications;
  const refresh = prefs.taskCompletionRefresh;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => (t + 1) % 6), 1200);
    return () => clearInterval(timer);
  }, []);

  const isFailed = tick >= 2;
  const showTab = (autoErrors && tick >= 3) ? "errors" : defaultTab;
  const showNotification = notify && tick >= 3 && tick < 5;

  const progress = tick === 0 ? 0 : 65;
  const statusLabel = isFailed ? "FAILED" : "RUNNING";
  const statusColor = isFailed ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500";
  const barColor = isFailed ? "bg-red-500" : "bg-brand";
  const timeStr = tick === 0 ? "0s" : tick === 1 ? "1m 24s" : "1m 25s";

  const tabStyle = (tabId: string) => cn(
    "flex-1 text-center py-2 border-b-2 text-[11px] font-medium transition-all duration-300",
    showTab === tabId ? "text-brand border-brand" : isDark ? "text-gray-500 border-transparent" : "text-gray-400 border-transparent"
  );

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className={cn("w-full max-w-[320px] h-[260px] rounded-lg border shadow-sm flex flex-col overflow-hidden transition-all duration-300 relative", bg, border, (showTab === "errors" && tick === 3) ? "ring-2 ring-red-500/50" : "")}>

         <div className={cn("absolute top-12 left-1/2 -translate-x-1/2 w-[240px] p-2 rounded shadow-xl border flex items-center gap-2 z-50 transition-all duration-300",
            isDark ? "bg-[#333] border-[#444]" : "bg-white border-gray-200",
            showNotification ? "opacity-100 translate-y-0 scale-100" : "opacity-0 -translate-y-4 scale-95 pointer-events-none"
         )}>
            <div className="w-6 h-6 rounded bg-red-500/20 text-red-500 flex items-center justify-center shrink-0">
               <Bell className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col">
               <span className="text-[10px] font-bold text-text">任务执行失败</span>
               <span className="text-[9px] text-text-subtle">Build Model_X 发生异常</span>
            </div>
         </div>

         <div className={cn("flex items-center justify-between px-3 py-2 border-b transition-colors", headerBg, border)}>
            <div className="text-[12px] font-medium text-text">任务详情</div>
            <div className="relative">
               <Bell className={cn("w-3.5 h-3.5 transition-colors duration-300", notify ? (showNotification ? "text-red-500 animate-pulse" : "text-brand") : "text-gray-400 opacity-50")} />
            </div>
         </div>

         <div className={cn("flex border-b", border)}>
           <div className={tabStyle("status")}>状态</div>
           <div className={tabStyle("logs")}>日志</div>
           <div className={tabStyle("errors")}>错误</div>
         </div>

         <div className="flex-1 flex flex-col p-3 relative h-full">
            {showTab === "status" && (
               <div className="flex flex-col gap-3 h-full">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className={cn("w-6 h-6 rounded bg-brand/10 text-brand flex items-center justify-center")}>
                           <Cpu className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                           <div className="text-[11px] font-medium text-text">Build Model_X</div>
                           <div className="text-[9px] text-text-subtle">ID: TASK-8492</div>
                        </div>
                     </div>
                     <span className={cn("px-1.5 py-0.5 rounded-full text-[9px] font-bold transition-colors", statusColor)}>{statusLabel}</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                     <div className="flex justify-between text-[10px] text-text-subtle">
                        <span>进度</span>
                        <span>{progress}%</span>
                     </div>
                     <div className={cn("w-full h-1.5 rounded-full overflow-hidden", isDark ? "bg-[#333]" : "bg-gray-200")}>
                        <div className={cn("h-full transition-all duration-500", barColor)} style={{ width: `${progress}%` }}></div>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-1">
                     <div className={cn("p-1.5 rounded flex flex-col gap-0.5 transition-colors", isDark ? "bg-[#333]" : "bg-gray-100", isFailed ? "opacity-70" : "")}>
                        <span className="text-[9px] text-text-subtle">已耗时</span>
                        <span className="text-[11px] font-medium text-text">{timeStr}</span>
                     </div>
                     <div className={cn("p-1.5 rounded flex flex-col gap-0.5 transition-colors", isDark ? "bg-[#333]" : "bg-gray-100", isFailed ? "opacity-70" : "")}>
                        <span className="text-[9px] text-text-subtle">预估剩余</span>
                        <span className="text-[11px] font-medium text-text">{isFailed ? "--" : "~2m 10s"}</span>
                     </div>
                  </div>

                  {refresh !== "off" && (
                     <div className="mt-auto self-start flex items-center gap-1.5 text-[9px] text-brand bg-brand/10 px-1.5 py-1 rounded border border-brand/20">
                        <RefreshCw className="w-2.5 h-2.5" />
                        完成后刷新资产
                     </div>
                  )}
               </div>
            )}

            {showTab === "logs" && (
               <div className={cn("flex flex-col gap-1.5 font-mono text-[9px] leading-relaxed p-2 rounded h-full", isDark ? "bg-[#1e1e1e] text-gray-400" : "bg-gray-50 text-gray-500")}>
                  <div className="flex gap-2">
                     <span className="opacity-50">14:02:11</span>
                     <span>[INFO] Starting build...</span>
                  </div>
                  {tick >= 1 && (
                    <div className="flex gap-2">
                       <span className="opacity-50">14:02:12</span>
                       <span>[INFO] Analyzing dependencies...</span>
                    </div>
                  )}
                  {tick >= 2 && (
                    <div className="flex gap-2">
                       <span className="opacity-50">14:02:15</span>
                       <span className="text-red-500">[ERROR] Module not found!</span>
                    </div>
                  )}
               </div>
            )}

            {showTab === "errors" && (
               <div className="flex flex-col gap-2">
                  {isFailed ? (
                     <>
                        <div className="flex gap-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-500">
                           <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5"></div>
                           <div className="flex flex-col gap-1">
                              <span className="font-bold text-[11px]">Error: Module not found</span>
                              <span className="opacity-90">Cannot resolve dependency 'React' in /src/components</span>
                           </div>
                        </div>
                        <div className={cn("w-full py-1.5 mt-2 text-center text-[10px] font-medium rounded border cursor-default transition-colors", isDark ? "border-[#444] text-gray-300 bg-[#333]" : "border-gray-300 text-gray-700 bg-gray-100")}>
                           查看原始错误
                        </div>
                     </>
                  ) : (
                     <div className="flex items-center justify-center h-20 text-[10px] text-text-subtle">
                        暂无错误
                     </div>
                  )}
               </div>
            )}
         </div>
      </div>

      <div className={cn("mt-4 text-[10px] flex items-center gap-1.5 transition-opacity duration-300", autoErrors ? "text-text-subtle opacity-100" : "text-gray-500 opacity-30")}>
         <Info className={cn("w-3.5 h-3.5", autoErrors ? "text-brand" : "text-current")} /> 失败任务会自动切到错误页签
      </div>
    </div>
  );
}

export function WorkspaceDefaultsPreview({ prefs, setPref }: { prefs: SettingsPreferences, setPref: <K extends keyof SettingsPreferences>(key: K, val: SettingsPreferences[K]) => void }) {
  const isDark = prefs.themePreference === "dark" || (prefs.themePreference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const cardBg = isDark ? "bg-[#1e1e1e] border-[#333]" : "bg-white border-gray-200";
  const hoverBg = isDark ? "hover:bg-[#252526] hover:border-brand/50" : "hover:bg-gray-50 hover:border-brand/40";
  const artBg = isDark ? "bg-[#2d2d2d]" : "bg-gray-100";

  return (
    <div className="grid grid-cols-2 gap-4 p-5 border-b border-border-soft bg-surface-muted/10">

       <div className={cn("flex flex-col p-4 rounded-xl border shadow-sm transition-all cursor-default relative overflow-hidden max-h-[210px]", cardBg, hoverBg)}>
          <div className="absolute right-[-10px] top-[-10px] w-24 h-24 opacity-10 flex items-center justify-center pointer-events-none text-current">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-20 h-20 rotate-12">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>

          <div className="flex items-center gap-2 text-[13px] font-bold text-text mb-3 z-10">
            <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-500"><Images className="w-4 h-4" /></div> 图像生成
          </div>
          <div className="flex-1 flex flex-col gap-2 z-10 overflow-y-auto custom-scrollbar pr-1">
            <div className={cn("flex justify-between items-center text-[11px] py-1.5 px-2 rounded shrink-0", artBg)}>
               <span className="text-text-subtle font-medium">默认模型</span>
               <SelectField
                 id="imageModel"
                 value={prefs.imageModel}
                 onChange={(v) => setPref("imageModel", v as SettingsPreferences["imageModel"])}
                 options={[{label: "自动", value: "auto"}, {label: "NanoBanana", value: "nanobanana"}, {label: "GPT", value: "gpt"}]}
                 className="w-auto min-w-[120px] h-auto min-h-0 text-[11px] px-1 py-0 gap-1 border-none bg-transparent shadow-none focus:ring-0 focus:border-transparent hover:border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-right justify-end"
               />
            </div>
            <div className={cn("flex justify-between items-center text-[11px] py-1.5 px-2 rounded shrink-0", artBg)}>
               <span className="text-text-subtle font-medium">清晰度</span>
               <SelectField
                 id="imageResolution"
                 value={prefs.imageResolution}
                 onChange={(v) => setPref("imageResolution", v as SettingsPreferences["imageResolution"])}
                 options={[{label: "0.5K", value: "0.5K"}, {label: "1K", value: "1K"}, {label: "2K", value: "2K"}, {label: "4K", value: "4K"}]}
                 className="w-auto min-w-[120px] h-auto min-h-0 text-[11px] px-1 py-0 gap-1 border-none bg-transparent shadow-none focus:ring-0 focus:border-transparent hover:border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-right justify-end"
               />
            </div>
            <div className={cn("flex justify-between items-center text-[11px] py-1.5 px-2 rounded shrink-0", artBg)}>
               <span className="text-text-subtle font-medium">推理深度</span>
               <SelectField
                 id="imageThinkingLevel"
                 value={prefs.imageThinkingLevel}
                 onChange={(v) => setPref("imageThinkingLevel", v as SettingsPreferences["imageThinkingLevel"])}
                 options={[{label: "极速", value: "minimal"}, {label: "深度", value: "high"}]}
                 className="w-auto min-w-[120px] h-auto min-h-0 text-[11px] px-1 py-0 gap-1 border-none bg-transparent shadow-none focus:ring-0 focus:border-transparent hover:border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-right justify-end"
               />
            </div>
          </div>
       </div>

       <div className={cn("flex flex-col p-4 rounded-xl border shadow-sm transition-all cursor-default relative overflow-hidden max-h-[210px]", cardBg, hoverBg)}>
          <div className="absolute right-0 top-0 w-24 h-24 opacity-10 flex items-center justify-center pointer-events-none text-current">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-16 h-16 rotate-6">
               <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
               <line x1="7" y1="2" x2="7" y2="22"></line>
               <line x1="17" y1="2" x2="17" y2="22"></line>
               <line x1="2" y1="12" x2="22" y2="12"></line>
               <line x1="2" y1="7" x2="7" y2="7"></line>
               <line x1="2" y1="17" x2="7" y2="17"></line>
               <line x1="17" y1="17" x2="22" y2="17"></line>
               <line x1="17" y1="7" x2="22" y2="7"></line>
             </svg>
          </div>

          <div className="flex items-center gap-2 text-[13px] font-bold text-text mb-3 z-10">
            <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-500"><PlaySquare className="w-4 h-4" /></div> 视频生成
          </div>
          <div className="flex-1 flex flex-col gap-2 z-10 overflow-y-auto custom-scrollbar pr-1">
            <div className={cn("flex justify-between items-center text-[11px] py-1.5 px-2 rounded shrink-0", artBg)}>
               <span className="text-text-subtle font-medium">默认模型</span>
               <SelectField
                 id="videoModel"
                 value={prefs.videoModel}
                 onChange={(v) => setPref("videoModel", v as SettingsPreferences["videoModel"])}
                 options={[{label: "默认", value: "default"}, {label: "极速模式", value: "fast"}]}
                 className="w-auto min-w-[120px] h-auto min-h-0 text-[11px] px-1 py-0 gap-1 border-none bg-transparent shadow-none focus:ring-0 focus:border-transparent hover:border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-right justify-end"
               />
            </div>
            <div className={cn("flex justify-between items-center text-[11px] py-1.5 px-2 rounded shrink-0", artBg)}>
               <span className="text-text-subtle font-medium">分辨率</span>
               <SelectField
                 id="videoResolution"
                 value={prefs.videoResolution}
                 onChange={(v) => setPref("videoResolution", v as SettingsPreferences["videoResolution"])}
                 options={[{label: "480p", value: "480p"}, {label: "720p", value: "720p"}]}
                 className="w-auto min-w-[120px] h-auto min-h-0 text-[11px] px-1 py-0 gap-1 border-none bg-transparent shadow-none focus:ring-0 focus:border-transparent hover:border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-right justify-end"
               />
            </div>
            <div className={cn("flex justify-between items-center text-[11px] py-1.5 px-2 rounded shrink-0", artBg)}>
               <span className="text-text-subtle font-medium">生成配套音效</span>
               <SelectField
                 id="videoGenerateAudio"
                 value={prefs.videoGenerateAudio ? "true" : "false"}
                 onChange={(v) => setPref("videoGenerateAudio", v === "true")}
                 options={[{label: "是", value: "true"}, {label: "否", value: "false"}]}
                 className="w-auto min-w-[120px] h-auto min-h-0 text-[11px] px-1 py-0 gap-1 border-none bg-transparent shadow-none focus:ring-0 focus:border-transparent hover:border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-right justify-end"
               />
            </div>
            <div className={cn("flex justify-between items-center text-[11px] py-1.5 px-2 rounded shrink-0", artBg)}>
               <span className="text-text-subtle font-medium flex-1 mr-2">启用联网搜索补充上下文</span>
               <SelectField
                 id="videoEnableWebSearch"
                 value={prefs.videoEnableWebSearch ? "true" : "false"}
                 onChange={(v) => setPref("videoEnableWebSearch", v === "true")}
                 options={[{label: "是", value: "true"}, {label: "否", value: "false"}]}
                 className="w-auto shrink-0 min-w-[120px] h-auto min-h-0 text-[11px] px-1 py-0 gap-1 border-none bg-transparent shadow-none focus:ring-0 focus:border-transparent hover:border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-right justify-end"
               />
            </div>
          </div>
       </div>

       <div className={cn("flex flex-col p-4 rounded-xl border shadow-sm transition-all cursor-default relative overflow-hidden max-h-[210px]", cardBg, hoverBg)}>
          <div className="absolute right-2 top-2 w-24 h-24 opacity-10 flex items-center justify-center pointer-events-none text-current">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-16 h-16 -rotate-6">
              <path d="M9 18V5l12-2v13"></path>
              <circle cx="6" cy="18" r="3"></circle>
              <circle cx="18" cy="16" r="3"></circle>
            </svg>
          </div>

          <div className="flex items-center gap-2 text-[13px] font-bold text-text mb-3 z-10">
            <div className="p-1.5 rounded-md bg-green-500/10 text-green-500"><Globe className="w-4 h-4" /></div> 音乐与音效
          </div>
          <div className="flex-1 flex flex-col gap-2 z-10 overflow-y-auto custom-scrollbar pr-1">
            <div className={cn("flex justify-between items-center text-[11px] py-1.5 px-2 rounded shrink-0", artBg)}>
               <span className="text-text-subtle font-medium">引擎版本</span>
               <SelectField
                 id="musicModel"
                 value={prefs.musicModel}
                 onChange={(v) => setPref("musicModel", v as SettingsPreferences["musicModel"])}
                 options={[{label: "V3.5", value: "V3_5"}, {label: "V4", value: "V4"}, {label: "V4.5", value: "V4_5"}, {label: "V5", value: "V5"}]}
                 className="w-auto min-w-[120px] h-auto min-h-0 text-[11px] px-1 py-0 gap-1 border-none bg-transparent shadow-none focus:ring-0 focus:border-transparent hover:border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-right justify-end"
               />
            </div>
            <div className={cn("flex justify-between items-center text-[11px] py-1.5 px-2 rounded shrink-0", artBg)}>
               <span className="text-text-subtle font-medium">纯音乐</span>
               <SelectField
                 id="musicInstrumental"
                 value={prefs.musicInstrumental ? "true" : "false"}
                 onChange={(v) => setPref("musicInstrumental", v === "true")}
                 options={[{label: "是", value: "true"}, {label: "否", value: "false"}]}
                 className="w-auto min-w-[120px] h-auto min-h-0 text-[11px] px-1 py-0 gap-1 border-none bg-transparent shadow-none focus:ring-0 focus:border-transparent hover:border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-right justify-end"
               />
            </div>
          </div>
       </div>

       <div className={cn("flex flex-col p-4 rounded-xl border shadow-sm transition-all cursor-default relative overflow-hidden max-h-[210px]", cardBg, hoverBg)}>
          <div className="absolute right-0 top-0 w-24 h-24 opacity-10 pointer-events-none" style={{ backgroundImage: "linear-gradient(currentcolor 1px, transparent 1px), linear-gradient(90deg, currentcolor 1px, transparent 1px)", backgroundSize: "8px 8px", transform: "perspective(100px) rotateX(60deg) rotateZ(45deg)" }}></div>

          <div className="flex items-center gap-2 text-[13px] font-bold text-text mb-3 z-10">
            <div className="p-1.5 rounded-md bg-orange-500/10 text-orange-500"><Box className="w-4 h-4" /></div> 3D 模型
          </div>
          <div className="flex-1 flex flex-col gap-2 z-10 overflow-y-auto custom-scrollbar pr-1">
            <div className={cn("flex justify-between items-center text-[11px] py-1.5 px-2 rounded shrink-0", artBg)}>
               <span className="text-text-subtle font-medium">贴图质量</span>
               <SelectField
                 id="model3dTextureQuality"
                 value={prefs.model3dTextureQuality}
                 onChange={(v) => setPref("model3dTextureQuality", v as SettingsPreferences["model3dTextureQuality"])}
                 options={[{label: "标准", value: "standard"}, {label: "精细", value: "detailed"}]}
                 className="w-auto min-w-[120px] h-auto min-h-0 text-[11px] px-1 py-0 gap-1 border-none bg-transparent shadow-none focus:ring-0 focus:border-transparent hover:border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-right justify-end"
               />
            </div>
            <div className={cn("flex justify-between items-center text-[11px] py-1.5 px-2 rounded shrink-0", artBg)}>
               <span className="text-text-subtle font-medium">骨骼绑定</span>
               <SelectField
                 id="model3dRig"
                 value={prefs.model3dRig ? "true" : "false"}
                 onChange={(v) => setPref("model3dRig", v === "true")}
                 options={[{label: "是", value: "true"}, {label: "否", value: "false"}]}
                 className="w-auto min-w-[120px] h-auto min-h-0 text-[11px] px-1 py-0 gap-1 border-none bg-transparent shadow-none focus:ring-0 focus:border-transparent hover:border-transparent hover:bg-black/5 dark:hover:bg-white/5 text-right justify-end"
               />
            </div>
          </div>
       </div>
    </div>
  );
}
