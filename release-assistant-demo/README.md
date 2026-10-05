# Release Assistant Demo

Static demo for GitHub Pages. No installation or API token needed.

## Publish
1. Create a PUBLIC repository named release-assistant-demo in your personal GitHub account.
2. Upload index.html, README.md and .nojekyll to the repository root. Upload files from inside this ZIP, not the ZIP itself.
3. Open Settings > Pages.
4. Source: Deploy from a branch. Branch: main. Folder: / (root). Save.
5. Wait for GitHub deployment, then use the Visit site link in Settings > Pages.

## Features
- Generic example tickets; import your own Jira CSV.
- Six release checklist types; browser-local checklist persistence.
- Export checklist JSON and draft release notes.

## Limitations
- No live Jira OAuth backend or automatic GitHub PR matching.
- Imported CSV is processed in the browser; not uploaded to a server.
- Checklists are saved only in this browser, not shared between people or devices.
- No AI requests or AI token usage while using this demo.
- Public repository and website: never commit company CSV, tokens, or private PR snapshots.

Open index.html locally for a quick preview. Use the hosted URL for reliable browser storage.
