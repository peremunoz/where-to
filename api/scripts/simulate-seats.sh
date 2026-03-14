#!/usr/bin/env bash
set -euo pipefail

# Simulates live seat occupancy by patching seat status for all IDs in demo/seats.json.
#
# Usage examples:
#   ./scripts/simulate-seats.sh
#   API_BASE_URL="https://your-ngrok-url.ngrok-free.app" ./scripts/simulate-seats.sh
#   API_BASE_URL="http://localhost:3000" INTERVAL_SECONDS=0.5 ./scripts/simulate-seats.sh
#   CYCLES=5 ./scripts/simulate-seats.sh

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
SEATS_FILE="${SEATS_FILE:-./demo/seats.json}"
INTERVAL_SECONDS="${INTERVAL_SECONDS:-1}"
CYCLES="${CYCLES:-0}" # 0 = run forever

if [[ ! -f "$SEATS_FILE" ]]; then
  echo "[ERROR] Seats file not found: $SEATS_FILE"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] node is required to parse $SEATS_FILE"
  exit 1
fi

mapfile -t SEAT_IDS < <(node -e '
  const fs = require("fs");
  const file = process.argv[1];
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(data)) process.exit(2);
  for (const item of data) {
    if (item && typeof item.id === "string" && item.id.trim()) {
      console.log(item.id.trim());
    }
  }
' "$SEATS_FILE")

if [[ ${#SEAT_IDS[@]} -eq 0 ]]; then
  echo "[ERROR] No seat ids found in $SEATS_FILE"
  exit 1
fi

echo "[INFO] Starting seat status simulation"
echo "[INFO] API_BASE_URL=$API_BASE_URL"
echo "[INFO] SEATS_FILE=$SEATS_FILE"
echo "[INFO] INTERVAL_SECONDS=$INTERVAL_SECONDS"
echo "[INFO] TOTAL_SEATS=${#SEAT_IDS[@]}"
if [[ "$CYCLES" -gt 0 ]]; then
  echo "[INFO] CYCLES=$CYCLES"
else
  echo "[INFO] CYCLES=forever"
fi

declare -a STATUSES=("AVAILABLE" "OCCUPIED")
cycle_count=0

shuffle_in_place() {
  local -n arr_ref=$1
  local i j tmp

  for ((i=${#arr_ref[@]}-1; i>0; i--)); do
    j=$((RANDOM % (i + 1)))
    tmp="${arr_ref[i]}"
    arr_ref[i]="${arr_ref[j]}"
    arr_ref[j]="$tmp"
  done
}

while true; do
  cycle_count=$((cycle_count + 1))

  cycle_ids=("${SEAT_IDS[@]}")
  shuffle_in_place cycle_ids

  for seat_id in "${cycle_ids[@]}"; do
    idx=$((RANDOM % 2))
    status="${STATUSES[$idx]}"

    http_code=$(curl -sS -o /tmp/seat_patch_response.txt -w "%{http_code}" \
      -X PATCH "${API_BASE_URL}/seats/${seat_id}" \
      -H 'Content-Type: application/json' \
      -d "{\"status\":\"${status}\"}") || http_code="000"

    ts=$(date -Iseconds)
    if [[ "$http_code" == "200" ]]; then
      echo "[$ts] [OK] seat=${seat_id} status=${status} code=${http_code}"
    else
      echo "[$ts] [ERR] seat=${seat_id} status=${status} code=${http_code} body=$(cat /tmp/seat_patch_response.txt 2>/dev/null || true)"
    fi

    sleep "$INTERVAL_SECONDS"
  done

  if [[ "$CYCLES" -gt 0 && "$cycle_count" -ge "$CYCLES" ]]; then
    echo "[INFO] Completed $cycle_count cycle(s). Exiting."
    break
  fi

done
