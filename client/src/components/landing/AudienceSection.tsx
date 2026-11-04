interface AudienceSectionProps {
  onExploreBounties: () => void;
  onLaunchBounty: () => void;
}

export function AudienceSection({
  onExploreBounties,
  onLaunchBounty,
}: AudienceSectionProps) {
  return (
    <section
      id="audience"
      className="audience-section section-cream"
      aria-labelledby="audience-heading"
    >
      <div className="container">
        {/* Editorial Section Header */}
        <div className="section-head text-center">
          <h2 id="audience-heading" className="section-title">
            Built for developers and maintainers alike.
          </h2>
          <p className="section-subtitle">
            GitEscrow aligns the incentives of open-source builders and project sponsors around verifiable deliverables and guaranteed escrow payouts.
          </p>
        </div>

        {/* Distinct Two-Section Editorial Layout */}
        <div className="audience-editorial-layout">
          {/* Section 1: For Developers */}
          <div id="for-developers" className="audience-editorial-block">
            <div className="audience-block-header">
              <h3 className="audience-block-title">
                Focus on building. Let your contributions speak.
              </h3>
              <span className="audience-role-tag font-mono">For open-source developers</span>
              <p className="audience-block-lead">
                Find vetted open-source issues with pre-funded milestone allocations. Submit pull requests with automated code evidence verification and get compensated reliably upon review.
              </p>
            </div>

            <ul className="audience-features-list">
              <li>
                <div className="list-marker font-mono">01</div>
                <div className="list-content">
                  <span className="list-title">Guaranteed Escrow Funding</span>
                  <span className="list-desc">Bounties are pre-funded before you start coding, with allocations locked securely into escrow.</span>
                </div>
              </li>
              <li>
                <div className="list-marker font-mono">02</div>
                <div className="list-content">
                  <span className="list-title">Explicit Acceptance Criteria</span>
                  <span className="list-desc">Work against unambiguous technical checklists, eliminating scope creep and guesswork.</span>
                </div>
              </li>
              <li>
                <div className="list-marker font-mono">03</div>
                <div className="list-content">
                  <span className="list-title">Automated Telemetry Audit</span>
                  <span className="list-desc">Review automated AST and CI diff evaluations before sponsor inspection, proving your code works.</span>
                </div>
              </li>
              <li>
                <div className="list-marker font-mono">04</div>
                <div className="list-content">
                  <span className="list-title">Direct Milestone Payouts</span>
                  <span className="list-desc">Receive immediate, idempotent payouts straight to your configured PayPal payout profile.</span>
                </div>
              </li>
            </ul>

            <div className="audience-action-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={onExploreBounties}
              >
                Explore Opportunities
              </button>
            </div>
          </div>

          <div className="audience-divider-hairline" aria-hidden="true" />

          {/* Section 2: For Sponsors */}
          <div id="for-sponsors" className="audience-editorial-block">
            <div className="audience-block-header">
              <h3 className="audience-block-title">
                Fund meaningful work with greater transparency.
              </h3>
              <span className="audience-role-tag font-mono">For repository maintainers</span>
              <p className="audience-block-lead">
                Accelerate your open-source roadmap by attaching milestone incentives to GitHub issues. Maintain complete custody control while providing contributors the security of funded escrow.
              </p>
            </div>

            <ul className="audience-features-list">
              <li>
                <div className="list-marker font-mono">01</div>
                <div className="list-content">
                  <span className="list-title">Fast Bounty Publishing</span>
                  <span className="list-desc">Link any public GitHub repository issue in seconds with authoritative capture verification.</span>
                </div>
              </li>
              <li>
                <div className="list-marker font-mono">02</div>
                <div className="list-content">
                  <span className="list-title">AI Milestone Decomposition</span>
                  <span className="list-desc">Decompose large, complex issues into manageable phases with measurable acceptance criteria.</span>
                </div>
              </li>
              <li>
                <div className="list-marker font-mono">03</div>
                <div className="list-content">
                  <span className="list-title">Evidence-Based PR Review</span>
                  <span className="list-desc">Inspect pull requests with automated code diff telemetry and CI test checks before releasing funds.</span>
                </div>
              </li>
              <li>
                <div className="list-marker font-mono">04</div>
                <div className="list-content">
                  <span className="list-title">Complete Custody Control</span>
                  <span className="list-desc">AI assists with technical evidence, but financial disbursements require your explicit sign-off.</span>
                </div>
              </li>
            </ul>

            <div className="audience-action-row">
              <button
                type="button"
                className="btn btn-secondary-outline"
                onClick={onLaunchBounty}
              >
                Launch a Bounty
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
