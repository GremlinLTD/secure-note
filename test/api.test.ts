import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import app from "../src/index";

describe("POST /api/notes", () => {
  it("creates a note and returns an id", async () => {
    const res = await app.request(
      "/api/notes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ c: "dGVzdA==", iv: "aXY=", pw: false, ttl: 3600 }),
      },
      env
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });

  it("returns 400 for missing fields", async () => {
    const res = await app.request(
      "/api/notes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iv: "aXY=" }),
      },
      env
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid TTL", async () => {
    const res = await app.request(
      "/api/notes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ c: "dGVzdA==", iv: "aXY=", ttl: 999 }),
      },
      env
    );
    expect(res.status).toBe(400);
  });

  it("applies default TTL and pw when omitted", async () => {
    const res = await app.request(
      "/api/notes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ c: "dGVzdA==", iv: "aXY=" }),
      },
      env
    );
    expect(res.status).toBe(201);
  });
});

describe("GET /api/notes/:id (non-password)", () => {
  it("returns and burns a non-password note on first read", async () => {
    const create = await app.request(
      "/api/notes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ c: "secret", iv: "iv123", pw: false, ttl: 3600 }),
      },
      env
    );
    const { id } = await create.json();

    const get = await app.request(`/api/notes/${id}`, { method: "GET" }, env);
    expect(get.status).toBe(200);
    const note = await get.json();
    expect(note.c).toBe("secret");
    expect(note.iv).toBe("iv123");
    expect(note.pw).toBe(false);

    // Second read should 404 (burned)
    const second = await app.request(`/api/notes/${id}`, { method: "GET" }, env);
    expect(second.status).toBe(404);
  });

  it("returns 404 for non-existent note", async () => {
    const res = await app.request(
      "/api/notes/00000000-0000-4000-8000-000000000000",
      { method: "GET" },
      env
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid UUID", async () => {
    const res = await app.request(
      "/api/notes/not-a-uuid",
      { method: "GET" },
      env
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/notes/:id (password-protected)", () => {
  it("does not burn on first read, returns attempts remaining", async () => {
    const create = await app.request(
      "/api/notes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ c: "pw-secret", iv: "pw-iv", pw: true, ttl: 3600 }),
      },
      env
    );
    const { id } = await create.json();

    // First attempt
    const get1 = await app.request(`/api/notes/${id}`, { method: "GET" }, env);
    expect(get1.status).toBe(200);
    const note1 = await get1.json();
    expect(note1.c).toBe("pw-secret");
    expect(note1.pw).toBe(true);
    expect(note1.attemptsRemaining).toBe(2);

    // Second attempt - still alive
    const get2 = await app.request(`/api/notes/${id}`, { method: "GET" }, env);
    expect(get2.status).toBe(200);
    const note2 = await get2.json();
    expect(note2.attemptsRemaining).toBe(1);

    // Third attempt - auto-burns (remaining = 0)
    const get3 = await app.request(`/api/notes/${id}`, { method: "GET" }, env);
    expect(get3.status).toBe(200);
    const note3 = await get3.json();
    expect(note3.attemptsRemaining).toBe(0);

    // Fourth attempt - 404
    const get4 = await app.request(`/api/notes/${id}`, { method: "GET" }, env);
    expect(get4.status).toBe(404);
  });
});

describe("DELETE /api/notes/:id", () => {
  it("burns a password-protected note after successful decryption", async () => {
    const create = await app.request(
      "/api/notes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ c: "to-delete", iv: "iv", pw: true, ttl: 3600 }),
      },
      env
    );
    const { id } = await create.json();

    // Read the note (doesn't burn for pw notes)
    const get = await app.request(`/api/notes/${id}`, { method: "GET" }, env);
    expect(get.status).toBe(200);

    // Confirm burn
    const del = await app.request(`/api/notes/${id}`, { method: "DELETE" }, env);
    expect(del.status).toBe(200);
    const body = await del.json();
    expect(body.deleted).toBe(true);

    // Now it should be gone
    const get2 = await app.request(`/api/notes/${id}`, { method: "GET" }, env);
    expect(get2.status).toBe(404);
  });

  it("returns 404 for non-existent note", async () => {
    const res = await app.request(
      "/api/notes/00000000-0000-4000-8000-000000000000",
      { method: "DELETE" },
      env
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /api/notes size limit", () => {
  it("returns 413 for payload exceeding MAX_NOTE_SIZE", async () => {
    const largePayload = "x".repeat(2 * 1024 * 1024);
    const res = await app.request(
      "/api/notes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": String(largePayload.length),
        },
        body: JSON.stringify({ c: largePayload, iv: "aXY=", ttl: 3600 }),
      },
      env
    );
    expect(res.status).toBe(413);
  });
});

describe("POST / (alias)", () => {
  it("creates a note same as /api/notes", async () => {
    const res = await app.request(
      "/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ c: "dGVzdA==", iv: "aXY=", ttl: 86400 }),
      },
      env
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
  });
});
