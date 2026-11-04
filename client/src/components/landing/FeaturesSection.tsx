import { SparkleIcon, CheckIcon, LockIcon, UserIcon, InfoIcon } from "../Icons";

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="features-section section-white"
      aria-labelledby="features-heading"
    >
      <div className="container">
        {/* Editorial Section Header */}
        <div className="section-head text-center">
          <h2 id="features-heading" className="section-title">
            Precision engineering for open-source compensation.
          </h2>
          <p className="section-subtitle">
            Move beyond all-or-nothing bounties with structured milestone
            decomposition, deterministic code verification, and transparent
            escrow custody.
          </p>
        </div>

        {/* Alternating Editorial Spreads */}
        <div className="editorial-spreads-container">
          {/* Spread 1: AI Issue Analysis (Text Left, Visual Right) */}
          <div className="editorial-spread spread-row">
            <div className="spread-text-col">
              <h3 className="spread-heading">
                1. Intelligent Issue Decomposition
              </h3>
              <p className="spread-lead">
                Transform unstructured GitHub issues into actionable milestone
                proposals with concrete acceptance criteria.
              </p>
              <p className="spread-body">
                Contributors avoid the frustration of scope creep, while
                maintainers define unambiguous boundaries before development
                begins. Every milestone specifies exact deliverables, test
                expectations, and proportional funding allocations.
              </p>
              <div className="spread-pills-list">
                <span className="spread-pill font-mono">
                  Zod-validated schema
                </span>
                <span className="spread-pill font-mono">
                  2 to 3 logical phases
                </span>
                <span className="spread-pill font-mono">
                  Sponsor review required
                </span>
              </div>
            </div>

            <div className="spread-visual-col">
              <div className="editorial-visual-card visual-decomposition">
                <div className="visual-card-header">
                  <div className="visual-header-left">
                    <SparkleIcon className="ai-icon" />
                    <span className="visual-card-title font-mono">
                      Issue Decomposition Proposal
                    </span>
                  </div>
                  <span className="status-badge badge-pending">
                    Zod Validated
                  </span>
                </div>
                <div className="visual-card-body">
                  <div className="visual-issue-row">
                    <span className="font-mono text-muted">target:</span>
                    <span className="font-mono text-amber">
                      #1042 OAuth2 PKCE Flow
                    </span>
                  </div>
                  <div className="visual-milestone-bar">
                    <div className="bar-header">
                      <span className="bar-name">
                        Milestone 1: Protocol Types & Verifier
                      </span>
                      <span className="bar-amount font-mono">
                        $150.00 (60%)
                      </span>
                    </div>
                    <span className="bar-criteria font-mono">
                      • RFC 7636 verifier generator · 100% test coverage
                    </span>
                  </div>
                  <div className="visual-milestone-bar">
                    <div className="bar-header">
                      <span className="bar-name">
                        Milestone 2: Token Exchange & CI Pipeline
                      </span>
                      <span className="bar-amount font-mono">
                        $100.00 (40%)
                      </span>
                    </div>
                    <span className="bar-criteria font-mono">
                      • Authorize redirect handler · E2E auth fixture
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Spread 2: GitHub PR Verification (Visual Left, Text Right) */}
          <div className="editorial-spread spread-row-reverse">
            <div className="spread-text-col">
              <h3 className="spread-heading">
                2. Deterministic Evidence Evaluation
              </h3>
              <p className="spread-lead">
                Cross-reference pull requests against requirements using
                automated AST analysis, changed files telemetry, and CI status
                runs.
              </p>
              <p className="spread-body">
                GitEscrow fetches pull request diffs directly via GitHub REST
                APIs. Our deterministic verification pipeline tests whether
                claimed implementations fulfill criteria facts before presenting
                the review to the repository sponsor.
              </p>
              <div className="spread-pills-list">
                <span className="spread-pill font-mono">
                  GitHub REST telemetry
                </span>
                <span className="spread-pill font-mono">
                  AST criteria matching
                </span>
                <span className="spread-pill font-mono">
                  CI artifact verification
                </span>
              </div>
            </div>

            <div className="spread-visual-col">
              <div className="editorial-visual-card visual-verification">
                <div className="visual-card-header">
                  <div className="visual-header-left">
                    <CheckIcon className="check-icon" />
                    <span className="visual-card-title font-mono">
                      Telemetry Evidence Report
                    </span>
                  </div>
                  <span className="status-badge badge-verified font-mono">
                    CI Passed
                  </span>
                </div>
                <div className="visual-card-body">
                  <div className="evidence-summary-row font-mono">
                    <span>PR #48 · facebook/react</span>
                    <span className="text-muted">commit 7f2a1b9</span>
                  </div>
                  <div className="evidence-eval-item verified">
                    <CheckIcon className="icon-tiny text-success" />
                    <span className="eval-text">
                      Export generatePKCEPair() with subtle.crypto
                    </span>
                    <span className="eval-status font-mono">MATCH (AST)</span>
                  </div>
                  <div className="evidence-eval-item verified">
                    <CheckIcon className="icon-tiny text-success" />
                    <span className="eval-text">
                      Add unit test suite with 100% branch coverage
                    </span>
                    <span className="eval-status font-mono">PASS (14/14)</span>
                  </div>
                  <div className="evidence-eval-item verified">
                    <CheckIcon className="icon-tiny text-success" />
                    <span className="eval-text">
                      Zero external runtime dependencies added
                    </span>
                    <span className="eval-status font-mono">CLEAN (0 ADD)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Spread 3: Phased Milestone Escrow & Dual-Signature Settlement (Text Left, Visual Right) */}
          <div className="editorial-spread spread-row">
            <div className="spread-text-col">
              <h3 className="spread-heading">
                3. Financial Integrity & Milestone Escrow
              </h3>
              <p className="spread-lead">
                Protect both parties with upfront PayPal escrow funding,
                integer-cent accounting, and immutable append-only ledgering.
              </p>
              <p className="spread-body">
                Funds are securely captured and held in escrow before work
                begins. When a milestone is verified, the sponsor authorizes
                disbursement with one click, triggering immediate payout
                directly to the contributor’s configured account.
              </p>
              <div className="spread-pills-list">
                <span className="spread-pill font-mono">
                  Authoritative PayPal capture
                </span>
                <span className="spread-pill font-mono">
                  Integer-cent precision
                </span>
                <span className="spread-pill font-mono">
                  Append-only audit trail
                </span>
              </div>
            </div>

            <div className="spread-visual-col">
              <div className="editorial-visual-card visual-settlement">
                <div className="visual-card-header">
                  <div className="visual-header-left">
                    <LockIcon className="lock-icon" />
                    <span className="visual-card-title font-mono">
                      Escrow Ledger Transaction
                    </span>
                  </div>
                  <span className="status-badge badge-clean font-mono">
                    Secured
                  </span>
                </div>
                <div className="visual-card-body">
                  <div className="ledger-preview-row">
                    <span className="font-mono text-muted">
                      Initial Escrow:
                    </span>
                    <span className="font-mono text-ink">$250.00 USD</span>
                  </div>
                  <div className="ledger-preview-row">
                    <span className="font-mono text-muted">
                      Disbursed (M1):
                    </span>
                    <span className="font-mono text-success">-$150.00 USD</span>
                  </div>
                  <div className="ledger-preview-row highlight">
                    <span className="font-mono">Remaining Escrow:</span>
                    <span className="font-mono text-amber">
                      $100.00 USD (M2 Reserved)
                    </span>
                  </div>
                  <div className="ledger-preview-note font-mono text-muted">
                    tx: cap_react_1042_pkce · idempotent provider payout
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Supporting Editorial Dual-Band: Controls & Workspace */}
        <div className="editorial-capabilities-band">
          <div className="capability-band-item">
            <div className="cap-header">
              <InfoIcon className="cap-icon" />
              <h4 className="cap-title">Strict Sponsor Custody Boundary</h4>
            </div>
            <p className="cap-desc">
              AI provides objective criteria analysis and facts reporting, but
              financial custody settlement requires explicit sponsor
              authorization. No autonomous disbursements ever occur.
            </p>
          </div>

          <div className="capability-band-item">
            <div className="cap-header">
              <UserIcon className="cap-icon" />
              <h4 className="cap-title">Unified Contributor Workspace</h4>
            </div>
            <p className="cap-desc">
              Developers track open bounties, review milestone criteria
              checklists, inspect automated PR evidence, and configure payout
              destinations in a centralized, secure interface.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
