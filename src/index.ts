import { OpenAPIHono } from "@hono/zod-openapi";
import type { Bindings } from "./types";

const app = new OpenAPIHono<{ Bindings: Bindings }>();

app.get("/health", (c) => c.json({ ok: true }));

export default app;
