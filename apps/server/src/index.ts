import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./lib/config.js";
import { scanMakerProjects } from "./services/projectDiscovery.js";
import { registerApiRoutes } from "./routes/api.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await registerApiRoutes(app);

await scanMakerProjects();

app.listen({ port: config.port, host: config.host }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
