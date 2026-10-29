import { ConnectionStatusPanel } from "../../src/components/connection-status-panel";

export default function SetupPage() {
  return (
    <main>
      <p className="eyebrow">Setup</p>
      <h1>เชื่อมต่อข้อมูล Release</h1>
      <ConnectionStatusPanel jiraConnected={false} githubConnected={false} />
    </main>
  );
}
