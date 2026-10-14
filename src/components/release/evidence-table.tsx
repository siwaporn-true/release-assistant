interface EvidenceTableProps {
  issues?: Array<{ key: string; summary: string; sourceUrl: string; classification?: string }>;
  pullRequests?: Array<{ number: number; title: string; sourceUrl: string }>;
  workflow?: { runId: number; sourceUrl: string; result: string; freshness?: string };
  ambiguousKey?: string;
}

export function EvidenceTable({ issues = [], pullRequests = [], workflow, ambiguousKey }: EvidenceTableProps) {
  return (
    <section className="evidence-section" aria-labelledby="evidence-title">
      <h2 id="evidence-title">Ticket evidence</h2>
      {workflow ? <p><a href={workflow.sourceUrl} target="_blank" rel="noreferrer">Workflow run {workflow.runId}</a> · {workflow.result}{workflow.freshness === "stale" ? <> · <span className="stale-label">Stale evidence</span></> : null}</p> : null}
      {ambiguousKey && pullRequests.length > 1 ? <fieldset><legend>Choose pull request for {ambiguousKey}</legend>{pullRequests.map((pr) => <label key={pr.number} className="radio-row"><input type="radio" name={`pr-${ambiguousKey}`} value={pr.number} /> <a href={pr.sourceUrl} target="_blank" rel="noreferrer">#{pr.number} {pr.title}</a></label>)}</fieldset> : null}
      <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Summary</th><th>Classification</th></tr></thead><tbody>{issues.map((issue) => <tr key={issue.key}><td><a href={issue.sourceUrl} target="_blank" rel="noreferrer">{issue.key}</a></td><td>{issue.summary}</td><td>{issue.classification?.replaceAll("_", " ") ?? "—"}</td></tr>)}</tbody></table></div>
    </section>
  );
}
