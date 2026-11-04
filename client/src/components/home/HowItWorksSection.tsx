import { Container } from "./Container";
import { DollarSign, Code2, FileCheck2, ArrowRightCircle } from "lucide-react";

export function HowItWorksSection() {
  const steps = [
    {
      num: "01",
      title: "Sponsor funds the issue",
      desc: "Maintainer creates the bounty and funds the reward via PayPal with clear acceptance criteria.",
      icon: DollarSign,
    },
    {
      num: "02",
      title: "Contributor claims & builds",
      desc: "Developer claims the milestone, implements the change, and opens a linked pull request.",
      icon: Code2,
    },
    {
      num: "03",
      title: "Automated evidence review",
      desc: "System inspects test outcomes, file changes, and acceptance criteria against the pull request.",
      icon: FileCheck2,
    },
    {
      num: "04",
      title: "Sponsor approves & pays",
      desc: "Maintainer reviews the verified evidence and releases payout directly to the contributor.",
      icon: ArrowRightCircle,
    },
  ];

  return (
    <section id="how-it-works" className="home-section-cream-sunk home-section-reveal">
      <Container>
        <div className="section-header-block">
          <h2 className="section-h2-display">
            From funded issue to verified payout
          </h2>
          <p className="section-subcopy-cream">
            Four simple steps protect both contributors and sponsors through the complete delivery lifecycle.
          </p>
        </div>

        {/* 4 Steps Timeline Grid with Connecting Line */}
        <div className="responsive-steps-grid">
          {/* Subtle Connecting Line visible across card gaps */}
          <div className="steps-timeline-rule" />

          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="responsive-card-md"
                style={{
                  backgroundColor: "var(--cream)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "var(--radius-card)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-16)",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--amber-dark)",
                      padding: "2px 8px",
                      borderRadius: "var(--radius-control)",
                      backgroundColor: "rgba(217, 119, 6, 0.08)",
                      border: "1px solid rgba(217, 119, 6, 0.2)",
                    }}
                  >
                    Step {step.num}
                  </span>
                  <div style={{ color: "var(--text-light-secondary)" }}>
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)", flex: "1 0 auto" }}>
                  <h3
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "var(--text-light-primary)",
                      margin: 0,
                      minHeight: "44px",
                      display: "flex",
                      alignItems: "flex-start",
                      lineHeight: 1.35,
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "14px",
                      lineHeight: 1.5,
                      color: "var(--text-light-secondary)",
                      margin: 0,
                    }}
                  >
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Step 04 Disclosure */}
        <div
          style={{
            marginTop: "var(--space-32)",
            padding: "var(--space-12) var(--space-16)",
            backgroundColor: "rgba(0, 0, 0, 0.03)",
            borderRadius: "var(--radius-control)",
            border: "1px solid var(--border-light)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              color: "var(--text-light-muted)",
              margin: 0,
              textAlign: "left",
            }}
          >
            GitEscrow is not a bank or a regulated escrow provider. Payments are processed by PayPal.
          </p>
        </div>
      </Container>
    </section>
  );
}
