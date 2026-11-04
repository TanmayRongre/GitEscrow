import { Container } from "./Container";
import { CheckCircle2 } from "lucide-react";

interface AudiencesSectionProps {
  onExploreBounties: () => void;
  onLaunchBounty: () => void;
}

export function AudiencesSection({
  onExploreBounties,
  onLaunchBounty,
}: AudiencesSectionProps) {
  const contributorBenefits = [
    {
      title: "Bounties funded upfront",
      desc: "Know that the bounty reward is funded and waiting before you write the first line of code.",
    },
    {
      title: "Clear acceptance criteria",
      desc: "Clear milestones remove ambiguity and protect against shifting project requirements.",
    },
    {
      title: "Prompt milestone payouts",
      desc: "Receive payouts as deliverables are reviewed and completed, not months later.",
    },
  ];

  const sponsorBenefits = [
    {
      title: "Pay only for results",
      desc: "Funds remain protected until deliverables pass inspection and receive your approval.",
    },
    {
      title: "Fast pull request review",
      desc: "Automated criteria checks save maintainer hours by highlighting evidence directly.",
    },
    {
      title: "Attract quality contributors",
      desc: "Funded bounty listings attract skilled engineers who value reliable compensation.",
    },
  ];

  return (
    <section id="audiences" className="home-section-cream home-section-reveal">
      <Container>
        <div className="section-header-block">
          <h2 className="section-h2-display">
            Built for both sides of open source
          </h2>
          <p className="section-subcopy-cream">
            Whether building software or funding maintenance, GitEscrow aligns incentives through transparent milestones.
          </p>
        </div>

        {/* 2 Symmetric Columns */}
        <div className="responsive-two-col-grid">
          {/* Column 1: For Contributors */}
          <div
            id="for-developers"
            className="responsive-card-lg"
            style={{
              backgroundColor: "var(--cream-sunk)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-card)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-24)",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-20)" }}>
                <h3
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "20px",
                    fontWeight: 600,
                    color: "var(--text-light-primary)",
                    margin: 0,
                  }}
                >
                  For Contributors
                </h3>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-control)",
                    backgroundColor: "rgba(217, 119, 6, 0.1)",
                    color: "#92400E",
                    fontWeight: 600,
                  }}
                >
                  Engineers
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-20)" }}>
                {contributorBenefits.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-12)" }}>
                    <CheckCircle2 size={18} color="var(--green-light)" style={{ flexShrink: 0, marginTop: "2px" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <strong style={{ fontFamily: "var(--font-body)", fontSize: "15px", color: "var(--text-light-primary)" }}>
                        {item.title}
                      </strong>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "14px", lineHeight: 1.5, color: "var(--text-light-secondary)" }}>
                        {item.desc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onExploreBounties}
              style={{
                backgroundColor: "var(--amber)",
                color: "#0B0C0E",
                fontFamily: "var(--font-body)",
                fontSize: "15px",
                fontWeight: 600,
                padding: "var(--space-12) var(--space-20)",
                borderRadius: "var(--radius-control)",
                border: "none",
                cursor: "pointer",
                width: "100%",
                minHeight: "44px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background-color 120ms ease",
              }}
            >
              Browse Available Bounties
            </button>
          </div>

          {/* Column 2: For Sponsors */}
          <div
            id="for-sponsors"
            className="responsive-card-lg"
            style={{
              backgroundColor: "var(--cream-sunk)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-card)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-24)",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-20)" }}>
                <h3
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "20px",
                    fontWeight: 600,
                    color: "var(--text-light-primary)",
                    margin: 0,
                  }}
                >
                  For Sponsors
                </h3>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    padding: "2px 8px",
                    borderRadius: "var(--radius-control)",
                    backgroundColor: "rgba(0, 0, 0, 0.05)",
                    color: "var(--text-light-primary)",
                    fontWeight: 600,
                  }}
                >
                  Maintainers
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-20)" }}>
                {sponsorBenefits.map((item, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-12)" }}>
                    <CheckCircle2 size={18} color="var(--green-light)" style={{ flexShrink: 0, marginTop: "2px" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <strong style={{ fontFamily: "var(--font-body)", fontSize: "15px", color: "var(--text-light-primary)" }}>
                        {item.title}
                      </strong>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: "14px", lineHeight: 1.5, color: "var(--text-light-secondary)" }}>
                        {item.desc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onLaunchBounty}
              style={{
                backgroundColor: "transparent",
                color: "var(--text-light-primary)",
                fontFamily: "var(--font-body)",
                fontSize: "15px",
                fontWeight: 600,
                padding: "var(--space-12) var(--space-20)",
                borderRadius: "var(--radius-control)",
                border: "1px solid var(--border-light)",
                cursor: "pointer",
                width: "100%",
                minHeight: "44px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "border-color 120ms ease, color 120ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--amber)";
                e.currentTarget.style.color = "var(--amber-dark)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-light)";
                e.currentTarget.style.color = "var(--text-light-primary)";
              }}
            >
              Fund Your Repository
            </button>
          </div>
        </div>
      </Container>
    </section>
  );
}
