#!/usr/bin/env bash
# Append one NDJSON record for the current Paperclip heartbeat / run.
# Requires: curl, jq. Uses PAPERCLIP_* from the environment (injected by the adapter).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${ROOT}/.paperclip"
LOG_FILE="${LOG_DIR}/local-run-log.ndjson"
mkdir -p "${LOG_DIR}"

TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

agent_json="null"
if [[ -n "${PAPERCLIP_API_KEY:-}" && -n "${PAPERCLIP_API_URL:-}" ]]; then
  full="$(curl -sS -f \
    -H "Authorization: Bearer ${PAPERCLIP_API_KEY}" \
    "${PAPERCLIP_API_URL}/api/agents/me" 2>/dev/null || true)"
  if [[ -n "$full" ]]; then
    agent_json="$(echo "$full" | jq -c '{id,name,role,urlKey,adapterType,status}')"
  fi
fi

jq -nc \
  --arg ts "$TS" \
  --argjson agent "${agent_json}" \
  '{
    schema: "paperclip.local_run_summary/v1",
    recordedAtUtc: $ts,
    env: {
      runId: env.PAPERCLIP_RUN_ID,
      agentId: env.PAPERCLIP_AGENT_ID,
      companyId: env.PAPERCLIP_COMPANY_ID,
      taskId: env.PAPERCLIP_TASK_ID,
      wakeReason: env.PAPERCLIP_WAKE_REASON,
      apiUrl: env.PAPERCLIP_API_URL
    },
    controlPlaneAgent: $agent
  }' >>"${LOG_FILE}"

echo "Wrote 1 line to ${LOG_FILE}"
tail -n 1 "${LOG_FILE}" | jq .
