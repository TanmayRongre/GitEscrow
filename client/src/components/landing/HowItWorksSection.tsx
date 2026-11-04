import { GitForkIcon, SparkleIcon, CheckIcon, LockIcon } from "../Icons";

export function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Create a Bounty",
      description:
        "Sponsors link any public GitHub issue and fund the reward pool into secure PayPal escrow with authoritatively verified capture.",
      technical: "Authoritative PayPal capture verification · integer-cent accounting",
      icon: GitForkIcon,
    },
    {
      number: "02",
      title: "Generate Milestones",
      description:
        "AI analyzes issue requirements, labels, and architectural scope to generate 2 to 3 sequential milestones with verifiable acceptance criteria.",
      technical: "Zod-validated JSON output · sponsor approval required to publish",
      icon: SparkleIcon,
    },
    {
      number: "03",
      title: "Submit and Verify",
      description:
        "Contributors claim milestones and submit pull requests. GitEscrow collects PR diffs, changed files, and CI runs for automated verification.",
      technical: "GitHub REST telemetry · facts versus interpretations evidence audit",
      icon: CheckIcon,
    },
    {
      number: "04",
      title: "Approve and Pay",
      description:
        "Sponsors review the verified evidence report and approve disbursements through PayPal milestone payouts directly to the contributor.",
      technical: "Idempotent provider dispatch · append-only escrow ledger mutation guards",
      icon: LockIcon,
    },
  ];

  return (
    <section
      id="how-it-works"
      className="how-it-works-section section-cream"
      aria-labelledby="how-it-works-heading"
    >
      <div className="container">
        {/* Editorial Section Header */}
        <div className="section-head text-center">
          <h2 id="how-it-works-heading" className="section-title">
            A verified path from issue to payment.
          </h2>
          <p className="section-subtitle">
            Every bounty transitions through a strict, transparent four-step lifecycle designed to keep sponsors in control and contributors rewarded.
          </p>
        </div>

        {/* 4-Step Connected Linear Flow */}
        <div className="workflow-timeline-wrapper">
          <div className="workflow-timeline-track" aria-hidden="true" />
          <div className="workflow-sequence-grid">
            {steps.map((step) => {
              const IconComponent = step.icon;
              return (
                <div key={step.number} className="sequence-step-item">
                  <div className="step-marker-row">
                    <span className="step-num font-mono">{step.number}</span>
                    <div className="step-dot-anchor" />
                    <div className="step-icon-wrapper">
                      <IconComponent className="step-icon" />
                    </div>
                  </div>

                  <h3 className="step-title">{step.title}</h3>
                  <p className="step-desc">{step.description}</p>

                  <div className="step-tech-tag">
                    <span className="font-mono">{step.technical}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
