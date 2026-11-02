import { useState, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { animateModalEnter } from "../motion/transitions";
import type { IIssueAnalysisResult, ISuggestedMilestone } from "../types/ai";
import { SparkleIcon, CloseIcon, CheckIcon, AlertIcon } from "./Icons";

interface AIAnalysisReviewModalProps {
  analysis: IIssueAnalysisResult;
  onApply: (
    approvedMilestones: ISuggestedMilestone[],
    updatedSummary: string,
  ) => void;
  onClose: () => void;
}

export function AIAnalysisReviewModal({
  analysis,
  onApply,
  onClose,
}: AIAnalysisReviewModalProps) {
  const [milestones, setMilestones] = useState<ISuggestedMilestone[]>(
    analysis.suggestedMilestones.map((m) => ({
      ...m,
      acceptanceCriteria: [...m.acceptanceCriteria],
    })),
  );
  const [summary, setSummary] = useState<string>(analysis.summary);
  const [newCriterionInputs, setNewCriterionInputs] = useState<
    Record<number, string>
  >({});

  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      animateModalEnter(backdropRef.current, modalRef.current);
    },
    { scope: containerRef },
  );

  const handleUpdateCriterion = (
    milestoneIdx: number,
    critIdx: number,
    value: string,
  ) => {
    setMilestones((prev) => {
      const copy = [...prev];
      const criteria = [...copy[milestoneIdx].acceptanceCriteria];
      criteria[critIdx] = value;
      copy[milestoneIdx] = {
        ...copy[milestoneIdx],
        acceptanceCriteria: criteria,
      };
      return copy;
    });
  };

  const handleRemoveCriterion = (milestoneIdx: number, critIdx: number) => {
    setMilestones((prev) => {
      const copy = [...prev];
      const criteria = copy[milestoneIdx].acceptanceCriteria.filter(
        (_, idx) => idx !== critIdx,
      );
      copy[milestoneIdx] = {
        ...copy[milestoneIdx],
        acceptanceCriteria:
          criteria.length > 0 ? criteria : ["Measurable acceptance criterion"],
      };
      return copy;
    });
  };

  const handleAddCriterion = (milestoneIdx: number) => {
    const inputVal = (newCriterionInputs[milestoneIdx] || "").trim();
    if (!inputVal) return;

    setMilestones((prev) => {
      const copy = [...prev];
      copy[milestoneIdx] = {
        ...copy[milestoneIdx],
        acceptanceCriteria: [
          ...copy[milestoneIdx].acceptanceCriteria,
          inputVal,
        ],
      };
      return copy;
    });

    setNewCriterionInputs((prev) => ({ ...prev, [milestoneIdx]: "" }));
  };

  const handleApply = () => {
    onApply(milestones, summary);
  };

  const totalCalculated = milestones.reduce(
    (acc, m) => acc + m.suggestedAmount,
    0,
  );

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-[var(--gutter)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-modal-title"
    >
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-[var(--color-backdrop)]"
        onClick={onClose}
      />

      <div
        ref={modalRef}
        className="modal-content relative z-10 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-[var(--color-rule-2)] pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge-ai">
                <SparkleIcon width="12" height="12" />
                AI Decomposition
              </span>
              <span className="status-badge badge-progress">
                {analysis.provider}
              </span>
              <span className="text-xs text-[var(--color-muted)] font-mono">
                Confidence: {analysis.confidence}
              </span>
            </div>
            <h2 id="ai-modal-title" className="modal-title mb-0">
              AI Issue Analysis & Milestone Criteria
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-ink)] p-1 rounded transition-colors"
            aria-label="Close dialog"
          >
            <CloseIcon width="16" height="16" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="space-y-6">
          {/* Target Issue Metadata */}
          <div className="border border-[var(--color-rule)] rounded-[var(--radius-card)] p-3 space-y-2 bg-[var(--color-paper-3)]">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-[var(--color-accent)] font-medium">
                {analysis.issue.owner}/{analysis.issue.repo}#
                {analysis.issue.issueNumber}
              </span>
              <span className="status-badge badge-open">
                {analysis.issue.state}
              </span>
            </div>
            <p className="text-sm font-medium text-[var(--color-ink)]">
              {analysis.issue.title}
            </p>
            {analysis.issue.labels.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {analysis.issue.labels.map((lbl) => (
                  <span key={lbl} className="status-badge text-[10px]">
                    {lbl}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Structured Problem Synopsis */}
          <div>
            <label className="field-label block mb-1">
              Structured issue synopsis
            </label>
            <textarea
              className="input-field text-xs w-full font-mono resize-y min-h-[72px]"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          {/* Technical Scope & Requirements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-[var(--color-rule)] rounded-[var(--radius-card)] p-3 space-y-2 bg-[var(--color-paper-3)]">
              <p className="text-xs font-semibold text-[var(--color-ink)]">
                Technical requirements
              </p>
              <ul className="text-xs space-y-1 text-[var(--color-muted)] list-disc pl-4">
                {analysis.technicalRequirements.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </div>
            <div className="border border-[var(--color-rule)] rounded-[var(--radius-card)] p-3 space-y-2 bg-[var(--color-paper-3)]">
              <p className="text-xs font-semibold text-[var(--color-ink)]">
                Dependencies & affected modules
              </p>
              <div className="flex flex-wrap gap-1">
                {analysis.dependencies.map((dep, idx) => (
                  <span key={idx} className="status-badge text-xs font-mono">
                    {dep}
                  </span>
                ))}
              </div>
              <div className="pt-2 flex items-center gap-1.5">
                <span className="text-xs text-[var(--color-muted)]">
                  Complexity:
                </span>
                <span
                  className={`status-badge ${analysis.complexity === "HIGH" ? "badge-cancelled" : "badge-progress"}`}
                >
                  {analysis.complexity}
                </span>
              </div>
            </div>
          </div>

          {/* Generated Milestone Proposals */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="field-label mb-0">
                Proposed milestones & acceptance criteria ({milestones.length})
              </label>
              <span className="text-xs font-mono text-[var(--color-muted)]">
                Total allocation:{" "}
                <span className="font-semibold text-[var(--color-ink)]">
                  ${totalCalculated.toFixed(2)} USD
                </span>
              </span>
            </div>

            <div className="space-y-4">
              {milestones.map((m, mIdx) => (
                <div
                  key={m.order}
                  className="border border-[var(--color-rule)] rounded-[var(--radius-card)] p-4 bg-[var(--color-paper-3)] space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="status-badge badge-progress text-xs font-mono">
                          Phase {m.order}
                        </span>
                        <span className="status-badge text-xs font-mono">
                          {m.weightPercentage}% weight
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-[var(--color-ink)]">
                        {m.title}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-base font-bold text-[var(--color-ink)]">
                        ${m.suggestedAmount.toFixed(2)}
                      </span>
                      <p className="text-[10px] text-[var(--color-muted)] font-mono">
                        {m.currency}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--color-muted)]">
                    {m.description}
                  </p>

                  {/* Acceptance Criteria Checklist */}
                  <div className="pt-2 border-t border-[var(--color-rule-2)]">
                    <p className="text-xs font-semibold text-[var(--color-muted)] mb-2">
                      Measurable acceptance criteria
                    </p>
                    <div className="space-y-2">
                      {m.acceptanceCriteria.map((crit, cIdx) => (
                        <div key={cIdx} className="flex items-center gap-2">
                          <CheckIcon
                            width="12"
                            height="12"
                            className="text-[var(--color-accent)] shrink-0"
                          />
                          <input
                            type="text"
                            value={crit}
                            onChange={(e) =>
                              handleUpdateCriterion(mIdx, cIdx, e.target.value)
                            }
                            className="input-field text-xs py-1 flex-1 font-mono"
                          />
                          {m.acceptanceCriteria.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCriterion(mIdx, cIdx)}
                              className="text-[var(--color-muted)] hover:text-[var(--color-bad)] p-1 text-xs"
                              title="Remove criterion"
                            >
                              <CloseIcon width="12" height="12" />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Add new criterion input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Add new testable criterion..."
                          value={newCriterionInputs[mIdx] || ""}
                          onChange={(e) =>
                            setNewCriterionInputs((prev) => ({
                              ...prev,
                              [mIdx]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddCriterion(mIdx);
                            }
                          }}
                          className="input-field text-xs py-1 flex-1 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddCriterion(mIdx)}
                          className="btn btn-secondary text-xs py-1 px-2.5 whitespace-nowrap"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Safety & Human Authority Notice */}
          <div className="alert-box bg-[var(--color-paper-3)] border border-[var(--color-rule)] text-xs text-[var(--color-muted)]">
            <div className="alert-message">
              <AlertIcon
                width="14"
                height="14"
                className="text-[var(--color-accent)] shrink-0 mt-0.5"
              />
              <div>
                <p className="font-semibold text-[var(--color-ink)]">
                  Sponsor verification & authorization required
                </p>
                <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
                  Applying these suggestions updates your draft bounty
                  milestones for your review. Milestones will not be published
                  or funded until you explicitly submit the bounty. AI never
                  approves disbursements or triggers financial transfers.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions border-t border-[var(--color-rule)] pt-4 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary text-xs whitespace-nowrap"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="btn btn-primary text-xs flex items-center gap-1.5 whitespace-nowrap"
          >
            <SparkleIcon width="13" height="13" />
            Apply suggestions
          </button>
        </div>
      </div>
    </div>
  );
}
