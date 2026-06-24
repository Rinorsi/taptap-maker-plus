export const ContextMenuStyles = {
  content:
    "context-menu-container z-[9999] min-w-[160px] max-w-[280px] max-h-[min(420px,calc(100vh-24px))] overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl border border-white/10 bg-surface-panel/95 backdrop-blur-xl p-1.5 shadow-[0_16px_70px_-10px_rgba(0,0,0,0.5)] ring-1 ring-white/5 animate-in fade-in zoom-in-95 duration-100 scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent",
  item: "group flex w-full cursor-pointer select-none items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium outline-none transition-all duration-200 text-text hover:bg-brand/15 hover:text-brand-strong data-[highlighted]:bg-brand/15 data-[highlighted]:text-brand-strong",
  disabledItem:
    "flex w-full select-none items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium text-text-muted/50",
  separator: "h-px bg-border/50 mx-2 my-1.5",
  label:
    "px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-widest text-text-muted/60",
};
