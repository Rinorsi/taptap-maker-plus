import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { CheckCircle2, ChevronDown, FolderSearch, LogIn, PackageCheck, Plus, RefreshCw, X, AlertTriangle, Cloud, Info } from "lucide-react";
import { motion } from "framer-motion";
import {
  bindExistingOnboardingProject,
  confirmMakerProjectsRootSettings,
  getMakerTokenOnboarding,
  getMakerProjectsRootSettings,
  getMcpPackageStatus,
  initCloudOnboardingProject,
  installMcpPackage,
  listMakerCloudProjects,
  loginMakerOnboarding,
  saveMakerProjectsRootSettings,
  setMakerTokenOnboarding,
  type MakerCloudProject,
  type MakerProjectsRootSettings,
  type McpPackageUpdateStatus,
  type ProjectSummary,
} from "../../api";
import { Button } from "../../components/ui/Button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/Select";
import { cn } from "../../lib/utils";

type Props = {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onProjectsChanged: (projects: ProjectSummary[], selectedProjectId?: string) => void;
  onSelectProject: (projectId: string) => void;
};

type StepState = "idle" | "working" | "done" | "error";

type InitPrompt = {
  targetDir: string;
  message: string;
};

export function FirstRunOnboarding({ open: isOpen, busy, onClose, onProjectsChanged, onSelectProject }: Props) {
  const [rootSettings, setRootSettings] = useState<MakerProjectsRootSettings>();
  const [rootDraft, setRootDraft] = useState("");
  const [projectDirDraft, setProjectDirDraft] = useState("");
  const [packageStatus, setPackageStatus] = useState<McpPackageUpdateStatus>();
  const [selectedPackageVersion, setSelectedPackageVersion] = useState("");
  const [packageState, setPackageState] = useState<StepState>("idle");
  const [refreshing, setRefreshing] = useState(false);
  const [rootState, setRootState] = useState<StepState>("idle");
  const [loginState, setLoginState] = useState<StepState>("idle");
  const [projectState, setProjectState] = useState<StepState>("idle");
  const [manualToken, setManualToken] = useState("");
  const [manualTokenOpen, setManualTokenOpen] = useState(false);
  const [cloudProjects, setCloudProjects] = useState<MakerCloudProject[]>([]);
  const [selectedCloudProjectId, setSelectedCloudProjectId] = useState("");
  const [notice, setNotice] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [initPrompt, setInitPrompt] = useState<InitPrompt>();

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    getMakerProjectsRootSettings()
      .then((response) => {
        if (cancelled) return;
        setRootSettings(response.settings);
        setRootDraft(response.settings.rootPath);
        setProjectDirDraft(response.settings.rootPath);
        setRootState(response.settings.confirmed ? "done" : "idle");
      })
      .catch((error) => {
        if (!cancelled) {
          setNotice(error instanceof Error ? error.message : String(error));
          setRootState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || packageStatus || packageState === "working") return;
    void refreshPackageStatus();
  }, [isOpen, packageStatus, packageState]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    getMakerTokenOnboarding()
      .then((response) => {
        if (!cancelled && response.token) setManualToken(response.token);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const working = busy || rootState === "working" || packageState === "working" || loginState === "working" || projectState === "working";
  const hasBoundProject = projects.length > 0 || projectState === "done";
  const canEnterWorkbench = rootState === "done" && packageState === "done" && loginState === "done" && hasBoundProject;
  const packageVersions = packageStatus?.availableVersions ?? [];
  const packageVersionOptions = [...packageVersions].reverse();
  const installButtonLabel = packageStatus?.localInstalled ? "重装" : "安装";

  function requestClose() {
    onClose();
  }

  function handleClosePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    requestClose();
  }

  function requestEnterWorkbench() {
    if (!canEnterWorkbench) {
      setNotice("请先完成首次启动配置，至少需要绑定或拉取一个 Maker 游戏项目后才能进入工作台。");
      if (!hasBoundProject) setProjectState((current) => current === "done" ? current : "error");
      return;
    }
    onClose();
  }

  async function chooseDirectory(title: string, defaultPath?: string) {
    try {
      const selected = await open({
        title,
        directory: true,
        multiple: false,
        defaultPath,
        canCreateDirectories: true,
      });
      return typeof selected === "string" ? selected : undefined;
    } catch {
      return window.prompt(title, defaultPath ?? "") ?? undefined;
    }
  }

  async function handleChooseRoot() {
    const selected = await chooseDirectory("选择 Maker 项目总目录", rootDraft || rootSettings?.defaultRootPath);
    if (!selected) return;
    setRootDraft(selected);
    await confirmRootPath(selected);
  }

  async function confirmRootPath(rootPath: string) {
    const nextRoot = rootPath.trim();
    if (!nextRoot) return;
    setRootState("working");
    setNotice("正在确认 Maker 项目总目录...");
    try {
      const saved = nextRoot === rootSettings?.rootPath
        ? await confirmMakerProjectsRootSettings()
        : await saveMakerProjectsRootSettings(nextRoot);
      const confirmed = saved.settings.confirmed ? saved : await confirmMakerProjectsRootSettings();
      setRootSettings(confirmed.settings);
      setRootDraft(confirmed.settings.rootPath);
      setProjectDirDraft(confirmed.settings.rootPath);
      if (saved.projects) {
        setProjects(saved.projects);
        onProjectsChanged(saved.projects, saved.selectedProjectId);
        if (saved.selectedProjectId) setProjectState("done");
      }
      setRootState("done");
      setNotice(`已确认项目总目录：${confirmed.settings.rootPath}`);
    } catch (error) {
      setRootState("error");
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  async function refreshPackageStatus() {
    setPackageState("working");
    setNotice("正在检查 @taptap/maker 云端版本...");
    try {
      const response = await getMcpPackageStatus(true);
      const status = response.status;
      setPackageStatus(status);
      setSelectedPackageVersion(status.latestVersion ?? status.availableVersions.at(-1) ?? status.currentVersion ?? "");
      if (status.registryError) {
        if (status.localInstalled) {
          setPackageState("done");
          setNotice(`本地 MCP 已安装，版本 ${status.currentVersion ?? "未知"}；云端版本暂时无法获取：${status.registryError}`);
          return;
        }
        throw new Error(`本地 MCP 未安装，云端版本无法获取：${status.registryError}`);
      }
      setPackageState(status.localInstalled ? "done" : "idle");
      setNotice(status.localInstalled
        ? `本地 MCP 已安装，版本 ${status.currentVersion ?? "未知"}。`
        : "本地 MCP 未安装，请选择云端版本后安装。");
    } catch (error) {
      setPackageState("error");
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleInstallSelectedPackageVersion() {
    const version = selectedPackageVersion.trim();
    const packageName = packageStatus?.packageName;
    if (!packageName || !version) {
      setNotice("请先检查云端版本，并选择要安装的 MCP 版本。");
      return;
    }
    if (packageStatus?.localInstalled) {
      const confirmed = window.confirm(`本地已有 MCP ${packageStatus.currentVersion ?? "未知版本"}，是否重新安装 ${version}？`);
      if (!confirmed) return;
    }
    setPackageState("working");
    setNotice(`正在安装 MCP：${packageName}@${version}`);
    try {
      const result = await installMcpPackage(`${packageName}@${version}`);
      setPackageStatus(result.status);
      setSelectedPackageVersion(result.status.currentVersion ?? version);
      setPackageState("done");
      setNotice(`已安装 MCP：${result.status.packageSpec}`);
    } catch (error) {
      setPackageState("error");
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleLogin() {
    setLoginState("working");
    setNotice("正在启动 Maker 登录流程...");
    try {
      const response = await loginMakerOnboarding();
      setLoginState("done");
      setNotice(formatCliNotice("登录流程已完成", response.cli.stdout, response.cli.stderr));
      await refreshCloudProjects();
    } catch (error) {
      setLoginState("error");
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  async function handleSaveToken() {
    const token = manualToken.trim();
    if (!token) return;
    setLoginState("working");
    setNotice("正在保存 Maker Token...");
    try {
      const response = await setMakerTokenOnboarding(token);
      setLoginState("done");
      setNotice(formatCliNotice("Token 已保存", response.cli.stdout, response.cli.stderr));
      await refreshCloudProjects();
    } catch (error) {
      setLoginState("error");
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  async function refreshCloudProjects() {
    setNotice("正在读取 Maker 云端项目列表...");
    try {
      const response = await listMakerCloudProjects();
      setCloudProjects(response.projects);
      setSelectedCloudProjectId((current) => current || response.projects[0]?.id || "");
      setNotice(response.projects.length ? `已读取 ${response.projects.length} 个云端项目` : "当前账号没有可拉取的 Maker 云端项目。");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (hasBoundProject) {
        setNotice(`云端项目暂时无法获取，本地已绑定项目可继续使用：${message}`);
        return;
      }
      setProjectState("error");
      setNotice(`本地还没有绑定项目，且云端项目无法获取：${message}`);
    }
  }

  async function refreshOnboardingState() {
    if (refreshing || working) return;
    setRefreshing(true);
    setNotice("正在刷新首次启动配置状态...");
    try {
      const rootResponse = await getMakerProjectsRootSettings();
      setRootSettings(rootResponse.settings);
      setRootDraft(rootResponse.settings.rootPath);
      setProjectDirDraft((current) => current || rootResponse.settings.rootPath);
      setRootState(rootResponse.settings.confirmed ? "done" : "idle");
      if (rootResponse.projects) {
        setProjects(rootResponse.projects);
        onProjectsChanged(rootResponse.projects, rootResponse.selectedProjectId);
        if (rootResponse.selectedProjectId) setProjectState("done");
      }
      await refreshPackageStatus();
      await refreshCloudProjects();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleChooseProjectDirectory() {
    const selected = await chooseDirectory("选择单个游戏项目目录", projectDirDraft || rootSettings?.rootPath);
    if (!selected) return;
    setProjectDirDraft(selected);
    setInitPrompt(undefined);
    await detectProjectDirectory(selected);
  }

  async function detectProjectDirectory(targetDir: string) {
    setProjectState("working");
    setNotice("正在检测项目目录...");
    try {
      const response = await bindExistingOnboardingProject(targetDir);
      setProjects(response.projects);
      onProjectsChanged(response.projects, response.selectedProjectId);
      onSelectProject(response.project.id);
      setProjectState("done");
      setNotice(`检测到完整 Maker 项目，已自动绑定：${response.project.name}`);
    } catch (error) {
      setProjectState("idle");
      setInitPrompt({
        targetDir,
        message: error instanceof Error ? error.message : String(error),
      });
      setNotice("这个目录还不是完整 Maker 项目。请选择云端项目拉取到该目录，或刷新云端项目列表。");
      if (!cloudProjects.length) {
        await refreshCloudProjects().catch((cloudError) => {
          setNotice(cloudError instanceof Error ? cloudError.message : String(cloudError));
        });
      }
    }
  }

  async function handleInitializeProject() {
    if (!initPrompt?.targetDir || !selectedCloudProjectId) return;
    setProjectState("working");
    setNotice("正在从 Maker 云端拉取项目...");
    try {
      const response = await initCloudOnboardingProject(selectedCloudProjectId, initPrompt.targetDir);
      setInitPrompt(undefined);
      setProjects(response.projects);
      onProjectsChanged(response.projects, response.selectedProjectId);
      onSelectProject(response.project.id);
      setProjectState("done");
      setNotice(`已拉取并绑定项目：${response.project.name}`);
    } catch (error) {
      setProjectState("error");
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  async function handlePullFirstCloudProject() {
    const appId = selectedCloudProjectId || cloudProjects[0]?.id;
    if (!appId) return;
    setProjectState("working");
    setNotice("正在从 Maker 云端拉取项目...");
    try {
      const response = await initCloudOnboardingProject(appId);
      setProjects(response.projects);
      onProjectsChanged(response.projects, response.selectedProjectId);
      onSelectProject(response.project.id);
      setProjectDirDraft(response.project.rootPath);
      setInitPrompt(undefined);
      setProjectState("done");
      setNotice(`已拉取并绑定项目：${response.project.name}`);
    } catch (error) {
      setProjectState("error");
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }

  function handleBackdropPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (event.target !== event.currentTarget) return;
    startDesktopWindowDrag();
  }

  function handleDialogHeaderPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (
      event.target instanceof HTMLElement &&
      event.target.closest("button, input, label, a")
    ) {
      return;
    }
    startDesktopWindowDrag();
  }

  function startDesktopWindowDrag() {
    import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => getCurrentWindow().startDragging())
      .catch(() => undefined);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 sm:p-8 backdrop-blur-md"
      onPointerDown={handleBackdropPointerDown}
    >
      <motion.section 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex max-h-[90vh] w-full max-w-5xl flex-col md:flex-row overflow-hidden rounded-[24px] border border-border/50 bg-surface-app shadow-2xl"
        data-no-window-drag
      >
        {/* Left Side: Illustration */}
        <div className="relative hidden w-[40%] flex-col justify-between overflow-hidden bg-surface-panel p-10 md:flex border-r border-border/30">
          
          {/* Subtle Abstract Tech Deco Background */}
          <div className="absolute inset-0 z-0 pointer-events-none text-text">
            {/* Dot Grid */}
            <svg className="absolute inset-0 w-full h-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="dotGrid" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1.5" fill="currentColor" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dotGrid)" />
            </svg>
            
            {/* Tech Wireframes & Decals (Animated & Higher Opacity for Light Mode) */}
            <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice">
              {/* Corner brackets */}
              <path d="M 30 50 L 30 30 L 50 30" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M 370 50 L 370 30 L 350 30" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M 30 750 L 30 770 L 50 770" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M 370 750 L 370 770 L 350 770" fill="none" stroke="currentColor" strokeWidth="1.5" />

              {/* Animated Schematic circles */}
              <circle cx="320" cy="180" r="40" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" className="text-brand opacity-60">
                <animateTransform attributeName="transform" type="rotate" from="0 320 180" to="360 320 180" dur="20s" repeatCount="indefinite" />
              </circle>
              <circle cx="320" cy="180" r="60" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-50" strokeDasharray="60 20">
                <animateTransform attributeName="transform" type="rotate" from="360 320 180" to="0 320 180" dur="30s" repeatCount="indefinite" />
              </circle>
              
              <line x1="320" y1="120" x2="320" y2="70" stroke="currentColor" strokeWidth="1" className="opacity-40" />
              <line x1="380" y1="180" x2="420" y2="180" stroke="currentColor" strokeWidth="1" className="opacity-40" />

              {/* Top Left Telemetry Block (Fills top empty space) */}
              <g transform="translate(40, 120)">
                <rect x="0" y="0" width="120" height="80" rx="4" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-20" />
                <line x1="0" y1="20" x2="120" y2="20" stroke="currentColor" strokeWidth="1" className="opacity-20" />
                <circle cx="10" cy="10" r="3" fill="currentColor" className="opacity-40" />
                <circle cx="20" cy="10" r="3" fill="currentColor" className="opacity-40" />
                {/* Fake mini text */}
                <path d="M 10 40 L 50 40 M 10 55 L 70 55 M 10 70 L 40 70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-30" />
                {/* Animated data bars */}
                <rect x="90" y="35" width="4" height="35" fill="currentColor" className="opacity-30">
                  <animate attributeName="height" values="10;35;10" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="y" values="60;35;60" dur="2s" repeatCount="indefinite" />
                </rect>
                <rect x="100" y="50" width="4" height="20" fill="currentColor" className="opacity-30">
                  <animate attributeName="height" values="20;10;20" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="y" values="50;60;50" dur="1.5s" repeatCount="indefinite" />
                </rect>
              </g>

              {/* Bottom Left Network Graph Block (Fills bottom empty space) */}
              <g transform="translate(40, 560)">
                <rect x="0" y="0" width="140" height="70" rx="4" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-20" />
                <path d="M 0 35 C 20 5, 40 65, 70 35 C 100 5, 120 65, 140 35" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brand opacity-60" strokeDasharray="160" strokeDashoffset="0">
                  <animate attributeName="stroke-dashoffset" values="160;0" dur="3s" repeatCount="indefinite" />
                </path>
                <path d="M 0 45 C 30 25, 50 75, 80 45 C 100 25, 120 55, 140 45" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-20" />
                <line x1="0" y1="55" x2="140" y2="55" stroke="currentColor" strokeWidth="1" className="opacity-20" />
                <line x1="0" y1="15" x2="140" y2="15" stroke="currentColor" strokeWidth="1" className="opacity-20" />
                <circle cx="140" cy="35" r="2.5" fill="currentColor" className="text-brand opacity-80" />
              </g>

              {/* Info Box Wireframe with Animated Scanning Line */}
              <g>
                <rect x="260" y="620" width="80" height="50" rx="4" fill="none" stroke="currentColor" strokeWidth="1" />
                <path d="M 270 650 L 330 650 M 270 660 L 300 660" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="opacity-30" />
                <line x1="260" y1="620" x2="340" y2="620" stroke="currentColor" strokeWidth="1.5" className="text-brand opacity-60">
                  <animate attributeName="y1" values="620;670;620" dur="4s" repeatCount="indefinite" />
                  <animate attributeName="y2" values="620;670;620" dur="4s" repeatCount="indefinite" />
                </line>
              </g>
              
              {/* Vertical Metric Scale */}
              <line x1="380" y1="300" x2="380" y2="500" stroke="currentColor" strokeWidth="1" className="opacity-30" />
              <path d="M 380 300 L 375 300 M 380 350 L 375 350 M 380 400 L 370 400 M 380 450 L 375 450 M 380 500 L 375 500" fill="none" stroke="currentColor" strokeWidth="1" className="opacity-50" />
            </svg>
            
            {/* Restrained Brand Tint */}
            <div className="absolute top-1/4 right-0 w-80 h-80 bg-brand/10 rounded-full blur-[100px] pointer-events-none mix-blend-screen opacity-60" />
            <div className="absolute bottom-1/4 -left-10 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none mix-blend-screen opacity-40" />
          </div>
          
          {/* Logo Top Left */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="relative z-10 flex justify-start"
          >
            <img src="/logo-text.png" alt="TapTap Maker" className="h-6 object-contain drop-shadow-sm" />
          </motion.div>

          {/* Animation Center */}
          <div className="relative w-full flex-1 flex flex-col items-center justify-center">
             <ProcessAnimation />
          </div>
          
          {/* Text Bottom Left */}
          <div className="relative z-10 w-full text-left">
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="m-0 text-xl font-bold tracking-tight text-text"
            >
              初始化工作流
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="mt-2 text-[13px] text-text-subtle leading-relaxed"
            >
              只需简单四步，即可自动检测 Maker 依赖环境并完成本地项目配置，立即开启游戏研发。
            </motion.p>
          </div>
        </div>

        {/* Right Side: Onboarding Steps */}
        <div className="flex w-full flex-col md:w-[60%] bg-surface-app relative z-10">
          <div
            className="flex cursor-default items-start justify-between gap-4 border-b border-border-soft bg-surface-muted/30 px-8 py-6"
            onPointerDown={handleDialogHeaderPointerDown}
          >
            <div>
              <h2 className="m-0 text-lg font-bold text-text">首次启动配置</h2>
              <p className="mt-1 text-sm text-text-subtle">完成本地可测的最小链路：项目总目录、MCP、登录、单个游戏项目。</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => void refreshOnboardingState()} disabled={working || refreshing} aria-label="刷新首次启动配置状态">
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onPointerDown={handleClosePointerDown}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  requestClose();
                }}
                aria-label="关闭首次启动配置"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-8 py-6">
            <motion.div 
              className="grid gap-4"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: { opacity: 1, transition: { staggerChildren: 0.15, delayChildren: 0.2 } }
              }}
            >
              <OnboardingStep
                index={1}
                title="选择 Maker 项目总目录"
                description="这里是放多个游戏项目的总目录，用于后续自动发现项目，也是删除本地项目文件夹的安全边界。"
                icon={<FolderSearch />}
                state={rootState}
              >
                <div className="flex min-w-0 flex-1 gap-2">
                  <input
                    readOnly
                    value={rootDraft}
                    className="h-9 min-w-0 flex-1 cursor-default rounded-control border border-border bg-surface-app px-3 font-mono text-xs text-text outline-none"
                    placeholder={rootSettings?.defaultRootPath ?? "Maker 项目总目录"}
                  />
                  <Button variant="outline" size="sm" onClick={() => void handleChooseRoot()} disabled={working}>
                    选择目录
                  </Button>
                </div>
              </OnboardingStep>

              <OnboardingStep
                index={2}
                title="检查并安装 MCP 包"
                description="进入此页会自动检查本地状态和云端版本；安装按钮只负责安装当前下拉框选中的版本。"
                icon={<PackageCheck />}
                state={packageState}
              >
                <div className="flex w-full flex-col gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => void handleInstallSelectedPackageVersion()} disabled={working || !selectedPackageVersion}>
                      {installButtonLabel}
                    </Button>
                    <Select
                      value={selectedPackageVersion}
                      onValueChange={setSelectedPackageVersion}
                      disabled={working || !packageVersionOptions.length}
                    >
                      <SelectTrigger className="h-9 min-w-[190px] flex-1 rounded-control border-border bg-surface-app text-xs focus:ring-brand/50">
                        <SelectValue placeholder={packageState === "working" ? "读取云端版本..." : "云端版本"} />
                      </SelectTrigger>
                      <SelectContent>
                        {packageVersionOptions.map((version) => (
                          <SelectItem key={version} value={version} className="text-xs">
                            {version === packageStatus?.latestVersion ? `${version}（最新版）` : version}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </OnboardingStep>

              <OnboardingStep
                index={3}
                title="登录 Maker"
                description="可以打开 Maker 登录流程，也可以手动粘贴 Token；手动 Token 会通过标准输入写入 Maker CLI，不放进命令参数。"
                icon={<LogIn />}
                state={loginState}
              >
                <div className="flex w-full flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => void handleLogin()} disabled={working}>
                      <LogIn className="mr-1 h-3.5 w-3.5" />
                      登录 Maker
                    </Button>
                    <button
                      type="button"
                      onClick={() => setManualTokenOpen((value) => !value)}
                      className="inline-flex items-center gap-1.5 rounded-control px-0 py-1 text-xs font-medium text-text-subtle transition-colors hover:text-text"
                    >
                      <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", manualTokenOpen && "rotate-180")} />
                      {manualToken ? "手动 Token 已保存" : "手动输入 Token"}
                    </button>
                  </div>
                  {manualTokenOpen ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden rounded-control border border-border-soft bg-surface-app/70 p-3"
                    >
                      <div className="flex min-w-0 flex-wrap gap-2">
                        <input
                          type="password"
                          value={manualToken}
                          onChange={(event) => setManualToken(event.target.value)}
                          className="h-9 min-w-[260px] flex-1 rounded-control border border-border bg-surface-panel px-3 font-mono text-xs text-text outline-none placeholder:text-text-muted focus:border-brand"
                          placeholder="粘贴 Maker Token"
                          autoComplete="off"
                          spellCheck={false}
                        />
                        <Button size="sm" onClick={() => void handleSaveToken()} disabled={working || !manualToken.trim()}>
                          保存 Token
                        </Button>
                      </div>
                      <p className="m-0 mt-2 text-[11px] leading-relaxed text-text-subtle">
                        用于无法自动跳转登录或本地测试；保存后会在首次启动页保留。
                      </p>
                    </motion.div>
                  ) : null}
                </div>
              </OnboardingStep>

              <OnboardingStep
                index={4}
                title="选择单个游戏项目目录"
                description="选择一个具体游戏项目目录。系统会先检测是否已有 .maker-mcp/config.json；完整就自动绑定，不完整再询问是否初始化。"
                icon={<Plus />}
                state={projectState}
              >
                <div className="flex w-full flex-col gap-4">
                  {/* Primary Action: Select Local Directory */}
                  <div className="flex min-w-0 flex-wrap justify-end gap-2">
                    <input
                      readOnly
                      value={projectDirDraft}
                      className="h-9 min-w-[300px] flex-1 cursor-default rounded-control border border-border bg-surface-app px-3 font-mono text-xs text-text outline-none"
                      placeholder="选择单个游戏项目目录"
                    />
                    <Button variant="outline" size="sm" onClick={() => void handleChooseProjectDirectory()} disabled={working}>
                      选择并检测
                    </Button>
                  </div>

                  {initPrompt && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-control border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-500">
                        <div className="flex items-center gap-2 font-bold mb-1">
                          <AlertTriangle className="h-4 w-4" />
                          未检测到完整 Maker 项目
                        </div>
                        <div className="font-mono text-[11px] opacity-80 mb-1">{initPrompt.targetDir}</div>
                        <div className="opacity-80">
                          此目录不包含项目配置文件。请重新选择有效的项目目录，或者在下方直接拉取云端项目。
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="flex items-center gap-4 py-1">
                    <div className="h-[1px] flex-1 bg-border-soft" />
                    <div className="text-[12px] text-text-subtle">或者</div>
                    <div className="h-[1px] flex-1 bg-border-soft" />
                  </div>

                  {/* Standalone Cloud Project Selector */}
                  <div className="rounded-control border border-border-soft bg-surface-panel p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-bold text-text">Maker 云端项目</div>
                      <Button variant="ghost" size="sm" onClick={() => void refreshCloudProjects()} disabled={working} className="h-7 text-xs text-text-subtle hover:text-text">
                        <RefreshCw className={cn("mr-1 h-3.5 w-3.5", projectState === "working" && "animate-spin")} />
                        刷新
                      </Button>
                    </div>
                    {cloudProjects.length ? (
                      <div className="flex flex-col gap-2">
                        <div className="text-xs text-text-subtle mb-1">选择一个项目，系统将自动拉取到您的 Maker 总目录中。</div>
                        <div className="flex min-w-0 flex-wrap gap-2">
                          <Select
                            value={selectedCloudProjectId}
                            onValueChange={setSelectedCloudProjectId}
                          >
                            <SelectTrigger className="h-9 min-w-[240px] flex-1 rounded-control border-border bg-surface-app text-xs focus:ring-brand/50">
                              <SelectValue placeholder="选择云端项目" />
                            </SelectTrigger>
                            <SelectContent>
                              {cloudProjects.map((project) => (
                                <SelectItem key={project.id} value={project.id} className="text-xs">
                                  {project.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="sm" onClick={() => void handlePullFirstCloudProject()} disabled={working || !selectedCloudProjectId}>
                            拉取到总目录
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="m-0 text-xs text-text-subtle bg-surface-muted/50 p-2 rounded-control">
                        暂未读取到云端项目。请确保已登录 Maker 账号，或手动点击刷新重试。
                      </p>
                    )}
                  </div>

                  {/* Recent Projects List */}
                  {!initPrompt && projects.length ? (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="grid gap-2 rounded-control border border-border-soft bg-surface-panel/60 p-2 overflow-hidden"
                    >
                      {projects.slice(0, 6).map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => onSelectProject(project.id)}
                          className="flex min-w-0 items-center justify-between gap-3 rounded-control px-2 py-1.5 text-left text-xs text-text hover:bg-surface-muted transition-colors"
                        >
                          <span className="truncate font-medium">{project.name}</span>
                          <span className="truncate font-mono text-[10px] text-text-subtle">{project.rootPath}</span>
                        </button>
                      ))}
                    </motion.div>
                  ) : null}
                </div>
              </OnboardingStep>
            </motion.div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-border-soft px-8 py-5 bg-surface-panel">
            <div className="min-w-0 truncate text-[11px] text-text-subtle font-medium">{notice || "选择目录会自动检测项目状态；不需要手动判断扫描、初始化或绑定。"}</div>
            <Button size="sm" onClick={requestEnterWorkbench} disabled={!canEnterWorkbench || working} className="rounded-full px-6 shadow-sm">
              进入工作台
            </Button>
          </div>
        </div>
      </motion.section>
    </div>
  );
}

function OnboardingStep({
  index,
  title,
  description,
  icon,
  state,
  children,
}: {
  index: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  state: StepState;
  children: React.ReactNode;
}) {
  return (
    <motion.article 
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
      }}
      className="flex flex-col gap-4 rounded-xl border border-border-soft bg-surface-panel p-5"
    >
      <div className="flex min-w-0 gap-3">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", stateClass(state))}>
          {state === "done" ? <CheckCircle2 className="h-4 w-4" /> : icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-text-muted">步骤 {index}</span>
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", stateBadgeClass(state))}>{stateLabel(state)}</span>
          </div>
          <h3 className="m-0 mt-1 text-sm font-semibold text-text">{title}</h3>
          <p className="m-0 mt-1 text-xs leading-relaxed text-text-subtle">{description}</p>
        </div>
      </div>
      <div className="flex min-w-0 w-full pl-0 md:pl-12">
        {children}
      </div>
    </motion.article>
  );
}

function stateLabel(state: StepState) {
  if (state === "working") return "进行中";
  if (state === "done") return "已完成";
  if (state === "error") return "需处理";
  return "未完成";
}

function stateClass(state: StepState) {
  if (state === "working") return "border-brand/30 bg-brand/10 text-brand";
  if (state === "done") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-500";
  if (state === "error") return "border-red-500/30 bg-red-500/10 text-red-500";
  return "border-border bg-surface-app text-text-muted";
}

function stateBadgeClass(state: StepState) {
  if (state === "working") return "bg-brand/10 text-brand";
  if (state === "done") return "bg-emerald-500/10 text-emerald-500";
  if (state === "error") return "bg-red-500/10 text-red-500";
  return "bg-surface-muted text-text-subtle";
}

function formatCliNotice(prefix: string, stdout: string, stderr: string) {
  const output = [stdout, stderr].filter(Boolean).join(" ").trim();
  return output ? `${prefix}：${output.slice(0, 180)}` : prefix;
}

function ProcessAnimation() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => (t + 1) % 5), 1800);
    return () => clearInterval(timer);
  }, []);

  const steps = [
    { id: 1, icon: FolderSearch, label: "发现项目", desc: "扫描并确立本地工作区边界" },
    { id: 2, icon: PackageCheck, label: "依赖解析", desc: "校验并安装核心 MCP 工具包" },
    { id: 3, icon: LogIn, label: "账号鉴权", desc: "安全注入云端服务访问令牌" },
    { id: 4, icon: CheckCircle2, label: "环境就绪", desc: "自动组装完毕，可以开始研发" },
  ];

  return (
    <div className="relative w-full flex flex-col justify-center py-4 px-2 sm:px-8 gap-10 font-sans">
       {/* SVG Flow Line Background */}
       <div className="absolute top-[2.5rem] bottom-[2.5rem] w-8 left-[1.75rem] sm:left-[3.25rem]">
         <svg className="w-full h-full" preserveAspectRatio="none">
            {/* Base Dashed Line */}
            <line x1="16" y1="0" x2="16" y2="100%" stroke="currentColor" className="text-border-soft" strokeWidth="1.5" strokeDasharray="4 4" />
            
            {/* Animated Solid Progress Line */}
            <line 
              x1="16" y1="0" 
              x2="16" y2={`${Math.min(100, (tick / 3) * 100)}%`} 
              stroke="currentColor" 
              className="text-brand transition-all duration-[1200ms] ease-out" 
              strokeWidth="2" 
            />
            
            {/* Traveling Data Packet (only when moving between steps) */}
            {tick > 0 && tick < 4 && (
              <motion.circle 
                cx="16" 
                r="3" 
                className="fill-brand drop-shadow-[0_0_5px_rgba(0,217,197,0.8)]"
                initial={{ cy: `${((tick - 1) / 3) * 100}%` }}
                animate={{ cy: `${(tick / 3) * 100}%` }}
                transition={{ duration: 1.2, ease: "linear" }}
              />
            )}
         </svg>
       </div>
       
       {steps.map((s, index) => {
         const isActive = tick >= index;
         const isCurrent = tick === index;
         const Icon = s.icon;
         
         return (
           <div key={s.id} className="relative z-10 flex items-center w-full">
             
             {/* Node Icon */}
             <div className={cn(
               "w-12 h-12 rounded-xl flex flex-shrink-0 items-center justify-center transition-all duration-700 z-10",
               isCurrent ? "bg-brand border-brand shadow-[0_0_15px_rgba(0,217,197,0.3)] text-white" 
                 : isActive ? "bg-surface-panel border-brand/40 shadow-sm text-brand" 
                 : "bg-transparent border-border-soft/50 text-border-strong",
               "border"
             )}>
                <Icon className={cn("w-5 h-5 transition-transform duration-700", isCurrent ? "scale-110" : "scale-100")} strokeWidth={isCurrent ? 2 : 1.5} />
             </div>

             {/* Node Text & Status */}
             <div className="ml-5 flex flex-col justify-center h-12 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-bold tracking-wider transition-colors duration-700 truncate", isActive ? "text-text" : "text-text-subtle/40")}>
                    {s.label}
                  </span>
                  
                  {isActive && !isCurrent && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex-shrink-0 flex items-center gap-1 text-[9px] text-brand font-semibold bg-brand/10 border border-brand/20 px-1.5 py-0.5 rounded tracking-wider">
                      已完成
                    </motion.div>
                  )}
                  {isCurrent && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex-shrink-0 flex items-center gap-1.5 text-[9px] text-brand font-semibold bg-brand/10 px-1.5 py-0.5 rounded border border-brand/30 tracking-wider">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" /> 进行中
                    </motion.div>
                  )}
                </div>
                
                <span className={cn("text-[11px] mt-1 transition-colors duration-700 truncate", isActive ? "text-text-subtle" : "text-text-subtle/30")}>
                  {s.desc}
                </span>
             </div>
             
           </div>
         );
       })}
    </div>
  );
}
