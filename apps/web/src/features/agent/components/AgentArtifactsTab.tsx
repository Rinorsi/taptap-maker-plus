import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  LoaderCircle,
  MessageSquare,
  PanelTop,
  Play,
  Sparkles,
  Undo2,
} from "lucide-react";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TooltipIconButton } from "../assistant-ui/TooltipIconButton";
import { cn } from "../../../lib/utils";
import type { AgentActionPreviewRecord, PiAgentRuntimeStatus } from "../api";
import type { ProjectSummary, RuntimeStatus } from "../../../api";

type AgentArtifactsTabProps = {
  selectedProject?: ProjectSummary;
  runtimeStatus: RuntimeStatus;
  pi?: PiAgentRuntimeStatus;
  pendingPreviews: AgentActionPreviewRecord[];
};

export function AgentArtifactsTab({
  selectedProject,
  runtimeStatus,
  pi,
  pendingPreviews,
}: AgentArtifactsTabProps) {
  const piConnected = Boolean(pi?.connected);

  return (
    <div className="flex h-full min-h-0 flex-col bg-agent-bg text-agent-text">
      <div className="flex h-[36px] shrink-0 items-center justify-between px-3 border-b border-agent-border-soft bg-agent-panel">
        <div className="flex items-center gap-2">
          <PanelTop className="h-3.5 w-3.5 text-agent-muted" />
          <h2 className="truncate text-[12px] font-medium text-agent-text">
            {selectedProject?.name ? `${selectedProject.name} Artifact` : "Untitled Artifact"}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="flex items-center gap-1.5 px-2 text-[10px] text-agent-subtle">
            {piConnected ? <CheckCircle2 className="h-3 w-3 text-agent-accent" /> : <LoaderCircle className="h-3 w-3 animate-spin" />}
            {piConnected ? "Saved" : "Saving..."}
          </span>
          <div className="flex items-center ml-2 border-l border-agent-border-soft pl-2 gap-0.5">
            <button
              type="button"
              disabled
              className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-agent-subtle hover:bg-agent-surface hover:text-agent-text disabled:opacity-50"
              title="Previous version"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-1 text-[10px] text-agent-muted font-mono">
              v1
            </span>
            <button
              type="button"
              disabled
              className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-agent-subtle hover:bg-agent-surface hover:text-agent-text disabled:opacity-50"
              title="Next version"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto bg-[#1e1e1e] text-[#d4d4d4] font-mono text-[13px] leading-relaxed p-6 selection:bg-[#264f78]">
        <div className="max-w-[800px] mx-auto relative pt-4 pb-32">
           <div className="flex">
             <div className="flex flex-col text-right pr-6 text-[#858585] select-none opacity-60">
               {mockCode.split('\n').map((_, i) => (
                 <span key={i} className="min-h-[22px]">{i + 1}</span>
               ))}
             </div>
             <div className="whitespace-pre flex-1 font-mono">
               {mockCode.split('\n').map((line, i) => {
                  let coloredLine = line
                    .replace(/function|const|new|return|if/g, '<span class="text-[#569cd6]">$&</span>')
                    .replace(/['"].*?['"]/g, '<span class="text-[#ce9178]">$&</span>')
                    .replace(/\b(document|window|console)\b/g, '<span class="text-[#4ec9b0]">$&</span>')
                    .replace(/\/\/.*/g, '<span class="text-[#6a9955]">$&</span>')
                    .replace(/(\w+)(?=\()/g, '<span class="text-[#dcdcaa]">$&</span>');
                  
                  const isSelected = i >= 8 && i <= 12;
                  
                  return (
                    <div key={i} className={cn("relative min-h-[22px]", isSelected && "bg-[#264f78]/50 ring-1 ring-[#264f78]")}>
                      <span dangerouslySetInnerHTML={{ __html: coloredLine || ' ' }} />
                    </div>
                  );
               })}
             </div>
           </div>

           <AnimatePresence>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="absolute left-[340px] top-[180px] z-20 w-[300px] rounded-[14px] border border-agent-border bg-agent-panel shadow-popover p-2 flex flex-col gap-2 font-sans"
            >
              <div className="text-[12px] font-medium text-agent-text px-1 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-agent-accent" />
                <span>Ask Agent about selection</span>
              </div>
              <textarea 
                className="w-full resize-none rounded-control border border-agent-border-soft bg-agent-bg p-2.5 text-[12px] text-agent-text outline-none focus:border-agent-accent/40 focus:ring-1 focus:ring-agent-accent/40 placeholder:text-agent-subtle"
                rows={2}
                placeholder="E.g. Explain how this selection works..."
              />
              <div className="flex justify-end gap-1.5">
                 <button className="h-7 px-3 rounded-full bg-agent-surface text-[11px] font-medium text-agent-muted hover:text-agent-text hover:bg-agent-border-soft transition-colors">Cancel</button>
                 <button className="h-7 px-3 rounded-full bg-agent-text text-[11px] font-medium text-agent-bg hover:opacity-85 transition-opacity shadow-sm">Ask Agent</button>
              </div>
            </motion.div>
           </AnimatePresence>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 font-sans">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 400, damping: 30 }}
            className="flex items-center gap-1 rounded-full border border-agent-border bg-agent-panel/85 p-1 backdrop-blur-xl shadow-popover"
          >
            <TooltipIconButton tooltip="Rewrite (Sparkles)" className="h-9 w-9 rounded-full text-agent-muted hover:bg-agent-surface hover:text-agent-text">
              <Sparkles className="h-4 w-4" />
            </TooltipIconButton>
            <TooltipIconButton tooltip="Add comments" className="h-9 w-9 rounded-full text-agent-muted hover:bg-agent-surface hover:text-agent-text">
              <MessageSquare className="h-4 w-4" />
            </TooltipIconButton>
            <TooltipIconButton tooltip="Format code" className="h-9 w-9 rounded-full text-agent-muted hover:bg-agent-surface hover:text-agent-text">
              <Code2 className="h-4 w-4" />
            </TooltipIconButton>
            <div className="w-px h-4 bg-agent-border mx-1" />
            <TooltipIconButton tooltip="Undo" className="h-9 w-9 rounded-full text-agent-muted hover:bg-agent-surface hover:text-agent-text">
              <Undo2 className="h-4 w-4" />
            </TooltipIconButton>
            <TooltipIconButton tooltip="Execute action" className="h-9 w-9 rounded-full text-agent-accent hover:bg-agent-accent/15 bg-agent-accent/10 ml-0.5">
              <Play className="h-4 w-4 fill-current" />
            </TooltipIconButton>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

const mockCode = `function generateCanvasLayout() {
  const container = document.createElement('div');
  container.className = 'canvas-layout';
  
  // Initialize floating toolbar
  const toolbar = new FloatingToolbar();
  toolbar.addAction('rewrite', SparklesIcon);
  toolbar.addAction('comment', MessageSquareIcon);
  
  // Handle text selection
  container.addEventListener('mouseup', (e) => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      showAskOpenCanvasUI(e.clientX, e.clientY);
    }
  });

  return container;
}`;
