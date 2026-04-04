# Secure Note Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-knowledge, one-time secret sharing service on Cloudflare Workers with Gremlin branding.

**Architecture:** Single Cloudflare Worker using Hono with @hono/zod-openapi for routing/validation/docs. KV for encrypted blob storage with native TTL. Client-side AES-256-GCM encryption via Web Crypto API. Inline HTML served via Hono JSX.

**Tech Stack:** Hono, @hono/zod-openapi, @scalar/hono-api-reference, Cloudflare Workers, KV, Zod, TypeScript, Web Crypto API

**Spec:** `docs/superpowers/specs/2026-04-04-secure-note-design.md`

**Brand guide:** `/Users/trozz/git/gremlin/brand-guide/tokens/tokens.css` for CSS variables, `/Users/trozz/git/gremlin/brand-guide/README.md` for colour reference, `/Users/trozz/git/gremlin/brand-guide/assets/` for logo SVGs.

---

## File Structure

```
secure-note/
├── src/
│   ├── index.ts              # Hono OpenAPIHono app, mount routes, env bindings
│   ├── routes/
│   │   ├── api.ts            # POST /api/notes, GET /api/notes/:id (OpenAPI routes)
│   │   ├── docs.ts           # GET /api/docs (Scalar), GET /api/docs.json (spec)
│   │   └── pages.ts          # GET / (create page), GET /note/:id (reveal page), GET /cli.sh
│   ├── views/
│   │   ├── layout.tsx        # Shared HTML shell: <html>, <head>, brand CSS, CSP nonce
│   │   ├── create.tsx        # Create form + inline JS for encryption + POST
│   │   └── reveal.tsx        # Reveal page + inline JS for decrypt + burn
│   ├── schemas/
│   │   └── notes.ts          # Zod schemas for create request, responses, params
│   ├── crypto.ts             # Client-side JS strings for encryption/decryption (served inline)
│   ├── cli-script.ts         # Shell script content exported as string for GET /cli.sh
│   ├── types.ts              # Shared Bindings type
│   └── kv.ts                 # KV helpers: saveNote, getAndDeleteNote, getNoteMetadata
├── test/
│   ├── api.test.ts           # API endpoint tests (create, burn, 404, validation, 413)
│   ├── kv.test.ts            # KV helper unit tests
│   └── schemas.test.ts       # Schema validation tests
├── cli/
│   ├── cli.sh                # POSIX shell encryption + POST script (uses Python for GCM)
│   └── gremlin-secret/       # Rust CLI (Cargo project)
│       ├── Cargo.toml
│       └── src/main.rs
├── vitest.config.ts
├── wrangler.toml
├── package.json
├── tsconfig.json
└── .gitignore
```

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `wrangler.toml`, `.gitignore`, `src/index.ts`

- [ ] **Step 1: Initialize the Hono project**

```bash
cd /Users/trozz/git/gremlin/secure-note
bun init -y
```

- [ ] **Step 2: Install dependencies**

```bash
bun add hono @hono/zod-openapi @scalar/hono-api-reference zod
bun add -d @cloudflare/workers-types wrangler vitest @cloudflare/vitest-pool-workers
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "lib": ["ESNext"],
    "types": ["@cloudflare/workers-types", "@cloudflare/vitest-pool-workers"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts"]
}
```

- [ ] **Step 4: Create wrangler.toml**

```toml
name = "secure-note"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[vars]
BASE_URL = "https://secure.gremlin.group"
MAX_NOTE_SIZE = "1048576"
DEFAULT_TTL = "604800"

[[kv_namespaces]]
binding = "NOTES"
id = "placeholder-create-via-wrangler"
preview_id = "placeholder-create-via-wrangler"
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.wrangler/
.dev.vars
```

- [ ] **Step 6: Create vitest.config.ts**

```typescript
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.toml" },
      },
    },
  },
});
```

- [ ] **Step 7: Create src/types.ts (shared Bindings)**

```typescript
// src/types.ts
export type Bindings = {
  NOTES: KVNamespace;
  BASE_URL: string;
  MAX_NOTE_SIZE: string;
  DEFAULT_TTL: string;
};
```

- [ ] **Step 8: Create minimal src/index.ts**

```typescript
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Bindings } from "./types";

const app = new OpenAPIHono<{ Bindings: Bindings }>();

app.get("/health", (c) => c.json({ ok: true }));

export default app;
```

- [ ] **Step 9: Verify it runs locally**

Run: `bunx wrangler dev`
Expected: Worker starts, `GET /health` returns `{"ok":true}`

- [ ] **Step 10: Commit**

```bash
git checkout -b feature/secure-note
git add package.json bun.lockb tsconfig.json wrangler.toml .gitignore vitest.config.ts src/index.ts src/types.ts
git commit -m "feat: scaffold Hono Cloudflare Worker project"
```

---

### Task 2: Zod schemas

**Files:**
- Create: `src/schemas/notes.ts`
- Create: `test/schemas.test.ts`

- [ ] **Step 1: Write schema validation tests**

```typescript
// test/schemas.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run test/schemas.test.ts`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement schemas**

```typescript
// src/schemas/notes.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run test/schemas.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/schemas/notes.ts test/schemas.test.ts
git commit -m "feat: add Zod schemas for note creation and retrieval"
```

---

### Task 3: KV helpers

**Files:**
- Create: `src/kv.ts`
- Create: `test/kv.test.ts`

- [ ] **Step 1: Write KV helper tests**

```typescript
// test/kv.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run test/kv.test.ts`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement KV helpers**

```typescript
// src/kv.ts
export interface NoteData {
  c: string;
  iv: string;
  pw: boolean;
  ts: number;
}

export interface NoteInput {
  c: string;
  iv: string;
  pw: boolean;
  ttl: number;
}

export async function saveNote(
  kv: KVNamespace,
  input: NoteInput
): Promise<string> {
  const id = crypto.randomUUID();
  const data: NoteData = {
    c: input.c,
    iv: input.iv,
    pw: input.pw,
    ts: Math.floor(Date.now() / 1000),
  };
  await kv.put(`note:${id}`, JSON.stringify(data), {
    expirationTtl: input.ttl,
  });
  return id;
}

export async function getAndDeleteNote(
  kv: KVNamespace,
  id: string
): Promise<NoteData | null> {
  const key = `note:${id}`;
  const raw = await kv.get(key);
  if (!raw) return null;
  // Delete BEFORE returning -- burn-before-return per spec.
  // If this succeeds but the response never reaches the client, the note is lost.
  // That is the intended security trade-off.
  await kv.delete(key);
  return JSON.parse(raw) as NoteData;
}
// Note: KV delete is not atomic with the read. The delete is issued immediately
// after the read so the window is as small as possible. If the delete fails,
// KV TTL will still expire the note eventually.

export async function getNoteMetadata(
  kv: KVNamespace,
  id: string
): Promise<{ pw: boolean; ts: number } | null> {
  const key = `note:${id}`;
  const raw = await kv.get(key);
  if (!raw) return null;
  const data = JSON.parse(raw) as NoteData;
  return { pw: data.pw, ts: data.ts };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bunx vitest run test/kv.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/kv.ts test/kv.test.ts
git commit -m "feat: add KV helpers for note storage and burn-before-return"
```

---

### Task 4: API routes

**Files:**
- Create: `src/routes/api.ts`
- Create: `test/api.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write API tests**

```typescript
// test/api.test.ts
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
    // Create
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

    // Retrieve (burns it)
    const get = await app.request(`/api/notes/${id}`, { method: "GET" }, env);
    expect(get.status).toBe(200);
    const note = await get.json();
    expect(note.c).toBe("secret");
    expect(note.iv).toBe("iv123");
    expect(note.pw).toBe(true);

    // Second read should 404
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
    const largePayload = "x".repeat(2 * 1024 * 1024); // 2MB
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run test/api.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement API routes**

```typescript
// src/routes/api.ts
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import {
  CreateNoteSchema,
  CreateNoteResponseSchema,
  GetNoteResponseSchema,
  ErrorSchema,
  NoteIdParamSchema,
} from "../schemas/notes";
import { saveNote, getAndDeleteNote } from "../kv";
import type { Bindings } from "../types";

const api = new OpenAPIHono<{ Bindings: Bindings }>();

const createNoteRoute = createRoute({
  method: "post",
  path: "/api/notes",
  tags: ["Notes"],
  summary: "Create a secret note",
  description: "Store an encrypted note that can be read exactly once.",
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
      description: "Payload too large",
    },
  },
});

// Size check is handled by middleware in index.ts -- no duplication here
const createNoteHandler = async (c: any) => {
  const body = c.req.valid("json");
  const id = await saveNote(c.env.NOTES, body);
  return c.json({ id }, 201);
};

api.openapi(createNoteRoute, createNoteHandler);

export { api, createNoteHandler };

const getNoteRoute = createRoute({
  method: "get",
  path: "/api/notes/{id}",
  tags: ["Notes"],
  summary: "Retrieve and destroy a note",
  description: "Returns the encrypted note and permanently deletes it. Cannot be called twice.",
  request: { params: NoteIdParamSchema },
  responses: {
    200: {
      content: { "application/json": { schema: GetNoteResponseSchema } },
      description: "Note returned and destroyed",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Invalid note ID",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Note not found or already destroyed",
    },
  },
});

api.openapi(getNoteRoute, async (c) => {
  const { id } = c.req.valid("param");
  const note = await getAndDeleteNote(c.env.NOTES, id);
  if (!note) {
    return c.json({ error: "Note not found or already destroyed" }, 404);
  }
  return c.json({ c: note.c, iv: note.iv, pw: note.pw }, 200);
});
```

- [ ] **Step 4: Update src/index.ts to mount API routes and POST / alias**

```typescript
// src/index.ts
import { OpenAPIHono } from "@hono/zod-openapi";
import { api } from "./routes/api";
import type { Bindings } from "./types";

const app = new OpenAPIHono<{ Bindings: Bindings }>();

app.route("/", api);

// POST / alias -- shares the same handler as /api/notes
// Imported from api.ts so all middleware (size checks, validation) applies equally
import { createNoteHandler } from "./routes/api";
app.post("/", createNoteHandler);

app.get("/health", (c) => c.json({ ok: true }));

export default app;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bunx vitest run test/api.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/routes/api.ts src/index.ts test/api.test.ts
git commit -m "feat: add API routes for note creation and burn-before-return retrieval"
```

---

### Task 5: OpenAPI docs (Scalar)

**Files:**
- Create: `src/routes/docs.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Create docs route**

```typescript
// src/routes/docs.ts
import { OpenAPIHono } from "@hono/zod-openapi";
import { apiReference } from "@scalar/hono-api-reference";
import type { Bindings } from "../types";

const docs = new OpenAPIHono<{ Bindings: Bindings }>();

docs.doc("/api/docs.json", {
  openapi: "3.1.0",
  info: {
    title: "Gremlin Secure Note",
    version: "1.0.0",
    description:
      "Zero-knowledge, one-time secret sharing. Notes are encrypted client-side and destroyed after a single read.",
  },
});

docs.get(
  "/api/docs",
  apiReference({
    spec: { url: "/api/docs.json" },
    theme: "moon",
    pageTitle: "Gremlin Secure Note API",
  })
);

export { docs };
```

- [ ] **Step 2: Mount docs in src/index.ts**

Add `import { docs } from "./routes/docs";` and `app.route("/", docs);` before the api route mount.

- [ ] **Step 3: Verify manually**

Run: `bunx wrangler dev`
Visit `http://localhost:8787/api/docs` -- should render Scalar UI with the two note endpoints.
Visit `http://localhost:8787/api/docs.json` -- should return OpenAPI JSON spec.

- [ ] **Step 4: Commit**

```bash
git add src/routes/docs.ts src/index.ts
git commit -m "feat: add Scalar API documentation at /api/docs"
```

---

### Task 6: Shared layout (Hono JSX)

**Files:**
- Create: `src/views/layout.tsx`

- [ ] **Step 1: Create the shared HTML layout**

This is the base HTML shell used by both pages. Includes Gremlin brand CSS tokens inline, CSP nonce support, responsive meta tags, and the logo SVG.

Reference the brand guide at `/Users/trozz/git/gremlin/brand-guide/tokens/tokens.css` for the CSS variables and `/Users/trozz/git/gremlin/brand-guide/assets/logo-reversed.svg` for the white logo (dark backgrounds). Copy the SVG inline rather than referencing an external file.

```tsx
// src/views/layout.tsx
import type { FC, PropsWithChildren } from "hono/jsx";

interface LayoutProps {
  title: string;
  nonce: string;
}

export const Layout: FC<PropsWithChildren<LayoutProps>> = ({
  title,
  nonce,
  children,
}) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <style nonce={nonce}>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --electric-teal: #00D4AA;
          --deep-midnight: #1A1F36;
          --energetic-coral: #FF6B6B;
          --bright-sky: #4ECDC4;
          --cloud-grey: #F7F9FB;
          --steel-grey: #95A1B5;
          --charcoal: #556178;
          --surface: #141829;
          --surface-raised: #1C2135;
          --border: #2A3142;
          --text-primary: #E8EBF0;
          --text-secondary: #A8B2C7;
          --font-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          --font-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, monospace;
          --radius-md: 8px;
          --radius-lg: 12px;
          --shadow-md: 0 4px 12px rgba(0,0,0,0.3);
        }
        body {
          font-family: var(--font-primary);
          background: var(--deep-midnight);
          color: var(--text-primary);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem 1rem;
        }
        .container {
          width: 100%;
          max-width: 560px;
        }
        .logo {
          text-align: center;
          margin-bottom: 2rem;
        }
        .logo svg { height: 32px; }
        .card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 2rem;
          box-shadow: var(--shadow-md);
        }
        h1 {
          font-size: 1.5rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        p.subtitle {
          color: var(--text-secondary);
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
        }
        label {
          display: block;
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin-bottom: 0.375rem;
        }
        textarea, input[type="password"], input[type="text"], select {
          width: 100%;
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-family: var(--font-mono);
          font-size: 0.875rem;
          padding: 0.75rem;
          outline: none;
          transition: border-color 0.15s;
        }
        textarea:focus, input:focus, select:focus {
          border-color: var(--electric-teal);
        }
        textarea { resize: vertical; min-height: 120px; }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: var(--radius-md);
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .btn:hover { opacity: 0.9; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary {
          background: var(--electric-teal);
          color: var(--deep-midnight);
        }
        .btn-danger {
          background: var(--energetic-coral);
          color: white;
        }
        .form-group { margin-bottom: 1rem; }
        .link-box {
          background: var(--surface-raised);
          border: 1px solid var(--electric-teal);
          border-radius: var(--radius-md);
          padding: 0.75rem;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          word-break: break-all;
          color: var(--electric-teal);
          margin-bottom: 1rem;
        }
        .secret-box {
          background: var(--surface-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 1rem;
          font-family: var(--font-mono);
          font-size: 0.875rem;
          white-space: pre-wrap;
          word-break: break-word;
          margin-bottom: 1rem;
        }
        .warning {
          color: var(--energetic-coral);
          font-size: 0.8rem;
          margin-top: 0.5rem;
        }
        .success {
          color: var(--electric-teal);
          font-size: 0.875rem;
        }
        .burned-msg {
          text-align: center;
          color: var(--text-secondary);
          padding: 2rem;
        }
        .burned-msg h2 {
          color: var(--energetic-coral);
          margin-bottom: 0.5rem;
        }
        .footer {
          text-align: center;
          color: var(--steel-grey);
          font-size: 0.75rem;
          margin-top: 2rem;
        }
        .footer a { color: var(--electric-teal); text-decoration: none; }
        .hidden { display: none; }
        .row { display: flex; gap: 1rem; }
        .row > * { flex: 1; }
      `}</style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          {/* Inline the reversed logo SVG from brand-guide/assets/logo-reversed.svg */}
          {/* Read the actual SVG content from the brand guide and paste here */}
        </div>
        {children}
        <div class="footer">
          <p>Powered by <a href="https://gremlin.group">gremlin.</a></p>
        </div>
      </div>
    </body>
  </html>
);
```

**Important:** Read `/Users/trozz/git/gremlin/brand-guide/assets/logo-reversed.svg` and inline its content into the logo div, replacing the comment placeholder.

- [ ] **Step 2: Commit**

```bash
git add src/views/layout.tsx
git commit -m "feat: add shared Hono JSX layout with Gremlin brand styling"
```

---

### Task 7: Create page (frontend)

**Files:**
- Create: `src/views/create.tsx`
- Create: `src/crypto.ts`
- Modify: `src/routes/pages.ts` (create)
- Modify: `src/index.ts`

- [ ] **Step 1: Create the client-side crypto JS module**

This file exports JS source code as a string to be inlined in `<script>` tags. It contains the Web Crypto API encryption logic.

```typescript
// src/crypto.ts
export function getEncryptScript(): string {
  return `
    async function generateKey() {
      return crypto.getRandomValues(new Uint8Array(32));
    }

    function toBase64Url(bytes) {
      const bin = String.fromCharCode(...bytes);
      return btoa(bin).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
    }

    function toBase64(bytes) {
      return btoa(String.fromCharCode(...bytes));
    }

    async function deriveKey(password, rawKey) {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
      );
      const derived = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: rawKey, iterations: 600000, hash: "SHA-256" },
        keyMaterial,
        256
      );
      return new Uint8Array(derived);
    }

    async function encryptSecret(plaintext, password) {
      const rawKey = await generateKey();
      let keyBytes = rawKey;
      if (password) {
        keyBytes = await deriveKey(password, rawKey);
      }
      const key = await crypto.subtle.importKey(
        "raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]
      );
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode(plaintext);
      const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded)
      );
      return {
        c: toBase64(ciphertext),
        iv: toBase64(iv),
        rawKey: toBase64Url(rawKey),
      };
    }
  `;
}

export function getDecryptScript(): string {
  return `
    function fromBase64Url(str) {
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4) str += '=';
      const bin = atob(str);
      return new Uint8Array([...bin].map(c => c.charCodeAt(0)));
    }

    function fromBase64(str) {
      const bin = atob(str);
      return new Uint8Array([...bin].map(c => c.charCodeAt(0)));
    }

    async function deriveKey(password, rawKey) {
      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]
      );
      const derived = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: rawKey, iterations: 600000, hash: "SHA-256" },
        keyMaterial,
        256
      );
      return new Uint8Array(derived);
    }

    async function decryptSecret(c, iv, rawKeyB64, password) {
      const rawKey = fromBase64Url(rawKeyB64);
      let keyBytes = rawKey;
      if (password) {
        keyBytes = await deriveKey(password, rawKey);
      }
      const key = await crypto.subtle.importKey(
        "raw", keyBytes, { name: "AES-GCM" }, false, ["decrypt"]
      );
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64(iv) },
        key,
        fromBase64(c)
      );
      return new TextDecoder().decode(decrypted);
    }
  `;
}
```

- [ ] **Step 2: Create the create page view**

```tsx
// src/views/create.tsx
import type { FC } from "hono/jsx";
import { Layout } from "./layout";
import { getEncryptScript } from "../crypto";

interface CreatePageProps {
  nonce: string;
  baseUrl: string;
}

export const CreatePage: FC<CreatePageProps> = ({ nonce, baseUrl }) => (
  <Layout title="Gremlin Secure Note" nonce={nonce}>
    <div class="card">
      <h1>Create a Secure Note</h1>
      <p class="subtitle">
        Your note is encrypted in your browser. We never see the contents.
      </p>

      <div id="create-form">
        <div class="form-group">
          <label for="secret">Secret</label>
          <textarea id="secret" placeholder="Enter your secret..." rows={6}></textarea>
        </div>

        <div class="row">
          <div class="form-group">
            <label for="password">Password (optional)</label>
            <input type="password" id="password" placeholder="Extra protection" />
          </div>
          <div class="form-group">
            <label for="ttl">Expires after</label>
            <select id="ttl">
              <option value="3600">1 hour</option>
              <option value="86400">24 hours</option>
              <option value="604800" selected>1 week</option>
              <option value="2592000">30 days</option>
            </select>
          </div>
        </div>

        <button class="btn btn-primary" id="create-btn" onclick="handleCreate()">
          Create Secret Link
        </button>
      </div>

      <div id="result" class="hidden">
        <p class="success">Secret link created. Share it with the recipient:</p>
        <div class="link-box" id="link-display"></div>
        <button class="btn btn-primary" onclick="copyLink()">Copy Link</button>
        <p class="warning">This link can only be viewed once. After that, the note is permanently destroyed.</p>
      </div>
    </div>

    <script nonce={nonce}>{getEncryptScript()}</script>
    <script nonce={nonce}>{`
      const BASE_URL = ${JSON.stringify(baseUrl)};

      async function handleCreate() {
        const secret = document.getElementById('secret').value;
        if (!secret.trim()) return;

        const btn = document.getElementById('create-btn');
        btn.disabled = true;
        btn.textContent = 'Encrypting...';

        try {
          const password = document.getElementById('password').value || null;
          const ttl = parseInt(document.getElementById('ttl').value, 10);

          const { c, iv, rawKey } = await encryptSecret(secret, password);

          const res = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ c, iv, pw: !!password, ttl }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to create note');
          }

          const { id } = await res.json();
          const link = BASE_URL + '/note/' + id + '#' + rawKey;

          document.getElementById('link-display').textContent = link;
          document.getElementById('create-form').classList.add('hidden');
          document.getElementById('result').classList.remove('hidden');
          window._link = link;
        } catch (e) {
          alert('Error: ' + e.message);
          btn.disabled = false;
          btn.textContent = 'Create Secret Link';
        }
      }

      function copyLink() {
        navigator.clipboard.writeText(window._link).then(() => {
          const btn = event.target;
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy Link'; }, 2000);
        });
      }
    `}</script>
  </Layout>
);
```

- [ ] **Step 3: Create the pages route**

```typescript
// src/routes/pages.ts
import { Hono } from "hono";
import { CreatePage } from "../views/create";
import { RevealPage } from "../views/reveal";
import { getNoteMetadata } from "../kv";
import type { Bindings } from "../types";

const pages = new Hono<{ Bindings: Bindings }>();

pages.get("/", (c) => {
  const nonce = crypto.randomUUID();
  const baseUrl = c.env.BASE_URL || "https://secure.gremlin.group";
  return c.html(<CreatePage nonce={nonce} baseUrl={baseUrl} />, 200, {
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'`,
  });
});

pages.get("/note/:id", async (c) => {
  const id = c.req.param("id");
  const meta = await getNoteMetadata(c.env.NOTES, id);
  const nonce = crypto.randomUUID();
  return c.html(
    <RevealPage nonce={nonce} noteId={id} exists={!!meta} pw={meta?.pw ?? false} ts={meta?.ts ?? 0} />,
    meta ? 200 : 404,
    {
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'`,
    }
  );
});

export { pages };
```

- [ ] **Step 4: Mount pages in src/index.ts**

Add `import { pages } from "./routes/pages";` and `app.route("/", pages);` -- mount pages AFTER api routes so POST / alias works correctly.

- [ ] **Step 5: Verify manually**

Run: `bunx wrangler dev`
Visit `http://localhost:8787/` -- should render the create form with Gremlin branding.

- [ ] **Step 6: Commit**

```bash
git add src/crypto.ts src/views/create.tsx src/routes/pages.ts src/index.ts
git commit -m "feat: add create page with client-side encryption"
```

---

### Task 8: Reveal page (frontend)

**Files:**
- Create: `src/views/reveal.tsx`

- [ ] **Step 1: Create the reveal page view**

```tsx
// src/views/reveal.tsx
import type { FC } from "hono/jsx";
import { Layout } from "./layout";
import { getDecryptScript } from "../crypto";

interface RevealPageProps {
  nonce: string;
  noteId: string;
  exists: boolean;
  pw: boolean;
  ts: number;
}

export const RevealPage: FC<RevealPageProps> = ({ nonce, noteId, exists, pw, ts }) => (
  <Layout title="Secure Note" nonce={nonce}>
    {exists ? (
      <div class="card">
        <div id="pre-reveal">
          <h1>You have received a secure note</h1>
          <p class="subtitle">
            Click below to reveal. The note will be permanently destroyed after viewing.
          </p>

          {pw && (
            <div class="form-group">
              <label for="password">This note requires a password</label>
              <input type="password" id="password" placeholder="Enter password" />
            </div>
          )}

          <button class="btn btn-danger" id="reveal-btn" onclick="handleReveal()">
            Reveal Secret
          </button>
        </div>

        <div id="post-reveal" class="hidden">
          <h1>Secret Note</h1>
          <div class="secret-box" id="secret-display"></div>
          <p class="warning">This note has been permanently destroyed and cannot be viewed again.</p>
        </div>

        <div id="error-msg" class="hidden burned-msg">
          <h2>Decryption Failed</h2>
          <p>The password may be incorrect, or the link may be corrupted.</p>
        </div>
      </div>
    ) : (
      <div class="card">
        <div class="burned-msg">
          <h2>Note Not Found</h2>
          <p>This note no longer exists. It may have already been viewed or expired.</p>
        </div>
      </div>
    )}

    {exists && (
      <script nonce={nonce}>{getDecryptScript()}{`
        const NOTE_ID = ${JSON.stringify(noteId)};
        const HAS_PASSWORD = ${JSON.stringify(pw)};

        async function handleReveal() {
          const rawKey = window.location.hash.slice(1);
          if (!rawKey) {
            alert('Invalid link: missing decryption key');
            return;
          }

          const btn = document.getElementById('reveal-btn');
          btn.disabled = true;
          btn.textContent = 'Retrieving...';

          try {
            const res = await fetch('/api/notes/' + NOTE_ID);
            if (!res.ok) {
              if (res.status === 404) {
                document.getElementById('pre-reveal').classList.add('hidden');
                document.getElementById('post-reveal').innerHTML = '<div class="burned-msg"><h2>Note Not Found</h2><p>This note has already been viewed or expired.</p></div>';
                document.getElementById('post-reveal').classList.remove('hidden');
                return;
              }
              throw new Error('Failed to retrieve note');
            }

            const { c, iv } = await res.json();
            const password = HAS_PASSWORD ? (document.getElementById('password')?.value || '') : null;
            const plaintext = await decryptSecret(c, iv, rawKey, password);

            document.getElementById('secret-display').textContent = plaintext;
            document.getElementById('pre-reveal').classList.add('hidden');
            document.getElementById('post-reveal').classList.remove('hidden');
          } catch (e) {
            document.getElementById('pre-reveal').classList.add('hidden');
            document.getElementById('error-msg').classList.remove('hidden');
          }
        }
      `}</script>
    )}
  </Layout>
);
```

- [ ] **Step 2: Verify full flow manually**

Run: `bunx wrangler dev`
1. Visit `/` -- create a note with some text
2. Copy the generated link
3. Open the link -- see the reveal page
4. Click "Reveal Secret" -- see the decrypted text
5. Reload the page -- should show "Note Not Found"
6. Test with a password-protected note

- [ ] **Step 3: Commit**

```bash
git add src/views/reveal.tsx
git commit -m "feat: add reveal page with client-side decryption and burn confirmation"
```

---

### Task 9: CLI shell script

**Files:**
- Create: `cli/cli.sh`
- Modify: `src/routes/pages.ts` (add GET /cli.sh)

- [ ] **Step 1: Create the shell script**

OpenSSL's `enc` command does not reliably support AES-256-GCM (auth tag handling varies by version). The script uses an embedded Python one-liner for encryption instead. Python 3 with `cryptography` or the stdlib `hashlib`/`os` is available on most systems. We use only stdlib modules to avoid extra dependencies.

```bash
#!/bin/sh
# gremlin-secret: one-time secret sharing via Gremlin Secure Note
# Usage: echo "my secret" | ./cli.sh [--ttl SECONDS] [--url BASE_URL]
# Password: set GREMLIN_SECRET_PASSWORD env var (not a CLI arg, for security)
# Requires: python3, curl
set -eu

BASE_URL="${GREMLIN_SECRET_URL:-https://secure.gremlin.group}"
TTL=604800
PASSWORD="${GREMLIN_SECRET_PASSWORD:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --url) BASE_URL="$2"; shift 2 ;;
    --ttl) TTL="$2"; shift 2 ;;
    *)     echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Read secret from stdin
SECRET="$(cat)"
if [ -z "$SECRET" ]; then
  echo "Error: no secret provided on stdin" >&2
  exit 1
fi

# Use Python for AES-256-GCM encryption (stdlib only via ctypes or cryptography)
# This outputs: base64_ciphertext base64_iv base64url_rawkey pw_flag
CRYPTO_OUTPUT="$(printf '%s' "$SECRET" | python3 -c "
import sys, os, json, base64, hashlib, hmac

secret = sys.stdin.buffer.read()
password = os.environ.get('GREMLIN_SECRET_PASSWORD', '')

raw_key = os.urandom(32)

if password:
    dk = hashlib.pbkdf2_hmac('sha256', password.encode(), raw_key, 600000, dklen=32)
    enc_key = dk
    pw_flag = True
else:
    enc_key = raw_key
    pw_flag = False

iv = os.urandom(12)

# Use cryptography library for AES-GCM
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
aesgcm = AESGCM(enc_key)
ct = aesgcm.encrypt(iv, secret, None)  # ct includes auth tag

c_b64 = base64.b64encode(ct).decode()
iv_b64 = base64.b64encode(iv).decode()
key_b64url = base64.urlsafe_b64encode(raw_key).decode().rstrip('=')

print(f'{c_b64} {iv_b64} {key_b64url} {str(pw_flag).lower()}')
")"

C_B64="$(echo "$CRYPTO_OUTPUT" | cut -d' ' -f1)"
IV_B64="$(echo "$CRYPTO_OUTPUT" | cut -d' ' -f2)"
RAW_KEY_B64="$(echo "$CRYPTO_OUTPUT" | cut -d' ' -f3)"
PW_FLAG="$(echo "$CRYPTO_OUTPUT" | cut -d' ' -f4)"

# POST to server
RESPONSE="$(curl -s -X POST "$BASE_URL/api/notes" \
  -H "Content-Type: application/json" \
  -d "{\"c\":\"$C_B64\",\"iv\":\"$IV_B64\",\"pw\":$PW_FLAG,\"ttl\":$TTL}")"

ID="$(printf '%s' "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)" || {
  echo "Error: failed to create note" >&2
  echo "$RESPONSE" >&2
  exit 1
}

echo "${BASE_URL}/note/${ID}#${RAW_KEY_B64}"
```

**Dependencies:** python3 with `cryptography` package. Not part of stdlib, so the script should check for it and print an install hint if missing. Add this check at the top of the Python block:

```python
try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError:
    print('Error: python3 cryptography package required. Install with: pip3 install cryptography', file=sys.stderr)
    sys.exit(1)
```

Alternatively, for the Rust CLI which has no external runtime dependencies, recommend users who want zero-dependency CLI use the Rust binary instead.

- [ ] **Step 2: Add GET /cli.sh route**

Create `src/cli-script.ts` that exports the shell script as a string constant. Then add the route in `src/routes/pages.ts`:

```typescript
// src/cli-script.ts
export const CLI_SCRIPT = `#!/bin/sh
# gremlin-secret: one-time secret sharing via Gremlin Secure Note
# ... (full shell script content from cli/cli.sh -- copy the entire script here as a template literal)
`;
```

```typescript
// In src/routes/pages.ts
import { CLI_SCRIPT } from "../cli-script";

pages.get("/cli.sh", (c) => {
  const script = CLI_SCRIPT.replace(
    "https://secure.gremlin.group",
    c.env.BASE_URL || "https://secure.gremlin.group"
  );
  return new Response(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="gremlin-secret.sh"',
    },
  });
});
```

The `cli-script.ts` should contain the full shell script from `cli/cli.sh` as a string export, with the default BASE_URL that gets replaced at serve time.

- [ ] **Step 3: Test the script manually**

```bash
echo "hello world" | sh cli/cli.sh --url http://localhost:8787
```

Expected: prints a URL. Open it in browser, click Reveal, see "hello world".

- [ ] **Step 4: Commit**

```bash
git add cli/cli.sh src/routes/pages.ts
git commit -m "feat: add POSIX shell script CLI for secret creation"
```

---

### Task 10: Rust CLI

**Files:**
- Create: `cli/gremlin-secret/Cargo.toml`
- Create: `cli/gremlin-secret/src/main.rs`

- [ ] **Step 1: Create Cargo.toml**

```toml
[package]
name = "gremlin-secret"
version = "0.1.0"
edition = "2021"
description = "CLI for Gremlin Secure Note - one-time secret sharing"

[dependencies]
aes-gcm = "0.10"
base64 = "0.22"
clap = { version = "4", features = ["derive"] }
pbkdf2 = { version = "0.12", features = ["simple"] }
rand = "0.8"
reqwest = { version = "0.12", features = ["blocking", "json"] }
rpassword = "5"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sha2 = "0.10"
hmac = "0.12"
```

- [ ] **Step 2: Create src/main.rs**

```rust
use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
use base64::{engine::general_purpose, Engine as _};
use clap::Parser;
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::io::{self, Read};

#[derive(Parser)]
#[command(name = "gremlin-secret", about = "One-time secret sharing CLI")]
struct Args {
    #[arg(long, default_value = "https://secure.gremlin.group")]
    base_url: String,

    #[arg(long, default_value = "604800")]
    ttl: u32,

    #[arg(long, help = "Prompt for a password interactively")]
    password: bool,
}

#[derive(Serialize)]
struct CreateRequest {
    c: String,
    iv: String,
    pw: bool,
    ttl: u32,
}

#[derive(Deserialize)]
struct CreateResponse {
    id: String,
}

fn to_base64url(bytes: &[u8]) -> String {
    general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    let mut secret = String::new();
    io::stdin().read_to_string(&mut secret)?;
    if secret.is_empty() {
        eprintln!("Error: no secret provided on stdin");
        std::process::exit(1);
    }

    // Generate random 32-byte key
    let mut raw_key = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut raw_key);

    // Derive key if password flag is set -- read password from terminal (not CLI arg)
    let enc_key = if args.password {
        eprint!("Password: ");
        let pw = rpassword::read_password().expect("failed to read password");
        let mut derived = [0u8; 32];
        pbkdf2_hmac::<Sha256>(pw.as_bytes(), &raw_key, 600_000, &mut derived);
        derived
    } else {
        raw_key
    };

    // Generate random 12-byte IV
    let mut iv_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut iv_bytes);

    // Encrypt
    let cipher = Aes256Gcm::new_from_slice(&enc_key)?;
    let nonce = Nonce::from_slice(&iv_bytes);
    let ciphertext = cipher.encrypt(nonce, secret.as_bytes())
        .map_err(|e| format!("encryption failed: {}", e))?;

    let req = CreateRequest {
        c: general_purpose::STANDARD.encode(&ciphertext),
        iv: general_purpose::STANDARD.encode(&iv_bytes),
        pw: args.password,
        ttl: args.ttl,
    };

    let client = reqwest::blocking::Client::new();
    let res = client
        .post(format!("{}/api/notes", args.base_url))
        .json(&req)
        .send()?;

    if !res.status().is_success() {
        let body = res.text()?;
        eprintln!("Error: {}", body);
        std::process::exit(1);
    }

    let resp: CreateResponse = res.json()?;
    let raw_key_b64 = to_base64url(&raw_key);
    println!("{}/note/{}#{}", args.base_url, resp.id, raw_key_b64);

    Ok(())
}
```

- [ ] **Step 3: Build and test**

```bash
cd cli/gremlin-secret
cargo build
echo "test secret" | cargo run -- --base-url http://localhost:8787
```

Expected: prints a URL. Open in browser, click Reveal, see "test secret".

- [ ] **Step 4: Commit**

```bash
git add cli/gremlin-secret/Cargo.toml cli/gremlin-secret/src/main.rs
git commit -m "feat: add Rust CLI for secret creation"
```

---

### Task 11: Rate limiting, size enforcement, final wiring

**Files:**
- Modify: `src/index.ts`
- Modify: `src/routes/api.ts`

- [ ] **Step 1: Add size enforcement middleware**

In `src/index.ts`, add middleware before API routes:

```typescript
app.use("/api/notes", async (c, next) => {
  if (c.req.method === "POST") {
    const maxSize = parseInt(c.env.MAX_NOTE_SIZE || "1048576", 10);
    const contentLength = parseInt(c.req.header("content-length") || "0", 10);
    if (contentLength > maxSize) {
      return c.json({ error: "Note too large" }, 413);
    }
  }
  await next();
});
```

- [ ] **Step 2: Add rate limiting note**

Cloudflare rate limiting is configured via the Cloudflare dashboard or wrangler rules, not in Worker code. Add a comment in `wrangler.toml`:

```toml
# Rate limiting: configure via Cloudflare dashboard
# POST /api/notes: 10 req/min per IP
# GET /api/notes/*: 30 req/min per IP
```

- [ ] **Step 3: Verify final route order in src/index.ts**

The final `src/index.ts` should mount routes in this order:
1. Size enforcement middleware
2. `docs` routes (Scalar + OpenAPI spec)
3. `api` routes (POST /api/notes, GET /api/notes/:id)
4. POST / alias
5. `pages` routes (GET /, GET /note/:id, GET /cli.sh)
6. Health check

- [ ] **Step 4: Run all tests**

Run: `bunx vitest run`
Expected: All tests pass.

- [ ] **Step 5: Full manual smoke test**

1. `bunx wrangler dev`
2. Create a note via web UI at `/`
3. Open the link, reveal it
4. Verify it 404s on second load
5. Create a password-protected note
6. Reveal with correct password
7. Try with wrong password (should show decrypt error)
8. Check `/api/docs` renders
9. Check `/api/docs.json` returns spec
10. Check `/health` returns ok

- [ ] **Step 6: Commit**

```bash
git add src/index.ts wrangler.toml
git commit -m "feat: add size enforcement middleware and finalize route wiring"
```

---

### Task 12: KV namespace setup and deploy

**Files:**
- Modify: `wrangler.toml`

- [ ] **Step 1: Create KV namespace**

```bash
bunx wrangler kv namespace create NOTES
bunx wrangler kv namespace create NOTES --preview
```

Copy the IDs from the output and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "NOTES"
id = "<production-id-from-output>"
preview_id = "<preview-id-from-output>"
```

- [ ] **Step 2: Deploy**

```bash
bunx wrangler deploy
```

- [ ] **Step 3: Configure custom domain**

Set up `secure.gremlin.group` via Cloudflare dashboard to point to this Worker.

- [ ] **Step 4: Smoke test on production**

Repeat the manual smoke test from Task 11 against the live URL.

- [ ] **Step 5: Commit**

```bash
git add wrangler.toml
git commit -m "chore: add KV namespace IDs for production deployment"
```

---

### Task 13: Final cleanup and PR

- [ ] **Step 1: Run all tests one final time**

Run: `bunx vitest run`
Expected: All pass.

- [ ] **Step 2: Push and create PR**

```bash
git push -u origin feature/secure-note
gh pr create --title "feat: one-time secret sharing service" --body "..."
```
