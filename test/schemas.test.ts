import { describe, it, expect } from "vitest";
import { CreateNoteSchema, NoteIdParamSchema } from "../src/schemas/notes";

describe("CreateNoteSchema", () => {
  it("accepts valid input with all fields", () => {
    const result = CreateNoteSchema.safeParse({
      c: "dGVzdA==",
      iv: "dGVzdA==",
      pw: true,
      ttl: 3600,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid input with defaults", () => {
    const result = CreateNoteSchema.safeParse({
      c: "dGVzdA==",
      iv: "dGVzdA==",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pw).toBe(false);
      expect(result.data.ttl).toBe(604800);
    }
  });

  it("rejects missing ciphertext", () => {
    const result = CreateNoteSchema.safeParse({ iv: "dGVzdA==" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid TTL value", () => {
    const result = CreateNoteSchema.safeParse({
      c: "dGVzdA==",
      iv: "dGVzdA==",
      ttl: 999,
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid TTL values", () => {
    for (const ttl of [3600, 86400, 604800, 2592000]) {
      const result = CreateNoteSchema.safeParse({
        c: "dGVzdA==",
        iv: "dGVzdA==",
        ttl,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("NoteIdParamSchema", () => {
  it("accepts valid UUID v4", () => {
    const result = NoteIdParamSchema.safeParse({
      id: "a1b2c3d4-e5f6-4890-abcd-ef1234567890",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID strings", () => {
    const result = NoteIdParamSchema.safeParse({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});
