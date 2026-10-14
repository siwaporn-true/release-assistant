export function ReleaseHeader({ project, version, branch, refreshedAt }: { project: string; version: string; branch: string; refreshedAt?: string | null }) {
  return (
    <header className="release-header">
      <div><p className="eyebrow">{project} · Fix Version {version}</p><p className="release-branch">{branch}</p></div>
      <p className="refresh-time">Last checked: {refreshedAt ? new Date(refreshedAt).toLocaleString() : "Never"}</p>
    </header>
  );
}
