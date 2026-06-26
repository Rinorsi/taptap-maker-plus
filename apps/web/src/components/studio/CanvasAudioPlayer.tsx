import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils";

function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

export function CanvasAudioPlayer({
  src,
  autoPlay,
  compact,
  className,
}: {
  src: string;
  autoPlay?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    setIsPlaying(false);
    setDuration(0);
    setCurrentTime(0);
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !autoPlay) return;
    void audio.play();
  }, [autoPlay, src]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      return;
    }
    audio.pause();
  };

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-xl border border-border-soft/70 bg-surface-panel/40 px-2.5 py-2",
        compact ? "rounded-lg px-2 py-1.5" : "py-2.5",
        className,
      )}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      <button
        type="button"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg border border-brand/30 bg-brand/12 text-brand transition-colors hover:bg-brand hover:text-white active:bg-brand-strong",
          compact ? "h-8 w-8" : "h-9 w-9",
        )}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          togglePlayback();
        }}
        title={isPlaying ? "暂停" : "播放"}
      >
        {isPlaying ? (
          <Pause className={cn("fill-current", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        ) : (
          <Play className={cn("ml-0.5 fill-current", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        )}
      </button>
      <div className="min-w-0 flex-1 pt-0.5">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={duration ? currentTime : 0}
          className="canvas-audio-player-range nodrag h-2 w-full accent-brand"
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => {
            const nextTime = Number(event.currentTarget.value);
            if (audioRef.current) audioRef.current.currentTime = nextTime;
            setCurrentTime(nextTime);
          }}
          aria-label="音频进度"
          style={{
            background: `linear-gradient(90deg, var(--color-brand) ${progress}%, rgba(255,255,255,0.16) ${progress}%)`,
          }}
        />
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-text-muted">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{formatAudioTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
