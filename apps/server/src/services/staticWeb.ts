import fs from "node:fs";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";
import { config } from "../lib/config.js";

export async function registerStaticWeb(app: FastifyInstance) {
  if (process.env.NODE_ENV !== "production") return;

  const root = config.webDistDir;
  const indexPath = path.join(root, "index.html");
  if (!fs.existsSync(indexPath)) {
    app.log.warn({ root }, "web dist not found; static web serving disabled");
    return;
  }

  app.addHook("onSend", async (request, reply, payload) => {
    if (!request.url.startsWith("/api/")) {
      reply.header("Cache-Control", "no-store");
    }
    return payload;
  });

  await app.register(fastifyStatic, {
    root,
    prefix: "/",
    maxAge: 0,
    immutable: false,
    setHeaders: (reply, filePath) => {
      reply.setHeader("Cache-Control", "no-store");
    }
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/") || request.url === "/api") {
      return reply.code(404).send({ error: "Not found" });
    }
    return reply
      .header("Cache-Control", "no-store")
      .type("text/html")
      .sendFile("index.html", { maxAge: 0, immutable: false });
  });
}
