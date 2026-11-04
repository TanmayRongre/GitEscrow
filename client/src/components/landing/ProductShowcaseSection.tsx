import { useState } from "react";
import { LockIcon, SparkleIcon } from "../Icons";

type ShowcaseTab =
  | "marketplace"
  | "analysis"
  | "verification"
  | "milestones"
  | "ledger";

interface ProductShowcaseSectionProps {
  onExploreBounties?: () => void;
}

export function ProductShowcaseSection({
  onExploreBounties,
}: ProductShowcaseSectionProps) {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("marketplace");

  return (
    <section
      id="showcase"
      className="showcase-section section-charcoal"
      aria-labelledby="showcase-heading"
    >
      <div className="container">
        {/* Editorial Section Header */}
        <div className="section-head text-center">
          <h2 id="showcase-heading" className="section-title">
            From GitHub issue to verified payment.
          </h2>
          <p className="section-subtitle">
            Explore the core interfaces that power the GitEscrow workflow from
            bounty creation through verified milestone disbursement.
          </p>
        </div>

        {/* 5-Tab Switcher */}
        <div
          className="showcase-tabs-container"
          role="tablist"
          aria-label="Platform View Tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "marketplace"}
            className={`showcase-tab ${activeTab === "marketplace" ? "tab-selected" : ""}`}
            onClick={() => setActiveTab("marketplace")}
          >
            Bounty Marketplace
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "analysis"}
            className={`showcase-tab ${activeTab === "analysis" ? "tab-selected" : ""}`}
            onClick={() => setActiveTab("analysis")}
          >
            AI Issue Analysis
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "verification"}
            className={`showcase-tab ${activeTab === "verification" ? "tab-selected" : ""}`}
            onClick={() => setActiveTab("verification")}
          >
            GitHub PR Verification
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "milestones"}
            className={`showcase-tab ${activeTab === "milestones" ? "tab-selected" : ""}`}
            onClick={() => setActiveTab("milestones")}
          >
            Milestone Progress
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "ledger"}
            className={`showcase-tab ${activeTab === "ledger" ? "tab-selected" : ""}`}
            onClick={() => setActiveTab("ledger")}
          >
            Financial Ledger
          </button>
        </div>

        {/* Showcase Display Panel */}
        <div className="showcase-display-panel">
          {/* Tab 1: Marketplace Showcase */}
          {activeTab === "marketplace" && (
            <div className="showcase-content-view">
              <div className="showcase-panel-toolbar">
                <span className="showcase-view-title">
                  Active Bounties in Marketplace
                </span>
                <span className="showcase-view-tag">
                  Live Filter: Open & Funded (Demo Data)
                </span>
              </div>

              <div className="showcase-bounty-list">
                <div className="showcase-bounty-card">
                  <div className="bounty-card-header">
                    <span className="bounty-repo font-mono">
                      facebook/react
                    </span>
                    <span className="bounty-amount num">$150.00 USD</span>
                  </div>
                  <h4 className="bounty-title">
                    #38090: [Fizz] Use the script nonce for bootstrap script
                    preloads
                  </h4>
                  <p className="bounty-snippet">
                    Pass script nonce options down to bootstrap preloads and
                    inline script tags in ReactFizzServer to satisfy CSP
                    policies.
                  </p>
                  <div className="bounty-card-meta">
                    <span className="bounty-tag">2 milestones</span>
                    <span className="bounty-tag">Funded in Escrow</span>
                    <span className="bounty-assignee">
                      Assigned to @react-contributor
                    </span>
                  </div>
                </div>

                <div className="showcase-bounty-card">
                  <div className="bounty-card-header">
                    <span className="bounty-repo font-mono">
                      facebook/react
                    </span>
                    <span className="bounty-amount num">$200.00 USD</span>
                  </div>
                  <h4 className="bounty-title">
                    #38092: [Compiler] Handle conditional hook invocations in
                    loop bodies
                  </h4>
                  <p className="bounty-snippet">
                    Improve static analysis pass to detect conditional hook
                    invocations inside for-of loops and generate clear
                    diagnostic warnings.
                  </p>
                  <div className="bounty-card-meta">
                    <span className="bounty-tag">3 milestones</span>
                    <span className="bounty-tag">Funded in Escrow</span>
                    <span className="bounty-assignee">Open for claim</span>
                  </div>
                </div>
              </div>

              {onExploreBounties ? (
                <div
                  style={{ marginTop: "var(--space-md)", textAlign: "center" }}
                >
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={onExploreBounties}
                  >
                    Browse full marketplace
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Tab 2: AI Issue Analysis Showcase */}
          {activeTab === "analysis" && (
            <div className="showcase-content-view">
              <div className="showcase-panel-toolbar">
                <div className="showcase-toolbar-left">
                  <SparkleIcon className="ai-icon" />
                  <span className="showcase-view-title">
                    AI Issue Analysis & Milestone Proposal
                  </span>
                </div>
                <span className="showcase-view-tag">
                  Zod Validated Output · Demo
                </span>
              </div>

              <div className="showcase-analysis-header">
                <div className="analysis-issue-pill">
                  <span className="font-mono text-amber">Issue #38090:</span>
                  <span className="issue-headline">
                    Use script nonce for bootstrap script preloads
                  </span>
                </div>
                <div className="analysis-summary-meta">
                  <span className="meta-chip font-mono">
                    Complexity: Moderate
                  </span>
                  <span className="meta-chip font-mono">
                    Recommended: 2 Milestones
                  </span>
                  <span className="meta-chip font-mono">
                    Total Budget: $150.00 USD
                  </span>
                </div>
              </div>

              <div className="showcase-milestones-list">
                <div className="showcase-milestone-panel in-progress">
                  <div className="milestone-status-header">
                    <span className="milestone-badge-order">
                      Milestone 1 (60% allocation)
                    </span>
                    <span className="status-badge badge-pending">PROPOSED</span>
                  </div>
                  <h4 className="milestone-heading">
                    ReactFizzServer Nonce Option Handling
                  </h4>
                  <p className="milestone-summary">
                    Parse nonce property from server bootstrap options and
                    thread through streaming preload generation logic.
                  </p>
                  <div className="criteria-checklist">
                    <span className="criteria-title font-mono">
                      Acceptance Criteria:
                    </span>
                    <ul className="criteria-items font-mono">
                      <li>• Read bootstrapScriptNonce from client options</li>
                      <li>• Render nonce attribute on preload link elements</li>
                      <li>• Pass all ReactFizzServer unit tests</li>
                    </ul>
                  </div>
                  <div className="milestone-footer-row">
                    <span className="milestone-allocation num">$90.00 USD</span>
                    <span className="milestone-tx font-mono">
                      Target: 3 days
                    </span>
                  </div>
                </div>

                <div className="showcase-milestone-panel in-progress">
                  <div className="milestone-status-header">
                    <span className="milestone-badge-order">
                      Milestone 2 (40% allocation)
                    </span>
                    <span className="status-badge badge-pending">PROPOSED</span>
                  </div>
                  <h4 className="milestone-heading">
                    Inline Script Tag Nonce Rendering & CSP Tests
                  </h4>
                  <p className="milestone-summary">
                    Ensure inline bootstrap script tags include nonce attribute
                    and add integration test against strict CSP header.
                  </p>
                  <div className="criteria-checklist">
                    <span className="criteria-title font-mono">
                      Acceptance Criteria:
                    </span>
                    <ul className="criteria-items font-mono">
                      <li>• Inject nonce on inline script elements</li>
                      <li>• Add strict-dynamic CSP test fixture</li>
                    </ul>
                  </div>
                  <div className="milestone-footer-row">
                    <span className="milestone-allocation num">$60.00 USD</span>
                    <span className="milestone-tx font-mono">
                      Target: 2 days
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Verification Report Showcase */}
          {activeTab === "verification" && (
            <div className="showcase-content-view">
              <div className="showcase-panel-toolbar">
                <div className="showcase-toolbar-left">
                  <SparkleIcon className="ai-icon" />
                  <span className="showcase-view-title">
                    Deterministic PR Verification Audit
                  </span>
                </div>
                <span className="status-badge badge-verified">
                  Overall: VERIFIED (High Confidence)
                </span>
              </div>

              <div className="showcase-audit-meta-grid">
                <div className="audit-meta-item">
                  <span className="audit-meta-label">
                    Evaluated Pull Request
                  </span>
                  <span className="audit-meta-val font-mono">
                    facebook/react#38091
                  </span>
                </div>
                <div className="audit-meta-item">
                  <span className="audit-meta-label">Target Milestone</span>
                  <span className="audit-meta-val">
                    Milestone 1: Nonce propagation & tests
                  </span>
                </div>
                <div className="audit-meta-item">
                  <span className="audit-meta-label">Code Telemetry</span>
                  <span className="audit-meta-val">
                    2 files changed (+84, -6 lines)
                  </span>
                </div>
                <div className="audit-meta-item">
                  <span className="audit-meta-label">CI Check Status</span>
                  <span className="audit-meta-val">
                    12/12 check runs completed cleanly
                  </span>
                </div>
              </div>

              <div className="showcase-criteria-table">
                <div className="criteria-table-head">
                  <span>Acceptance Criterion</span>
                  <span>Evidence Finding</span>
                  <span>Verification Status</span>
                </div>
                <div className="criteria-table-row">
                  <span className="criterion-name">
                    Pass script nonce down to bootstrap preloads
                  </span>
                  <span className="criterion-evidence font-mono">
                    ReactFizzServer.js:142 handles options.nonce
                  </span>
                  <span className="status-badge badge-clean">Verified</span>
                </div>
                <div className="criteria-table-row">
                  <span className="criterion-name">
                    Automated unit tests for script nonce rendering
                  </span>
                  <span className="criterion-evidence font-mono">
                    ReactFizz-test.js:315 contains 4 test cases
                  </span>
                  <span className="status-badge badge-clean">Verified</span>
                </div>
                <div className="criteria-table-row">
                  <span className="criterion-name">
                    Ensure all CI lint and test suites pass cleanly
                  </span>
                  <span className="criterion-evidence font-mono">
                    GitHub Actions head commit 1b132598 passed
                  </span>
                  <span className="status-badge badge-clean">Verified</span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Milestone Progress Showcase */}
          {activeTab === "milestones" && (
            <div className="showcase-content-view">
              <div className="showcase-panel-toolbar">
                <span className="showcase-view-title">
                  Milestone Breakdown & Settlement Status
                </span>
                <span className="showcase-view-tag">
                  Bounty Total: $150.00 USD (Demo)
                </span>
              </div>

              <div className="showcase-milestones-list">
                <div className="showcase-milestone-panel completed">
                  <div className="milestone-status-header">
                    <span className="milestone-badge-order">
                      Milestone 1 of 2
                    </span>
                    <span className="status-badge badge-success">
                      APPROVED & DISBURSED
                    </span>
                  </div>
                  <h4 className="milestone-heading">
                    Core Nonce Propagation Logic
                  </h4>
                  <p className="milestone-summary">
                    Implement nonce options parsing in ReactFizzServer and pass
                    to bootstrap preload tags.
                  </p>
                  <div className="milestone-footer-row">
                    <span className="milestone-allocation num">
                      $75.00 USD (50% allocation)
                    </span>
                    <span className="milestone-tx font-mono">
                      Payout Tx: 968351637J373690F
                    </span>
                  </div>
                </div>

                <div className="showcase-milestone-panel in-progress">
                  <div className="milestone-status-header">
                    <span className="milestone-badge-order">
                      Milestone 2 of 2
                    </span>
                    <span className="status-badge badge-pending">
                      IN PROGRESS
                    </span>
                  </div>
                  <h4 className="milestone-heading">
                    Integration Tests & Edge Case Handling
                  </h4>
                  <p className="milestone-summary">
                    Verify empty, missing, and special character nonces across
                    Webpack and Vite streaming renderers.
                  </p>
                  <div className="milestone-footer-row">
                    <span className="milestone-allocation num">
                      $75.00 USD (50% allocation)
                    </span>
                    <span className="milestone-tx">Reserved in Escrow</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 5: Financial Ledger Showcase */}
          {activeTab === "ledger" && (
            <div className="showcase-content-view">
              <div className="showcase-panel-toolbar">
                <div className="showcase-toolbar-left">
                  <LockIcon className="lock-icon" />
                  <span className="showcase-view-title">
                    Append-Only Escrow Ledger Entries
                  </span>
                </div>
                <span className="showcase-view-tag">
                  Strict Immutability Enforced (Demo)
                </span>
              </div>

              <div className="ledger-entries-table">
                <div className="ledger-table-head">
                  <span>Event Type</span>
                  <span>Direction</span>
                  <span>Amount</span>
                  <span>Status</span>
                  <span>Reference ID</span>
                </div>
                <div className="ledger-table-row">
                  <span className="ledger-event font-mono">
                    FUNDING_CAPTURED
                  </span>
                  <span className="ledger-dir credit">CREDIT</span>
                  <span className="ledger-amt num">$150.00</span>
                  <span className="status-badge badge-clean">COMPLETED</span>
                  <span className="ledger-ref font-mono">
                    cap_real_react_38090
                  </span>
                </div>
                <div className="ledger-table-row">
                  <span className="ledger-event font-mono">
                    MILESTONE_APPROVED
                  </span>
                  <span className="ledger-dir internal">INTERNAL</span>
                  <span className="ledger-amt num">$75.00</span>
                  <span className="status-badge badge-clean">RECORDED</span>
                  <span className="ledger-ref font-mono">
                    m1_appr_react_38090
                  </span>
                </div>
                <div className="ledger-table-row">
                  <span className="ledger-event font-mono">
                    PAYOUT_COMPLETED
                  </span>
                  <span className="ledger-dir debit">DEBIT</span>
                  <span className="ledger-amt num">$75.00</span>
                  <span className="status-badge badge-success">COMPLETED</span>
                  <span className="ledger-ref font-mono">
                    968351637J373690F
                  </span>
                </div>
              </div>

              <div className="ledger-guarantee-note">
                <LockIcon className="lock-icon" />
                <span>
                  All ledger mutations are append-only. Updates and deletions
                  are prevented at the database driver level.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
