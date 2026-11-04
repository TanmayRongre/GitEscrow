interface FinalCTASectionProps {
  onExploreBounties: () => void;
  onRegister: () => void;
}

export function FinalCTASection({
  onExploreBounties,
  onRegister,
}: FinalCTASectionProps) {
  return (
    <section className="final-cta-section section-dark" aria-labelledby="final-cta-heading">
      <div className="container">
        <div className="final-cta-box">
          <h2 id="final-cta-heading" className="final-cta-title">
            Your code deserves transparent rewards.
          </h2>
          <p className="final-cta-subtitle">
            Build, contribute and collaborate through a more transparent bounty
            workflow.
          </p>
          <div className="final-cta-actions">
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
              onClick={onRegister}
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
