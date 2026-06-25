import { motion } from "framer-motion";
import { Clock, X } from "lucide-react";
import { Button } from "../ui/Button";

type TaskProgressBarProps = {
  elapsedSeconds: number;
  estimatedSeconds?: number;
  status?: "queued" | "running";
  phase?: string;
  showCancel?: boolean;
  onCancel?: () => void;
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function TaskProgressBar({
  elapsedSeconds,
  estimatedSeconds,
  status = "running",
  phase,
  showCancel = false,
  onCancel,
}: TaskProgressBarProps) {
  const hasEstimate = estimatedSeconds !== undefined && estimatedSeconds > 0;
  const progress = hasEstimate
    ? Math.min(100, (elapsedSeconds / estimatedSeconds) * 100)
    : 0;
  const remainingSeconds = hasEstimate
    ? Math.max(0, estimatedSeconds - elapsedSeconds)
    : 0;

  return (
    <div className="w-full bg-surface-raised rounded-2xl p-6 shadow-inner border border-white/5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-brand">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-bold">
            已用时: {formatTime(elapsedSeconds)}
          </span>
          {phase && (
            <span className="text-xs font-bold text-text-muted ml-2">
              · {phase}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {hasEstimate && (
            <span className="text-xs font-bold text-text-muted">
              剩余 {formatTime(remainingSeconds)}
            </span>
          )}
          {showCancel && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-7 px-2 text-text-muted hover:text-red-500"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="h-2 w-full bg-surface-app rounded-full overflow-hidden">
        {hasEstimate ? (
          <motion.div
            className="h-full bg-brand transition-all ease-linear"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        ) : (
          <motion.div
            className="h-full bg-brand w-1/3"
            animate={{
              x: ["-100%", "300%"],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </div>
    </div>
  );
}