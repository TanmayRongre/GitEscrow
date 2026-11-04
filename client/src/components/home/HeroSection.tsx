import { Container } from "./Container";
import { HeroEvidenceCard } from "./HeroEvidenceCard";
import { HeroTrustRow } from "./HeroTrustRow";

interface HeroSectionProps {
  onExploreBounties: () => void;
  onLaunchBounty: () => void;
}

export function HeroSection({
  onExploreBounties,
  onLaunchBounty,
}: HeroSectionProps) {
  return (
    <section
      id="hero"
      className="hero-section"
      style={{
        backgroundColor: "var(--ink)",
        borderBottom: "1px solid var(--border-dark)",
      }}
    >
      <Container>
        <div className="hero-two-col-layout">
          {/* Left Column: Text, CTAs, Trust Row */}
          <div className="hero-left-col">
            <h1
              className="hero-headline"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 400,
                fontSize: "clamp(32px, 4vw, 48px)",
                lineHeight: 1.15,
                letterSpacing: "-0.01em",
                color: "var(--text-dark-primary)",
                textWrap: "balance",
                margin: 0,
              }}
            >
              Code with confidence. Get paid with evidence.
            </h1>

            <p
              className="hero-subcopy"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 400,
                fontSize: "17px",
                lineHeight: 1.6,
                color: "var(--text-dark-secondary)",
                margin: 0,
              }}
            >
              GitEscrow lets sponsors create PayPal-funded bounties linked to GitHub
              issues, track work through milestones, and release payment after
              reviewing pull request evidence.
            </p>

            {/* CTAs */}
            <div
              className="hero-cta-group"
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "var(--space-16)",
              }}
            >
              <button
                type="button"
                className="btn-primary-hero"
                onClick={onExploreBounties}
                style={{
                  backgroundColor: "var(--amber)",
                  color: "#0B0C0E",
                  fontFamily: "var(--font-body)",
                  fontSize: "16px",
                  fontWeight: 600,
                  padding: "var(--space-12) var(--space-24)",
                  borderRadius: "var(--radius-control)",
                  border: "none",
                  cursor: "pointer",
                  minHeight: "48px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background-color 120ms ease",
                }}
              >
                Find Bounties
              </button>

              <button
                type="button"
                className="btn-secondary-hero"
                onClick={onLaunchBounty}
                style={{
                  backgroundColor: "var(--ink-raised)",
                  color: "var(--text-dark-primary)",
                  fontFamily: "var(--font-body)",
                  fontSize: "16px",
                  fontWeight: 500,
                  padding: "var(--space-12) var(--space-24)",
                  borderRadius: "var(--radius-control)",
                  border: "1px solid var(--border-dark)",
                  cursor: "pointer",
                  minHeight: "48px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "border-color 120ms ease, background-color 120ms ease",
                }}
              >
                Fund an Issue
              </button>
            </div>

            {/* Trust Row on Left */}
            <HeroTrustRow />
          </div>

          {/* Right Column: Hero Sample Card */}
          <div className="hero-right-col">
            <HeroEvidenceCard />
          </div>
        </div>
      </Container>
    </section>
  );
}
