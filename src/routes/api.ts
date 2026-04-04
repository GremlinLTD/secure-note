import { OpenAPIHono, createRoute } from "@hono/zod-openapi";

import type { Bindings } from "../types";
import {
  CreateNoteSchema,
  CreateNoteResponseSchema,
  GetNoteResponseSchema,
  ErrorSchema,
  NoteIdParamSchema,
} from "../schemas/notes";
import { saveNote, getAndDeleteNote, getAndDecrementViews, getNoteMetadata, incrementAttempts, deleteNote, incrementStat, getStats, isIpAllowed } from "../kv";

type Env = { Bindings: Bindings };

export const api = new OpenAPIHono<Env>();

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  const cfIp = c.req.header("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  const xff = c.req.header("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "unknown";
}

export const createNoteRoute = createRoute({
  method: "post",
  path: "/api/notes",
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

const getNoteRoute = createRoute({
  method: "get",
  path: "/api/notes/{id}",
  request: {
    params: NoteIdParamSchema,
  },
  responses: {
    200: {
      content: { "application/json": { schema: GetNoteResponseSchema } },
      description: "Note retrieved. Non-password notes are burned immediately. Password-protected notes allow up to 3 attempts.",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid UUID",
    },
    403: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Access denied due to IP restriction",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Note not found or attempts exhausted",
    },
  },
});

// DELETE is internal-only (called by reveal page JS after successful decryption).
// Not registered with OpenAPI to keep it out of public API docs.

export const createNoteHandler: Parameters<
  typeof api.openapi<typeof createNoteRoute>
>[1] = async (c) => {
  const { c: ciphertext, iv, pw, ttl, title, burnMsg, maxViews, allowedIps } = c.req.valid("json");
  const id = await saveNote(c.env.NOTES, { c: ciphertext, iv, pw, ttl, title, burnMsg, maxViews, allowedIps });
  incrementStat(c.env.NOTES, "created").catch(() => {});
  return c.json({ id }, 201);
};

api.openapi(createNoteRoute, createNoteHandler);

api.openapi(getNoteRoute, async (c) => {
  const { id } = c.req.valid("param");

  // Check if note exists and whether it's password-protected
  const meta = await getNoteMetadata(c.env.NOTES, id);
  if (!meta) {
    return c.json({ error: "Note not found or already destroyed" }, 404);
  }

  const clientIp = getClientIp(c);
  if (meta.allowedIps && !isIpAllowed(clientIp, meta.allowedIps)) {
    return c.json({ error: "Access denied. This note is restricted to specific IP addresses." }, 403);
  }

  if (!meta.pw) {
    if ((meta.maxViews ?? 1) > 1) {
      const result = await getAndDecrementViews(c.env.NOTES, id);
      if (!result) {
        return c.json({ error: "Note not found or already destroyed" }, 404);
      }
      if (result.remaining === 0) {
        incrementStat(c.env.NOTES, "burned").catch(() => {});
      }
      return c.json({ c: result.note.c, iv: result.note.iv, pw: result.note.pw, viewsRemaining: result.remaining }, 200);
    }
    // Non-password, single view: burn-before-return
    const note = await getAndDeleteNote(c.env.NOTES, id);
    if (!note) {
      return c.json({ error: "Note not found or already destroyed" }, 404);
    }
    await incrementStat(c.env.NOTES, "burned");
    return c.json({ c: note.c, iv: note.iv, pw: note.pw }, 200);
  }

  // Password-protected: increment attempts, auto-burn after 3
  const result = await incrementAttempts(c.env.NOTES, id);
  if (!result) {
    return c.json({ error: "Note not found or already destroyed" }, 404);
  }

  if (result.remaining === 0) {
    await incrementStat(c.env.NOTES, "burned");
  }

  return c.json({
    c: result.note.c,
    iv: result.note.iv,
    pw: result.note.pw,
    attemptsRemaining: result.remaining,
  }, 200);
});

api.get("/api/stats", async (c) => {
  const stats = await getStats(c.env.NOTES);
  return c.json(stats, 200);
});

api.delete("/api/notes/:id", async (c) => {
  const id = c.req.param("id");

  const meta = await getNoteMetadata(c.env.NOTES, id);
  if (!meta) {
    return c.json({ error: "Note not found or already destroyed" }, 404);
  }

  // Only allow DELETE if the note has been retrieved at least once (attempts > 0).
  // This prevents blind deletion by UUID without having the decryption key.
  if (meta.attempts < 1) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const clientIp = getClientIp(c);
  if (meta.allowedIps && !isIpAllowed(clientIp, meta.allowedIps)) {
    return c.json({ error: "Access denied. This note is restricted to specific IP addresses." }, 403);
  }

  const deleted = await deleteNote(c.env.NOTES, id);
  if (!deleted) {
    return c.json({ error: "Note not found or already destroyed" }, 404);
  }
  incrementStat(c.env.NOTES, "burned").catch(() => {});
  return c.json({ deleted: true }, 200);
});
