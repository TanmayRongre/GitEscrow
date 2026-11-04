import { ExternalLinkIcon } from "../Icons";

interface LandingFooterProps {
  onExploreBounties: () => void;
  onLaunchBounty: () => void;
}

export function LandingFooter({
  onExploreBounties,
  onLaunchBounty,
}: LandingFooterProps) {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="landing-footer section-dark">
      <div className="container">
        <div className="landing-footer-grid">
          {/* Brand Col */}
          <div className="landing-footer-brand">
            <div className="footer-logo-row">
              <span className="logo-mark">GE</span>
              <span className="logo-title">GitEscrow</span>
            </div>
            <p className="landing-footer-tagline">
              AI-powered contribution verification and milestone payment
              platform for open-source GitHub repositories.
            </p>
            <div className="landing-footer-status">
              <span className="status-badge badge-clean">
                PayPal Sandbox Verified
              </span>
            </div>
          </div>

          {/* Nav Col 1: Platform */}
          <div className="landing-footer-col">
            <span className="footer-col-heading">Platform</span>
            <ul className="footer-links-list">
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={onExploreBounties}
                >
                  Explore Bounties
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={() => scrollTo("how-it-works")}
                >
                  How It Works
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={() => scrollTo("features")}
                >
                  Platform Features
                </button>
              </li>
            </ul>
          </div>

          {/* Nav Col 2: Roles */}
          <div className="landing-footer-col">
            <span className="footer-col-heading">Participants</span>
            <ul className="footer-links-list">
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={() => scrollTo("for-developers")}
                >
                  For Developers
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={() => scrollTo("for-sponsors")}
                >
                  For Sponsors
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link-btn"
                  onClick={onLaunchBounty}
                >
                  Launch a Bounty
                </button>
              </li>
            </ul>
          </div>

          {/* Nav Col 3: Source Code & Integrity */}
          <div className="landing-footer-col">
            <span className="footer-col-heading">Open Source</span>
            <ul className="footer-links-list">
              <li>
                <a
                  href="https://github.com/TanmayRongre/GitEscrow"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-ext-link"
                >
                  GitHub Repository
                  <ExternalLinkIcon className="link-icon" />
                </a>
              </li>
              <li>
                <span className="footer-note-text">
                  MIT / Apache 2.0 License
                </span>
              </li>
              <li>
                <span className="footer-note-text">
                  Append-only Escrow Ledger
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="landing-footer-bottom">
          <span className="footer-copy">© 2026 GitEscrow.</span>
          <span className="footer-built">
            Built with React, TypeScript, and Hallmark design tokens.
          </span>
        </div>
      </div>
    </footer>
  );
}
