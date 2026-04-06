# MVP vertical slice: local run audit (NDJSON)

## Scope (half page)

**Problem:** Operators cannot easily see a **durable, structured** record of what a Paperclip-connected agent run was, beyond ephemeral terminal output.

**Slice:** One shell step that captures **run id, company, optional task, wake reason**, and (when credentials are present) the **`/api/agents/me`** payload, and appends a single **NDJSON** line under `.paperclip/local-run-log.ndjson`.

**Out of scope:** Shipping this inside the Paperclip product UI, multi-host aggregation, or rotation of logs. This is a **workspace-local spike** humans can inspect and diff across runs.

## Implementation

- Script: [`scripts/paperclip-run-summary.sh`](../scripts/paperclip-run-summary.sh)
- Log file (gitignored): `.paperclip/local-run-log.ndjson`

## How a human verifies

1. From the same environment where heartbeats run (or after exporting `PAPERCLIP_*` from the adapter), execute:

   ```bash
   chmod +x scripts/paperclip-run-summary.sh
   ./scripts/paperclip-run-summary.sh
   ```

2. Confirm:
   - The script prints **one pretty-printed JSON object** and reports the log path.
   - `tail -n 1 .paperclip/local-run-log.ndjson | jq .` shows `env.runId` matching the current `PAPERCLIP_RUN_ID`.
   - When `PAPERCLIP_API_KEY` and `PAPERCLIP_API_URL` are set, `controlPlaneAgent` includes a **reduced** API view: `id`, `name`, `role`, `urlKey`, `adapterType`, `status` (full `/agents/me` is not stored in the log).

3. Run it twice in a row with different `PAPERCLIP_RUN_ID` values (simulate two heartbeats): the file should have **two lines**, each valid JSON (NDJSON).

This ties **local filesystem observability** to **control-plane identity**, matching roadmap themes M1 (correlation) and M2 (context) at a minimal workspace level.

## M1: Run ↔ issue correlation (control plane)

Roadmap **M1** is satisfied by the Paperclip API itself (no extra code in this workspace):

1. **Mutating calls carry a run** — Agents send `X-Paperclip-Run-Id: <PAPERCLIP_RUN_ID>` on issue mutations (checkout, update, comment, release, etc.) so the server can attribute each change to a heartbeat run.
2. **Issue row stores execution linkage** — `GET /api/issues/{issueId}` includes `checkoutRunId` and `executionRunId` when set.
3. **Company activity is the audit trail** — `GET /api/companies/{companyId}/activity` returns recent events with `runId`, `entityType` (`issue`), `entityId` (issue UUID), `action` (e.g. `issue.checked_out`, `issue.updated`), and `agentId`.

### How to verify (API)

Replace `API_URL`, `TOKEN`, and `COMPANY_ID` with your instance values (or use the adapter-injected `PAPERCLIP_*` vars).

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/companies/$COMPANY_ID/activity" | jq '.[0:5]'
```

Confirm each row has `runId` and, for issue-scoped actions, `entityId` matching an issue. Pick a run id from one row and confirm it matches the agent run that performed the mutation (same run as `PAPERCLIP_RUN_ID` during that heartbeat).

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API_URL/api/issues/<issue-uuid>" | jq '{identifier, checkoutRunId, executionRunId}'
```

### How to verify (UI)

Open the company **activity** / audit view in the Paperclip app (wording varies by build); events shown there correspond to the same records as the activity API.
