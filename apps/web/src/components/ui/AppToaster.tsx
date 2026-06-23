import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "border-border bg-surface-panel text-text shadow-popover",
          title: "text-text",
          description: "text-text-muted",
          actionButton: "bg-brand text-[#04202a]",
          cancelButton: "bg-surface-muted text-text"
        }
      }}
    />
  );
}
