import Fastify from "fastify";

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });

app.get("/health", async () => ({ ok: true }));

const port = Number(process.env.PORT ?? 3001);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
