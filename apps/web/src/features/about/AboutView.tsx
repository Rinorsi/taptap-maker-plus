import { Heart, Scale, Mail, Sparkles, Users, MessageSquare } from "lucide-react";
import { appVersion } from "../../generated/appVersion";
import React from "react";

function DevBackgroundSVG() {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-64 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000 z-0">
      <div className="absolute top-1/2 right-10 w-32 h-32 bg-brand/5 rounded-full blur-2xl -translate-y-1/2"></div>
      <svg viewBox="0 0 256 120" preserveAspectRatio="xMaxYMid slice" className="absolute right-0 top-0 w-full h-full text-brand/30">
        <path d="M -50 60 C 50 60, 100 30, 200 30" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" className="animate-[dash-flow_2s_linear_infinite]" />
        <path d="M 80 60 C 150 60, 180 90, 220 90" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-50" />

        <g fill="currentColor">
          {/* Using GPU-accelerated CSS opacity and scale animations via Tailwind */}
          <circle cx="200" cy="30" r="3.5" className="animate-pulse" style={{ animationDuration: '2s' }} />

          <circle cx="80" cy="60" r="4.5" className="animate-ping" style={{ transformOrigin: '80px 60px', animationDuration: '3s' }} />
          <circle cx="80" cy="60" r="3" />

          <circle cx="220" cy="90" r="3" className="animate-pulse" style={{ animationDuration: '3s', animationDelay: '1s' }} />
        </g>
      </svg>
      <style>{`
        @keyframes dash-flow {
          from { stroke-dashoffset: 8; }
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}

function IntroBackgroundSVG() {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-64 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-1000 z-0">
      <div className="absolute top-1/2 right-10 w-32 h-32 bg-brand/5 rounded-full blur-2xl -translate-y-1/2"></div>
      <svg viewBox="0 0 256 120" preserveAspectRatio="xMaxYMid slice" className="absolute right-0 top-0 w-full h-full text-brand/20">
        <g stroke="currentColor" strokeWidth="0.5" fill="none">
          {/* GPU accelerated CSS rotation using transform-origin */}
          <g className="origin-[180px_60px] animate-[spin_30s_linear_infinite]">
            <polygon points="180,30 206,45 206,75 180,90 154,75 154,45" />
            <polygon points="180,20 214.6,40 214.6,80 180,100 145.4,80 145.4,40" strokeDasharray="2 4" />
          </g>
          <g className="origin-[180px_60px] animate-[spin_20s_linear_infinite_reverse]">
            <circle cx="180" cy="60" r="50" strokeDasharray="1 6" />
          </g>
        </g>
      </svg>
    </div>
  );
}

export function AboutView() {
  return (
    <div className="flex h-full min-h-0 overflow-y-auto text-text bg-surface">
      <div className="mx-auto flex w-full max-w-[640px] flex-col px-8 py-16">

        {/* Simple & Clean Hero */}
        <div className="flex flex-col items-center justify-center text-center mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="relative group mb-6 cursor-default">
            <div className="absolute -inset-2 bg-brand/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
            <img src="/files.png" alt="TapTap Maker Plus" className="relative h-20 w-20 rounded-2xl object-contain shadow-sm border border-border-soft group-hover:scale-105 group-hover:rotate-3 transition-transform duration-500" />
          </div>
          <h1 className="m-0 text-3xl font-bold text-text tracking-tight mb-3 transition-colors hover:text-brand duration-300">TapTap Maker Plus</h1>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-surface-muted border border-border-soft text-text-subtle text-[11px] font-bold tracking-wider hover:border-brand/40 hover:text-brand transition-colors duration-300">
              {appVersion.displayVersion}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-surface-muted border border-border-soft text-text-subtle text-[11px] font-bold tracking-wider uppercase hover:border-brand/40 hover:text-brand transition-colors duration-300">
              {appVersion.channel}
            </span>
          </div>
        </div>

        {/* Document Flow Sections */}
        <div className="flex flex-col gap-6">

          <Section icon={<Sparkles className="h-4 w-4" />} title="项目介绍" delay={100} bgSvg={<IntroBackgroundSVG />}>
            <p>
              TapTap Maker Plus 是面向 TapTap Maker 项目的本地桌面工作台，聚合项目管理、素材库、MCP Runtime、生成任务、图像/视频/音频/3D 工作室和多模态画布能力。
            </p>
            <p className="mt-2">
              当前仍处于 Alpha 测试阶段，核心功能、数据结构和更新流程会伴随测试反馈持续调整，请务必为重要项目保留独立备份。
            </p>
          </Section>

          <Section icon={<MessageSquare className="h-4 w-4" />} title="作者的话" delay={200}>
            <p>
              大家好啊，这里是云诺羲~这是一个清澈愚蠢的大学生的项目，所以项目有问题欢迎大家敲打！请大家多多支持 TapTap 制造 Plus，谢谢喵！
            </p>
          </Section>

          <Section icon={<Users className="h-4 w-4" />} title="开发组与贡献者" delay={300} bgSvg={<DevBackgroundSVG />}>
            <div className="flex flex-col gap-2 relative z-10">
              <div className="group/item flex items-center transition-colors hover:bg-surface-muted/50 backdrop-blur-sm p-1.5 -ml-1.5 rounded-md">
                <strong className="text-text group-hover/item:text-brand transition-colors">主程序开发</strong>
                <span className="mx-2 text-border">·</span>
                <span className="text-text-subtle">云诺羲Rinorsi</span>
              </div>
              <div className="group/item flex items-center transition-colors hover:bg-surface-muted/50 backdrop-blur-sm p-1.5 -ml-1.5 rounded-md">
                <strong className="text-text group-hover/item:text-brand transition-colors">本月代码贡献鸣谢</strong>
                <span className="mx-2 text-border">·</span>
                <span className="text-text-subtle italic">[近期 PR 贡献者占位...]</span>
              </div>
            </div>
          </Section>

          <Section icon={<Heart className="h-4 w-4 text-rose-500 animate-pulse" />} title="鸣谢与捐赠" delay={400}>
            <p>
              感谢所有在社区提供反馈、报告 Bug 以及捐赠支持的开发者们。你们的支持是我们持续迭代更新的动力！
            </p>
            <div className="mt-3 group/donation relative overflow-hidden rounded-lg bg-surface-muted/30 p-4 border border-border-soft text-[13px] text-text-subtle text-center italic transition-all duration-500 hover:border-rose-500/30 hover:bg-rose-500/5 hover:shadow-[0_0_20px_rgba(244,63,94,0.1)]">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/10 to-transparent -translate-x-full group-hover/donation:animate-[shimmer_2s_infinite]"></div>
              [ 赞助者名单 / 捐赠二维码 / 感谢语 占位区 ]
            </div>
          </Section>

          <Section icon={<MessageSquare className="h-4 w-4" />} title="反馈与联系方式" delay={500}>
            <ul className="list-disc list-inside space-y-1 text-text-subtle relative z-10">
              <li>
                <strong className="text-text font-normal">邮箱：</strong>{" "}
                <a href="mailto:Rinorsi@163.com" className="text-brand hover:underline hover:text-brand-strong transition-colors ml-1">Rinorsi@163.com</a>
              </li>
              <li>
                <strong className="text-text font-normal">GitHub Issues：</strong>{" "}
                <span className="ml-1 cursor-pointer hover:text-brand transition-colors">[仓库反馈链接占位]</span>
              </li>
            </ul>
          </Section>

        </div>

        {/* Centered Footer */}
        <div className="mt-12 mb-8 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500 fill-mode-both">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-surface-muted/50 mb-3 text-text-muted hover:text-brand hover:bg-brand/10 transition-all duration-300 hover:rotate-12 hover:scale-110 cursor-default">
            <Scale className="h-5 w-5" />
          </div>
          <div className="text-text font-bold mb-1 tracking-wide">MIT License</div>
          <p className="text-[12px] text-text-subtle opacity-60">
            Copyright (c) 2026 Rinorsi & TapTap Maker Contributors.
          </p>
        </div>

      </div>
    </div>
  );
}

function Section({ icon, title, children, delay, bgSvg }: { icon: React.ReactNode; title: string; children: React.ReactNode; delay: number; bgSvg?: React.ReactNode }) {
  return (
    <section
      className="group relative flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 fill-mode-both duration-700 rounded-2xl border border-transparent hover:border-brand/10 hover:bg-brand/[0.02] p-5 -mx-5 transition-all duration-500 overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      {bgSvg}
      <div className="relative z-10 flex items-center gap-2 border-b border-border-soft pb-2 transition-colors duration-300 group-hover:border-brand/30">
        <div className="text-text-muted transition-all duration-500 group-hover:text-brand group-hover:scale-110 group-hover:-rotate-12">
          {icon}
        </div>
        <h2 className="m-0 text-base font-bold text-text transition-colors duration-300 group-hover:text-text-strong">{title}</h2>
      </div>
      <div className="relative z-10 text-[13px] leading-relaxed text-text-subtle transition-colors duration-300 group-hover:text-text-muted">
        {children}
      </div>
    </section>
  );
}
