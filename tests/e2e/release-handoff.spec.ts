import { expect, test } from "@playwright/test";
import blocked from "../fixtures/scenarios/blocked.json";
import ambiguous from "../fixtures/scenarios/ambiguous.json";
import ready from "../fixtures/scenarios/ready.json";

test("select scope, resolve evidence, refresh current SHA, and hand off to QA", async ({ page }) => {
  await page.route("**/api/jira/projects", (route) => route.fulfill({ json: [{ key: "SUN", name: "Sun" }] }));
  await page.route("**/api/jira/fix-versions?*", (route) => route.fulfill({ json: [{ id: "21221", name: "12.3.0" }] }));
  await page.route("**/api/releases", async (route) => route.fulfill({ json: { id: "release-1" } }));
  let current: object = ambiguous;
  await page.route("**/api/releases/release-1", (route) => route.fulfill({ json: current }));
  await page.route("**/api/releases/release-1/refresh", (route) => { current = ready; return route.fulfill({ json: ready }); });
  await page.route("**/api/releases/release-1/handoff", (route) => route.fulfill({ json: { handoffText: "QA handoff created for SUN 21221" } }));

  await page.goto("/releases/new");
  await page.getByLabel("Project").selectOption("SUN"); await page.getByLabel("Fix Version").selectOption("21221"); await page.getByLabel("Release branch").fill("release/12.3.0"); await page.getByRole("button", { name: "Check release" }).click();
  await expect(page.getByRole("heading", { name: "Not ready for QA" })).toBeVisible();
  await page.getByRole("radio", { name: /#21/ }).check();
  current = blocked; await page.reload(); await expect(page.getByText("Build the current release commit")).toBeVisible(); await expect(page.getByRole("button", { name: "Create QA handoff" })).toBeDisabled();
  await page.getByRole("button", { name: "Refresh evidence" }).click(); await expect(page.getByRole("heading", { name: "Ready for QA" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept()); await page.getByRole("button", { name: "Create QA handoff" }).click();
});
