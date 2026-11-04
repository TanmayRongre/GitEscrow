import { useState, useRef, useEffect } from "react";
import { CheckCircle2, GitPullRequest } from "lucide-react";
import { gsap, prefersReducedMotion } from "../../motion/gsapSetup";

type TabKey = "issue" | "pr" | "verification" | "payout";

interface TabDef {
  id: TabKey;
  label: string;
}

const TABS: TabDef[] = [
  { id: "issue", label: "Issue" },
  { id: "pr", label: "Pull Request" },
  { id: "verification", label: "Verification" },
  { id: "payout", label: "Payout" },
];

export function HeroEvidenceCard() {
  const [activeTab, setActiveTab] = useState<TabKey>("issue");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !panelRef.current) return;
    gsap.fromTo(
      panelRef.current,
      { autoAlpha: 0.65, y: 4 },
      { autoAlpha: 1, y: 0, duration: 0.16, ease: "power2.out", clearProps: "transform,opacity" },
    );
  }, [activeTab]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % TABS.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = TABS.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    setActiveTab(TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      className="hero-evidence-card"
      style={{
        backgroundColor: "var(--ink-raised)",
        border: "1px solid var(--border-dark)",
        borderRadius: "var(--radius-card)",
        overflow: "hidden",
        boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.6)",
        width: "100%",
      }}
    >
      {/* Top Meta Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-12)",
          padding: "var(--space-16) var(--space-20)",
          borderBottom: "1px solid var(--border-dark)",
          backgroundColor: "rgba(255, 255, 255, 0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              padding: "3px 8px",
              borderRadius: "var(--radius-control)",
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              color: "#F4F5F6",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              fontWeight: 500,
              letterSpacing: "0.02em",
            }}
          >
            Sample Deliverable
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "14px",
              color: "var(--text-dark-primary)",
              fontWeight: 500,
            }}
          >
            acme/sample-app#12
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-12)" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "14px",
              color: "var(--amber)",
              fontWeight: 600,
            }}
          >
            $250.00 USD
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              padding: "3px 8px",
              borderRadius: "var(--radius-control)",
              backgroundColor: "rgba(34, 197, 94, 0.12)",
              color: "var(--green)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              fontWeight: 500,
            }}
          >
            Funded via PayPal
          </span>
        </div>
      </div>

      {/* 4 Equal-Width Interactive Tabs */}
      <div
        role="tablist"
        aria-label="Sample deliverable stages"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          borderBottom: "1px solid var(--border-dark)",
          backgroundColor: "rgba(0, 0, 0, 0.3)",
        }}
      >
        {TABS.map((tab, idx) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              ref={(el) => { tabRefs.current[idx] = el; }}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                width: "100%",
                padding: "var(--space-12) var(--space-8)",
                background: "transparent",
                border: "none",
                borderBottom: isActive ? "2px solid var(--amber)" : "2px solid transparent",
                color: isActive ? "#F4F5F6" : "#CBD5E1",
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                fontWeight: isActive ? 600 : 500,
                cursor: "pointer",
                textAlign: "center",
                transition: "color 120ms ease, border-color 120ms ease",
                outlineOffset: "-2px",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div ref={panelRef} className="responsive-card-md">
        {/* Tab 1: Issue */}
        {activeTab === "issue" && (
          <div
            id="panel-issue"
            role="tabpanel"
            aria-labelledby="tab-issue"
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "var(--space-8)" }}>
              <h3
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "var(--text-dark-primary)",
                  margin: 0,
                }}
              >
                Add stream timeout handling to client connections
              </h3>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#D1D5DB" }}>
                Milestone 1 of 2 · Target v2.4
              </span>
            </div>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                lineHeight: 1.5,
                color: "var(--text-dark-secondary)",
                margin: 0,
              }}
            >
              Connection streams currently stay open indefinitely if a remote host stops responding.
              This deliverable introduces a configurable socket timeout to close idle streams cleanly.
            </p>
            <div
              style={{
                padding: "var(--space-12)",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border-dark)",
                borderRadius: "var(--radius-control)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#F4F5F6",
                  display: "block",
                  marginBottom: "var(--space-8)",
                }}
              >
                Acceptance Criteria:
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
                {[
                  "Accept timeoutMs in connection options with 30s default fallback",
                  "Add unit test verifying socket closure on expired streams",
                ].map((crit, cIdx) => (
                  <div key={cIdx} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-8)" }}>
                    <CheckCircle2 size={15} color="var(--green)" style={{ flexShrink: 0, marginTop: "2px" }} />
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-dark-secondary)", lineHeight: 1.4 }}>
                      {crit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Pull Request */}
        {activeTab === "pr" && (
          <div
            id="panel-pr"
            role="tabpanel"
            aria-labelledby="tab-pr"
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
              <GitPullRequest size={18} color="var(--amber)" />
              <h3
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "var(--text-dark-primary)",
                  margin: 0,
                }}
              >
                PR #48: Configure idle socket timeout on stream creation
              </h3>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-16)", fontFamily: "var(--font-mono)", fontSize: "12px", color: "#D1D5DB" }}>
              <span>Author: @contributor</span>
              <span>Branch: fix/stream-timeout</span>
              <span>Commit: 7f9a1c4</span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "var(--space-12)",
                marginTop: "var(--space-4)",
              }}
            >
              <div style={{ padding: "var(--space-12)", backgroundColor: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-dark)", borderRadius: "var(--radius-control)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#D1D5DB", display: "block" }}>Files Modified</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "15px", color: "var(--text-dark-primary)", fontWeight: 600 }}>3 files (+48 / -6)</span>
              </div>
              <div style={{ padding: "var(--space-12)", backgroundColor: "rgba(255, 255, 255, 0.03)", border: "1px solid var(--border-dark)", borderRadius: "var(--radius-control)" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#D1D5DB", display: "block" }}>Automated Tests</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "15px", color: "var(--green)", fontWeight: 600 }}>14 passing (0 failures)</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Verification (Default) */}
        {activeTab === "verification" && (
          <div
            id="panel-verification"
            role="tabpanel"
            aria-labelledby="tab-verification"
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-8)" }}>
              <div>
                <h3
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "var(--text-dark-primary)",
                    margin: 0,
                  }}
                >
                  Automated Evidence Report
                </h3>
                <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#D1D5DB" }}>
                  AI-assisted recommendation: Sponsor decides final approval.
                </span>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "12px",
                  padding: "3px 8px",
                  borderRadius: "var(--radius-control)",
                  backgroundColor: "rgba(217, 119, 6, 0.15)",
                  color: "var(--amber)",
                  border: "1px solid rgba(217, 119, 6, 0.3)",
                  fontWeight: 500,
                }}
              >
                Ready for Review
              </span>
            </div>

            {/* Evidence Checklist */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
              {[
                { label: "Stream timeout parameter accepted in connection options", source: "Matched in connection.ts:42" },
                { label: "Default timeout falls back to 30 seconds if omitted", source: "Matched in config.ts:18" },
                { label: "Socket closure unit test verifies expired streams", source: "Matched in stream.test.ts:89" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "var(--space-8)",
                    padding: "var(--space-8) var(--space-12)",
                    backgroundColor: "rgba(255, 255, 255, 0.03)",
                    borderRadius: "var(--radius-control)",
                    border: "1px solid var(--border-dark)",
                  }}
                >
                  <CheckCircle2 size={15} color="var(--green)" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "13px", color: "var(--text-dark-primary)" }}>
                      {item.label}
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#CBD5E1" }}>
                      {item.source}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Payout */}
        {activeTab === "payout" && (
          <div
            id="panel-payout"
            role="tabpanel"
            aria-labelledby="tab-payout"
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}
          >
            <h3
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--text-dark-primary)",
                margin: 0,
              }}
            >
              Funded Payout Dispatch
            </h3>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                lineHeight: 1.5,
                color: "var(--text-dark-secondary)",
                margin: 0,
              }}
            >
              Reward balance of <strong style={{ color: "var(--amber)", fontFamily: "var(--font-mono)" }}>$250.00 USD</strong> is funded upfront via PayPal and tracked through the milestone state machine.
            </p>
            <div
              style={{
                padding: "var(--space-12)",
                backgroundColor: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border-dark)",
                borderRadius: "var(--radius-control)",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "#E2E8F0",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-4)",
              }}
            >
              <div>Destination: <span style={{ color: "var(--text-dark-primary)" }}>@contributor (c***r@example.com)</span></div>
              <div>Trigger: <span style={{ color: "var(--green)" }}>Instant payout released on sponsor approval</span></div>
            </div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#CBD5E1", margin: 0 }}>
              GitEscrow is not a bank or a regulated escrow provider. Payments are processed by PayPal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
