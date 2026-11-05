import { useState, useRef, useEffect } from "react";
import { CheckCircle2, GitPullRequest, CircleDot, Lock } from "lucide-react";
import { gsap, prefersReducedMotion } from "../../motion/gsapSetup";

type TabKey = "issue" | "pr" | "verification" | "payout";

interface TabDef {
  id: TabKey;
  label: string;
}

const TABS: TabDef[] = [
  { id: "issue", label: "Issue" },
  { id: "pr", label: "Pull Request" },
  { id: "verification", label: "Evidence" },
  { id: "payout", label: "Release" },
];

export function HeroEvidenceCard() {
  const [activeTab, setActiveTab] = useState<TabKey>("issue");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !panelRef.current) return;
    gsap.fromTo(
      panelRef.current,
      { autoAlpha: 0.7, y: 3 },
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
        boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)",
        width: "100%",
      }}
    >
      {/* Top Context & Escrow Meta Bar */}
      <div className="hero-card-header">
        <div className="hero-card-header-left">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--text-dark-primary)",
              backgroundColor: "rgba(255, 255, 255, 0.06)",
              padding: "2px 8px",
              borderRadius: "var(--radius-control)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap",
            }}
          >
            <CircleDot size={13} color="var(--amber)" />
            acme/sample-app#12
          </span>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "12px",
              color: "#94A3B8",
              whiteSpace: "nowrap",
            }}
          >
            Milestone 1 of 2
          </span>
        </div>

        <div className="hero-card-header-right">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              color: "var(--amber)",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            $250.00 USD
          </span>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "var(--radius-control)",
              backgroundColor: "rgba(34, 197, 94, 0.12)",
              color: "var(--green)",
              border: "1px solid rgba(34, 197, 94, 0.25)",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              whiteSpace: "nowrap",
            }}
          >
            <Lock size={10} color="var(--green)" />
            Funded Escrow
          </span>
        </div>
      </div>

      {/* 4 Interactive Pipeline Stages */}
      <div
        role="tablist"
        aria-label="Milestone deliverable lifecycle stages"
        className="hero-pipeline-tabs"
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
              className={`hero-pipeline-tab ${isActive ? "active" : ""}`}
            >
              <span className="hero-tab-num">0{idx + 1}</span>
              <span className="hero-tab-label">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div ref={panelRef} className="hero-card-body">
        {/* Stage 1: Issue & Acceptance Criteria */}
        {activeTab === "issue" && (
          <div
            id="panel-issue"
            role="tabpanel"
            aria-labelledby="tab-issue"
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <h3
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--text-dark-primary)",
                  margin: 0,
                  lineHeight: 1.35,
                }}
              >
                Add stream timeout handling to client connections
              </h3>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--amber)", fontWeight: 500 }}>
                  $250.00 USD
                </span>
                <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>·</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#94A3B8" }}>
                  Milestone 1 of 2 (Target v2.4)
                </span>
              </div>
            </div>

            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                lineHeight: 1.5,
                color: "var(--text-dark-secondary)",
                margin: 0,
              }}
            >
              Connection streams stay open indefinitely if a remote host stops responding.
              Introduces a configurable socket timeout to close idle streams cleanly.
            </p>

            {/* Criteria Box */}
            <div
              style={{
                padding: "var(--space-10) var(--space-12)",
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                border: "1px solid var(--border-dark)",
                borderRadius: "var(--radius-control)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)" }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 600, color: "#F4F5F6" }}>
                  Acceptance Criteria
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--green)" }}>
                  2 Scoped Checks
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
                {[
                  "Accept timeoutMs in connection options with 30s default fallback",
                  "Add unit test verifying socket closure on expired streams",
                ].map((crit, cIdx) => (
                  <div key={cIdx} style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-8)" }}>
                    <CheckCircle2 size={14} color="var(--green)" style={{ flexShrink: 0, marginTop: "2px" }} />
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#CBD5E1", lineHeight: 1.4 }}>
                      {crit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* State Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "var(--space-4)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#94A3B8" }}>
                Status: <span style={{ color: "var(--green)" }}>Funded &amp; Open</span>
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#94A3B8" }}>
                Contributor claims milestone to build
              </span>
            </div>
          </div>
        )}

        {/* Stage 2: Pull Request & Telemetry */}
        {activeTab === "pr" && (
          <div
            id="panel-pr"
            role="tabpanel"
            aria-labelledby="tab-pr"
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
                <GitPullRequest size={16} color="var(--amber)" />
                <h3
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "var(--text-dark-primary)",
                    margin: 0,
                    lineHeight: 1.35,
                  }}
                >
                  PR #48: Configure idle socket timeout on stream creation
                </h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)", flexWrap: "wrap", fontFamily: "var(--font-mono)", fontSize: "12px", color: "#94A3B8" }}>
                <span>Author: @contributor</span>
                <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>·</span>
                <span>Branch: fix/stream-timeout</span>
                <span style={{ color: "rgba(255, 255, 255, 0.2)" }}>·</span>
                <span>Commit: 7f9a1c4</span>
              </div>
            </div>

            {/* 2 Metrics Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-8)" }}>
              <div style={{ padding: "var(--space-8) var(--space-12)", backgroundColor: "rgba(0, 0, 0, 0.3)", border: "1px solid var(--border-dark)", borderRadius: "var(--radius-control)" }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "#94A3B8", display: "block" }}>Code Delta</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", color: "var(--text-dark-primary)", fontWeight: 600 }}>3 files (+48 / -6)</span>
              </div>
              <div style={{ padding: "var(--space-8) var(--space-12)", backgroundColor: "rgba(0, 0, 0, 0.3)", border: "1px solid var(--border-dark)", borderRadius: "var(--radius-control)" }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "#94A3B8", display: "block" }}>CI Test Pipeline</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", color: "var(--green)", fontWeight: 600 }}>14 passed (1.82s)</span>
              </div>
            </div>

            {/* GitHub CI Checks Checklist */}
            <div
              style={{
                padding: "var(--space-10) var(--space-12)",
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                border: "1px solid var(--border-dark)",
                borderRadius: "var(--radius-control)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-6)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", fontWeight: 600, color: "#F4F5F6" }}>GitHub Actions Checks</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--green)" }}>All Passed</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", fontFamily: "var(--font-mono)", color: "#CBD5E1" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle2 size={13} color="var(--green)" /> ci/vitest-unit
                </span>
                <span style={{ color: "#94A3B8" }}>14 tests passed</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px", fontFamily: "var(--font-mono)", color: "#CBD5E1" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle2 size={13} color="var(--green)" /> ci/typecheck
                </span>
                <span style={{ color: "#94A3B8" }}>0 errors</span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "var(--space-4)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#94A3B8" }}>
                Telemetry: <span style={{ color: "var(--green)" }}>Verified</span>
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#94A3B8" }}>
                Automated evidence compiled for review
              </span>
            </div>
          </div>
        )}

        {/* Stage 3: Automated Evidence Report */}
        {activeTab === "verification" && (
          <div
            id="panel-verification"
            role="tabpanel"
            aria-labelledby="tab-verification"
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "var(--space-8)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <h3
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "var(--text-dark-primary)",
                    margin: 0,
                  }}
                >
                  Automated Evidence Report
                </h3>
                <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#94A3B8" }}>
                  AI-assisted recommendation · Sponsor decides final approval
                </span>
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  padding: "2px 7px",
                  borderRadius: "var(--radius-control)",
                  backgroundColor: "rgba(217, 119, 6, 0.15)",
                  color: "var(--amber)",
                  border: "1px solid rgba(217, 119, 6, 0.3)",
                  fontWeight: 600,
                }}
              >
                Advisory Match
              </span>
            </div>

            {/* Criteria Match Rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
              {[
                { label: "Stream timeout parameter in options", file: "connection.ts:42" },
                { label: "Unit test confirms expired teardown", file: "stream.test.ts:89" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "var(--space-6) var(--space-10)",
                    backgroundColor: "rgba(0, 0, 0, 0.3)",
                    borderRadius: "var(--radius-control)",
                    border: "1px solid var(--border-dark)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-8)" }}>
                    <CheckCircle2 size={13} color="var(--green)" style={{ flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "var(--text-dark-primary)" }}>
                      {item.label}
                    </span>
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#94A3B8" }}>
                    {item.file}
                  </span>
                </div>
              ))}
            </div>

            {/* Code Diff Preview */}
            <div
              style={{
                padding: "var(--space-8) var(--space-12)",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                borderRadius: "var(--radius-control)",
                border: "1px solid var(--border-dark)",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                lineHeight: 1.5,
                color: "#D1D5DB",
                overflowX: "auto",
              }}
            >
              <div style={{ color: "var(--green)" }}>+ if (options.timeoutMs) &#123;</div>
              <div style={{ color: "var(--green)" }}>+ &nbsp;&nbsp;this.socket.setTimeout(options.timeoutMs, () =&gt; this.handleTimeout());</div>
              <div style={{ color: "var(--green)" }}>+ &#125;</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "var(--space-4)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#94A3B8" }}>
                Confidence: <span style={{ color: "var(--green)" }}>Verified Pass</span>
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#94A3B8" }}>
                Ready for maintainer release
              </span>
            </div>
          </div>
        )}

        {/* Stage 4: Disbursement & Payout */}
        {activeTab === "payout" && (
          <div
            id="panel-payout"
            role="tabpanel"
            aria-labelledby="tab-payout"
            style={{ display: "flex", flexDirection: "column", gap: "var(--space-12)" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <h3
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--text-dark-primary)",
                  margin: 0,
                }}
              >
                Disbursement Authorization
              </h3>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "12px", color: "#94A3B8" }}>
                Maintainer approves verified deliverable to trigger PayPal payout
              </span>
            </div>

            {/* Escrow Details */}
            <div
              style={{
                padding: "var(--space-10) var(--space-12)",
                backgroundColor: "rgba(0, 0, 0, 0.3)",
                border: "1px solid var(--border-dark)",
                borderRadius: "var(--radius-control)",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
                color: "#E2E8F0",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-6)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#94A3B8", fontFamily: "var(--font-body)" }}>Milestone Release:</span>
                <span style={{ color: "var(--amber)", fontWeight: 600 }}>$250.00 USD</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#94A3B8", fontFamily: "var(--font-body)" }}>Destination:</span>
                <span style={{ color: "var(--text-dark-primary)" }}>@contributor (c***r@example.com)</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#94A3B8", fontFamily: "var(--font-body)" }}>Escrow State:</span>
                <span style={{ color: "var(--green)" }}>PayPal Authorized · Awaiting Approval</span>
              </div>
            </div>

            {/* Visual Action Buttons */}
            <div style={{ display: "flex", gap: "var(--space-8)", paddingTop: "var(--space-2)" }}>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                style={{
                  flex: 1,
                  backgroundColor: "transparent",
                  color: "var(--text-dark-primary)",
                  fontFamily: "var(--font-body)",
                  fontSize: "13px",
                  fontWeight: 500,
                  padding: "var(--space-8) var(--space-12)",
                  borderRadius: "var(--radius-control)",
                  border: "1px solid var(--border-dark)",
                  cursor: "default",
                  pointerEvents: "none",
                }}
              >
                Request Changes
              </button>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                style={{
                  flex: 1.4,
                  backgroundColor: "var(--amber)",
                  color: "#0B0C0E",
                  fontFamily: "var(--font-body)",
                  fontSize: "13px",
                  fontWeight: 600,
                  padding: "var(--space-8) var(--space-12)",
                  borderRadius: "var(--radius-control)",
                  border: "none",
                  cursor: "default",
                  pointerEvents: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                }}
              >
                <Lock size={13} color="#0B0C0E" />
                Release Payment
              </button>
            </div>

            <p style={{ fontFamily: "var(--font-body)", fontSize: "11px", color: "#94A3B8", margin: 0 }}>
              Sample workflow. Payments are processed by PayPal. GitEscrow is not a bank.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
