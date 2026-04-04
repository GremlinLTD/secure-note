# Gremlin Secure Note -- Design Spec

One-time secret sharing service hosted on Cloudflare Workers. Zero-knowledge encryption ensures neither Cloudflare nor the operator can decrypt stored secrets.

## Overview

A single Cloudflare Worker (Hono framework) serves both the API and inline HTML frontend. Secrets are encrypted client-side with AES-256-GCM before being sent to the server. The decryption key exists only in the URL fragment (never transmitted to the server). Notes are destroyed on read (burn-before-return) and auto-expire via KV TTL.

**Domain:** `secure.gremlin.group` (configurable via `BASE_URL` env var)

## Encryption Model

### Create flow

1. Client generates a random 256-bit AES key using Web Crypto API
2. Client encrypts plaintext with AES-256-GCM, producing ciphertext + IV
3. If password is set: the random key is further derived via PBKDF2 before encryption (see Cryptographic Parameters below)
4. Client POSTs encrypted blob (ciphertext + IV + metadata) to the server
5. Server stores in KV with a random UUID and configured TTL
6. Server returns the note ID
7. Client constructs URL: `https://secure.gremlin.group/note/{id}#{base64url-encoded-key}`

### Reveal flow (burn-before-return)

1. Viewer visits the URL, sees a "Reveal Secret" button (and password field if protected)
2. On click, client calls `GET /api/notes/:id`
3. Server reads the encrypted blob from KV
4. Server deletes the KV entry immediately
5. Server returns the encrypted blob in the response
6. Client decrypts using the key from the URL fragment (+ password if applicable)
7. Plaintext displayed in the browser

If the response fails to reach the client after deletion, the note is lost forever. This is the intended security trade-off: favor destruction over availability.

### Zero-knowledge guarantees

- The AES key is in the URL fragment, which browsers never send in HTTP requests
- The server only stores opaque encrypted bytes
- No secret material is logged or accessible server-side
- Optional password adds a second factor via PBKDF2 key derivation

### Cryptographic Parameters

All clients (browser, shell, Rust) must use identical parameters for interoperability:

- **Algorithm:** AES-256-GCM
- **Key size:** 256 bits (32 bytes)
- **IV size:** 96 bits (12 bytes), randomly generated per encryption
- **Auth tag:** 128 bits, appended to ciphertext (Web Crypto API default behavior). The `c` field contains `ciphertext || auth_tag`.
- **Password derivation (when password is set):**
  - Algorithm: PBKDF2-SHA-256
  - Iterations: 600,000
  - Salt: the raw 32-byte random key (generated in step 1 of the create flow)
  - Input: UTF-8 encoded user password
  - Output: 256-bit derived key used for AES-GCM encryption
  - The URL fragment still contains the base64url-encoded random key (salt). The viewer needs both the link and password to derive the same encryption key.

### Race condition (KV eventual consistency)

Cloudflare KV is eventually consistent. Two near-simultaneous `GET /api/notes/:id` requests could theoretically both read the value before either delete propagates. This is a known limitation. Mitigations:

- The reveal page requires a deliberate click, making sub-second races unlikely in normal use
- UUID v4 IDs have 122 bits of entropy, making guessing infeasible
- For stronger guarantees, a future version could use Durable Objects for single-reader semantics
- This trade-off is accepted for v1: the race window is small (typically <1s) and exploitation requires knowing the note ID

## Tech Stack

- **Runtime:** Cloudflare Workers
- **Framework:** Hono with `@hono/zod-openapi` for routing, validation, and OpenAPI spec generation
- **Storage:** Cloudflare KV (encrypted blobs with native TTL expiration)
- **Encryption:** Web Crypto API (AES-256-GCM, client-side)
- **Templating:** Hono JSX (inline HTML, no separate frontend build)
- **API docs:** Scalar UI served from the Worker
- **CLI:** POSIX shell script + Rust binary

## API Design

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Create a note (undocumented convenience alias for `/api/notes`) |
| `POST` | `/api/notes` | Create a note |
| `GET` | `/api/notes/:id` | Burn and return encrypted blob |
| `GET` | `/note/:id` | Serve the reveal HTML page |
| `GET` | `/` | Serve the create form HTML page |
| `GET` | `/cli.sh` | Download shell helper script |
| `GET` | `/api/docs` | API documentation (Scalar UI) |
| `GET` | `/api/docs.json` | OpenAPI 3.1 spec |

### POST /api/notes (and POST /)

**JSON body:**

```json
{
  "c": "base64-ciphertext",
  "iv": "base64-iv",
  "pw": false,
  "ttl": 604800
}
```

- `c` (required): Base64-encoded AES-256-GCM ciphertext
- `iv` (required): Base64-encoded initialization vector
- `pw` (optional, default `false`): Whether the note is password-protected
- `ttl` (optional, default `604800`): Time-to-live in seconds. Must be one of: 3600, 86400, 604800, 2592000

**Response (201):**

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### GET /api/notes/:id

**Response (200):** Returns the encrypted blob and deletes it from KV (burn-before-return).

```json
{
  "c": "base64-ciphertext",
  "iv": "base64-iv",
  "pw": false
}
```

**Response (404):** Note does not exist or has already been burned.

```json
{
  "error": "Note not found or already destroyed"
}
```

**Response (400):** Invalid request.

```json
{
  "error": "Invalid note ID format"
}
```

**Response (429):** Rate limited.

```json
{
  "error": "Too many requests"
}
```

### POST /api/notes error responses

**Response (400):** Validation failure (missing fields, invalid TTL, etc.)

```json
{
  "error": "Validation failed",
  "details": [{ "field": "c", "message": "Required" }]
}
```

**Response (413):** Payload exceeds `MAX_NOTE_SIZE`.

```json
{
  "error": "Note too large"
}
```

**Response (429):** Rate limited.

```json
{
  "error": "Too many requests"
}
```

## Data Model (KV)

**Key format:** `note:{uuid-v4}`

**Value:**

```json
{
  "c": "base64-ciphertext",
  "iv": "base64-iv",
  "pw": true,
  "ts": 1712188800
}
```

- `c`: Encrypted ciphertext
- `iv`: Initialization vector for AES-GCM
- `pw`: Boolean flag indicating password protection (so reveal page can show password field)
- `ts`: Creation timestamp (Unix seconds), displayed on reveal page as "created X ago"

**TTL:** Set via KV's native `expirationTtl` parameter on write. Cloudflare handles automatic deletion.

**TTL options presented to user:** 1 hour (3600), 24 hours (86400), 1 week (604800, default), 30 days (2592000).

## Frontend / UI

Two pages served as inline HTML via Hono JSX. Styled to the Gremlin brand guide.

### Create page (GET /)

- Gremlin branding: Deep Midnight (`#1A1F36`) background, Electric Teal (`#00D4AA`) accents, logo
- Textarea for the secret
- Optional password field
- TTL dropdown (1 hour, 24 hours, 1 week, 30 days)
- "Create Secret Link" button
- After creation: displays the shareable URL with a copy button
- All encryption happens in-browser before the POST

### Reveal page (GET /note/:id)

The server reads the `pw` flag from KV metadata (without deleting the note) and renders it into the HTML page. This allows the UI to show/hide the password field without burning the note. The actual burn happens only when the user clicks "Reveal" and the client calls `GET /api/notes/:id`. Note: this means visiting the reveal URL leaks whether a note exists without burning it. This is an accepted trade-off for better UX.

- Gremlin branding, minimal layout
- Message: "You have received a secure note"
- If password-protected: password input field (server-rendered based on KV metadata)
- "Reveal Secret" button (deliberate click required, no auto-decrypt)
- On click: calls API, decrypts, displays plaintext in a styled container
- After reveal: clear message that the note has been destroyed and cannot be viewed again
- If note already burned or expired: 404 status with "This note no longer exists" message

### Style

- Dark mode by default (Deep Midnight background, fits the security aesthetic)
- Electric Teal for primary actions and accents
- Energetic Coral (`#FF6B6B`) for destructive/warning states
- System font stack from brand tokens
- Responsive, mobile-friendly
- No external CSS frameworks, brand tokens inlined
- Strict Content-Security-Policy headers with nonces

## Project Structure

```
secure-note/
├── src/
│   ├── index.ts              # Hono app, route definitions
│   ├── routes/
│   │   ├── api.ts            # OpenAPI routes via @hono/zod-openapi
│   │   ├── docs.ts           # Scalar UI + OpenAPI spec serving
│   │   └── pages.ts          # GET /, GET /note/:id
│   ├── views/
│   │   ├── layout.tsx        # Shared HTML shell, brand styles
│   │   ├── create.tsx        # Create form page
│   │   └── reveal.tsx        # Reveal page
│   ├── schemas/
│   │   └── notes.ts          # Zod schemas (validation + OpenAPI)
│   ├── crypto.ts             # Client-side encryption/decryption JS (served inline)
│   └── kv.ts                 # KV read/write/delete helpers
├── cli/
│   ├── cli.sh                # POSIX shell script
│   └── gremlin-secret/       # Rust CLI (Cargo project)
│       ├── Cargo.toml
│       └── src/main.rs
├── wrangler.toml             # Cloudflare Worker config
├── package.json
├── tsconfig.json
└── .gitignore
```

## Security

- **Zero-knowledge:** Server only stores encrypted blobs. Key never leaves the client.
- **Burn-before-return:** KV entry deleted before ciphertext is returned in the response.
- **KV TTL:** Native Cloudflare expiration as safety net for unviewed notes.
- **Optional password:** PBKDF2 key derivation combining URL fragment key with user password.
- **No secret logging:** The Worker must not log request bodies or KV values.
- **Rate limiting (v1):** Cloudflare rate limiting on POST endpoints (~10 creates/min/IP) and GET /api/notes/:id (~30 reads/min/IP) to prevent enumeration attempts.
- **Note size limit:** 1MB default, configurable via `MAX_NOTE_SIZE` environment variable.
- **CSP:** Strict Content-Security-Policy headers, nonce-based inline scripts, no external resources.
- **CORS:** No CORS headers. API is same-origin only. CLI tools do not run in a browser context.
- **Size enforcement:** `MAX_NOTE_SIZE` enforced at the Worker level by checking `Content-Length` header before reading the body. Cloudflare Workers also enforce a platform-level request body limit.

## CLI Tools

### Shell script (cli/cli.sh)

POSIX shell script using `openssl` and `curl`. Reads from stdin only. Encrypts locally, POSTs ciphertext, prints the full URL.

### Rust binary (cli/gremlin-secret/)

Static binary using `aes-gcm` and `reqwest` crates. Supports `--ttl`, `--password`, and `--base-url` flags.

Both CLIs read secrets from **stdin only** (not command-line arguments, which would be visible in `ps` output and shell history):
1. Read secret from stdin
2. Generate random AES-256 key
3. Encrypt locally
4. POST ciphertext to server
5. Print the full URL with key fragment

## Configuration (Environment Variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `https://secure.gremlin.group` | Public URL for link generation |
| `MAX_NOTE_SIZE` | `1048576` | Maximum note size in bytes (1MB) |
| `DEFAULT_TTL` | `604800` | Default TTL in seconds (1 week) |

## Out of Scope (Future)

- File/attachment sharing
- Multiple views before burn
- Custom branding per note
- Self-hosted deployment guide
- Analytics/metrics dashboard
