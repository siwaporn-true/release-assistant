const actionLabels: Record<string, string> = {
  workflow_failed: "Fix failed workflow",
  workflow_missing: "Run the Preprod workflow",
  workflow_sha_mismatch: "Build the current release commit",
  ambiguous_pr: "Choose the correct pull request",
  missing_pr: "Link the missing pull request",
  connector_unavailable: "Restore connector access",
};

export function NextAction({ action }: { action?: { ruleId: string; subject?: string } }) {
  return (
    <section className="next-action" aria-labelledby="next-action-title">
      <p className="eyebrow">Next action</p>
      <h2 id="next-action-title">{action ? (actionLabels[action.ruleId] ?? action.ruleId.replaceAll("_", " ")) : "No blockers remaining"}</h2>
      {action?.subject ? <p>Evidence: <code>{action.subject}</code></p> : null}
    </section>
  );
}
