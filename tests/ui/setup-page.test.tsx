// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConnectionStatusPanel } from "../../src/components/connection-status-panel";

describe("connection setup page", () => {
  it("renders connection state without serializing credentials", () => {
    const { container } = render(
      <ConnectionStatusPanel jiraConnected githubConnected={false} />,
    );

    expect(screen.getByText("Jira connected")).toBeTruthy();
    expect(screen.getByText("Connect GitHub")).toBeTruthy();
    expect(container.innerHTML).not.toContain("access-token");
    expect(container.innerHTML).not.toContain("private-key");
  });
});
