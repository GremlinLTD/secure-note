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

describe("GET /api/notes/:id", () => {
  it("returns and burns a note", async () => {
    const create = await app.request(
      "/api/notes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ c: "secret", iv: "iv123", pw: true, ttl: 3600 }),
      },
      env
    );
    const { id } = await create.json();

    const get = await app.request(`/api/notes/${id}`, { method: "GET" }, env);
    expect(get.status).toBe(200);
    const note = await get.json();
    expect(note.c).toBe("secret");
    expect(note.iv).toBe("iv123");
    expect(note.pw).toBe(true);

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
