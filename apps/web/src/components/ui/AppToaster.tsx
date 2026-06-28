import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      theme="system"
      closeButton
      offset={{ top: 72 }}
      toastOptions={{
        closeButtonAriaLabel: "关闭提示",
        style: {
          backgroundColor: "var(--surface-panel)",
          borderColor: "var(--color-border)",
          color: "var(--color-text)",
          boxShadow: "var(--shadow-popover)",
          backdropFilter: "blur(16px)",
        },
        classNames: {
          toast: "group min-h-0 w-[min(440px,calc(100vw-32px))] border border-border text-text ring-1 ring-white/5 rounded-xl",
          title: "text-text text-[13px] font-semibold",
          description: "!text-text-muted text-[12px] leading-5",
          content: "gap-0.5",
          icon: "text-brand",
          closeButton: "!border-border !bg-surface-raised !text-text-muted hover:!bg-surface-muted hover:!text-text",
          actionButton: "bg-brand text-white font-medium",
          cancelButton: "bg-surface-muted text-text font-medium"
        }
      }}
    />
  );
}
