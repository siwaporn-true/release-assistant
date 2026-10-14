import type { AssessmentStatus } from "../../domain/release/types";
import { StatusBadge } from "./status-badge";

type Gate = { status: AssessmentStatus; findings: Array<{ ruleId: string; subject?: string }> };
const gateLabels = { scope: "Scope Ready", code: "Code Ready", build: "Build Ready" } as const;

export function GateTimeline({ gates }: { gates: Record<keyof typeof gateLabels, Gate> }) {
  const severity: Record<AssessmentStatus, number> = { passed: 0, checking: 1, needs_confirmation: 2, cannot_verify: 3, blocked: 4 };
  const active = (Object.keys(gateLabels) as Array<keyof typeof gateLabels>).reduce<keyof typeof gateLabels | undefined>((current, key) => !current || severity[gates[key].status] > severity[gates[current].status] ? key : current, undefined);
  return (
    <section aria-labelledby="gates-title"><h2 id="gates-title">Release gates</h2>
      <div className="gate-timeline">
        {(Object.keys(gateLabels) as Array<keyof typeof gateLabels>).map((key) => (
          <details key={key} open={key === active} className="gate-card">
            <summary><span>{gateLabels[key]}</span><StatusBadge status={gates[key].status} /></summary>
            {gates[key].findings.length ? <ul>{gates[key].findings.map((finding, index) => <li key={`${finding.ruleId}-${index}`}>{finding.ruleId.replaceAll("_", " ")}{finding.subject ? ` — ${finding.subject}` : ""}</li>)}</ul> : <p>No blocking findings.</p>}
          </details>
        ))}
      </div>
    </section>
  );
}
