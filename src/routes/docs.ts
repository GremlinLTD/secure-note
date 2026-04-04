import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import type { Bindings } from "../types";

const docs = new OpenAPIHono<{ Bindings: Bindings }>();

docs.doc("/api/docs.json", {
  openapi: "3.1.0",
  info: {
    title: "Gremlin Secure Note",
    version: "1.0.0",
    description:
      "Zero-knowledge, one-time secret sharing. Notes are encrypted client-side and destroyed after a single read.",
  },
});

docs.get(
  "/api/docs",
  Scalar({
    spec: { url: "/api/docs.json" },
    theme: "moon",
    pageTitle: "Gremlin Secure Note API",
  })
);

export { docs };
