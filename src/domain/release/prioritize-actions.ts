import type { ReleaseAssessment } from "./evaluate-release";

export interface RecommendedAction {
  ruleId: string;
  subject?: string;
  priority: number;
}

const priority = {
  blocked: 0,
  cannot_verify: 1,
  needs_confirmation: 2,
  checking: 3,
} as const;

export function prioritizeActions(assessment: ReleaseAssessment): RecommendedAction[] {
  return assessment.findings
    .map((finding) => ({
      ruleId: finding.ruleId,
      subject: finding.subject,
      priority: priority[finding.status],
    }))
    .sort((left, right) => left.priority - right.priority || left.ruleId.localeCompare(right.ruleId));
}
