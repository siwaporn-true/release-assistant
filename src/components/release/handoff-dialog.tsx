"use client";
export function HandoffDialog({ revision, onConfirm }: { revision: number; onConfirm: () => void }) { return <section className="action-dialog"><h2>Create QA handoff?</h2><p>Revision {revision}</p><p>This captures the current tickets, pull requests, commit and workflow result.</p><button type="button" onClick={onConfirm}>Create QA handoff</button></section>; }
