import { useState } from "react";
import { CheckIcon, InfoIcon } from "../Icons";

export function AIVerificationSection() {
  const [selectedCriterion, setSelectedCriterion] = useState<number>(0);

  const criteria = [
    {
      id: 0,
      criterion:
        "Generate RFC 7636 compliant S256 code_verifier & code_challenge",
      status: "verified",
      confidence: "98%",
      file: "src/auth/pkce.ts:18",
      evidence:
        "AST matches exported generatePKCEPair() function using crypto.subtle.digest('SHA-256')",
      diff: [
        { type: "context", text: "export interface PKCEPair {" },
        { type: "context", text: "  verifier: string;" },
        { type: "context", text: "  challenge: string;" },
        { type: "context", text: "}" },
        {
          type: "add",
          text: "+ export async function generatePKCEPair(): Promise<PKCEPair> {",
        },
        { type: "add", text: "+   const verifier = generateRandomString(43);" },
        { type: "add", text: "+   const encoder = new TextEncoder();" },
        { type: "add", text: "+   const data = encoder.encode(verifier);" },
        {
          type: "add",
          text: "+   const hash = await crypto.subtle.digest('SHA-256', data);",
        },
        { type: "add", text: "+   const challenge = base64UrlEncode(hash);" },
        { type: "add", text: "+   return { verifier, challenge };" },
        { type: "add", text: "+ }" },
      ],
    },
    {
      id: 1,
      criterion:
        "Add unit tests with 100% branch coverage on SHA-256 transformations",
      status: "verified",
      confidence: "95%",
      file: "tests/pkce.test.ts:42",
      evidence:
        "12 test assertions passing across valid vectors, empty strings, and special characters",
      diff: [
        {
          type: "context",
          text: "describe('PKCE Verification Suite', () => {",
        },
        {
          type: "add",
          text: "+   it('produces RFC 7636 Appendix B test vector challenge', async () => {",
        },
        {
          type: "add",
          text: "+     const vector = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';",
        },
        {
          type: "add",
          text: "+     const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';",
        },
        {
          type: "add",
          text: "+     const res = await computeChallenge(vector);",
        },
        { type: "add", text: "+     expect(res).toBe(expected);" },
        { type: "add", text: "+   });" },
        { type: "context", text: "});" },
      ],
    },
    {
      id: 2,
      criterion:
        "Zero external runtime dependencies added to production bundle",
      status: "verified",
      confidence: "100%",
      file: "package.json",
      evidence:
        "package.json dependencies block unchanged; implementation relies strictly on Web Crypto API",
      diff: [
        { type: "context", text: '  "dependencies": {' },
        { type: "context", text: '    "react": "^19.0.0",' },
        { type: "context", text: '    "react-dom": "^19.0.0"' },
        { type: "context", text: "  }," },
        { type: "context", text: '  "devDependencies": {' },
        { type: "add", text: '+   "@types/node": "^22.0.0"' },
        { type: "context", text: "  }" },
      ],
    },
  ];

  const activeCriterion = criteria[selectedCriterion] || criteria[0];

  return (
    <section
      id="ai-verification"
      className="ai-verification-section section-dark"
      aria-labelledby="ai-verification-heading"
    >
      <div className="container">
        {/* Editorial Section Header */}
        <div className="section-head text-center">
          <h2 id="ai-verification-heading" className="section-title">
            Evidence before approval.
          </h2>
          <p className="section-subtitle">
            GitEscrow AI synthesizes technical evidence from pull request diffs,
            AST criteria matching, and CI test artifacts. Maintainers inspect
            factual proof before releasing funds.
          </p>
        </div>

        {/* Large Realistic Verification Console Preview */}
        <div
          className="verification-console-window"
          aria-label="Interactive AI Verification Preview"
        >
          {/* Console Header Bar */}
          <div className="console-header-bar">
            <div className="console-pr-meta">
              <span className="console-repo-tag font-mono">facebook/react</span>
              <span className="console-pr-number font-mono">PR #48</span>
              <span className="console-pr-title">
                Implement PKCE Code Challenge Generator
              </span>
            </div>

            <div className="console-status-badges">
              <span className="console-ci-badge badge-ci-pass font-mono">
                <CheckIcon className="icon-tiny" /> CI 14/14 Passed
              </span>
              <span className="console-files-badge font-mono">
                3 Files · +68 / -4 Lines
              </span>
              <span className="console-demo-badge font-mono">
                Interactive Preview
              </span>
            </div>
          </div>

          {/* Interactive Evidence Workspace */}
          <div className="console-workspace-grid">
            {/* Left: Acceptance Criteria Checklist */}
            <div className="console-criteria-col">
              <div className="console-col-header">
                <span className="col-heading-label">
                  Acceptance Criteria Audit
                </span>
                <span className="col-heading-tag font-mono">
                  3 of 3 Verified
                </span>
              </div>

              <div
                className="criteria-selectable-list"
                role="tablist"
                aria-label="Criteria Checklist"
              >
                {criteria.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={selectedCriterion === idx}
                    className={`criteria-select-item ${selectedCriterion === idx ? "criteria-item-selected" : ""}`}
                    onClick={() => setSelectedCriterion(idx)}
                  >
                    <div className="criteria-item-top">
                      <span className="criteria-status-chip font-mono">
                        <CheckIcon className="icon-tiny" /> Verified (
                        {item.confidence})
                      </span>
                      <span className="criteria-file-chip font-mono">
                        {item.file}
                      </span>
                    </div>
                    <p className="criteria-item-text">{item.criterion}</p>
                  </button>
                ))}
              </div>

              {/* Sponsor Custody Boundary Callout */}
              <div className="sponsor-authority-callout">
                <div className="callout-icon-wrap">
                  <InfoIcon className="icon-tiny" />
                </div>
                <div className="callout-body">
                  <span className="callout-title">
                    Sponsor Release Authority
                  </span>
                  <p className="callout-text">
                    AI analyzes code facts; sponsors retain exclusive
                    disbursement authority. Funds are released through
                    dual-signature PayPal capture only when the maintainer
                    clicks Approve.
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Code Diff & AST Telemetry */}
            <div className="console-diff-col">
              <div className="console-col-header">
                <div className="diff-header-info">
                  <span className="diff-target-file font-mono">
                    {activeCriterion.file}
                  </span>
                  <span className="diff-proof-summary">
                    {activeCriterion.evidence}
                  </span>
                </div>
              </div>

              {/* Syntax Highlighted Diff Viewer */}
              <div
                className="diff-code-viewer font-mono"
                tabIndex={0}
                aria-label="Code diff viewer"
              >
                <div className="diff-lines-container">
                  {activeCriterion.diff.map((line, index) => (
                    <div
                      key={index}
                      className={`diff-line-row ${
                        line.type === "add"
                          ? "diff-line-add"
                          : line.type === "del"
                            ? "diff-line-del"
                            : "diff-line-context"
                      }`}
                    >
                      <span className="diff-line-num">{index + 1}</span>
                      <span className="diff-line-content">{line.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sponsor Decision Action Bar */}
              <div className="console-decision-bar">
                <div className="decision-payout-meta">
                  <span className="payout-label font-mono">
                    Milestone 1 Allocation:
                  </span>
                  <span className="payout-amount font-mono">$250.00 USD</span>
                  <span className="payout-sub font-mono">(Escrow Secured)</span>
                </div>

                <div className="decision-actions">
                  <button
                    type="button"
                    className="btn btn-secondary-subtle font-mono text-xs"
                    onClick={() =>
                      alert(
                        "Demo preview: Maintainers can request amendments or clarification from the contributor.",
                      )
                    }
                  >
                    Request Changes
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary font-mono text-xs whitespace-nowrap"
                    onClick={() =>
                      alert(
                        "Demo preview: Clicking approve triggers immediate idempotent PayPal payout disbursement to the contributor.",
                      )
                    }
                  >
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
