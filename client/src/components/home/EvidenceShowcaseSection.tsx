import { Container } from "./Container";
import { CheckCircle2, GitPullRequest, ShieldCheck, Terminal } from "lucide-react";

export function EvidenceShowcaseSection() {
  return (
    <section id="evidence" className="home-section-ink home-section-reveal">
      <Container>
        <div className="section-header-block">
          <h2 className="section-h2-display">
            Review pull requests with clear evidence
          </h2>
          <p className="section-subcopy-ink">
            Sponsors inspect automated pull request evidence and test results before approving milestones, keeping final payment decisions under human control.
          </p>
        </div>

        {/* Large Showcase Card (Sample Deliverable) */}
        <div
          style={{
            backgroundColor: "var(--ink-raised)",
            border: "1px solid var(--border-dark)",
            borderRadius: "var(--radius-card)",
            overflow: "hidden",
            boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.6)",
          }}
        >
          {/* Header Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "var(--space-12)",
              padding: "var(--space-16) var(--space-24)",
              borderBottom: "1px solid var(--border-dark)",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)" }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  padding: "3px 8px",
                  borderRadius: "var(--radius-control)",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  color: "#F4F5F6",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  fontWeight: 500,
                }}
              >
                Sample Deliverable
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
                <GitPullRequest size={16} color="var(--amber)" />
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "14px",
                    color: "var(--text-dark-primary)",
                    fontWeight: 500,
                  }}
                >
                  acme/sample-app#12 · PR #48
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#D1D5DB" }}>
                Commit: 7f9a1c4
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  padding: "3px 8px",
                  borderRadius: "var(--radius-control)",
                  backgroundColor: "rgba(34, 197, 94, 0.12)",
                  color: "var(--green)",
                  border: "1px solid rgba(34, 197, 94, 0.25)",
                }}
              >
                14 CI Tests Passed
              </span>
            </div>
          </div>

          {/* Two Distinct Labeled Panels Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
              gap: "var(--space-24)",
              padding: "var(--space-24)",
              alignItems: "start",
            }}
          >
            {/* Panel 1: CI Results (from GitHub) */}
            <div
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.2)",
                border: "1px solid var(--border-dark)",
                borderRadius: "var(--radius-control)",
                padding: "var(--space-20)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-16)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
                  <Terminal size={18} color="var(--amber)" />
                  <h3
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "var(--text-dark-primary)",
                      margin: 0,
                    }}
                  >
                    CI results (from GitHub)
                  </h3>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--green)" }}>
                  All Checks Passed
                </span>
              </div>

              <div
                style={{
                  padding: "var(--space-8) var(--space-12)",
                  backgroundColor: "rgba(34, 197, 94, 0.06)",
                  border: "1px solid rgba(34, 197, 94, 0.2)",
                  borderRadius: "var(--radius-control)",
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  color: "#E2E8F0",
                  lineHeight: 1.4,
                }}
              >
                CI pipeline executed on commit 7a82f1b. All 6 jobs completed successfully.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-10)" }}>
                {[
                  { check: "Unit tests", result: "14 passed, 0 failed (1.8s)" },
                  { check: "TypeScript check", result: "Clean, 0 errors" },
                  { check: "Linter rules", result: "0 warnings" },
                  { check: "Code coverage", result: "94.2% statements covered" },
                  { check: "Build bundle", result: "Production artifacts verified" },
                ].map((row, rIdx) => (
                  <div
                    key={rIdx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "var(--space-8) var(--space-12)",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      borderRadius: "var(--radius-control)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
                      <CheckCircle2 size={14} color="var(--green)" />
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-dark-primary)" }}>
                        {row.check}
                      </span>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#D1D5DB" }}>
                      {row.result}
                    </span>
                  </div>
                ))}
              </div>

              {/* Terminal Log Output Preview */}
              <div
                style={{
                  padding: "var(--space-10) var(--space-12)",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  borderRadius: "var(--radius-control)",
                  border: "1px solid var(--border-dark)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  lineHeight: 1.5,
                  color: "#D1D5DB",
                  overflowX: "auto",
                }}
              >
                <div style={{ color: "var(--green)" }}>$ vitest run --reporter=verbose</div>
                <div style={{ color: "#94A3B8" }}>Test Files  3 passed (3)</div>
                <div style={{ color: "var(--green)" }}>Tests  14 passed (14) · Duration 1.82s</div>
              </div>
            </div>

            {/* Panel 2: AI-Assisted Review (Advisory recommendation) */}
            <div
              style={{
                backgroundColor: "rgba(0, 0, 0, 0.2)",
                border: "1px solid var(--border-dark)",
                borderRadius: "var(--radius-control)",
                padding: "var(--space-20)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-16)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
                  <ShieldCheck size={18} color="var(--amber)" />
                  <h3
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "var(--text-dark-primary)",
                      margin: 0,
                    }}
                  >
                    AI-assisted review
                  </h3>
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    color: "var(--amber)",
                    padding: "2px 6px",
                    borderRadius: "var(--radius-control)",
                    backgroundColor: "rgba(217, 119, 6, 0.1)",
                  }}
                >
                  Advisory Only
                </span>
              </div>

              <div
                style={{
                  padding: "var(--space-8) var(--space-12)",
                  backgroundColor: "rgba(217, 119, 6, 0.06)",
                  border: "1px solid rgba(217, 119, 6, 0.2)",
                  borderRadius: "var(--radius-control)",
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  color: "#E2E8F0",
                  lineHeight: 1.4,
                }}
              >
                AI findings are advisory evidence only. The sponsor makes the final decision.
              </div>

              {/* Criteria Match */}
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
                {[
                  { crit: "Stream timeout parameter in options", file: "connection.ts:42" },
                  { crit: "Default timeout falls back to 30s", file: "config.ts:18" },
                  { crit: "Unit test confirms expired teardown", file: "stream.test.ts:89" },
                ].map((item, iIdx) => (
                  <div
                    key={iIdx}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "var(--space-8)",
                      padding: "var(--space-8)",
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      borderRadius: "var(--radius-control)",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    <CheckCircle2 size={15} color="var(--green)" style={{ flexShrink: 0, marginTop: "2px" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-dark-primary)" }}>
                        {item.crit}
                      </span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#D1D5DB" }}>
                        Matched in {item.file}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Code Diff Preview */}
              <div
                style={{
                  padding: "var(--space-10) var(--space-12)",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  borderRadius: "var(--radius-control)",
                  border: "1px solid var(--border-dark)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  lineHeight: 1.5,
                  color: "#D1D5DB",
                  overflowX: "auto",
                }}
              >
                <div style={{ color: "var(--green)" }}>+ if (options.timeoutMs) &#123;</div>
                <div style={{ color: "var(--green)" }}>+ &nbsp;&nbsp;this.socket.setTimeout(options.timeoutMs, () =&gt; this.handleTimeout());</div>
                <div style={{ color: "var(--green)" }}>+ &#125;</div>
              </div>
            </div>
          </div>

          {/* Action Bar (Sample UI Display Only) */}
          <div
            style={{
              padding: "var(--space-16) var(--space-24)",
              borderTop: "1px solid var(--border-dark)",
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "var(--space-16)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "#CBD5E1" }}>
                Sponsor review action required to trigger payout disbursement.
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#94A3B8" }}>
                Sample UI. No real approval or payment.
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)", flexWrap: "wrap" }}>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                style={{
                  backgroundColor: "transparent",
                  color: "var(--text-dark-primary)",
                  fontFamily: "var(--font-body)",
                  fontSize: "14px",
                  fontWeight: 500,
                  padding: "var(--space-12) var(--space-24)",
                  borderRadius: "var(--radius-control)",
                  border: "1px solid var(--border-dark)",
                  cursor: "default",
                  pointerEvents: "none",
                }}
              >
                Request Changes
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                style={{
                  backgroundColor: "var(--amber)",
                  color: "#0B0C0E",
                  fontFamily: "var(--font-body)",
                  fontSize: "14px",
                  fontWeight: 600,
                  padding: "var(--space-12) var(--space-24)",
                  borderRadius: "var(--radius-control)",
                  border: "none",
                  cursor: "default",
                  pointerEvents: "none",
                }}
              >
                Approve and Release Payment
              </button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
