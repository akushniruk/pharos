import { pushNotification } from "./store.js";

/**
 * Map agent/run lifecycle signals to in-app notifications.
 * Call from observability surfaces (IPC, SSE, polling) when wired.
 *
 * @param {{ phase: 'started' | 'completed' | 'failed' | 'blocked', runId?: string, agentLabel?: string, detail?: string }} evt
 */
export function reportRunLifecycle(evt) {
  const agent = evt.agentLabel?.trim() || "Agent";
  const runBit = evt.runId ? ` · ${evt.runId.slice(0, 8)}…` : "";

  switch (evt.phase) {
    case "started":
      pushNotification({
        kind: "run",
        source: "run",
        title: `${agent} run started`,
        body: (evt.detail || "A new run is executing.") + runBit,
      });
      break;
    case "completed":
      pushNotification({
        kind: "info",
        source: "run",
        title: `${agent} run completed`,
        body: evt.detail || "Run finished successfully.",
      });
      break;
    case "failed":
      pushNotification({
        kind: "error",
        source: "run",
        title: `${agent} run failed`,
        body: evt.detail || "The run ended with an error.",
      });
      break;
    case "blocked":
      pushNotification({
        kind: "warning",
        source: "run",
        title: `${agent} run blocked`,
        body: evt.detail || "The run is waiting on an external dependency.",
      });
      break;
    default:
      pushNotification({
        kind: "info",
        source: "run",
        title: "Run update",
        body: evt.detail || JSON.stringify(evt),
      });
  }
}
