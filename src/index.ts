import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import type { MiddlewareHandler } from "hono";
import type { Bindings } from "./types";
import { api, createNoteHandler, createNoteRoute } from "./routes/api";
import { pages } from "./routes/pages";
type Env = { Bindings: Bindings };

const app = new OpenAPIHono<Env>();

const sizeGuard: MiddlewareHandler<Env> = async (c, next) => {
  if (c.req.method === "POST") {
    const maxSize = Number(c.env.MAX_NOTE_SIZE ?? 1048576);
    const contentLength = Number(c.req.header("Content-Length") ?? 0);
    if (contentLength > maxSize) {
      return c.json({ error: "Note too large" }, 413);
    }
  }
  await next();
};

app.use("/api/notes", sizeGuard);
app.use("/", sizeGuard);

app.get("/health", (c) => c.json({ ok: true }));

app.route("/", api);
app.route("/", pages);

const createNoteAliasRoute = createRoute({
  ...createNoteRoute,
  path: "/",
});

app.openapi(createNoteAliasRoute, createNoteHandler);

app.doc("/api/docs.json", {
  openapi: "3.1.0",
  info: {
    title: "Gremlin Secure Note",
    version: "1.1.0",
    description:
      "Zero-knowledge, one-time secret sharing. Notes are encrypted client-side and destroyed after a single read.",
  },
});

app.get(
  "/api/docs",
  Scalar({
    url: "/api/docs.json",
    theme: "moon",
    pageTitle: "Gremlin Secure Note API",
  })
);

export default app;
