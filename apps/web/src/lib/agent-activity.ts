/**
 * Fire-and-forget telemetry for agent actions.
 * Catches and ignores all errors — telemetry should never block UX.
 */
export function logAgentActivity(action: string, metadata?: Record<string, unknown>): void {
  fetch('/api/agent/activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, metadata }),
  }).catch(() => {
    // Intentionally ignored — telemetry is best-effort
  });
}
