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
import { saveNote, getAndDeleteNote } from "../kv";

type Env = { Bindings: Bindings };

export const api = new OpenAPIHono<Env>();

const createNoteRoute = createRoute({
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
      description: "Note retrieved and burned",
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
  const { c: ciphertext, iv, pw, ttl } = c.req.valid("json");
  const id = await saveNote(c.env.NOTES, { c: ciphertext, iv, pw, ttl });
  return c.json({ id }, 201);
};

api.openapi(createNoteRoute, createNoteHandler);

api.openapi(getNoteRoute, async (c) => {
  const { id } = c.req.valid("param");
  const note = await getAndDeleteNote(c.env.NOTES, id);
  if (!note) {
    return c.json({ error: "Note not found" }, 404);
  }
  return c.json({ c: note.c, iv: note.iv, pw: note.pw }, 200);
});
