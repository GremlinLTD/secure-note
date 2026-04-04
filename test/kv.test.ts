import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { saveNote, getAndDeleteNote, getNoteMetadata, getNote, incrementAttempts, deleteNote } from "../src/kv";

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

describe("getNote (non-destructive read)", () => {
  it("reads without deleting", async () => {
    const id = await saveNote(env.NOTES, {
      c: "peek",
      iv: "iv",
      pw: true,
      ttl: 3600,
    });

    const note = await getNote(env.NOTES, id);
    expect(note).not.toBeNull();
    expect(note!.c).toBe("peek");

    const again = await getNote(env.NOTES, id);
    expect(again).not.toBeNull();
  });
});

describe("incrementAttempts", () => {
  it("increments attempts and returns remaining count", async () => {
    const id = await saveNote(env.NOTES, {
      c: "pw-note",
      iv: "iv",
      pw: true,
      ttl: 3600,
    });

    const r1 = await incrementAttempts(env.NOTES, id);
    expect(r1).not.toBeNull();
    expect(r1!.remaining).toBe(2);

    const r2 = await incrementAttempts(env.NOTES, id);
    expect(r2).not.toBeNull();
    expect(r2!.remaining).toBe(1);

    const r3 = await incrementAttempts(env.NOTES, id);
    expect(r3).not.toBeNull();
    expect(r3!.remaining).toBe(0);

    const r4 = await incrementAttempts(env.NOTES, id);
    expect(r4).toBeNull();
  });
});

describe("deleteNote", () => {
  it("deletes an existing note", async () => {
    const id = await saveNote(env.NOTES, {
      c: "del",
      iv: "iv",
      pw: true,
      ttl: 3600,
    });

    const deleted = await deleteNote(env.NOTES, id);
    expect(deleted).toBe(true);

    const gone = await getNote(env.NOTES, id);
    expect(gone).toBeNull();
  });

  it("returns false for non-existent note", async () => {
    const deleted = await deleteNote(env.NOTES, "00000000-0000-4000-8000-000000000000");
    expect(deleted).toBe(false);
  });
});
