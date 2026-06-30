import Fastify from "fastify";
import cors from "@fastify/cors";
import fs from "node:fs";
import path from "node:path";
import { config, setMakerProjectsRoot } from "./lib/config.js";
import { getAppSetting } from "./lib/db.js";
import { scanMakerProjects } from "./services/projectDiscovery.js";
import { registerApiRoutes } from "./routes/api.js";
import { registerStaticWeb } from "./services/staticWeb.js";
import { runtimeManager } from "./services/mcpRuntime.js";
import { loadStoredMakerPackage } from "./services/mcpPackageManager.js";

const app = Fastify({ logger: true });
let shuttingDown = false;
let desktopParentMonitor: NodeJS.Timeout | undefined;

function appendServerCrashLog(source: string, error: unknown) {
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
    const message = error instanceof Error ? error.stack || error.message : String(error);
    fs.appendFileSync(
      path.join(config.dataDir, "server-crash.log"),
      `[${new Date().toISOString()}] ${source}\n${message}\n\n`,
      "utf8",
    );
  } catch {
    // Crash logging must not throw while handling another failure.
  }
}

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (desktopParentMonitor) clearInterval(desktopParentMonitor);
  app.log.info({ signal }, "shutting down TapTap Maker Plus server");
  await runtimeManager.stopAll().catch((error) => app.log.error(error));
  await app.close().catch((error) => app.log.error(error));
}

function startDesktopParentMonitor() {
  const parentPid = Number(process.env.TAPTAP_DESKTOP_PARENT_PID);
  if (!Number.isInteger(parentPid) || parentPid <= 0) return;

  desktopParentMonitor = setInterval(() => {
    try {
      process.kill(parentPid, 0);
    } catch {
      void shutdown("desktop-parent-exit").finally(() => process.exit(0));
    }
  }, 1000);
  desktopParentMonitor.unref();
}

await app.register(cors, {
  origin: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
});
await registerApiRoutes(app);
await registerStaticWeb(app);

const storedMakerProjectsRoot = getAppSetting("maker_projects_root");
if (storedMakerProjectsRoot) setMakerProjectsRoot(storedMakerProjectsRoot);
loadStoredMakerPackage();
if (getAppSetting("maker_projects_root_confirmed") === config.makerProjectsRoot) {
  await scanMakerProjects().catch((error) => {
    app.log.error(error, "failed to scan Maker projects during startup");
  });
}

process.once("SIGINT", () => {
  void shutdown("SIGINT").finally(() => process.exit(0));
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM").finally(() => process.exit(0));
});

process.on("uncaughtException", (error) => {
  appendServerCrashLog("uncaughtException", error);
  app.log.error(error, "uncaught exception");
});

process.on("unhandledRejection", (reason) => {
  appendServerCrashLog("unhandledRejection", reason);
  app.log.error({ reason }, "unhandled rejection");
});

startDesktopParentMonitor();

app.addHook("onClose", async () => {
  await runtimeManager.stopAll();
});

app.listen({ port: config.port, host: config.host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
