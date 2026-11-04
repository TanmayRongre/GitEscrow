import { GitIssueIcon, CheckIcon, LockIcon } from '../Icons';

export function TrustSection() {
  return (
    <section className="trust-section" aria-labelledby="trust-heading">
      <div className="container">
        <div className="section-head">
          <h2 id="trust-heading" className="section-title">
            Built for how open-source actually works
          </h2>
          <p className="section-subtitle">
            Traditional bounties suffer from vague requirements and all-or-nothing disputes. GitEscrow structures contributions around verified evidence.
          </p>
        </div>

        <div className="trust-grid">
          {/* Pillar 1: Contributor Confidence */}
          <div className="trust-column">
            <div className="trust-col-header">
              <div className="trust-icon-box">
                <CheckIcon className="trust-icon" />
              </div>
              <h3 className="trust-col-title">
                Guaranteed review for contributors
              </h3>
            </div>
            <p className="trust-col-desc">
              Contributors work with confidence knowing milestones are pre-funded into escrow with clear acceptance criteria. When code evidence satisfies requirements, payments are released promptly.
            </p>
            <ul className="trust-points-list">
              <li>Upfront escrow funding verified on-chain and in ledger</li>
              <li>Concrete acceptance criteria eliminate guesswork</li>
              <li>Deterministic proof report highlights your actual diffs</li>
            </ul>
          </div>

          {/* Pillar 2: Sponsor Evidence Verification */}
          <div className="trust-column">
            <div className="trust-col-header">
              <div className="trust-icon-box">
                <GitIssueIcon className="trust-icon" />
              </div>
              <h3 className="trust-col-title">
                Verifiable code evidence for sponsors
              </h3>
            </div>
            <p className="trust-col-desc">
              Sponsors inspect pull requests with automated criteria cross-referencing. Review files changed, commit hashes, and CI status runs before approving any disbursement.
            </p>
            <ul className="trust-points-list">
              <li>Automated criteria matching against raw diff telemetry</li>
              <li>CI test runs and commit statuses verified via GitHub API</li>
              <li>Sponsor maintains absolute approval authority</li>
            </ul>
          </div>

          {/* Pillar 3: Milestone-Based Workflow */}
          <div className="trust-column">
            <div className="trust-col-header">
              <div className="trust-icon-box">
                <LockIcon className="trust-icon" />
              </div>
              <h3 className="trust-col-title">
                Phased milestones over all-or-nothing risk
              </h3>
            </div>
            <p className="trust-col-desc">
              Ambitious features rarely succeed as a monolithic PR. Decomposing complex issues into sequential milestones ensures continuous feedback, lower risk, and incremental compensation.
            </p>
            <ul className="trust-points-list">
              <li>2 to 3 logical phases with independent deliverables</li>
              <li>Integer-cent balance accounting prevents rounding errors</li>
              <li>Unused allocations protected by cancellation refunds</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

