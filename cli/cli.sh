#!/bin/sh
# gremlin-secret: one-time secret sharing via Gremlin Secure Note
# Usage: echo "my secret" | ./cli.sh [--ttl SECONDS] [--url BASE_URL]
# Password: set GREMLIN_SECRET_PASSWORD env var (not a CLI arg, for security)
# Requires: python3 with cryptography package, curl
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

# Strip trailing slash from BASE_URL
BASE_URL="${BASE_URL%/}"

SECRET="$(cat)"
if [ -z "$SECRET" ]; then
  echo "Error: no secret provided on stdin" >&2
  exit 1
fi

CRYPTO_OUTPUT="$(printf '%s' "$SECRET" | python3 -c "
import sys, os, base64, hashlib

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
except ImportError:
    print('Error: python3 cryptography package required. Install with: pip3 install cryptography', file=sys.stderr)
    sys.exit(1)

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

aesgcm = AESGCM(enc_key)
ct = aesgcm.encrypt(iv, secret, None)

c_b64 = base64.b64encode(ct).decode()
iv_b64 = base64.b64encode(iv).decode()
key_b64url = base64.urlsafe_b64encode(raw_key).decode().rstrip('=')

print(f'{c_b64} {iv_b64} {key_b64url} {str(pw_flag).lower()}')
")"

C_B64="$(echo "$CRYPTO_OUTPUT" | cut -d' ' -f1)"
IV_B64="$(echo "$CRYPTO_OUTPUT" | cut -d' ' -f2)"
RAW_KEY_B64="$(echo "$CRYPTO_OUTPUT" | cut -d' ' -f3)"
PW_FLAG="$(echo "$CRYPTO_OUTPUT" | cut -d' ' -f4)"

RESPONSE="$(curl -s -X POST "$BASE_URL/api/notes" \
  -H "Content-Type: application/json" \
  -d "{\"c\":\"$C_B64\",\"iv\":\"$IV_B64\",\"pw\":$PW_FLAG,\"ttl\":$TTL}")"

ID="$(printf '%s' "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")" || {
  echo "Error: failed to create note" >&2
  echo "$RESPONSE" >&2
  exit 1
}

echo "${BASE_URL}/note/${ID}#${RAW_KEY_B64}"
