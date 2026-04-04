import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import type { Bindings } from "../types";
import {
  CreateNoteSchema,
  CreateNoteResponseSchema,
  GetNoteResponseSchema,
  ErrorSchema,
  NoteIdParamSchema,
} from "../schemas/notes";
import { saveNote, getAndDeleteNote, getAndDecrementViews, getNoteMetadata, incrementAttempts, deleteNote } from "../kv";

type Env = { Bindings: Bindings };

export const api = new OpenAPIHono<Env>();

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
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Note not found or attempts exhausted",
    },
  },
});

const deleteNoteRoute = createRoute({
  method: "delete",
  path: "/api/notes/{id}",
  request: {
    params: NoteIdParamSchema,
  },
  responses: {
    200: {
      content: { "application/json": { schema: z.object({ deleted: z.boolean() }).openapi("DeleteNoteResponse") } },
      description: "Confirm burn after successful decryption (password-protected notes only)",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid UUID",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Note not found",
    },
  },
});

export const createNoteHandler: Parameters<
  typeof api.openapi<typeof createNoteRoute>
>[1] = async (c) => {
  const { c: ciphertext, iv, pw, ttl, title, burnMsg, maxViews } = c.req.valid("json");
  const id = await saveNote(c.env.NOTES, { c: ciphertext, iv, pw, ttl, title, burnMsg, maxViews });
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

  if (!meta.pw) {
    if ((meta.maxViews ?? 1) > 1) {
      const result = await getAndDecrementViews(c.env.NOTES, id);
      if (!result) {
        return c.json({ error: "Note not found or already destroyed" }, 404);
      }
      return c.json({ c: result.note.c, iv: result.note.iv, pw: result.note.pw, viewsRemaining: result.remaining }, 200);
    }
    // Non-password, single view: burn-before-return
    const note = await getAndDeleteNote(c.env.NOTES, id);
    if (!note) {
      return c.json({ error: "Note not found or already destroyed" }, 404);
    }
    return c.json({ c: note.c, iv: note.iv, pw: note.pw }, 200);
  }

  // Password-protected: increment attempts, auto-burn after 3
  const result = await incrementAttempts(c.env.NOTES, id);
  if (!result) {
    return c.json({ error: "Note not found or already destroyed" }, 404);
  }

  return c.json({
    c: result.note.c,
    iv: result.note.iv,
    pw: result.note.pw,
    attemptsRemaining: result.remaining,
  }, 200);
});

api.openapi(deleteNoteRoute, async (c) => {
  const { id } = c.req.valid("param");
  const deleted = await deleteNote(c.env.NOTES, id);
  if (!deleted) {
    return c.json({ error: "Note not found or already destroyed" }, 404);
  }
  return c.json({ deleted: true }, 200);
});
