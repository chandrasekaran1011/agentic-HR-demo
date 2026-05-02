import type { AuditEntry } from "@hr-agent/shared";

export function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground italic">No audit events yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {entries.map((e, i) => (
        <li key={i} className="text-sm border-l-2 border-border pl-3 py-1">
          <span className="text-muted-foreground font-mono mr-3">
            {new Date(e.ts).toLocaleTimeString()}
          </span>
          <span className="text-foreground">{e.msg}</span>
          {e.ticket_id && (
            <span className="text-muted-foreground ml-2 font-mono text-xs">{e.ticket_id}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
