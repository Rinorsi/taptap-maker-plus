import { useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { XCircle } from "lucide-react";
import type { AppAnnouncementSummary } from "../../api";
import { Button } from "../../components/ui/Button";
import { appVersion } from "../../generated/appVersion";

const ANNOUNCEMENT_READ_STORAGE_KEY = "taptap.readAnnouncementIds";
const LEGACY_ANNOUNCEMENT_READ_STORAGE_KEY = "taptap.readAnnouncementId";

export type AnnouncementContent = {
  id: string;
  title: string;
  summary: string;
  markdown: string;
  publishedAt: string;
  source: "cloud" | "local";
};

export function useAppAnnouncements({
  announcements,
  announcement,
}: {
  announcements?: AppAnnouncementSummary[];
  announcement?: AppAnnouncementSummary;
}) {
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>(() => readAnnouncementReadIds());
  const announcementContents = useMemo(
    () => resolveAnnouncementContents(announcements, announcement),
    [announcement, announcements],
  );
  const announcementUnread = announcementContents.some((item) => !readAnnouncementIds.includes(item.id));
  const markAnnouncementsRead = () => {
    setReadAnnouncementIds((current) =>
      writeAnnouncementReadIds([
        ...current,
        ...announcementContents.map((item) => item.id),
      ]),
    );
  };

  return {
    announcementContents,
    announcementUnread,
    readAnnouncementIds,
    markAnnouncementsRead,
  };
}

function readAnnouncementReadIds() {
  const raw = localStorage.getItem(ANNOUNCEMENT_READ_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string" && Boolean(item));
      }
    } catch {
      return [];
    }
  }
  const legacyId = localStorage.getItem(LEGACY_ANNOUNCEMENT_READ_STORAGE_KEY);
  return legacyId ? [legacyId] : [];
}

function writeAnnouncementReadIds(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  localStorage.setItem(ANNOUNCEMENT_READ_STORAGE_KEY, JSON.stringify(uniqueIds));
  localStorage.removeItem(LEGACY_ANNOUNCEMENT_READ_STORAGE_KEY);
  return uniqueIds;
}

function toCloudAnnouncementContent(announcement: AppAnnouncementSummary): AnnouncementContent {
  return {
    id: announcement.id,
    title: announcement.title,
    summary: announcement.summary,
    markdown: announcement.markdown,
    publishedAt: announcement.publishedAt,
    source: "cloud",
  };
}

function resolveAnnouncementContents(announcements?: AppAnnouncementSummary[], announcement?: AppAnnouncementSummary): AnnouncementContent[] {
  const cloudAnnouncements = announcements?.length ? announcements : announcement ? [announcement] : [];
  if (cloudAnnouncements.length) return cloudAnnouncements.map(toCloudAnnouncementContent);
  return [
    {
      id: `${appVersion.displayVersion}:${appVersion.announcementMarkdown}`,
      title: appVersion.announcementTitle,
      summary: appVersion.announcementBody,
      markdown: appVersion.announcementMarkdown,
      publishedAt: new Date().toISOString(),
      source: "local",
    },
  ];
}

function renderInlineMarkdown(text: string) {
  const html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="text-text font-bold">$1</strong>')
    .replace(/`(.*?)`/g, '<code class="bg-surface-muted text-brand px-1.5 py-0.5 rounded text-[13px] border border-border-soft font-mono">$1</code>');

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function MiniMarkdown({ content, skipFirstHeading }: { content: string; skipFirstHeading?: string }) {
  let skippedHeading = false;
  const lines = content.split("\n").filter((line) => line.trim() !== "");

  return (
    <div className="flex flex-col text-[15px] text-text-muted leading-relaxed">
      {lines.map((line, index) => {
        if (skipFirstHeading && !skippedHeading && line.startsWith("## ") && line.includes(skipFirstHeading)) {
          skippedHeading = true;
          return null;
        }
        if (line.startsWith("## ")) {
          return (
            <h2 key={index} className={`text-text font-bold text-[20px] mb-4 leading-tight flex items-center gap-2.5 ${index > 0 ? "mt-10" : "mt-0"}`}>
              <div className="w-1.5 h-5 bg-brand rounded-full"></div>
              {line.replace("## ", "")}
            </h2>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h3 key={index} className={`text-text font-bold text-[17px] mb-3 leading-tight ${index > 0 ? "mt-8" : "mt-0"}`}>
              {line.replace("### ", "")}
            </h3>
          );
        }
        if (line.startsWith("> ")) {
          return (
            <blockquote key={index} className="border-l-[3px] border-brand/50 bg-brand/5 pl-5 py-3.5 text-text-subtle mt-4 mb-6 rounded-r-lg text-[14px]">
              {renderInlineMarkdown(line.replace("> ", ""))}
            </blockquote>
          );
        }
        if (line.startsWith("* ")) {
          return (
            <div key={index} className="flex items-start gap-3 ml-2 mt-2">
              <span className="text-brand mt-[8px] text-[10px] opacity-80">●</span>
              <span className="flex-1">{renderInlineMarkdown(line.replace("* ", ""))}</span>
            </div>
          );
        }
        return (
          <p key={index} className="m-0 mb-5">
            {renderInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

function formatAnnouncementDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function startAnnouncementWindowDrag(event: React.PointerEvent<HTMLElement>) {
  if (event.button !== 0) return;
  if (
    event.target instanceof HTMLElement &&
    event.target.closest("button, input, textarea, select, a")
  ) {
    return;
  }
  getCurrentWindow().startDragging().catch(() => undefined);
}

export function AnnouncementDialog({
  announcements,
  readAnnouncementIds,
  onClose,
}: {
  announcements: AnnouncementContent[];
  readAnnouncementIds: string[];
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(() => announcements[0]?.id ?? "");
  const selectedAnnouncement = announcements.find((item) => item.id === selectedId) ?? announcements[0];

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 px-6 backdrop-blur-[4px] animate-in fade-in duration-200">
      <div className="flex h-[75vh] w-full max-w-[960px] overflow-hidden rounded-panel bg-surface-panel shadow-popover animate-in zoom-in-[0.98] duration-200 relative ring-1 ring-border-soft">
        <aside className="flex w-[260px] shrink-0 flex-col border-r border-border-soft bg-surface-app">
          <div
            className="flex h-[80px] shrink-0 cursor-grab items-center px-6 active:cursor-grabbing"
            onPointerDown={startAnnouncementWindowDrag}
            title="拖动窗口"
          >
            <h2 className="m-0 text-[18px] font-bold text-text flex items-center gap-2">
              <svg className="w-5 h-5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line></svg>
              公告中心
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-2">
            <div className="flex flex-col gap-1.5">
              {announcements.map((item) => {
                const active = selectedAnnouncement?.id === item.id;
                const unread = !readAnnouncementIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`flex w-full flex-col rounded-control px-4 py-3.5 text-left transition-colors ${
                      active ? "bg-brand/10 text-brand" : "text-text-muted hover:bg-surface-muted hover:text-text"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {unread ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" /> : null}
                      <span className="min-w-0 flex-1 text-[14px] font-bold line-clamp-1">
                        {item.title}
                      </span>
                      <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[9px] font-bold text-text-subtle">
                        {item.source === "cloud" ? "云端" : "本地"}
                      </span>
                    </span>

                    <span className="mt-1.5 text-[12px] font-medium opacity-80 font-mono">
                      {formatAnnouncementDate(item.publishedAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="relative flex min-w-0 flex-1 flex-col bg-surface-panel overflow-hidden">
          <div
            className="relative shrink-0 cursor-grab px-12 pt-14 pb-8 border-b border-border-soft flex justify-between items-start gap-4 active:cursor-grabbing"
            onPointerDown={startAnnouncementWindowDrag}
            title="拖动窗口"
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center rounded-control bg-brand px-2 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider">
                  官方动态
                </span>
                <span className="inline-flex items-center rounded-control border border-border-soft bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-text-subtle">
                  {selectedAnnouncement.source === "cloud" ? "云端" : "本地"}
                </span>
                <span className="text-[13px] text-text-subtle font-mono">
                  {formatAnnouncementDate(selectedAnnouncement.publishedAt)}
                </span>
              </div>
              <h3 className="m-0 text-[32px] font-bold leading-tight text-text tracking-tight">
                {selectedAnnouncement.title}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              onPointerDown={(event) => event.stopPropagation()}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-surface-muted text-text-muted transition-colors hover:bg-border-soft hover:text-text"
              title="关闭公告"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-12 py-10 scrollbar-thin">
            {selectedAnnouncement ? (
              <MiniMarkdown content={selectedAnnouncement.markdown} skipFirstHeading={selectedAnnouncement.title} />
            ) : null}
          </div>

          <div className="shrink-0 border-t border-border-soft bg-surface-panel p-6 flex justify-end">
            <Button onClick={onClose} size="lg" className="px-10 text-[15px]">
              我知道了
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
