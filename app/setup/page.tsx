import Link from "next/link";

export function ConnectionStatusPanel({
  jiraConnected,
  githubConnected,
}: {
  jiraConnected: boolean;
  githubConnected: boolean;
}) {
  return (
    <section aria-labelledby="connections-title">
      <h2 id="connections-title">Connections</h2>
      <ul>
        <li>{jiraConnected ? "Jira connected" : <Link href="/api/auth/jira/start">Connect Jira</Link>}</li>
        <li>{githubConnected ? "GitHub connected" : <Link href="/api/auth/github/callback">Connect GitHub</Link>}</li>
      </ul>
    </section>
  );
}

export default function SetupPage() {
  return (
    <main>
      <p className="eyebrow">Setup</p>
      <h1>เชื่อมต่อข้อมูล Release</h1>
      <ConnectionStatusPanel jiraConnected={false} githubConnected={false} />
    </main>
  );
}
