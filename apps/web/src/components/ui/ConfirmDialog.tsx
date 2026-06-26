import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./Button";
import { useEffect, useState, type ReactNode } from "react";

export type ConfirmConfig = {
  isOpen: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  secondaryLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  requiredText?: string;
  requiredTextLabel?: string;
  onConfirm: () => void;
  onSecondary?: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ config }: { config: ConfirmConfig }) {
  const [requiredTextInput, setRequiredTextInput] = useState("");
  const canConfirm = !config.requiredText || requiredTextInput === config.requiredText;

  useEffect(() => {
    if (config.isOpen) setRequiredTextInput("");
  }, [config.isOpen, config.requiredText]);

  return (
    <Dialog.Root
      open={config.isOpen}
      onOpenChange={(open) => {
        if (!open) config.onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm animate-in fade-in duration-150" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[10000] flex max-h-[78vh] w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-white/10 bg-surface-panel/95 p-5 shadow-[0_16px_70px_-10px_rgba(0,0,0,0.5)] ring-1 ring-white/5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          <Dialog.Title className="m-0 text-base font-bold text-text">
            {config.title}
          </Dialog.Title>
          {config.body ? (
            <Dialog.Description className="mt-3 max-h-[44vh] overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
              {config.body}
            </Dialog.Description>
          ) : null}
          {config.requiredText ? (
            <label className="mt-4 flex flex-col gap-2 text-xs font-semibold text-text-subtle">
              <span>{config.requiredTextLabel ?? "输入确认文本"}</span>
              <input
                value={requiredTextInput}
                onChange={(event) => setRequiredTextInput(event.currentTarget.value)}
                className="h-9 rounded-control border border-border bg-surface-muted px-3 font-mono text-xs text-text outline-none focus:border-brand"
                spellCheck={false}
                autoComplete="off"
              />
            </label>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={config.onCancel}>
              {config.cancelLabel ?? "取消"}
            </Button>
            {config.secondaryLabel && config.onSecondary ? (
              <Button type="button" variant="outline" onClick={config.onSecondary}>
                {config.secondaryLabel}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="default"
              className={
                config.danger
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : undefined
              }
              disabled={!canConfirm}
              onClick={config.onConfirm}
            >
              {config.confirmLabel ?? "确认"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
