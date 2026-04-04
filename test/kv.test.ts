import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { saveNote, getAndDeleteNote, getAndDecrementViews, getNoteMetadata, incrementAttempts, deleteNote, isIpAllowed } from "../src/kv";

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

  it("stores absolute expiration timestamp", async () => {
    const id = await saveNote(env.NOTES, {
      c: "expiry-test",
      iv: "iv",
      pw: true,
      ttl: 3600,
    });

    const note = await getAndDeleteNote(env.NOTES, id);
    expect(note).not.toBeNull();
    expect(note!.exp).toBeTypeOf("number");
    expect(note!.exp).toBeGreaterThan(note!.ts);
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

describe("getAndDecrementViews", () => {
  it("allows multiple views and burns on the last one", async () => {
    const id = await saveNote(env.NOTES, {
      c: "multi",
      iv: "iv",
      pw: false,
      ttl: 3600,
      maxViews: 3,
    });

    const r1 = await getAndDecrementViews(env.NOTES, id);
    expect(r1).not.toBeNull();
    expect(r1!.remaining).toBe(2);

    const r2 = await getAndDecrementViews(env.NOTES, id);
    expect(r2).not.toBeNull();
    expect(r2!.remaining).toBe(1);

    const r3 = await getAndDecrementViews(env.NOTES, id);
    expect(r3).not.toBeNull();
    expect(r3!.remaining).toBe(0);

    const r4 = await getAndDecrementViews(env.NOTES, id);
    expect(r4).toBeNull();
  });

  it("returns null for non-existent note", async () => {
    const r = await getAndDecrementViews(env.NOTES, "00000000-0000-4000-8000-000000000000");
    expect(r).toBeNull();
  });
});

describe("burnMsg", () => {
  it("stores and returns burnMsg in metadata", async () => {
    const id = await saveNote(env.NOTES, {
      c: "burn-test",
      iv: "iv",
      pw: false,
      ttl: 3600,
      burnMsg: "Thanks for reading!",
    });

    const meta = await getNoteMetadata(env.NOTES, id);
    expect(meta).not.toBeNull();
    expect(meta!.burnMsg).toBe("Thanks for reading!");
  });

  it("omits burnMsg from metadata when not set", async () => {
    const id = await saveNote(env.NOTES, {
      c: "no-burn-msg",
      iv: "iv",
      pw: false,
      ttl: 3600,
    });

    const meta = await getNoteMetadata(env.NOTES, id);
    expect(meta).not.toBeNull();
    expect(meta!.burnMsg).toBeUndefined();
  });
});

describe("isIpAllowed", () => {
  it("returns true when allowedIps is empty", () => {
    expect(isIpAllowed("1.2.3.4", [])).toBe(true);
  });

  it("returns true for an exact IP match", () => {
    expect(isIpAllowed("10.0.0.5", ["10.0.0.5", "192.168.1.1"])).toBe(true);
  });

  it("returns false when IP does not match any entry", () => {
    expect(isIpAllowed("10.0.0.6", ["10.0.0.5", "192.168.1.1"])).toBe(false);
  });

  it("returns true for an IP within a /24 CIDR range", () => {
    expect(isIpAllowed("203.0.113.42", ["203.0.113.0/24"])).toBe(true);
  });

  it("returns false for an IP outside a /24 CIDR range", () => {
    expect(isIpAllowed("203.0.114.1", ["203.0.113.0/24"])).toBe(false);
  });

  it("returns true for the network address itself in CIDR", () => {
    expect(isIpAllowed("10.0.0.0", ["10.0.0.0/8"])).toBe(true);
  });

  it("matches exact IPv6 address", () => {
    expect(isIpAllowed("2001:db8::1", ["2001:db8::1"])).toBe(true);
    expect(isIpAllowed("2001:db8::2", ["2001:db8::1"])).toBe(false);
  });

  it("matches IPv6 CIDR /48", () => {
    expect(isIpAllowed("2001:db8:1::1", ["2001:db8:1::/48"])).toBe(true);
    expect(isIpAllowed("2001:db8:2::1", ["2001:db8:1::/48"])).toBe(false);
  });

  it("matches IPv6 CIDR /64", () => {
    expect(isIpAllowed("2001:db8:1:2::ffff", ["2001:db8:1:2::/64"])).toBe(true);
    expect(isIpAllowed("2001:db8:1:3::1", ["2001:db8:1:2::/64"])).toBe(false);
  });

  it("matches IPv6 loopback", () => {
    expect(isIpAllowed("::1", ["::1"])).toBe(true);
  });

  it("matches IPv4-mapped IPv6 against IPv4 rule", () => {
    expect(isIpAllowed("::ffff:10.0.0.5", ["10.0.0.5"])).toBe(true);
    expect(isIpAllowed("::ffff:10.0.0.5", ["10.0.0.0/24"])).toBe(true);
  });

  it("matches IPv4 against IPv4-mapped IPv6 rule", () => {
    expect(isIpAllowed("10.0.0.5", ["::ffff:10.0.0.5"])).toBe(true);
  });

  it("matches IPv6 /128 (exact)", () => {
    expect(isIpAllowed("2001:db8::1", ["2001:db8::1/128"])).toBe(true);
    expect(isIpAllowed("2001:db8::2", ["2001:db8::1/128"])).toBe(false);
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

    const meta = await getNoteMetadata(env.NOTES, id);
    expect(meta).toBeNull();
  });

  it("returns false for non-existent note", async () => {
    const deleted = await deleteNote(env.NOTES, "00000000-0000-4000-8000-000000000000");
    expect(deleted).toBe(false);
  });
});
