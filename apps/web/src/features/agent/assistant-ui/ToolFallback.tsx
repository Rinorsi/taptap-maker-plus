import {
  AlertCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  LoaderIcon,
  XCircleIcon,
} from "lucide-react";
import { memo, useState } from "react";
import {
  type ToolApprovalOption,
  type ToolCallMessagePart,
  type ToolCallMessagePartComponent,
  type ToolCallMessagePartProps,
  type ToolCallMessagePartStatus,
  useToolCallElapsed,
} from "@assistant-ui/react";
import { Button } from "../../../components/ui/Button";
import { cn } from "../../../lib/utils";

type ToolStatus = ToolCallMessagePartStatus["type"];

const statusIconMap: Record<ToolStatus, React.ElementType> = {
  running: LoaderIcon,
  complete: CheckIcon,
  incomplete: XCircleIcon,
  "requires-action": AlertCircleIcon,
};

const formatToolDuration = (ms: number) => {
  if (ms < 1000) return "<1s";
  const seconds = ms / 1000;
  if (seconds < 10) return `${(Math.floor(seconds * 10) / 10).toFixed(1)}s`;
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
};

function ToolFallbackDuration() {
  const elapsedMs = useToolCallElapsed();
  if (elapsedMs === undefined) return null;
  return <span className="text-xs tabular-nums text-text-subtle">{formatToolDuration(elapsedMs)}</span>;
}

const approvalLabels: Record<string, string> = {
  "allow-once": "允许一次",
  "allow-always": "始终允许",
  "reject-once": "拒绝一次",
  "reject-always": "始终拒绝",
};

const isAllowKind = (kind: string) => kind === "allow-once" || kind === "allow-always";
const approvalOptionLabel = (option: ToolApprovalOption) => option.label ?? approvalLabels[option.kind] ?? option.id;

function ToolApproval({
  addResult,
  resume,
  interrupt,
  approval,
  respondToApproval,
}: Partial<Pick<ToolCallMessagePartProps, "addResult" | "resume" | "respondToApproval">> & {
  interrupt?: ToolCallMessagePart["interrupt"];
  approval?: ToolCallMessagePart["approval"];
}) {
  const [submitted, setSubmitted] = useState(false);
  if (approval != null && (approval.approved !== undefined || approval.resolution !== undefined)) return null;

  const declaredOptions = respondToApproval ? approval?.options : undefined;
  const options = declaredOptions?.filter((option) => Object.hasOwn(approvalLabels, option.kind));

  const respond = (approved: boolean) => {
    if (submitted) return;
    if (approval != null && approval.approved === undefined && respondToApproval) {
      respondToApproval({ approved });
    } else if (interrupt) {
      resume?.({ approved });
    } else {
      addResult?.(approved ? "用户已允许执行" : "用户已拒绝执行");
    }
    setSubmitted(true);
  };

  const respondWithOption = (option: ToolApprovalOption) => {
    if (submitted) return;
    respondToApproval?.({ optionId: option.id });
    setSubmitted(true);
  };

  if (declaredOptions && declaredOptions.length > 0) {
    const allowOptions = options?.filter((option) => isAllowKind(option.kind)) ?? [];
    const rejectOptions = options?.filter((option) => !isAllowKind(option.kind)) ?? [];
    return (
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {[...allowOptions, ...rejectOptions].map((option) => (
          <Button
            key={option.id}
            size="sm"
            variant={isAllowKind(option.kind) ? "default" : "outline"}
            onClick={() => respondWithOption(option)}
            disabled={submitted}
          >
            {approvalOptionLabel(option)}
          </Button>
        ))}
        {rejectOptions.length === 0 ? (
          <Button size="sm" variant="outline" onClick={() => respond(false)} disabled={submitted}>
            拒绝
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 pt-1">
      <Button size="sm" onClick={() => respond(true)} disabled={submitted}>
        允许
      </Button>
      <Button size="sm" variant="outline" onClick={() => respond(false)} disabled={submitted}>
        拒绝
      </Button>
    </div>
  );
}

const ToolFallbackImpl: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
  addResult,
  resume,
  interrupt,
  approval,
  respondToApproval,
}) => {
  const isRequiresAction = status?.type === "requires-action";
  const [open, setOpen] = useState(isRequiresAction);
  const statusType = status?.type ?? "complete";
  const Icon = statusIconMap[statusType];
  const error = status?.type === "incomplete" ? status.error : undefined;
  const errorText = error ? (typeof error === "string" ? error : JSON.stringify(error)) : "";

  return (
    <div className="aui-tool-fallback-root w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[13px] mt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 text-left text-zinc-400 transition hover:text-zinc-200"
      >
        <Icon className={cn("h-4 w-4 shrink-0", statusType === "running" ? "animate-spin" : "")} />
        <span className="min-w-0 flex-1 truncate">
          工具调用: <b>{toolName}</b>
        </span>
        <ToolFallbackDuration />
        <ChevronDownIcon className={cn("h-4 w-4 shrink-0 transition", open ? "rotate-0" : "-rotate-90")} />
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-2 ps-6">
          {errorText ? (
            <div>
              <p className="m-0 text-xs font-semibold text-[#b03939]">错误</p>
              <p className="m-0 mt-1 whitespace-pre-wrap break-words text-xs text-text-muted">{errorText}</p>
            </div>
          ) : null}
          {argsText ? (
            <pre className="m-0 max-h-56 overflow-auto rounded-xl bg-black/50 border border-white/10 px-3 py-2 text-[11px] text-zinc-300 font-mono">
              {argsText}
            </pre>
          ) : null}
          {isRequiresAction ? (
            <ToolApproval
              addResult={addResult}
              resume={resume}
              interrupt={interrupt}
              approval={approval}
              respondToApproval={respondToApproval}
            />
          ) : null}
          {result !== undefined ? (
            <pre className="m-0 max-h-56 overflow-auto rounded-xl bg-black/50 border border-white/10 px-3 py-2 text-[11px] text-zinc-300 font-mono">
              {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export const ToolFallback = memo(ToolFallbackImpl) as ToolCallMessagePartComponent;
