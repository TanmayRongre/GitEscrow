import { useState } from "react";
import {
  CheckIcon,
  GitIssueIcon,
  ExternalLinkIcon,
  SparkleIcon,
  LockIcon,
} from "../Icons";

type WorkflowStep = "issue" | "evidence" | "verification" | "payout";

export function WorkflowDemoPreview() {
  const [activeStep, setActiveStep] = useState<WorkflowStep>("verification");

  return (
    <div className="workflow-preview-shell">
      {/* Header bar */}
      <div className="workflow-preview-header">
        <div className="workflow-preview-title-row">
          <span className="workflow-badge">
            Interactive preview (demo data)
          </span>
          <span className="workflow-repo-tag">facebook/react#38090</span>
        </div>

        {/* Workflow Phase Tabs */}
        <div
          className="workflow-step-tabs"
          role="tablist"
          aria-label="Workflow Demonstration Steps"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeStep === "issue"}
            className={`workflow-step-tab ${activeStep === "issue" ? "tab-active" : ""}`}
            onClick={() => setActiveStep("issue")}
          >
            1. Issue
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeStep === "evidence"}
            className={`workflow-step-tab ${activeStep === "evidence" ? "tab-active" : ""}`}
            onClick={() => setActiveStep("evidence")}
          >
            2. Pull Request
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeStep === "verification"}
            className={`workflow-step-tab ${activeStep === "verification" ? "tab-active" : ""}`}
            onClick={() => setActiveStep("verification")}
          >
            3. AI Verification
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeStep === "payout"}
            className={`workflow-step-tab ${activeStep === "payout" ? "tab-active" : ""}`}
            onClick={() => setActiveStep("payout")}
          >
            4. Payout
          </button>
        </div>
      </div>

      {/* Main Preview Content */}
      <div className="workflow-preview-body">
        {activeStep === "issue" && (
          <div className="workflow-pane">
            <div className="workflow-pane-head">
              <div className="workflow-issue-badge">
                <GitIssueIcon className="issue-icon" />
                <span className="issue-id">Issue #38090</span>
                <span className="issue-state">open</span>
              </div>
              <span className="issue-bounty-val">$150.00 USD</span>
            </div>

            <h4 className="workflow-pane-title">
              [Fizz] Use the script nonce for bootstrap script preloads
            </h4>
            <p className="workflow-pane-desc">
              When streaming server components with Content Security Policy,
              script preloads currently omit the nonce parameter, triggering
              browser CSP violations.
            </p>

            <div className="workflow-subpanel">
              <div className="workflow-subpanel-head">
                <SparkleIcon className="ai-icon" />
                <span>AI Milestone Proposal (2 Milestones)</span>
              </div>
              <div className="workflow-milestone-row">
                <div className="milestone-col-main">
                  <span className="milestone-name">
                    Milestone 1: Nonce propagation & tests
                  </span>
                  <span className="milestone-sub">
                    ReactFizzServer nonce option parser and unit tests
                  </span>
                </div>
                <span className="milestone-price">$75.00</span>
              </div>
              <div className="workflow-milestone-row">
                <div className="milestone-col-main">
                  <span className="milestone-name">
                    Milestone 2: Streaming integration tests
                  </span>
                  <span className="milestone-sub">
                    End-to-end streaming fixture across Webpack and Vite
                  </span>
                </div>
                <span className="milestone-price">$75.00</span>
              </div>
            </div>
          </div>
        )}

        {activeStep === "evidence" && (
          <div className="workflow-pane">
            <div className="workflow-pane-head">
              <div className="workflow-issue-badge">
                <span className="issue-id">PR #38091</span>
                <span className="issue-state state-submitted">submitted</span>
              </div>
              <span className="workflow-meta-tag">Milestone 1 deliverable</span>
            </div>

            <h4 className="workflow-pane-title">
              Add script nonce support to bootstrap scripts
            </h4>
            <p className="workflow-pane-desc">
              Passes script nonce down to bootstrap preloads and inline script
              tags in FizzServer. Resolves #38090.
            </p>

            <div className="workflow-subpanel">
              <div className="workflow-subpanel-head">
                <span>Changed Files & Diff Inspection</span>
                <span className="diff-stats">+84 -6 lines</span>
              </div>
              <div className="file-diff-item">
                <span className="file-name">
                  packages/react-server/ReactFizzServer.js
                </span>
                <span className="file-stat">+62, -4</span>
              </div>
              <div className="file-diff-item">
                <span className="file-name">
                  packages/react-server/__tests__/ReactFizz-test.js
                </span>
                <span className="file-stat">+22, -2</span>
              </div>
            </div>

            <div className="workflow-ci-row">
              <span className="ci-label">CI check status:</span>
              <span className="status-badge badge-clean">
                <CheckIcon className="check-icon" />
                12 of 12 check-runs passed (clean)
              </span>
            </div>
          </div>
        )}

        {activeStep === "verification" && (
          <div className="workflow-pane">
            <div className="workflow-pane-head">
              <div className="workflow-issue-badge">
                <SparkleIcon className="ai-icon" />
                <span className="issue-id">AI Evidence Report</span>
              </div>
              <span className="status-badge badge-verified">
                Confidence: 94% (High)
              </span>
            </div>

            <h4 className="workflow-pane-title">
              Milestone 1 Acceptance Verification
            </h4>

            <div className="criteria-checklist">
              <div className="criteria-item verified">
                <div className="criteria-status-box">
                  <CheckIcon className="check-icon" />
                </div>
                <div className="criteria-content">
                  <span className="criteria-text">
                    Pass script nonce option down to bootstrap script preloads
                  </span>
                  <span className="criteria-fact">
                    Matched: ReactFizzServer.js:142 handles options.nonce
                  </span>
                </div>
              </div>

              <div className="criteria-item verified">
                <div className="criteria-status-box">
                  <CheckIcon className="check-icon" />
                </div>
                <div className="criteria-content">
                  <span className="criteria-text">
                    Automated unit tests verifying script nonce attribute
                    rendering
                  </span>
                  <span className="criteria-fact">
                    Matched: ReactFizz-test.js adds 4 assertion cases
                  </span>
                </div>
              </div>

              <div className="criteria-item verified">
                <div className="criteria-status-box">
                  <CheckIcon className="check-icon" />
                </div>
                <div className="criteria-content">
                  <span className="criteria-text">
                    Ensure all CI lint and test suites pass cleanly
                  </span>
                  <span className="criteria-fact">
                    Confirmed: commit 1b132598 check-runs green
                  </span>
                </div>
              </div>
            </div>

            <div className="workflow-recommendation-bar">
              <span className="recommendation-badge">Assessment</span>
              <span className="recommendation-text">
                All 3 criteria satisfied with high evidence confidence
              </span>
            </div>
          </div>
        )}

        {activeStep === "payout" && (
          <div className="workflow-pane">
            <div className="workflow-pane-head">
              <div className="workflow-issue-badge">
                <LockIcon className="lock-icon" />
                <span className="issue-id">
                  Sponsor Confirmation & Settlement
                </span>
              </div>
              <span className="status-badge badge-success">
                Payout Completed
              </span>
            </div>

            <h4 className="workflow-pane-title">Milestone 1 Payout Settled</h4>

            <div className="payout-details-grid">
              <div className="payout-data-block">
                <span className="data-label">Sponsor Approval</span>
                <span className="data-value">
                  @lead-maintainer (Manual Confirmation)
                </span>
              </div>
              <div className="payout-data-block">
                <span className="data-label">Disbursement Amount</span>
                <span className="data-value num">$75.00 USD</span>
              </div>
              <div className="payout-data-block">
                <span className="data-label">PayPal Batch ID</span>
                <span className="data-value font-mono">QTDY8R65EQAYN</span>
              </div>
              <div className="payout-data-block">
                <span className="data-label">Transaction Reference</span>
                <span className="data-value font-mono">968351637J373690F</span>
              </div>
            </div>

            <div className="ledger-preview-box">
              <div className="ledger-preview-row">
                <span className="ledger-type">MILESTONE_APPROVED</span>
                <span className="ledger-dir">INTERNAL</span>
                <span className="ledger-time">Approved deliverable</span>
              </div>
              <div className="ledger-preview-row">
                <span className="ledger-type">PAYOUT_COMPLETED</span>
                <span className="ledger-dir">DEBIT</span>
                <span className="ledger-time">$75.00 to contributor</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer bar */}
      <div className="workflow-preview-footer">
        <span className="workflow-footnote">
          Evidence collected via GitHub API · Settlement via PayPal Payouts
        </span>
        <button
          type="button"
          className="workflow-step-advance-btn"
          onClick={() => {
            if (activeStep === "issue") setActiveStep("evidence");
            else if (activeStep === "evidence") setActiveStep("verification");
            else if (activeStep === "verification") setActiveStep("payout");
            else setActiveStep("issue");
          }}
        >
          Next demo step
          <ExternalLinkIcon className="link-icon" />
        </button>
      </div>
    </div>
  );
}
