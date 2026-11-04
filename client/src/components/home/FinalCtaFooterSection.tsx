import { Container } from "./Container";

interface FinalCtaFooterSectionProps {
  onExploreBounties: () => void;
  onLaunchBounty: () => void;
}

export function FinalCtaFooterSection({
  onExploreBounties,
  onLaunchBounty,
}: FinalCtaFooterSectionProps) {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer id="final-cta" className="home-section-ink home-section-reveal" style={{ borderBottom: "none" }}>
      <Container>
        {/* Final CTA Banner */}
        <div
          style={{
            maxWidth: "680px",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-20)",
            paddingBottom: "var(--space-64)",
            borderBottom: "1px solid var(--border-dark)",
            marginBottom: "var(--space-48)",
          }}
        >
          <h2 className="section-h2-display" style={{ color: "var(--text-dark-primary)" }}>
            Ready to build open source with certainty?
          </h2>
          <p className="section-subcopy-ink">
            Join developers and project maintainers funding and delivering software through milestone bounties.
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--space-16)",
              marginTop: "var(--space-8)",
            }}
          >
            <button
              type="button"
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
              Start as Contributor
            </button>

            <button
              type="button"
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
              Sponsor an Issue
            </button>
          </div>
        </div>

        {/* Minimalist Footer */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-24)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--space-16)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)" }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "var(--amber)",
                  padding: "4px 8px",
                  borderRadius: "var(--radius-control)",
                  backgroundColor: "rgba(217, 119, 6, 0.1)",
                  border: "1px solid rgba(217, 119, 6, 0.25)",
                }}
              >
                GE
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "14px", color: "#CBD5E1" }}>
                GitEscrow — Milestone bounties for open source engineering.
              </span>
            </div>

            <nav aria-label="Footer Navigation">
              <ul
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "var(--space-24)",
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                }}
              >
                <li>
                  <button
                    type="button"
                    onClick={onExploreBounties}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#CBD5E1",
                      fontFamily: "var(--font-body)",
                      fontSize: "14px",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    Explore Bounties
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollTo("how-it-works")}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#CBD5E1",
                      fontFamily: "var(--font-body)",
                      fontSize: "14px",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    How It Works
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollTo("for-sponsors")}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#CBD5E1",
                      fontFamily: "var(--font-body)",
                      fontSize: "14px",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    For Sponsors
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollTo("for-developers")}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#CBD5E1",
                      fontFamily: "var(--font-body)",
                      fontSize: "14px",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    For Developers
                  </button>
                </li>
              </ul>
            </nav>
          </div>

          {/* Statutory Disclosure & Copyright */}
          <div
            style={{
              paddingTop: "var(--space-16)",
              borderTop: "1px solid var(--border-dark)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--space-12)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "12px",
                lineHeight: 1.5,
                color: "var(--text-dark-muted)",
                margin: 0,
                maxWidth: "720px",
              }}
            >
              GitEscrow is not a bank or a regulated escrow provider. Payments are processed by PayPal.
            </p>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "12px",
                color: "var(--text-dark-muted)",
                margin: 0,
              }}
            >
              Distributed under the MIT License. © 2026 GitEscrow.
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}
