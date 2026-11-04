import { CheckCircle2, ShieldCheck, Banknote } from "lucide-react";

export function HeroTrustRow() {
  const trustPoints = [
    {
      icon: Banknote,
      text: "Upfront PayPal funding before work starts",
    },
    {
      icon: ShieldCheck,
      text: "Automated checks inspect PR evidence",
    },
    {
      icon: CheckCircle2,
      text: "Direct payout on sponsor sign-off",
    },
  ];

  return (
    <div
      className="hero-trust-row"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: "var(--space-16)",
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
              alignItems: "flex-start",
              gap: "var(--space-8)",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                color: "var(--amber)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "2px",
              }}
            >
              <Icon size={18} strokeWidth={1.75} />
            </div>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                lineHeight: 1.45,
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
