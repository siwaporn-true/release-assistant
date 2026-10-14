import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">Release Decision Assistant</p>
      <h1>ส่ง build ให้ QA อย่างมั่นใจ</h1>
      <p>ตรวจ Jira, GitHub และ GitHub Actions จากหลักฐานชุดเดียวกัน</p>
      <p><Link className="primary-link" href="/releases/new">Check a release</Link></p>
    </main>
  );
}
