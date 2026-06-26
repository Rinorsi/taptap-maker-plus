import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="bottom-right"
      theme="dark"
      closeButton
      toastOptions={{
        classNames: {
          toast: "group border-border bg-surface-panel text-text shadow-popover rounded-xl",
          title: "text-text font-medium",
          description: "text-text-muted",
          actionButton: "bg-brand text-white font-medium",
          cancelButton: "bg-surface-muted text-text font-medium"
        }
      }}
    />
  );
}
