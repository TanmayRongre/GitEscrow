import { useState, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { animateModalEnter } from "../motion/transitions";
import { apiRequest } from "../api/client";
import type { IMilestone, IBounty } from "../types/bounty";
import type { IAcceptanceVerificationResult } from "../types/pr-verification";
import { CloseIcon, SparkleIcon, AlertIcon } from "./Icons";

interface MilestoneSubmitPRModalProps {
  milestone: IMilestone;
  bounty: IBounty;
  onSuccess: (
    updatedMilestone: IMilestone,
    verification: IAcceptanceVerificationResult,
  ) => void;
  onClose: () => void;
}

export function MilestoneSubmitPRModal({
  milestone,
  bounty,
  onSuccess,
  onClose,
}: MilestoneSubmitPRModalProps) {
  const [prUrl, setPrUrl] = useState<string>(milestone.prUrl || "");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
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

  const expectedRepo = `${bounty.repositoryOwner}/${bounty.repositoryName}`;

  // Validate PR URL format in real-time
  const parseMatch = prUrl
    .trim()
    .match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i);
  const isUrlValid = Boolean(parseMatch);
  const isRepoMatch =
    parseMatch &&
    parseMatch[1].toLowerCase() === bounty.repositoryOwner.toLowerCase() &&
    parseMatch[2].toLowerCase() === bounty.repositoryName.toLowerCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prUrl.trim()) {
      setError("Please enter a valid GitHub Pull Request URL.");
      return;
    }

    if (!isRepoMatch) {
      setError(
        `Repository mismatch: Pull Request must belong to "${expectedRepo}".`,
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await apiRequest<{
        message: string;
        milestone: IMilestone;
        verification: IAcceptanceVerificationResult;
      }>(`/milestones/${milestone._id || milestone.id}/submit-pr`, {
        method: "POST",
        body: JSON.stringify({
          prUrl: prUrl.trim(),
          notes: notes.trim() || undefined,
        }),
      });

      onSuccess(res.milestone, res.verification);
    } catch (err: any) {
      setError(err.message || "Failed to submit and verify pull request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-pr-modal-title"
    >
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/75"
        onClick={loading ? undefined : onClose}
      />

      <div
        ref={modalRef}
        className="relative z-10 w-full max-w-xl bg-[var(--color-paper)] border border-[var(--color-rule)] rounded-[var(--radius-card)] flex flex-col my-8 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-rule)] bg-[var(--color-paper-2)]">
          <div>
            <h2
              id="submit-pr-modal-title"
              className="text-base font-semibold text-[var(--color-ink)]"
            >
              Submit GitHub pull request
            </h2>
            <p className="text-xs text-[var(--color-muted)] font-mono">
              Milestone #{milestone.order}: {milestone.title}
            </p>
          </div>
          <button
            type="button"
            className="text-[var(--color-muted)] hover:text-[var(--color-ink)] transition-colors p-1"
            onClick={onClose}
            disabled={loading}
            aria-label="Close modal"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)] p-3 rounded-[var(--radius-card)] text-xs flex items-center gap-2">
              <AlertIcon />
              <span>{error}</span>
            </div>
          )}

          {/* Target Repo Banner */}
          <div className="p-3 bg-[var(--color-paper-3)] border border-[var(--color-rule)] rounded-[var(--radius-card)] text-xs space-y-1">
            <span className="field-label mb-0 text-[11px]">
              Required repository
            </span>
            <p className="font-mono text-xs font-semibold text-[var(--color-ink)]">
              {expectedRepo}
            </p>
            <p className="text-[11px] text-[var(--color-muted)]">
              The pull request must be opened against the repository linked to
              this bounty.
            </p>
          </div>

          {/* Acceptance Criteria Reminder */}
          <div className="p-3 bg-[var(--color-paper-3)] border border-[var(--color-rule)] rounded-[var(--radius-card)] text-xs space-y-2">
            <span className="field-label mb-0 text-[11px]">
              Milestone acceptance criteria (
              {milestone.acceptanceCriteria.length})
            </span>
            <ul className="space-y-1 text-xs text-[var(--color-ink-2)] list-disc pl-4">
              {milestone.acceptanceCriteria.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>

          {/* PR URL Input */}
          <div className="space-y-1">
            <label htmlFor="pr-url-input" className="field-label">
              GitHub pull request URL
            </label>
            <input
              id="pr-url-input"
              type="url"
              className="input-field font-mono text-xs"
              placeholder={`https://github.com/${expectedRepo}/pull/123`}
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              required
              disabled={loading}
            />
            {prUrl.trim() && (
              <div className="pt-1 text-[11px]">
                {isRepoMatch ? (
                  <span className="text-[var(--color-ok)] flex items-center gap-1 font-mono">
                    ✓ Valid PR for {expectedRepo} (PR #{parseMatch?.[3]})
                  </span>
                ) : isUrlValid ? (
                  <span className="text-[var(--color-danger)] flex items-center gap-1 font-mono">
                    ✗ Mismatch: PR belongs to {parseMatch?.[1]}/
                    {parseMatch?.[2]}, expected {expectedRepo}
                  </span>
                ) : (
                  <span className="text-[var(--color-muted)] font-mono">
                    Format: https://github.com/:owner/:repo/pull/:number
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Submission Notes */}
          <div className="space-y-1">
            <label htmlFor="pr-notes-input" className="field-label">
              Deliverable notes & test summary
            </label>
            <textarea
              id="pr-notes-input"
              className="input-field textarea-field text-xs"
              rows={3}
              placeholder="Describe key changes, test runs executed, or specific edge cases resolved in this pull request…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* AI Notice */}
          <div className="p-3 bg-[var(--color-paper-2)] border border-[var(--color-rule-2)] rounded-[var(--radius-card)] text-[11px] text-[var(--color-muted)] flex items-center gap-2">
            <SparkleIcon />
            <span>
              Upon submission, GitEscrow will inspect changed files, commit
              diffs, and GitHub Actions checks to evaluate milestone criteria
              for the sponsor.
            </span>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-rule)]">
            <button
              type="button"
              className="btn btn-sm"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm flex items-center gap-2 whitespace-nowrap"
              disabled={loading || !isRepoMatch}
            >
              {loading ? (
                <>
                  <span className="animate-spin text-xs">⟳</span>
                  <span>Verifying…</span>
                </>
              ) : (
                <>
                  <SparkleIcon />
                  <span>Submit PR</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
