import { spawn } from "node:child_process";
import http from "node:http";

const DEV_WEB_HOST = "127.0.0.1";
const DEV_WEB_PORT = 5173;
const WEB_IDENTITY_NAME = 'name="taptap-maker-plus"';
const WEB_IDENTITY_CONTENT = 'content="web"';

function readDevWebRoot() {
  return new Promise((resolve) => {
    const request = http.get(
      {
        host: DEV_WEB_HOST,
        port: DEV_WEB_PORT,
        path: "/",
        timeout: 750,
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => resolve(body));
      },
    );

    request.on("error", () => resolve(""));
    request.on("timeout", () => {
      request.destroy();
      resolve("");
    });
  });
}

const existingRoot = await readDevWebRoot();

if (
  existingRoot.includes(WEB_IDENTITY_NAME) &&
  existingRoot.includes(WEB_IDENTITY_CONTENT)
) {
  console.log(`Reusing existing TapTap Maker web dev server on http://${DEV_WEB_HOST}:${DEV_WEB_PORT}`);
  process.exit(0);
}

const child =
  process.platform === "win32"
    ? spawn(process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", ["/d", "/s", "/c", "npm run dev:web"], {
        stdio: "inherit",
      })
    : spawn("npm", ["run", "dev:web"], {
        stdio: "inherit",
      });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
