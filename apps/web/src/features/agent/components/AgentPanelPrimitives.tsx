import type { ReactNode } from "react";
import { cn } from "../../../lib/utils";

export function AgentSection({ icon, title, actions, children, className }: { icon?: ReactNode; title: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex min-h-0 flex-col overflow-hidden bg-transparent", className)}>
      <div className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3">
        <div className="flex min-w-0 items-center gap-2">
          {icon ? <div className="text-zinc-500">{icon}</div> : null}
          <h2 className="m-0 truncate text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{title}</h2>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function AgentInfoRow({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "bad" | "neutral" | "good" }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 px-3 py-1.5 border-b border-white/5 hover:bg-white/5 transition-colors">
      <span className="shrink-0 text-[11px] font-medium text-zinc-500">{label}</span>
      <strong
        className={cn(
          "min-w-0 truncate text-right text-[11px] font-mono",
          tone === "bad" ? "text-red-400" : tone === "good" ? "text-emerald-400" : "text-zinc-300"
        )}
        title={value}
      >
        {value}
      </strong>
    </div>
  );
}

export function AgentMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "brand" | "good" | "bad" | "neutral" }) {
  return (
    <div className={cn(
      "min-w-0 border-l-2 pl-3 py-1",
      tone === "brand" ? "border-blue-500" : tone === "good" ? "border-emerald-500" : tone === "bad" ? "border-red-500" : "border-zinc-700"
    )}>
      <span className="block text-[10px] font-medium uppercase text-zinc-500">{label}</span>
      <strong className="block truncate text-sm font-semibold text-zinc-200">{value}</strong>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <p className="m-0 text-sm font-semibold text-text">{title}</p>
        {body ? <p className="m-0 mt-2 text-xs leading-5 text-text-muted">{body}</p> : null}
      </div>
    </div>
  );
}
