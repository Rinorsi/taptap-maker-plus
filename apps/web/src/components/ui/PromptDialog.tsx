import * as Dialog from "@radix-ui/react-dialog";
import { useState, useEffect, useRef } from "react";
import { Button } from "./Button";
import { Input } from "./Input";

export type PromptConfig = {
  isOpen: boolean;
  title: string;
  defaultValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
};

export function PromptDialog({ config }: { config: PromptConfig }) {
  const [value, setValue] = useState(config.defaultValue || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (config.isOpen) {
      setValue(config.defaultValue || "");
      // Focus input on next tick when dialog mounts
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [config.isOpen, config.defaultValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      config.onConfirm(value.trim());
    }
  };

  return (
    <Dialog.Root open={config.isOpen} onOpenChange={(open) => !open && config.onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[10000] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-surface-panel/95 p-6 shadow-[0_16px_70px_-10px_rgba(0,0,0,0.5)] ring-1 ring-white/5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
          <Dialog.Title className="text-lg font-bold text-text mb-4">
            {config.title}
          </Dialog.Title>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="bg-surface-app border-white/10 focus-visible:ring-brand"
            />
            <div className="flex justify-end gap-3 mt-2">
              <Button type="button" variant="outline" onClick={config.onCancel}>
                取消
              </Button>
              <Button type="submit" disabled={!value.trim()}>
                {config.confirmLabel || "确认"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
