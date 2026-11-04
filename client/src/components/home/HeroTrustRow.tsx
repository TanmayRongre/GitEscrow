import { CheckCircle2, ShieldCheck, Banknote } from "lucide-react";

export function HeroTrustRow() {
  const trustPoints = [
    {
      icon: Banknote,
      text: "Upfront PayPal funding before work starts",
    },
    {
      icon: ShieldCheck,
      text: "Automated checks inspect pull request evidence",
    },
    {
      icon: CheckCircle2,
      text: "Direct payout released on sponsor approval",
    },
  ];

  return (
    <div
      className="hero-trust-row"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-12)",
        paddingTop: "var(--space-24)",
        marginTop: "var(--space-32)",
        borderTop: "1px solid var(--border-dark)",
      }}
    >
      {trustPoints.map((point, index) => {
        const Icon = point.icon;
        return (
          <div
            key={index}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-12)",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                color: "var(--amber)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={18} strokeWidth={1.75} />
            </div>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                lineHeight: 1.4,
                color: "#CBD5E1",
                margin: 0,
              }}
            >
              {point.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
