import { CheckIcon, AlertIcon } from "../Icons";

export function ProblemSection() {
  return (
    <section
      id="problem"
      className="problem-section section-cream"
      aria-labelledby="problem-heading"
    >
      <div className="container">
        {/* Editorial Section Header */}
        <div className="section-head text-center">
          <h2 id="problem-heading" className="section-title">
            Open-source contributions deserve transparent rewards.
          </h2>
          <p className="section-subtitle">
            Traditional bounties suffer from vague requirements, speculative
            pull requests, and all-or-nothing payout disputes. GitEscrow
            replaces uncertainty with structured milestone verification.
          </p>
        </div>

        {/* Core Problem Narrative */}
        <div className="problem-narrative-grid">
          <div className="narrative-point">
            <span className="narrative-num font-mono">01</span>
            <h3 className="narrative-title">Contributor Payment Anxiety</h3>
            <p className="narrative-desc">
              Developers invest dozens of hours implementing complex features in
              good faith, only to face indefinite review delays, shifting
              requirements, or unrewarded project abandonment.
            </p>
          </div>

          <div className="narrative-point">
            <span className="narrative-num font-mono">02</span>
            <h3 className="narrative-title">Sponsor Verification Friction</h3>
            <p className="narrative-desc">
              Repository maintainers want to reward contributors but lack the
              bandwidth to manually cross-reference large pull requests against
              requirements, test suites, and regression checks.
            </p>
          </div>

          <div className="narrative-point">
            <span className="narrative-num font-mono">03</span>
            <h3 className="narrative-title">Monolithic All-or-Nothing Risk</h3>
            <p className="narrative-desc">
              When a whole feature is bundled into one monolithic bounty,
              partial completion yields zero compensation. Phased milestones
              ensure continuous feedback, shared security, and incremental
              payouts.
            </p>
          </div>
        </div>

        {/* Architectural Comparison Visualization */}
        <div
          className="architecture-comparison-container"
          aria-label="Workflow Architecture Comparison"
        >
          <div className="comparison-flow-grid">
            {/* Left: Traditional Workflow (Failure Mode) */}
            <div className="comparison-column col-traditional">
              <div className="comparison-col-header">
                <h4 className="comparison-col-title">
                  The Traditional Bounty Cycle
                </h4>
                <span className="comparison-status-tag tag-warning">
                  <AlertIcon className="icon-tiny" /> Speculative & Unverified
                </span>
                <p className="comparison-col-desc">
                  Effort without verification or phase guarantees.
                </p>
              </div>

              <div className="flow-step-list">
                <div className="flow-step-node node-muted">
                  <span className="node-marker font-mono">A</span>
                  <div className="node-content">
                    <span className="node-label">
                      Unstructured GitHub Issue
                    </span>
                    <span className="node-sub">
                      Ambiguous scope and loose definitions of done
                    </span>
                  </div>
                </div>

                <div className="flow-connector-line line-dashed" />

                <div className="flow-step-node node-muted">
                  <span className="node-marker font-mono">B</span>
                  <div className="node-content">
                    <span className="node-label">
                      Monolithic Speculative PR
                    </span>
                    <span className="node-sub">
                      500+ lines changed with uncoordinated deliverables
                    </span>
                  </div>
                </div>

                <div className="flow-connector-line line-dashed" />

                <div className="flow-step-node node-muted">
                  <span className="node-marker font-mono">C</span>
                  <div className="node-content">
                    <span className="node-label">Manual Guesswork Review</span>
                    <span className="node-sub">
                      Maintainers struggle to audit criteria and coverage
                    </span>
                  </div>
                </div>

                <div className="flow-connector-line line-dashed" />

                <div className="flow-step-node node-risk">
                  <span className="node-marker font-mono">D</span>
                  <div className="node-content">
                    <span className="node-label">
                      Ghosted Reviews & Disputes
                    </span>
                    <span className="node-sub">
                      Funds locked or refunded without contributor payout
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Divider Indicator */}
            <div className="comparison-divider-axis">
              <span className="axis-line" />
              <span className="axis-badge font-mono">VS</span>
              <span className="axis-line" />
            </div>

            {/* Right: GitEscrow Verified Architecture */}
            <div className="comparison-column col-gitescrow">
              <div className="comparison-col-header">
                <h4 className="comparison-col-title">
                  GitEscrow Milestone Architecture
                </h4>
                <span className="comparison-status-tag tag-verified">
                  <CheckIcon className="icon-tiny" /> Verified & Pre-Funded
                </span>
                <p className="comparison-col-desc">
                  Deterministic criteria evaluation backed by upfront escrow.
                </p>
              </div>

              <div className="flow-step-list">
                <div className="flow-step-node node-active">
                  <span className="node-marker font-mono">01</span>
                  <div className="node-content">
                    <span className="node-label">AI Issue Decomposition</span>
                    <span className="node-sub">
                      Zod-validated milestones with explicit acceptance criteria
                    </span>
                  </div>
                </div>

                <div className="flow-connector-line line-solid" />

                <div className="flow-step-node node-active">
                  <span className="node-marker font-mono">02</span>
                  <div className="node-content">
                    <span className="node-label">Pre-Funded Escrow Lock</span>
                    <span className="node-sub">
                      Authoritative PayPal capture with integer-cent ledgering
                    </span>
                  </div>
                </div>

                <div className="flow-connector-line line-solid" />

                <div className="flow-step-node node-active">
                  <span className="node-marker font-mono">03</span>
                  <div className="node-content">
                    <span className="node-label">
                      AST & CI Evidence Verification
                    </span>
                    <span className="node-sub">
                      PR diff telemetry automatically matched against criteria
                    </span>
                  </div>
                </div>

                <div className="flow-connector-line line-solid" />

                <div className="flow-step-node node-verified-highlight">
                  <span className="node-marker font-mono">04</span>
                  <div className="node-content">
                    <span className="node-label">
                      Guaranteed Milestone Release
                    </span>
                    <span className="node-sub">
                      Sponsor approves factual proof, triggering direct payout
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
