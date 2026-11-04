import { Container } from "./Container";
import { XCircle, CheckCircle2 } from "lucide-react";

export function ProblemSection() {
  const traditionalPoints = [
    "Unfunded promises with no upfront financial commitment.",
    "All-or-nothing scope with no incremental milestones.",
    "Subjective reviews leading to abandoned work.",
    "Manual payouts delayed by weeks or months.",
  ];

  const gitEscrowPoints = [
    "Bounties funded upfront via PayPal before work starts.",
    "Scoped milestones with incremental payouts.",
    "Automated evidence matches acceptance criteria to code.",
    "Direct payout released on sponsor approval.",
  ];

  return (
    <section id="problem" className="home-section-cream home-section-reveal">
      <Container>
        <div className="section-header-block">
          <h2 className="section-h2-display">
            Open source bounties are fundamentally broken
          </h2>
          <p className="section-subcopy-cream">
            Contributors risk working for unpaid promises, while project sponsors spend hours reviewing incomplete code submissions.
          </p>
        </div>

        {/* 2-Column Comparison Grid without VS hacks */}
        <div className="responsive-two-col-grid">
          {/* Column 1: Traditional Bounties */}
          <div
            className="responsive-card-lg"
            style={{
              backgroundColor: "var(--cream-sunk)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-card)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-20)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "var(--text-light-primary)",
                  margin: 0,
                }}
              >
                Traditional Bounties
              </h3>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-control)",
                  backgroundColor: "rgba(185, 28, 28, 0.08)",
                  color: "var(--red-light)",
                  fontWeight: 500,
                }}
              >
                Uncertain
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)", flex: "1 0 auto" }}>
              {traditionalPoints.map((point, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-12)" }}>
                  <XCircle size={18} color="var(--red-light)" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "15px",
                      lineHeight: 1.5,
                      color: "var(--text-light-secondary)",
                    }}
                  >
                    {point}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: GitEscrow */}
          <div
            className="responsive-card-lg"
            style={{
              backgroundColor: "var(--cream-sunk)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-card)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-20)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h3
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "18px",
                  fontWeight: 600,
                  color: "var(--text-light-primary)",
                  margin: 0,
                }}
              >
                GitEscrow
              </h3>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  padding: "2px 8px",
                  borderRadius: "var(--radius-control)",
                  backgroundColor: "rgba(21, 128, 61, 0.08)",
                  color: "var(--green-light)",
                  fontWeight: 500,
                }}
              >
                Verified
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-16)", flex: "1 0 auto" }}>
              {gitEscrowPoints.map((point, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-12)" }}>
                  <CheckCircle2 size={18} color="var(--green-light)" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "15px",
                      lineHeight: 1.5,
                      color: "var(--text-light-primary)",
                      fontWeight: 500,
                    }}
                  >
                    {point}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
