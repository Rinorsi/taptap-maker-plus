import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const workspaceRoot = path.dirname(path.dirname(scriptPath));
const versionPath = path.join(workspaceRoot, "app-version.json");

const version = readJson(versionPath);
validateVersion(version);

const packageFiles = [
  "package.json",
  "apps/web/package.json",
  "apps/server/package.json",
];

for (const relativePath of packageFiles) {
  const filePath = path.join(workspaceRoot, relativePath);
  const data = readJson(filePath);
  data.version = version.packageVersion;
  writeJson(filePath, data);
}

syncPackageLock();
syncWebIndex();
syncTauriConfig();
syncCargoToml();
writeGeneratedModule("apps/web/src/generated/appVersion.ts");
writeGeneratedModule("apps/server/src/generated/appVersion.ts");

console.log(`Synced app version ${version.displayVersion} (${version.packageVersion})`);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function validateVersion(data) {
  const required = [
    "appId",
    "productName",
    "windowTitle",
    "displayVersion",
    "packageVersion",
    "channel",
    "publisher",
    "description",
    "announcementTitle",
    "announcementBody",
    "announcementMarkdown",
  ];
  for (const key of required) {
    if (typeof data[key] !== "string" || !data[key].trim()) {
      throw new Error(`app-version.json requires string key: ${key}`);
    }
  }
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(data.packageVersion)) {
    throw new Error("app-version.json packageVersion must be semver without leading v");
  }
  if (!Array.isArray(data.announcements)) {
    throw new Error("app-version.json announcements must be an array");
  }
}

function syncPackageLock() {
  const filePath = path.join(workspaceRoot, "package-lock.json");
  if (!fs.existsSync(filePath)) return;
  const data = readJson(filePath);
  data.version = version.packageVersion;
  if (data.packages?.[""]) data.packages[""].version = version.packageVersion;
  if (data.packages?.["apps/server"]) data.packages["apps/server"].version = version.packageVersion;
  if (data.packages?.["apps/web"]) data.packages["apps/web"].version = version.packageVersion;
  writeJson(filePath, data);
}

function syncTauriConfig() {
  const filePath = path.join(workspaceRoot, "src-tauri/tauri.conf.json");
  const data = readJson(filePath);
  data.productName = version.productName;
  data.version = version.packageVersion;
  if (data.app?.windows?.[0]) {
    data.app.windows[0].title = version.windowTitle;
  }
  data.bundle = {
    ...data.bundle,
    publisher: version.publisher,
    windows: {
      ...(data.bundle?.windows ?? {}),
      nsis: {
        ...((data.bundle?.windows?.nsis) ?? {}),
        installerIcon: "icons/icon.ico",
        uninstallerIcon: "icons/icon.ico",
        installMode: "currentUser",
        languages: ["SimpChinese"],
        displayLanguageSelector: false,
        startMenuFolder: "TapTap Maker Plus"
      }
    }
  };
  writeJson(filePath, data);
}

function syncWebIndex() {
  const filePath = path.join(workspaceRoot, "apps/web/index.html");
  let text = fs.readFileSync(filePath, "utf8");
  text = text.replace(/<title>.*<\/title>/, `<title>${escapeHtml(version.windowTitle)}</title>`);
  fs.writeFileSync(filePath, text, "utf8");
}

function syncCargoToml() {
  const filePath = path.join(workspaceRoot, "src-tauri/Cargo.toml");
  let text = fs.readFileSync(filePath, "utf8");
  text = replaceTomlString(text, "version", version.packageVersion);
  text = replaceTomlString(text, "description", version.description);
  text = replaceTomlArray(text, "authors", [version.publisher]);
  fs.writeFileSync(filePath, text, "utf8");
}

function replaceTomlString(text, key, value) {
  const pattern = new RegExp(`^${key} = ".*"$`, "m");
  if (!pattern.test(text)) throw new Error(`Cargo.toml missing key: ${key}`);
  return text.replace(pattern, `${key} = "${escapeToml(value)}"`);
}

function replaceTomlArray(text, key, values) {
  const pattern = new RegExp(`^${key} = \\[.*\\]$`, "m");
  if (!pattern.test(text)) throw new Error(`Cargo.toml missing key: ${key}`);
  const rendered = values.map((item) => `"${escapeToml(item)}"`).join(", ");
  return text.replace(pattern, `${key} = [${rendered}]`);
}

function escapeToml(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function writeGeneratedModule(relativePath) {
  const filePath = path.join(workspaceRoot, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const content = `export const appVersion = ${JSON.stringify(version, null, 2)} as const;\n`;
  fs.writeFileSync(filePath, content, "utf8");
}
