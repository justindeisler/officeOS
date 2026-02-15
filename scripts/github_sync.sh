#!/bin/bash
# GitHub Activity Sync Script
# Runs daily to import GitHub activity into the PA database.
# Can be triggered via cron or systemd timer.
#
# Usage:
#   ./scripts/github_sync.sh           # Sync last 7 days
#   ./scripts/github_sync.sh 30        # Sync last 30 days
#   ./scripts/github_sync.sh --all     # Sync all linked repos

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PA_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PA_DIR}/logs/github_sync.log"
API_URL="${PA_API_URL:-https://pa.justin-deisler.com/api}"

# Ensure logs directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Get API token
if [ -f ~/clawd/config/pa-api.conf ]; then
  PA_TOKEN=$(python3 ~/clawd/scripts/credential_manager.py get ~/clawd/config/pa-api.conf token 2>/dev/null || echo "")
else
  PA_TOKEN="${PA_JWT_TOKEN:-}"
fi

if [ -z "$PA_TOKEN" ]; then
  echo "$(date -Is) ERROR: No PA API token found" | tee -a "$LOG_FILE"
  exit 1
fi

DAYS="${1:-7}"
ENDPOINT="/github/sync-all"

if [ "$DAYS" = "--all" ]; then
  DAYS=30
fi

echo "$(date -Is) Starting GitHub sync (last $DAYS days)..." | tee -a "$LOG_FILE"

RESPONSE=$(curl -s -X POST "${API_URL}${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${PA_TOKEN}" \
  -d "{\"days\": ${DAYS}}" \
  --max-time 120)

if echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Synced {d[\"totalRepos\"]} repos, imported {d[\"totalImported\"]} items')" 2>/dev/null; then
  echo "$(date -Is) Sync completed successfully" | tee -a "$LOG_FILE"
  echo "$RESPONSE" | python3 -m json.tool >> "$LOG_FILE" 2>/dev/null
else
  echo "$(date -Is) ERROR: Sync failed or unexpected response" | tee -a "$LOG_FILE"
  echo "$RESPONSE" >> "$LOG_FILE"
  exit 1
fi
