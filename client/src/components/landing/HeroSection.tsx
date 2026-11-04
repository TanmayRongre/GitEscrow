import { WorkflowDemoPreview } from "./WorkflowDemoPreview";
import { GitForkIcon, CheckIcon, LockIcon } from "../Icons";

interface HeroSectionProps {
  onExploreBounties: () => void;
  onLaunchBounty: () => void;
}

export function HeroSection({
  onExploreBounties,
  onLaunchBounty,
}: HeroSectionProps) {
  return (
    <section className="hero-section section-dark" aria-labelledby="hero-heading">
      <div className="hero-geometric-accent" aria-hidden="true" />
      <div className="container hero-container">
        <div className="hero-grid">
          {/* Left Column: Headlines & Actions */}
          <div className="hero-content">
            <h1 id="hero-heading" className="hero-title hero-enter">
              Code with trust. <br className="hero-heading-break" />
              Get paid with proof.
            </h1>

            <p className="hero-lead hero-enter">
              GitEscrow connects open-source contributors and sponsors through AI-powered GitHub contribution verification and milestone-based payments.
            </p>

            <div className="hero-actions hero-enter">
              <button
                type="button"
                className="btn btn-primary hero-btn"
                onClick={onExploreBounties}
              >
                Explore Bounties
              </button>
              <button
                type="button"
                className="btn hero-btn hero-btn-secondary"
                onClick={onLaunchBounty}
              >
                Launch a Bounty
              </button>
            </div>

            {/* Technical Verification Signals */}
            <div className="hero-signals hero-enter">
              <div className="signal-item">
                <GitForkIcon className="signal-icon" />
                <span>GitHub REST integration</span>
              </div>
              <div className="signal-item">
                <CheckIcon className="signal-icon" />
                <span>Automated PR evidence</span>
              </div>
              <div className="signal-item">
                <LockIcon className="signal-icon" />
                <span>Append-only financial ledger</span>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Workflow Preview */}
          <div className="hero-preview-col hero-preview-enter">
            <WorkflowDemoPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
