# Pharos + AI Memory Brain Integration

This integration is optional and keeps both systems independently runnable.

## What it adds

- `pharos` daemon can expose a Memory Brain runtime snapshot at `GET /api/integrations/memory-brain`.
- websocket clients receive `memory_brain_status` and `memory_brain_action` messages on `/stream`.
- operators can trigger manual debug actions:
  - `POST /api/integrations/memory-brain/actions/refresh`
  - `POST /api/integrations/memory-brain/actions/sink-recheck`
  - `POST /api/integrations/memory-brain/actions/repair-graph`

## Decoupling guarantees

- If integration is disabled, Pharos still runs normally and reports `state=disabled`.
- If Memory Brain URL is missing, Pharos reports `state=not_configured`.
- If Memory Brain is unavailable, Pharos degrades status without crashing event ingestion.

## Pharos environment variables

- `PHAROS_MEMORY_BRAIN_INTEGRATION` (`0|1`, default `0`)
- `PHAROS_MEMORY_BRAIN_URL` (example: `http://127.0.0.1:8765`)
- `PHAROS_MEMORY_BRAIN_TIMEOUT_MS` (default `3000`)
- `PHAROS_MEMORY_BRAIN_POLL_MS` (default `15000`)
- `PHAROS_MEMORY_BRAIN_REPAIR_PATH` (default `/ops/repair-graph`)

## Runtime behavior

- Health polling starts only when integration is enabled.
- Healthy status polls at configured interval.
- Degraded/offline status polls faster for faster recovery visibility.
- After repeated probe failures, a short circuit-breaker cooldown is applied before retrying.

## Validation checklist

1. Start `ai-memory-brain` gateway:
   - `memory_gateway/start-server.sh`
2. Start `pharos` daemon with integration env vars set.
3. Verify API:
   - `curl http://127.0.0.1:4000/api/integrations/memory-brain`
4. Verify websocket:
   - first payload sequence includes `memory_brain_status`.
5. In Pharos UI Event Stream:
   - runtime panel shows helper/model/sink status.
   - `Refresh health`, `Sink recheck`, and `Repair graph` buttons emit action entries.

## Troubleshooting

- `state=disabled`: set `PHAROS_MEMORY_BRAIN_INTEGRATION=1`.
- `state=not_configured`: set `PHAROS_MEMORY_BRAIN_URL`.
- `connectivity=offline`: confirm gateway is reachable at `${PHAROS_MEMORY_BRAIN_URL}/health`.
- repeated `circuit_open`: integration target is unstable; wait for cooldown and re-check gateway logs.
