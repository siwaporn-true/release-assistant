import { expect, test } from "@playwright/test";
import unavailable from "../fixtures/scenarios/unavailable.json";

test("connector outage cannot be mistaken for QA readiness", async ({ page }) => {
  await page.route("**/api/releases/release-1", (route) => route.fulfill({ json: unavailable }));
  await page.goto("/releases/release-1");
  await expect(page.getByRole("heading", { name: "Not ready for QA" })).toBeVisible();
  await expect(page.getByText("Cannot verify GitHub: Unavailable")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create QA handoff" })).toBeDisabled();
});
