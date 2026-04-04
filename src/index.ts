import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { Bindings } from "./types";
import { api, createNoteHandler } from "./routes/api";
import { docs } from "./routes/docs";
import { pages } from "./routes/pages";
import {
  CreateNoteSchema,
  CreateNoteResponseSchema,
  ErrorSchema,
} from "./schemas/notes";

const app = new OpenAPIHono<{ Bindings: Bindings }>();

const sizeGuard = async (c: any, next: any) => {
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

app.route("/", docs);
app.route("/", api);
app.route("/", pages);

const createNoteAliasRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: { "application/json": { schema: CreateNoteSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { "application/json": { schema: CreateNoteResponseSchema } },
      description: "Note created",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Validation error",
    },
    413: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Note too large",
    },
  },
});

app.openapi(createNoteAliasRoute, createNoteHandler);

export default app;
