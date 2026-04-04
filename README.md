# Gremlin Secure Note

Zero-knowledge, one-time secret sharing powered by Cloudflare Workers.

Secrets are encrypted in your browser before being stored. The decryption key never leaves your device. Notes self-destruct after being read.

## Features

- **Zero-knowledge encryption** -- AES-256-GCM, client-side. The server only stores opaque encrypted bytes.
- **Burn after reading** -- non-password notes are destroyed the moment they're retrieved.
- **Password protection** -- optional second factor with 3 decryption attempts before auto-burn.
- **Configurable TTL** -- 1 hour, 24 hours, 1 week (default), or 30 days.
- **API-first** -- JSON API with OpenAPI docs, plus `POST /` for easy curl piping.
- **CLI tools** -- shell script and Rust binary for scripted secret sharing.

## Quick start

### Web UI

Visit [secure.gremlin.group](https://secure.gremlin.group), paste your secret, and share the link.

### CLI (shell)

Requires `python3` with the `cryptography` package and `curl`.

```bash
# Download the script
curl -o gremlin-secret.sh https://secure.gremlin.group/cli.sh
chmod +x gremlin-secret.sh

# Share a secret
echo "my-api-key-123" | ./gremlin-secret.sh

# With a password (via env var)
GREMLIN_SECRET_PASSWORD="hunter2" echo "secret" | ./gremlin-secret.sh

# Custom TTL (1 hour)
echo "expires soon" | ./gremlin-secret.sh --ttl 3600
```

### CLI (Rust)

Download the latest binary from [Releases](https://github.com/GremlinLTD/secure-note/releases), or build from source:

```bash
cd cli/gremlin-secret
cargo build --release
```

```bash
# Share a secret
echo "my-api-key-123" | gremlin-secret

# With a password (prompted interactively)
echo "secret" | gremlin-secret --password

# Custom TTL and base URL
echo "secret" | gremlin-secret --ttl 3600 --base-url https://secure.example.com
```

## API

Interactive documentation is available at [secure.gremlin.group/api/docs](https://secure.gremlin.group/api/docs).

### Create a note

```bash
curl -X POST https://secure.gremlin.group/api/notes \
  -H "Content-Type: application/json" \
  -d '{"c":"<base64-ciphertext>","iv":"<base64-iv>","pw":false,"ttl":604800}'
```

Response: `{"id":"<uuid>"}`

The `POST /` endpoint is an alias that accepts the same payload.

### Retrieve and burn a note

```bash
curl https://secure.gremlin.group/api/notes/<id>
```

Response: `{"c":"...","iv":"...","pw":false}`

For non-password notes, the note is permanently deleted on this call. For password-protected notes, you get 3 attempts before auto-burn. Call `DELETE /api/notes/<id>` to confirm burn after successful decryption.

### OpenAPI spec

```bash
curl https://secure.gremlin.group/api/docs.json
```

## Encryption

All encryption happens client-side using the Web Crypto API.

| Parameter | Value |
|-----------|-------|
| Algorithm | AES-256-GCM |
| Key size | 256 bits (32 bytes) |
| IV size | 96 bits (12 bytes) |
| Auth tag | 128 bits, appended to ciphertext |
| Password derivation | PBKDF2-SHA-256, 600,000 iterations |
| Key encoding | Base64url (URL fragment) |

The decryption key is stored in the URL fragment (`#`), which browsers never send to the server.

## Development

```bash
# Install dependencies
bun install

# Run locally
bunx wrangler dev

# Run tests
bunx vitest run

# Type check
bunx tsc --noEmit
```

## Deployment

```bash
# Create KV namespace
bunx wrangler kv namespace create NOTES

# Update wrangler.toml with the namespace ID, then deploy
bunx wrangler deploy
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `https://secure.gremlin.group` | Public URL for link generation |
| `MAX_NOTE_SIZE` | `1048576` | Maximum note size in bytes (1MB) |
| `DEFAULT_TTL` | `604800` | Default TTL in seconds (1 week) |

## License

Proprietary. Copyright Gremlin LTD.
