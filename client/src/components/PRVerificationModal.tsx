import { useState, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { animateModalEnter } from "../motion/transitions";
import { apiRequest } from "../api/client";
import type { IMilestone } from "../types/bounty";
import type { IAcceptanceVerificationResult } from "../types/pr-verification";
import {
  CloseIcon,
  SparkleIcon,
  CheckIcon,
  AlertIcon,
  LockIcon,
} from "./Icons";

interface PRVerificationModalProps {
  milestone: IMilestone;
  verification: IAcceptanceVerificationResult;
  isSponsor: boolean;
  onDecisionComplete?: (updatedMilestone: IMilestone) => void;
  onClose: () => void;
}

export function PRVerificationModal({
  milestone,
  verification,
  isSponsor,
  onDecisionComplete,
  onClose,
}: PRVerificationModalProps) {
  const [activeTab, setActiveTab] = useState<
    "criteria" | "evidence" | "risks" | "decision"
  >("criteria");
  const [decisionNotes, setDecisionNotes] = useState<string>("");
  const [submittingAction, setSubmittingAction] = useState<
    "APPROVE" | "REQUEST_CHANGES" | "REJECT" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      animateModalEnter(backdropRef.current, modalRef.current);
    },
    { scope: containerRef },
  );

  const getAssessmentBadgeClass = (assessment: string) => {
    switch (assessment) {
      case "PASS":
        return "badge-ok";
      case "PARTIAL":
        return "badge-progress";
      case "FAIL":
        return "badge-cancelled";
      case "INSUFFICIENT_EVIDENCE":
        return "badge-draft";
      default:
        return "badge-draft";
    }
  };

  const getCriterionStatusBadge = (status: string) => {
    switch (status) {
      case "MET":
        return "badge-ok";
      case "PARTIALLY_MET":
        return "badge-progress";
      case "NOT_MET":
        return "badge-cancelled";
      case "UNVERIFIABLE":
        return "badge-draft";
      default:
        return "badge-draft";
    }
  };

  const handleSponsorDecision = async (
    action: "APPROVE" | "REQUEST_CHANGES" | "REJECT",
  ) => {
    if (!decisionNotes.trim() && action !== "APPROVE") {
      setError("Please provide decision notes explaining the feedback.");
      return;
    }

    try {
      setSubmittingAction(action);
      setError(null);

      const res = await apiRequest<{ message: string; milestone: IMilestone }>(
        `/milestones/${milestone._id || milestone.id}/review`,
        {
          method: "POST",
          body: JSON.stringify({
            action,
            decisionNotes:
              decisionNotes.trim() || `Milestone decision: ${action}`,
          }),
        },
      );

      onDecisionComplete?.(res.milestone);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to process sponsor review decision.");
    } finally {
      setSubmittingAction(null);
    }
  };

  const isApproved = milestone.status === "APPROVED";
  const canDecide = isSponsor && !isApproved;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pr-verification-title"
    >
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/75"
        onClick={submittingAction ? undefined : onClose}
      />

      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-3xl bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-card)] flex flex-col max-h-[90vh] my-8 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="badge-ai flex items-center gap-1 font-mono text-xs">
                <SparkleIcon />
                <span>AI Verification</span>
              </span>
              <span
                className={`status-badge ${getAssessmentBadgeClass(verification.overallAssessment)} font-mono text-xs font-medium`}
              >
                {verification.overallAssessment}
              </span>
              <span className="status-badge text-xs font-mono">
                Confidence: {verification.confidence.level}
              </span>
            </div>
            <h2
              id="pr-verification-title"
              className="text-base font-medium text-[var(--color-ink)] pt-1"
            >
              Pull Request #{verification.pr.pullNumber}:{" "}
              {verification.pr.title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-[var(--color-muted)] font-mono flex-wrap pt-1">
              <a
                href={verification.pr.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] hover:underline inline-flex items-center gap-1"
              >
                <span>View on GitHub ↗</span>
              </a>
              <span className="text-[var(--color-rule-2)]">/</span>
              <span>
                {verification.pr.headBranch} → {verification.pr.baseBranch}
              </span>
              <span className="text-[var(--color-rule-2)]">/</span>
              <span>sha: {verification.pr.headSha.substring(0, 8)}</span>
              <span className="text-[var(--color-rule-2)]">/</span>
              <span>{verification.pr.changedFilesCount} files</span>
            </div>
          </div>
          <button
            type="button"
            className="text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors p-1"
            onClick={onClose}
            aria-label="Close modal"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[var(--color-rule)] bg-[var(--color-paper-3)] px-6">
          <button
            type="button"
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "criteria"
                ? "border-[var(--color-accent)] text-[var(--color-ink)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
            onClick={() => setActiveTab("criteria")}
          >
            Acceptance criteria ({verification.criteriaEvaluations.length})
          </button>
          <button
            type="button"
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "evidence"
                ? "border-[var(--color-accent)] text-[var(--color-ink)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
            onClick={() => setActiveTab("evidence")}
          >
            Facts & evidence
          </button>
          <button
            type="button"
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              activeTab === "risks"
                ? "border-[var(--color-accent)] text-[var(--color-ink)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            }`}
            onClick={() => setActiveTab("risks")}
          >
            CI & risks (
            {verification.potentialRisks.length +
              verification.missingRequirements.length}
            )
          </button>
          {canDecide && (
            <button
              type="button"
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === "decision"
                  ? "border-[var(--color-accent)] text-[var(--color-ink)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
              onClick={() => setActiveTab("decision")}
            >
              Sponsor decision
            </button>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)] p-3 rounded-[var(--radius-card)] text-xs flex items-center gap-2">
              <AlertIcon />
              <span>{error}</span>
            </div>
          )}

          {/* Executive Summary */}
          <div className="p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule)] rounded-[var(--radius-card)] text-xs space-y-1">
            <span className="field-label mb-0 text-[11px]">Audit summary</span>
            <p className="text-[var(--color-ink-2)] leading-relaxed">
              {verification.summary}
            </p>
          </div>

          {/* TAB 1: Criteria Evaluations */}
          {activeTab === "criteria" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="field-label mb-0 text-xs font-medium text-[var(--color-ink)]">
                  Individual criteria evaluations
                </span>
                <span className="text-xs text-[var(--color-muted)] font-mono">
                  {
                    verification.criteriaEvaluations.filter(
                      (c) => c.status === "MET",
                    ).length
                  }{" "}
                  of {verification.criteriaEvaluations.length} met
                </span>
              </div>

              <div className="space-y-3">
                {verification.criteriaEvaluations.map((evalItem, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[var(--color-paper-3)] border border-[var(--color-rule)] rounded-[var(--radius-card)] space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 flex-1">
                        <span className="font-mono text-xs font-medium text-[var(--color-muted)] pt-0.5">
                          {idx + 1}.
                        </span>
                        <p className="font-medium text-[var(--color-ink)] leading-snug">
                          {evalItem.criterion}
                        </p>
                      </div>
                      <span
                        className={`status-badge ${getCriterionStatusBadge(evalItem.status)} font-mono text-xs font-medium whitespace-nowrap`}
                      >
                        {evalItem.status}
                      </span>
                    </div>

                    <div className="pl-5 space-y-1 text-xs">
                      <p className="text-[var(--color-muted)] leading-relaxed">
                        <span className="font-medium text-[var(--color-ink-2)]">
                          Evidence:
                        </span>{" "}
                        {evalItem.evidence}
                      </p>
                      {evalItem.matchedFiles &&
                        evalItem.matchedFiles.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            <span className="text-[11px] text-[var(--color-muted)]">
                              Files:
                            </span>
                            {evalItem.matchedFiles.map((f, fIdx) => (
                              <span
                                key={fIdx}
                                className="status-badge font-mono text-[10px]"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: Facts & Evidence */}
          {activeTab === "evidence" && (
            <div className="space-y-4">
              {/* Verified Facts */}
              <div className="p-3 bg-[var(--color-paper-3)] border border-[var(--color-rule)] rounded-[var(--radius-card)] space-y-2">
                <span className="field-label mb-0 text-xs font-medium text-[var(--color-ok)] flex items-center gap-1.5">
                  <CheckIcon />
                  <span>Verified ground truth (GitHub evidence)</span>
                </span>
                <ul className="space-y-1.5 text-xs text-[var(--color-ink-2)] list-disc pl-4">
                  {verification.facts.map((fact, idx) => (
                    <li key={idx} className="font-mono">
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>

              {/* AI Interpretations */}
              <div className="p-3 bg-[var(--color-paper-3)] border border-[var(--color-rule)] rounded-[var(--radius-card)] space-y-2">
                <span className="field-label mb-0 text-xs font-medium text-[var(--color-accent)] flex items-center gap-1.5">
                  <SparkleIcon />
                  <span>AI interpretations & contextual matching</span>
                </span>
                <ul className="space-y-1.5 text-xs text-[var(--color-muted)] list-disc pl-4">
                  {verification.interpretations.map((interp, idx) => (
                    <li key={idx}>{interp}</li>
                  ))}
                </ul>
              </div>

              {/* Code References */}
              {verification.codeReferences &&
                verification.codeReferences.length > 0 && (
                  <div className="p-3 bg-[var(--color-paper-3)] border border-[var(--color-rule)] rounded-[var(--radius-card)] space-y-2">
                    <span className="field-label mb-0 text-xs font-medium text-[var(--color-ink)]">
                      Detected code references & modified modules
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {verification.codeReferences.map((refPath, idx) => (
                        <span
                          key={idx}
                          className="status-badge font-mono text-xs"
                        >
                          {refPath}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* TAB 3: CI & Risks */}
          {activeTab === "risks" && (
            <div className="space-y-4">
              {/* CI Status Summary */}
              <div className="p-3 bg-[var(--color-paper-3)] border border-[var(--color-rule)] rounded-[var(--radius-card)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="field-label mb-0 text-xs font-medium text-[var(--color-ink)]">
                    Continuous integration & test runs
                  </span>
                  <span
                    className={`status-badge ${
                      verification.ciStatusSummary.state === "PASSED"
                        ? "badge-ok"
                        : verification.ciStatusSummary.state === "FAILED"
                          ? "badge-cancelled"
                          : "badge-progress"
                    } font-mono text-xs font-medium`}
                  >
                    {verification.ciStatusSummary.state}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-muted)] font-mono">
                  {verification.ciStatusSummary.totalChecks} checks:{" "}
                  {verification.ciStatusSummary.passed} passed,{" "}
                  {verification.ciStatusSummary.failed} failed,{" "}
                  {verification.ciStatusSummary.pending} pending
                </p>
                {verification.ciStatusSummary.details &&
                  verification.ciStatusSummary.details.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {verification.ciStatusSummary.details.map((d, idx) => (
                        <p
                          key={idx}
                          className="text-[11px] font-mono text-[var(--color-ink-2)]"
                        >
                          {d}
                        </p>
                      ))}
                    </div>
                  )}
              </div>

              {/* Missing Requirements */}
              {verification.missingRequirements.length > 0 && (
                <div className="p-3 bg-[var(--color-danger)]/5 border border-[var(--color-danger)]/20 rounded-[var(--radius-card)] space-y-1.5 text-xs">
                  <span className="field-label mb-0 text-[11px] text-[var(--color-danger)] font-medium">
                    Missing specifications
                  </span>
                  <ul className="space-y-1 text-xs text-[var(--color-danger)] list-disc pl-4">
                    {verification.missingRequirements.map((reqItem, idx) => (
                      <li key={idx}>{reqItem}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Potential Risks */}
              {verification.potentialRisks.length > 0 && (
                <div className="p-3 bg-[var(--color-paper-3)] border border-[var(--color-rule)] rounded-[var(--radius-card)] space-y-1.5 text-xs">
                  <span className="field-label mb-0 text-[11px] text-[var(--color-muted)] font-medium">
                    Potential risks & edge cases
                  </span>
                  <ul className="space-y-1 text-xs text-[var(--color-muted)] list-disc pl-4">
                    {verification.potentialRisks.map((risk, idx) => (
                      <li key={idx}>{risk}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggested Changes */}
              {verification.suggestedChanges.length > 0 && (
                <div className="p-3 bg-[var(--color-paper-3)] border border-[var(--color-rule)] rounded-[var(--radius-card)] space-y-1.5 text-xs">
                  <span className="field-label mb-0 text-[11px] text-[var(--color-ink)] font-medium">
                    Actionable suggestions for contributor
                  </span>
                  <ul className="space-y-1 text-xs text-[var(--color-ink-2)] list-disc pl-4">
                    {verification.suggestedChanges.map((suggestion, idx) => (
                      <li key={idx}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Sponsor Review Decision */}
          {activeTab === "decision" && canDecide && (
            <div className="space-y-4">
              <div className="p-3 bg-[var(--color-paper-3)] border border-[var(--color-rule)] rounded-[var(--radius-card)] text-xs space-y-1">
                <span className="field-label mb-0 text-[11px]">
                  Sponsor review authority
                </span>
                <p className="text-[var(--color-ink-2)]">
                  The AI verification report above is consultative technical
                  advice. As the organization sponsor, you make the final
                  binding milestone decision.
                </p>
              </div>

              <div className="space-y-1">
                <label htmlFor="sponsor-notes-input" className="field-label">
                  Decision notes & feedback for contributor
                </label>
                <textarea
                  id="sponsor-notes-input"
                  className="input-field textarea-field text-xs"
                  rows={3}
                  placeholder="Detail your findings, required code changes, or approval remarks…"
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  disabled={Boolean(submittingAction)}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm flex-1 flex items-center justify-center gap-1.5"
                  onClick={() => handleSponsorDecision("APPROVE")}
                  disabled={Boolean(submittingAction)}
                >
                  <CheckIcon />
                  <span>Approve milestone</span>
                </button>
                <button
                  type="button"
                  className="btn btn-sm flex-1"
                  onClick={() => handleSponsorDecision("REQUEST_CHANGES")}
                  disabled={Boolean(submittingAction)}
                >
                  Request changes
                </button>
                <button
                  type="button"
                  className="btn btn-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 flex-1"
                  onClick={() => handleSponsorDecision("REJECT")}
                  disabled={Boolean(submittingAction)}
                >
                  Reject submission
                </button>
              </div>
            </div>
          )}

          {/* Sponsor Authority Disclaimer */}
          <div className="p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule-2)] rounded-[var(--radius-card)] text-[11px] text-[var(--color-muted)] flex items-center gap-2">
            <LockIcon />
            <span>
              Consultative AI report. Milestone approvals and financial ledger
              records require explicit human sponsor authority.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between p-4 border-t border-[var(--color-rule)] bg-[var(--color-paper-2)] text-xs">
          <span className="text-[var(--color-muted)] font-mono">
            Provider: {verification.provider} •{" "}
            {new Date(verification.verifiedAt).toLocaleTimeString()}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onClose}
            disabled={Boolean(submittingAction)}
          >
            Close report
          </button>
        </div>
      </div>
    </div>
  );
}
