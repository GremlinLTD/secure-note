import { z } from "@hono/zod-openapi";

export const CreateNoteSchema = z
  .object({
    c: z.string().min(1).openapi({ description: "Base64-encoded AES-256-GCM ciphertext (includes auth tag)" }),
    iv: z.string().min(1).openapi({ description: "Base64-encoded 96-bit initialization vector" }),
    pw: z.boolean().default(false).openapi({ description: "Whether the note is password-protected" }),
    ttl: z
      .union([z.literal(3600), z.literal(86400), z.literal(604800), z.literal(2592000)])
      .default(604800)
      .openapi({ description: "Time-to-live in seconds" }),
    title: z.string().max(100).optional().openapi({ description: "Optional title shown to recipient before reveal" }),
    burnMsg: z.string().max(200).optional().openapi({ description: "Message shown after note is destroyed" }),
    maxViews: z.number().int().min(1).max(5).default(1).optional().openapi({ description: "Number of times the note can be viewed (non-password notes only)" }),
  })
  .openapi("CreateNote");

export const CreateNoteResponseSchema = z
  .object({
    id: z.string().uuid().openapi({ description: "Note ID" }),
  })
  .openapi("CreateNoteResponse");

export const GetNoteResponseSchema = z
  .object({
    c: z.string().openapi({ description: "Base64-encoded ciphertext" }),
    iv: z.string().openapi({ description: "Base64-encoded IV" }),
    pw: z.boolean().openapi({ description: "Password-protected flag" }),
    attemptsRemaining: z.number().optional().openapi({ description: "Remaining decryption attempts (password-protected notes only)" }),
    viewsRemaining: z.number().optional().openapi({ description: "Remaining views (multi-view notes only)" }),
  })
  .openapi("GetNoteResponse");

export const ErrorSchema = z
  .object({
    error: z.string().openapi({ description: "Error message" }),
  })
  .openapi("Error");

export const NoteIdParamSchema = z.object({
  id: z.string().uuid().openapi({ description: "Note UUID", param: { in: "path" } }),
});
