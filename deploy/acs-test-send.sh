#!/usr/bin/env bash
#
# Independent end-to-end test for Azure Communication Services email.
# Uses curl + openssl only — no SDK, no Node, no Docker. Helpful for
# isolating ACS problems from the orchestrator code path.
#
# Usage:
#   bash deploy/acs-test-send.sh <recipient-email>
#
# Reads .env from the repo root (or the env vars from your shell):
#   AZURE_COMM_CONNECTION_STRING   endpoint=https://<r>.communication.azure.com/;accesskey=…
#   AZURE_COMM_SENDER_ADDRESS      DoNotReply@<verified-domain>
#
# Exit codes:
#   0   ACS accepted the request (HTTP 202). Look in the recipient's inbox.
#   1   missing args/env or signing failed
#   2   ACS rejected the request (4xx/5xx). The error body is printed.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <recipient-email>" >&2
  exit 1
fi
TO="$1"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a; . "$REPO_ROOT/.env"; set +a
fi

CONN="${AZURE_COMM_CONNECTION_STRING:-}"
SENDER="${AZURE_COMM_SENDER_ADDRESS:-}"
[[ -n "$CONN"   ]] || { echo "AZURE_COMM_CONNECTION_STRING is not set" >&2; exit 1; }
[[ -n "$SENDER" ]] || { echo "AZURE_COMM_SENDER_ADDRESS is not set"   >&2; exit 1; }

for cmd in curl openssl; do
  command -v "$cmd" >/dev/null \
    || { echo "$cmd is required but not installed" >&2; exit 1; }
done

# --- Parse endpoint + key ----------------------------------------------------
# Strip optional `endpoint=` prefix that the Azure portal includes.
CONN_STRIPPED="${CONN#endpoint=}"
ENDPOINT="${CONN_STRIPPED%%;*}"
TAIL="${CONN_STRIPPED#*;}"
ACCESS_KEY="${TAIL#accesskey=}"

HOST="${ENDPOINT#https://}"
HOST="${HOST%%/*}"

PATH_AND_QUERY="/emails:send?api-version=2023-03-31"
URL="https://${HOST}${PATH_AND_QUERY}"

# --- Build body (single-line JSON to avoid signature mismatches) -------------
BODY=$(printf '{"senderAddress":"%s","content":{"subject":"ACS test from %s","plainText":"If you can read this, Azure Communication Services email is working from %s."},"recipients":{"to":[{"address":"%s"}]}}' \
  "$SENDER" "$(hostname)" "$(hostname)" "$TO")

# --- Required ACS signature headers ------------------------------------------
DATE_HEADER=$(LC_ALL=C TZ=GMT date "+%a, %d %b %Y %H:%M:%S GMT")

CONTENT_HASH=$(printf '%s' "$BODY" \
  | openssl dgst -binary -sha256 \
  | openssl base64 -A)

# String-to-sign: VERB\nPATH+QUERY\nDATE;HOST;CONTENT_HASH
STRING_TO_SIGN=$(printf 'POST\n%s\n%s;%s;%s' \
  "$PATH_AND_QUERY" "$DATE_HEADER" "$HOST" "$CONTENT_HASH")

# Decode the base64 access key into hex so openssl can sign with binary key.
# `xxd -p` is in vim-common on Ubuntu; fall back to od if absent.
if command -v xxd >/dev/null; then
  KEY_HEX=$(printf '%s' "$ACCESS_KEY" | openssl base64 -d -A | xxd -p | tr -d '\n')
else
  KEY_HEX=$(printf '%s' "$ACCESS_KEY" | openssl base64 -d -A | od -An -t x1 | tr -d ' \n')
fi

SIGNATURE=$(printf '%s' "$STRING_TO_SIGN" \
  | openssl dgst -binary -sha256 -mac HMAC -macopt "hexkey:$KEY_HEX" \
  | openssl base64 -A)

AUTH="HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${SIGNATURE}"

echo "▶ POST $URL"
echo "  sender:    $SENDER"
echo "  recipient: $TO"
echo

HTTP_CODE=$(curl -sS -o /tmp/acs-test-response.json -w "%{http_code}" \
  -X POST "$URL" \
  -H "x-ms-date: $DATE_HEADER" \
  -H "x-ms-content-sha256: $CONTENT_HASH" \
  -H "Content-Type: application/json" \
  -H "Authorization: $AUTH" \
  --data-binary "$BODY")

echo "HTTP $HTTP_CODE"
echo "--- response body ---"
cat /tmp/acs-test-response.json
echo

if [[ "$HTTP_CODE" == "202" ]]; then
  echo "✓ ACS accepted the send. Watch the recipient's inbox (delivery is async)."
  exit 0
else
  echo "✗ ACS rejected the request. Common causes:"
  echo "  - sender domain not verified  (Portal → ACS → Email → Domains)"
  echo "  - access key rotated/wrong    (Portal → ACS → Keys)"
  echo "  - region mismatch             (ACS Email only available in select data locations)"
  echo "  - sender address not in MailFrom list of a verified domain"
  exit 2
fi
