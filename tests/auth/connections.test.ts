import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "../../src/auth/crypto";
import { consumeOAuthState } from "../../src/connectors/jira/oauth";
import { authorizeGitHubInstallation } from "../../src/connectors/github/app-auth";

const key = Buffer.alloc(32, 7).toString("base64");

describe("connection security boundaries", () => {
  it("encrypts provider tokens before persistence", () => {
    const encrypted = encryptSecret("jira-access-token", key);

    expect(encrypted).not.toContain("jira-access-token");
    expect(decryptSecret(encrypted, key)).toBe("jira-access-token");
  });

  it("rejects an OAuth callback with a mismatched state", async () => {
    const states = new Map([["expected", { userId: "user-1", consumed: false }]]);

    await expect(consumeOAuthState("wrong", states)).rejects.toThrow("Invalid OAuth state");
  });

  it("consumes an OAuth state only once", async () => {
    const states = new Map([["expected", { userId: "user-1", consumed: false }]]);

    await expect(consumeOAuthState("expected", states)).resolves.toEqual({ userId: "user-1" });
    await expect(consumeOAuthState("expected", states)).rejects.toThrow("Invalid OAuth state");
  });

  it("rejects a GitHub installation owned by another user", () => {
    expect(() =>
      authorizeGitHubInstallation("user-1", {
        userId: "user-2",
        installationId: 123,
        accountLogin: "other-team",
      }),
    ).toThrow("GitHub installation is not owned by this user");
  });
});
