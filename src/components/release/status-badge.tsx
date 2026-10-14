import type { AssessmentStatus } from "../../domain/release/types";

const labels: Record<AssessmentStatus, string> = {
  passed: "Passed",
  blocked: "Blocked",
  needs_confirmation: "Needs confirmation",
  checking: "Checking",
  cannot_verify: "Cannot verify",
};

export function StatusBadge({ status }: { status: AssessmentStatus }) {
  return <span className={`status-badge status-${status}`}>{labels[status]}</span>;
}
