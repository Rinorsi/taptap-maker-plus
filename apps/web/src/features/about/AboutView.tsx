import { ExternalLink, Info, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { appVersion } from "../../generated/appVersion";

export function AboutView() {
  return (
    <div className="flex h-full min-h-0 overflow-y-auto text-text">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-10 py-12">
        <div className="flex items-center gap-3">
          <img src="/files.png" alt="TapTap Maker Plus" className="h-12 w-12 rounded-xl object-contain shadow-sm" />
          <div>
            <h1 className="m-0 text-2xl font-bold text-text">TapTap Maker Plus</h1>
            <p className="m-0 mt-1 text-sm text-text-subtle">{appVersion.displayVersion} · {appVersion.channel}</p>
          </div>
        </div>

        <section className="rounded-xl border border-border-soft bg-surface-panel p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="m-0 text-base font-bold text-text">项目介绍</h2>
              <p className="m-0 mt-2 text-sm leading-relaxed text-text-muted">
                TapTap Maker Plus 是面向 TapTap Maker 项目的本地桌面工作台，聚合项目管理、素材库、MCP Runtime、生成任务、图像/视频/音频/3D 工作室和多模态画布能力。
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <InfoCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="免责声明"
            body="当前仍处于 Alpha 测试阶段，功能、数据结构和更新流程会继续调整。重要项目请保留独立备份。"
          />
          <InfoCard
            icon={<Info className="h-5 w-5" />}
            title="许可证"
            body="MIT License"
          />
          <InfoCard
            icon={<Mail className="h-5 w-5" />}
            title="开发组成员"
            body="云诺羲Rinorsi · Rinorsi@163.com"
          />
          <InfoCard
            icon={<ExternalLink className="h-5 w-5" />}
            title="更新与公告"
            body="版本记录和安装包通过 GitHub Releases 发布；设置页提供检查、选择版本和下载安装入口。"
          />
        </div>

        <section className="rounded-xl border border-border-soft bg-surface-panel p-5">
          <h2 className="m-0 text-base font-bold text-text">本版本说明</h2>
          <p className="m-0 mt-2 text-sm leading-relaxed text-text-muted">{appVersion.announcementBody}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {appVersion.announcements.map((item) => (
              <div key={item.title} className="rounded-lg border border-border-soft bg-surface-app/60 p-3">
                <div className="text-[13px] font-bold text-text">{item.title}</div>
                <p className="m-0 mt-1 text-xs leading-relaxed text-text-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <section className="rounded-xl border border-border-soft bg-surface-panel p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-text-muted">
          {icon}
        </div>
        <div>
          <h2 className="m-0 text-sm font-bold text-text">{title}</h2>
          <p className="m-0 mt-1 text-xs leading-relaxed text-text-muted">{body}</p>
        </div>
      </div>
    </section>
  );
}
