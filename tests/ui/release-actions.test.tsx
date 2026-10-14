// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExceptionDialog } from "../../src/components/release/exception-dialog";
import { RerunDialog } from "../../src/components/release/rerun-dialog";
import { HandoffDialog } from "../../src/components/release/handoff-dialog";
afterEach(cleanup);

describe("release action confirmations", () => {
  it("collects rule, reason, and approver for an exception", () => { const submit = vi.fn(); render(<ExceptionDialog ruleId="workflow_failed" onConfirm={submit} />); fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Accepted" } }); fireEvent.change(screen.getByLabelText("Approver"), { target: { value: "lead-1" } }); fireEvent.click(screen.getByRole("button", { name: "Add exception" })); expect(submit).toHaveBeenCalledWith(expect.objectContaining({ ruleId: "workflow_failed", reason: "Accepted", approverId: "lead-1" })); });
  it("shows repository, workflow, branch, and SHA before re-run", () => { render(<RerunDialog repository="org/app" workflowId="preprod.yml" branch="release/x" sha="abc1234" onConfirm={vi.fn()} />); expect(screen.getByText("org/app")).toBeTruthy(); expect(screen.getByText("preprod.yml")).toBeTruthy(); expect(screen.getByText("release/x")).toBeTruthy(); expect(screen.getByText("abc1234")).toBeTruthy(); });
  it("shows immutable handoff revision before confirmation", () => { render(<HandoffDialog revision={4} onConfirm={vi.fn()} />); expect(screen.getByText("Revision 4")).toBeTruthy(); expect(screen.getByRole("button", { name: "Create QA handoff" })).toBeTruthy(); });
});
