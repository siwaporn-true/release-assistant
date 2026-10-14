import type { AssessmentStatus } from "../../domain/release/types";
import { StatusBadge } from "./status-badge";

export function ReleaseHealth({ ready, status }: { ready: boolean; status: AssessmentStatus }) {
  return (
    <section className="hero-card" aria-labelledby="release-answer">
      <StatusBadge status={status} />
      <h1 id="release-answer">{ready ? "Ready for QA" : "Not ready for QA"}</h1>
      <p>{ready ? "Evidence is complete for Preprod regression." : "Resolve the current blocker before handing off to QA."}</p>
    </section>
  );
}
