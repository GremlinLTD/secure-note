#!/bin/sh
# Setup Cloudflare WAF rate limiting rules for Gremlin Secure Note
#
# Prerequisites:
#   - CLOUDFLARE_API_TOKEN with "Zone WAF Write" permission
#   - CLOUDFLARE_ZONE_ID for gremlin.group
#
# Usage:
#   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ZONE_ID=xxx sh scripts/setup-rate-limits.sh
#
set -eu

: "${CLOUDFLARE_API_TOKEN:?Set CLOUDFLARE_API_TOKEN with Zone WAF Write permission}"
: "${CLOUDFLARE_ZONE_ID:?Set CLOUDFLARE_ZONE_ID for gremlin.group}"

API="https://api.cloudflare.com/client/v4"
AUTH="Authorization: Bearer $CLOUDFLARE_API_TOKEN"

echo "Creating rate limiting rules for zone $CLOUDFLARE_ZONE_ID..."

# Create the http_ratelimit phase entry point ruleset with all rules
curl -s "$API/zones/$CLOUDFLARE_ZONE_ID/rulesets" \
  --request POST \
  --header "$AUTH" \
  --header "Content-Type: application/json" \
  --data '{
    "name": "Secure Note Rate Limits",
    "kind": "zone",
    "phase": "http_ratelimit",
    "rules": [
      {
        "description": "Brute-force GET: block after 10 failed note lookups per minute",
        "expression": "(http.request.uri.path matches \"^/api/notes/[0-9a-f-]+$\" and http.request.method eq \"GET\" and http.response.code eq 404)",
        "action": "block",
        "action_parameters": {
          "response": {
            "status_code": 429,
            "content_type": "application/json",
            "content": "{\"error\":\"Too many requests. Try again later.\"}"
          }
        },
        "ratelimit": {
          "characteristics": ["ip.src", "cf.colo.id"],
          "requests_per_period": 10,
          "period": 60,
          "mitigation_timeout": 300,
          "counting_expression": "http.response.code eq 404"
        },
        "enabled": true
      },
      {
        "description": "Brute-force DELETE: block after 5 failed delete attempts per minute",
        "expression": "(http.request.uri.path matches \"^/api/notes/[0-9a-f-]+$\" and http.request.method eq \"DELETE\" and (http.response.code eq 403 or http.response.code eq 404))",
        "action": "block",
        "action_parameters": {
          "response": {
            "status_code": 429,
            "content_type": "application/json",
            "content": "{\"error\":\"Too many requests. Try again later.\"}"
          }
        },
        "ratelimit": {
          "characteristics": ["ip.src", "cf.colo.id"],
          "requests_per_period": 5,
          "period": 60,
          "mitigation_timeout": 600,
          "counting_expression": "(http.response.code eq 403 or http.response.code eq 404)"
        },
        "enabled": true
      },
      {
        "description": "Create spam: block after 10 note creations per minute",
        "expression": "(http.request.uri.path eq \"/api/notes\" and http.request.method eq \"POST\")",
        "action": "block",
        "action_parameters": {
          "response": {
            "status_code": 429,
            "content_type": "application/json",
            "content": "{\"error\":\"Too many requests. Try again later.\"}"
          }
        },
        "ratelimit": {
          "characteristics": ["ip.src", "cf.colo.id"],
          "requests_per_period": 10,
          "period": 60,
          "mitigation_timeout": 300
        },
        "enabled": true
      }
    ]
  }' | python3 -c "
import sys, json
d = json.load(sys.stdin)
if d.get('success'):
    rid = d['result']['id']
    rules = d['result'].get('rules', [])
    print(f'Ruleset created: {rid}')
    for r in rules:
        print(f'  Rule: {r[\"description\"]} (id: {r[\"id\"]})')
else:
    errors = d.get('errors', [])
    for e in errors:
        print(f'Error: {e.get(\"message\", e)}')
    # If ruleset already exists, show how to update
    if any('already exists' in str(e) for e in errors):
        print()
        print('A ruleset for this phase already exists. To update it:')
        print(f'  curl -s \"{API}/zones/{CLOUDFLARE_ZONE_ID}/rulesets?phase=http_ratelimit\" -H \"{AUTH}\"')
"

echo ""
echo "Done. Verify at: https://dash.cloudflare.com -> Security -> WAF -> Rate limiting rules"
