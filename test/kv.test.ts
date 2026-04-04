import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { saveNote, getAndDeleteNote, getNoteMetadata } from "../src/kv";

describe("KV helpers", () => {
  it("saves and retrieves a note", async () => {
    const id = await saveNote(env.NOTES, {
      c: "ciphertext",
      iv: "iv-value",
      pw: false,
      ttl: 3600,
    });

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );

    const note = await getAndDeleteNote(env.NOTES, id);
    expect(note).not.toBeNull();
    expect(note!.c).toBe("ciphertext");
    expect(note!.iv).toBe("iv-value");
    expect(note!.pw).toBe(false);
  });

  it("returns null after note is burned", async () => {
    const id = await saveNote(env.NOTES, {
      c: "once",
      iv: "iv",
      pw: false,
      ttl: 3600,
    });

    await getAndDeleteNote(env.NOTES, id);
    const second = await getAndDeleteNote(env.NOTES, id);
    expect(second).toBeNull();
  });

  it("returns metadata without burning", async () => {
    const id = await saveNote(env.NOTES, {
      c: "data",
      iv: "iv",
      pw: true,
      ttl: 3600,
    });

    const meta = await getNoteMetadata(env.NOTES, id);
    expect(meta).not.toBeNull();
    expect(meta!.pw).toBe(true);
    expect(meta!.ts).toBeTypeOf("number");

    // Note should still exist
    const note = await getAndDeleteNote(env.NOTES, id);
    expect(note).not.toBeNull();
  });

  it("returns null metadata for non-existent note", async () => {
    const meta = await getNoteMetadata(
      env.NOTES,
      "00000000-0000-4000-8000-000000000000"
    );
    expect(meta).toBeNull();
  });
});
