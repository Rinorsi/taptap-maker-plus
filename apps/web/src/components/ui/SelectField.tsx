import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

type Option = {
  value: string;
  label: string;
};

type Props = {
  id: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
};

function suppressContextMenu(event: React.MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export function SelectField({ id, value, options, onChange, className, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const reposition = () => updateMenuPosition();
    window.addEventListener("pointerdown", close);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  function updateMenuPosition() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom;
    const maxHeight = 220;
    const openUp = spaceBelow < 180 && rect.top > spaceBelow;
    setMenuStyle({
      position: "fixed",
      left: rect.left,
      top: openUp ? undefined : rect.bottom + 4,
      bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
      width: rect.width,
      maxHeight
    });
  }

  function toggleOpen() {
    updateMenuPosition();
    setOpen((current) => !current);
  }

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-3 rounded-control border border-border bg-surface-panel px-3 py-1.5 text-left text-sm text-text shadow-sm outline-none transition-colors hover:border-brand/40 focus:border-brand focus:ring-1 focus:ring-brand/30",
          open && "border-brand ring-1 ring-brand/30"
        )}
        onClick={toggleOpen}
        onContextMenu={suppressContextMenu}
      >
        <span className="min-w-0 truncate">{selected?.label ?? ""}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-text-subtle transition-transform", open && "rotate-180 text-brand-strong")} />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div
          role="listbox"
          className="z-[9999] overflow-y-auto rounded-card border border-border bg-surface-panel p-1 text-sm text-text shadow-popover"
          style={menuStyle}
          onPointerDown={(e) => {
             e.stopPropagation();
          }}
          onContextMenu={suppressContextMenu}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-control px-2.5 py-2 text-left transition-colors hover:bg-surface-muted",
                  active && "bg-brand/10 text-brand-strong"
                )}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                onContextMenu={suppressContextMenu}
              >
                <span className="min-w-0 truncate">{option.label}</span>
                {active && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
