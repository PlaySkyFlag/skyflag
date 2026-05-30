#!/usr/bin/env bash
# One-time backfill: push every existing thresan_waitlist row into Kit.
# The live sync (api/kit-sync.ts) only fires on NEW inserts, so run this once
# after the Kit key is set to import the people who signed up beforehand.
#
# Usage:
#   KIT_API_KEY=kit_xxx ./scripts/kit-backfill.sh
#
# Reads the waitlist with the Supabase service-role key (pulled from the
# linked CLI), then upserts each subscriber into Kit, stamping the source.
# Upserts are idempotent in Kit, so re-running is safe.
set -euo pipefail

: "${KIT_API_KEY:?Set KIT_API_KEY (Kit Settings -> Developer)}"
PROJECT_REF="oeychcbxvuozkvfjcwlr"
SUPA_URL="https://${PROJECT_REF}.supabase.co/rest/v1/thresan_waitlist"

SVC=$(supabase projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null \
  | awk -F'|' '/service_role/{gsub(/ /,"",$2);print $2}')
if [ -z "$SVC" ]; then
  echo "Could not read the Supabase service_role key from the linked CLI." >&2
  exit 1
fi

rows=$(curl -s "${SUPA_URL}?select=email,source&order=created_at.asc" \
  -H "apikey: $SVC" -H "Authorization: Bearer $SVC")

echo "$rows" | python3 -c '
import json, sys
for r in json.load(sys.stdin):
    email = r["email"]
    source = r.get("source") or "website"
    print(email + "\t" + source)
' | while IFS=$'\t' read -r email source; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "https://api.kit.com/v4/subscribers" \
    -H "Content-Type: application/json" \
    -H "X-Kit-Api-Key: $KIT_API_KEY" \
    -d "{\"email_address\":\"$email\",\"fields\":{\"source\":\"$source\"}}")
  # 422 = custom "source" field not configured; retry without it.
  if [ "$code" = "422" ]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "https://api.kit.com/v4/subscribers" \
      -H "Content-Type: application/json" -H "X-Kit-Api-Key: $KIT_API_KEY" \
      -d "{\"email_address\":\"$email\"}")
  fi
  printf "%-34s %-28s -> %s\n" "$email" "$source" "$code"
done

echo "Backfill complete."
