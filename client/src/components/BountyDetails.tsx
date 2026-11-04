import { useState, useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { apiRequest } from "../api/client";
import type {
  IBounty,
  IMilestone,
  IEscrowLedger,
  BountyStatus,
  MilestoneStatus,
} from "../types/bounty";
import type { User } from "../context/AuthContext";
import {
  GitIssueIcon,
  CheckIcon,
  LockIcon,
  InfoIcon,
  ArrowLeftIcon,
  ExternalLinkIcon,
  SparkleIcon,
  AlertIcon,
  RefreshIcon,
} from "./Icons";
import {
  animateTabTransition,
  animateMilestoneList,
} from "../motion/transitions";
import { ModalDialog } from "./ModalDialog";
import { MilestoneSubmitPRModal } from "./MilestoneSubmitPRModal";
import { PRVerificationModal } from "./PRVerificationModal";
import type { IAcceptanceVerificationResult } from "../types/pr-verification";

interface BountyDetailsProps {
  bountyId: string;
  currentUser: User | null;
  onBack: () => void;
  onRefreshList?: () => void;
}

export function BountyDetails({
  bountyId,
  currentUser,
  onBack,
  onRefreshList,
}: BountyDetailsProps) {
  const [bounty, setBounty] = useState<IBounty | null>(null);
  const [milestones, setMilestones] = useState<IMilestone[]>([]);
  const [ledgerEvents, setLedgerEvents] = useState<IEscrowLedger[]>([]);
  const [activeTab, setActiveTab] = useState<
    "details" | "milestones" | "ledger"
  >("details");

  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal / Input states
  const [showSubmitPrModal, setShowSubmitPrModal] = useState<boolean>(false);
  const [prUrl, setPrUrl] = useState<string>("");
  const [prNumber, setPrNumber] = useState<number>(1);
  const [submissionNotes, setSubmissionNotes] = useState<string>("");

  const [selectedMilestoneForReview, setSelectedMilestoneForReview] =
    useState<IMilestone | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject">(
    "approve",
  );
  const [reviewNotes, setReviewNotes] = useState<string>("");

  const [selectedMilestoneForSubmit, setSelectedMilestoneForSubmit] =
    useState<IMilestone | null>(null);
  const [milestoneSubmitDetails, setMilestoneSubmitDetails] =
    useState<string>("");

  // Task 2C: PR Submission & Verification Modal States
  const [selectedMilestoneForPRSubmit, setSelectedMilestoneForPRSubmit] =
    useState<IMilestone | null>(null);
  const [activeVerificationModal, setActiveVerificationModal] = useState<{
    milestone: IMilestone;
    verification: IAcceptanceVerificationResult;
  } | null>(null);

  // Task 2D: Contributor Payout Profile & Retry States
  const [showPayoutEmailModal, setShowPayoutEmailModal] = useState<boolean>(false);
  const [payoutEmailInput, setPayoutEmailInput] = useState<string>("");
  const [payoutLoading, setPayoutLoading] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const tabContentRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (tabContentRef.current) {
        animateTabTransition(tabContentRef.current);
      }
      if (activeTab === "milestones" && containerRef.current) {
        const rows = containerRef.current.querySelectorAll(
          ".milestone-view-row",
        );
        if (rows.length > 0) {
          animateMilestoneList(rows);
        }
      }
    },
    { dependencies: [activeTab, milestones.length], scope: containerRef },
  );

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<{
        bounty: IBounty;
        milestones: IMilestone[];
      }>(`/bounties/${bountyId}`);
      setBounty(res.bounty);
      setMilestones(res.milestones || []);

      if (currentUser) {
        try {
          const ledgerRes = await apiRequest<{ events: IEscrowLedger[] }>(
            `/bounties/${bountyId}/ledger`,
          );
          setLedgerEvents(ledgerRes.events || []);
        } catch {
          setLedgerEvents([]);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load bounty details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [bountyId]);

  const isCreator =
    Boolean(
      currentUser &&
      bounty &&
      ((typeof bounty.createdBy === "object" &&
        String((bounty.createdBy as any)?._id || (bounty.createdBy as any)?.id) === String(currentUser.id)) ||
        String(bounty.createdBy) === String(currentUser.id))
    );

  const isAssignedContributor =
    Boolean(
      currentUser &&
      bounty &&
      ((typeof bounty.assignedContributorId === "object" &&
        String((bounty.assignedContributorId as any)?._id || (bounty.assignedContributorId as any)?.id) === String(currentUser.id)) ||
        String(bounty.assignedContributorId) === String(currentUser.id))
    );

  const canAccept =
    currentUser && bounty && bounty.status === "OPEN" && !isAssignedContributor;

  const canStart =
    currentUser &&
    bounty &&
    bounty.status === "ASSIGNED" &&
    isAssignedContributor;

  const canSubmitPR =
    currentUser &&
    bounty &&
    bounty.status === "IN_PROGRESS" &&
    isAssignedContributor;

  const canPublish =
    currentUser && bounty && bounty.status === "DRAFT" && isCreator;

  const canCancel =
    currentUser &&
    bounty &&
    ["DRAFT", "OPEN", "ASSIGNED", "IN_PROGRESS"].includes(bounty.status) &&
    isCreator;

  const handlePublish = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await apiRequest(`/bounties/${bountyId}/publish`, { method: "POST" });
      setSuccessMsg("Bounty published successfully to the marketplace.");
      await fetchDetails();
      onRefreshList?.();
    } catch (err: any) {
      setError(err.message || "Failed to publish bounty.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Confirm cancellation of this bounty?")) return;
    try {
      setActionLoading(true);
      setError(null);
      await apiRequest(`/bounties/${bountyId}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: "Cancelled by sponsor" }),
      });
      setSuccessMsg("Bounty has been cancelled.");
      await fetchDetails();
      onRefreshList?.();
    } catch (err: any) {
      setError(err.message || "Failed to cancel bounty.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFundBounty = async () => {
    if (!bounty) return;
    try {
      setActionLoading(true);
      setError(null);
      await apiRequest(`/bounties/${bountyId}/fund`, {
        method: "POST",
        body: JSON.stringify({
          paypalCaptureId: `cap_sandbox_${Date.now()}`,
          amount: bounty.rewardAmount,
        }),
      });
      setSuccessMsg(`Bounty funded with $${bounty.rewardAmount.toFixed(2)} USD! Milestone payouts activated.`);
      await fetchDetails();
      onRefreshList?.();
    } catch (err: any) {
      setError(err.message || "Failed to fund bounty.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSavePayoutEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setPayoutLoading(true);
      setError(null);
      await apiRequest("/users/me/payout-profile", {
        method: "PATCH",
        body: JSON.stringify({ paypalEmail: payoutEmailInput.trim() }),
      });
      setShowPayoutEmailModal(false);
      setSuccessMsg("PayPal payout email configured successfully.");
      await fetchDetails();
    } catch (err: any) {
      setError(err.message || "Failed to update PayPal email.");
    } finally {
      setPayoutLoading(false);
    }
  };

  const handleRetryPayout = async (milestoneId: string) => {
    try {
      setActionLoading(true);
      setError(null);
      const res = await apiRequest<{ message: string; status: string }>(
        `/milestones/${milestoneId}/payout/retry`,
        { method: "POST" },
      );
      setSuccessMsg(`Payout retry status: ${res.status}. ${res.message}`);
      await fetchDetails();
    } catch (err: any) {
      setError(err.message || "Failed to retry payout.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await apiRequest(`/bounties/${bountyId}/accept`, { method: "POST" });
      setSuccessMsg(
        "You have accepted this bounty. It is now assigned to you.",
      );
      await fetchDetails();
      onRefreshList?.();
    } catch (err: any) {
      setError(err.message || "Failed to accept bounty.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await apiRequest(`/bounties/${bountyId}/start`, { method: "POST" });
      setSuccessMsg("Work initiated. Status updated to in progress.");
      await fetchDetails();
      onRefreshList?.();
    } catch (err: any) {
      setError(err.message || "Failed to start work.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitPR = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      setError(null);
      await apiRequest(`/bounties/${bountyId}/submit`, {
        method: "POST",
        body: JSON.stringify({
          prUrl: prUrl.trim() || undefined,
          prNumber: prNumber ? Number(prNumber) : undefined,
          submissionNotes: submissionNotes.trim(),
        }),
      });
      setShowSubmitPrModal(false);
      setSuccessMsg("Deliverable submitted successfully.");
      await fetchDetails();
      onRefreshList?.();
    } catch (err: any) {
      setError(err.message || "Failed to submit PR deliverable.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMilestoneReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMilestoneForReview) return;
    try {
      setActionLoading(true);
      setError(null);
      const endpoint =
        reviewAction === "approve"
          ? `/milestones/${selectedMilestoneForReview._id || selectedMilestoneForReview.id}/approve`
          : `/milestones/${selectedMilestoneForReview._id || selectedMilestoneForReview.id}/request-changes`;

      await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify({ decisionNotes: reviewNotes.trim() }),
      });

      setSelectedMilestoneForReview(null);
      setReviewNotes("");
      setSuccessMsg(
        reviewAction === "approve"
          ? "Milestone approved. Event recorded in escrow ledger."
          : "Changes requested from contributor.",
      );
      await fetchDetails();
    } catch (err: any) {
      setError(err.message || "Failed to process milestone decision.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMilestoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMilestoneForSubmit) return;
    try {
      setActionLoading(true);
      setError(null);
      await apiRequest(
        `/milestones/${selectedMilestoneForSubmit._id || selectedMilestoneForSubmit.id}/submit`,
        {
          method: "POST",
          body: JSON.stringify({
            submissionDetails: milestoneSubmitDetails.trim(),
          }),
        },
      );
      setSelectedMilestoneForSubmit(null);
      setMilestoneSubmitDetails("");
      setSuccessMsg("Milestone deliverable submitted for review.");
      await fetchDetails();
    } catch (err: any) {
      setError(err.message || "Failed to submit milestone.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <p>Loading bounty specifications…</p>
      </div>
    );
  }

  if (!bounty) {
    return (
      <div className="empty-state">
        <p>Bounty not found or error loading details.</p>
        <button
          type="button"
          className="btn btn-sm"
          onClick={onBack}
          style={{ marginTop: "var(--space-md)" }}
        >
          Back to marketplace
        </button>
      </div>
    );
  }

  const formatReward = (amount: number, currency: string = "USD") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
      amount,
    );

  const getStatusBadgeClass = (status: BountyStatus | MilestoneStatus) => {
    switch (status) {
      case "OPEN":
      case "APPROVED":
        return "badge-open";
      case "ASSIGNED":
      case "IN_PROGRESS":
        return "badge-progress";
      case "SUBMITTED":
      case "UNDER_REVIEW":
        return "badge-submitted";
      case "COMPLETED":
        return "badge-completed";
      case "CANCELLED":
      case "EXPIRED":
      case "REJECTED":
        return "badge-cancelled";
      case "DRAFT":
      case "PENDING":
      default:
        return "badge-draft";
    }
  };

  const getStatusLabel = (status: BountyStatus | MilestoneStatus) => {
    switch (status) {
      case "OPEN":
        return "open";
      case "ASSIGNED":
        return "assigned";
      case "IN_PROGRESS":
        return "in progress";
      case "SUBMITTED":
        return "submitted";
      case "UNDER_REVIEW":
        return "under review";
      case "APPROVED":
        return "approved";
      case "REJECTED":
        return "changes requested";
      case "COMPLETED":
        return "completed";
      case "CANCELLED":
        return "cancelled";
      case "EXPIRED":
        return "expired";
      case "PENDING":
        return "pending";
      case "DRAFT":
      default:
        return "draft";
    }
  };

  const orgName =
    typeof bounty.organizationId === "object" && bounty.organizationId?.name
      ? bounty.organizationId.name
      : "Organization";

  const contributorName =
    typeof bounty.assignedContributorId === "object" &&
    bounty.assignedContributorId?.username
      ? `@${bounty.assignedContributorId.username}`
      : null;

  return (
    <div ref={containerRef} className="bounty-details-container">
      <div className="details-top-bar">
        <button type="button" className="btn btn-sm" onClick={onBack}>
          <ArrowLeftIcon />
          <span>Back</span>
        </button>

        <div
          style={{
            display: "flex",
            gap: "var(--space-xs)",
            alignItems: "center",
          }}
        >
          {canPublish && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handlePublish}
              disabled={actionLoading}
            >
              Publish bounty
            </button>
          )}

          {canAccept && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleAccept}
              disabled={actionLoading}
            >
              Claim bounty
            </button>
          )}

          {canStart && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleStart}
              disabled={actionLoading}
            >
              Start work
            </button>
          )}

          {canSubmitPR && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowSubmitPrModal(true)}
              disabled={actionLoading}
            >
              Submit PR deliverable
            </button>
          )}

          {canCancel && (
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={handleCancel}
              disabled={actionLoading}
            >
              Cancel bounty
            </button>
          )}

          {isCreator && bounty.status !== "DRAFT" && bounty.fundingStatus === "UNFUNDED" && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleFundBounty}
              disabled={actionLoading}
            >
              Fund bounty ({formatReward(bounty.rewardAmount, bounty.currency)})
            </button>
          )}

          {isAssignedContributor && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setPayoutEmailInput(currentUser?.paypalEmail || currentUser?.email || "");
                setShowPayoutEmailModal(true);
              }}
            >
              {currentUser?.paypalEmail ? "Update PayPal email" : "Configure PayPal email"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert-box alert-error">
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="alert-box alert-success">
          <span>{successMsg}</span>
          <button
            type="button"
            className="btn-link"
            onClick={() => setSuccessMsg(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="details-header-panel">
        <div className="details-title-row">
          <span
            className={`status-badge ${getStatusBadgeClass(bounty.status)}`}
          >
            {getStatusLabel(bounty.status)}
          </span>
          {bounty.fundingStatus && (
            <span
              className={`status-badge ${
                bounty.fundingStatus === "FUNDED" || bounty.fundingStatus === "FULLY_DISBURSED"
                  ? "badge-ok"
                  : bounty.fundingStatus === "PARTIALLY_DISBURSED"
                  ? "badge-progress"
                  : "badge-cancelled"
              }`}
              style={{ fontSize: "11px" }}
            >
              {bounty.fundingStatus === "FUNDED"
                ? "Funded in Escrow"
                : bounty.fundingStatus === "PARTIALLY_DISBURSED"
                ? "Partially Disbursed"
                : bounty.fundingStatus === "FULLY_DISBURSED"
                ? "Fully Disbursed"
                : "Unfunded"}
            </span>
          )}
          <span className="reward-tag-large measured">
            {formatReward(bounty.rewardAmount, bounty.currency)}
          </span>
        </div>

        <h1 className="details-title">{bounty.title}</h1>

        <div className="details-github-bar">
          <span className="gh-badge">
            Repository: {bounty.repositoryFullName}
          </span>
          <a
            href={bounty.issueUrl}
            target="_blank"
            rel="noreferrer"
            className="gh-link-badge"
          >
            <GitIssueIcon />
            <span className="measured">
              Issue #{bounty.issueNumber} ({bounty.issueState})
            </span>
            <ExternalLinkIcon />
          </a>
          <span style={{ color: "var(--color-muted)", display: "inline-flex", alignItems: "center", gap: "var(--space-2xs)" }}>
            Organization: {orgName}
            {orgName === "Cyberdyne Systems" && (
              <span className="badge-demo" title="Demonstration organization (application-generated)">Demo sponsor</span>
            )}
          </span>
        </div>

        <div className="details-header-meta">
          <div>
            <span>Assigned contributor: </span>
            <span className="meta-val">
              {contributorName ? contributorName : "None (open for claims)"}
            </span>
          </div>
          {bounty.prUrl && (
            <div>
              <span>Submitted pull request: </span>
              <a
                href={bounty.prUrl}
                target="_blank"
                rel="noreferrer"
                className="meta-val"
                style={{ textDecoration: "underline" }}
              >
                PR #{bounty.prNumber || "Link"}
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="details-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === "details" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("details")}
        >
          Description and scope
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "milestones" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("milestones")}
        >
          Milestones ({milestones.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "ledger" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("ledger")}
        >
          Escrow ledger ({ledgerEvents.length})
        </button>
      </div>

      <div ref={tabContentRef}>
        {activeTab === "details" && (
          <div className="content-panel">
            <h3
              className="section-title"
              style={{
                fontSize: "var(--text-md)",
                marginBottom: "var(--space-sm)",
              }}
            >
              Problem description and acceptance criteria
            </h3>
            <p style={{ whiteSpace: "pre-wrap", color: "var(--color-ink-2)" }}>
              {bounty.description}
            </p>

            {bounty.submissionNotes && (
              <div
                style={{
                  marginTop: "var(--space-md)",
                  padding: "var(--space-sm)",
                  background: "var(--color-paper-3)",
                  borderRadius: "var(--radius-pill)",
                  border: "var(--rule-hair) solid var(--color-rule)",
                }}
              >
                <span className="field-label">
                  Contributor submission notes
                </span>
                <p
                  style={{
                    color: "var(--color-ink-2)",
                    fontSize: "var(--text-sm)",
                    marginTop: "var(--space-2xs)",
                  }}
                >
                  {bounty.submissionNotes}
                </p>
              </div>
            )}

            <div
              style={{
                marginTop: "var(--space-lg)",
                paddingTop: "var(--space-md)",
                borderTop: "var(--rule-hair) solid var(--color-rule)",
              }}
            >
              <h4
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-muted)",
                  margin: "0 0 var(--space-xs)",
                }}
              >
                Lifecycle audit trail
              </h4>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-xs)",
                }}
              >
                {bounty.statusHistory?.map((h, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "var(--text-xs)",
                      padding: "var(--space-2xs) 0",
                      borderBottom: "var(--rule-hair) solid var(--color-rule)",
                    }}
                  >
                    <span>
                      {h.fromStatus ? `${getStatusLabel(h.fromStatus)} → ` : ""}
                      <strong>{getStatusLabel(h.toStatus)}</strong>
                      {h.reason ? ` (${h.reason})` : ""}
                    </span>
                    <span
                      className="measured"
                      style={{ color: "var(--color-muted)" }}
                    >
                      {(() => {
                        const dt = h.changedAt || h.timestamp || h.createdAt;
                        if (!dt) return "Recorded";
                        const parsed = new Date(dt);
                        return isNaN(parsed.getTime())
                          ? "Recorded"
                          : parsed.toLocaleString();
                      })()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "milestones" && (
          <div>
            <div style={{ marginBottom: "var(--space-sm)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2xs)" }}>
              <span className="field-label">Deliverable milestones ({milestones.length})</span>
              {orgName === "Cyberdyne Systems" && (
                <span className="badge-demo" title="Seeded milestone deliverables — disbursements require verified PayPal transactions">Demo deliverables</span>
              )}
            </div>
            {milestones.length === 0 ? (
              <div className="empty-state">
                <p>No milestones attached to this bounty.</p>
              </div>
            ) : (
              <>
                {/* Milestone Progression Summary Pipeline */}
                <div className="milestone-progression-panel">
                  <div className="progression-header">
                    <span className="progression-title">Milestone Execution & Payout Pipeline</span>
                    <span className="progression-count font-mono text-xs">
                      {milestones.filter(m => m.status === 'APPROVED').length} of {milestones.length} Approved
                    </span>
                  </div>
                  <div className="progression-rail">
                    {milestones.map((m, idx) => {
                      const isApproved = m.status === 'APPROVED';
                      const isSubmitted = m.status === 'SUBMITTED' || m.status === 'UNDER_REVIEW';
                      return (
                        <div
                          key={m._id || m.id || idx}
                          className={`progression-step ${
                            isApproved ? 'step-approved' : isSubmitted ? 'step-review' : 'step-pending'
                          }`}
                        >
                          <div className="step-indicator">
                            {isApproved ? (
                              <CheckIcon width="12" height="12" />
                            ) : isSubmitted ? (
                              <SparkleIcon width="12" height="12" />
                            ) : (
                              <span className="font-mono text-xs">{m.order}</span>
                            )}
                          </div>
                          <div className="step-info">
                            <span className="step-name">{m.title}</span>
                            <span className="step-amt font-mono text-xs">
                              {formatReward(m.rewardAmount, m.currency)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="milestones-view-list">
                {milestones.map((m) => {
                  const isApproved = m.status === "APPROVED";
                  const isSubmitted = ["SUBMITTED", "UNDER_REVIEW"].includes(
                    m.status,
                  );
                  const canSubmitThis =
                    isAssignedContributor &&
                    ["PENDING", "IN_PROGRESS", "REJECTED"].includes(m.status);
                  const canReviewThis =
                    isCreator && isSubmitted && !isAssignedContributor;

                  return (
                    <div key={m._id || m.id} className="milestone-view-row">
                      <div className="milestone-view-header">
                        <div>
                          <h3
                            style={{
                              fontSize: "var(--text-md)",
                              margin: 0,
                              fontWeight: 500,
                            }}
                          >
                            <span
                              className="measured"
                              style={{
                                color: "var(--color-accent)",
                                marginRight: "var(--space-xs)",
                              }}
                            >
                              #{m.order}
                            </span>
                            {m.title}
                          </h3>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "var(--space-xs)",
                            alignItems: "center",
                          }}
                        >
                          <span className="reward-tag measured">
                            {formatReward(m.rewardAmount, m.currency)}
                          </span>
                          <span
                            className={`status-badge ${getStatusBadgeClass(m.status)}`}
                          >
                            {getStatusLabel(m.status)}
                          </span>
                        </div>
                      </div>

                      {m.description && (
                        <p
                          style={{
                            color: "var(--color-muted)",
                            fontSize: "var(--text-sm)",
                            margin: "var(--space-xs) 0",
                          }}
                        >
                          {m.description}
                        </p>
                      )}

                      <div className="criteria-view-box">
                        <span className="field-label">Acceptance criteria</span>
                        <ul className="criteria-view-list">
                          {m.acceptanceCriteria.map((c, cIdx) => (
                            <li key={cIdx}>{c}</li>
                          ))}
                        </ul>
                      </div>

                      {m.submissionDetails && (
                        <div
                          style={{
                            marginTop: "var(--space-xs)",
                            padding: "var(--space-xs)",
                            background: "var(--color-paper)",
                            borderRadius: "var(--radius-pill)",
                            border: "var(--rule-hair) solid var(--color-rule)",
                            fontSize: "var(--text-xs)",
                          }}
                        >
                          <span className="field-label">Submission notes</span>
                          <p style={{ color: "var(--color-ink-2)" }}>
                            {m.submissionDetails}
                          </p>
                        </div>
                      )}

                      {/* PR Evidence & AI Verification Banner */}
                      {m.prUrl && (
                        <div
                          style={{
                            marginTop: "var(--space-xs)",
                            padding: "var(--space-xs) var(--space-sm)",
                            background: "var(--color-paper-3)",
                            borderRadius: "var(--radius-card)",
                            border: "var(--rule-hair) solid var(--color-rule)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "var(--space-2xs)",
                            fontSize: "var(--text-xs)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2xs)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                              <a
                                href={m.prUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="measured"
                                style={{ color: "var(--color-accent)", textDecoration: "underline", fontWeight: 600 }}
                              >
                                PR #{m.prNumber} ↗
                              </a>
                              {m.prState && (
                                <span className="status-badge" style={{ fontSize: "10px" }}>
                                  {m.prState}
                                </span>
                              )}
                              {m.isMerged && (
                                <span className="status-badge badge-ok" style={{ fontSize: "10px" }}>
                                  merged
                                </span>
                              )}
                              {m.submissionHistory && m.submissionHistory.length > 1 && (
                                <span className="status-badge badge-progress" style={{ fontSize: "10px" }}>
                                  resubmission #{m.submissionHistory.length}
                                </span>
                              )}
                            </div>

                            {m.latestVerification && (
                              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
                                <span
                                  className={`status-badge ${
                                    m.latestVerification.overallAssessment === "PASS"
                                      ? "badge-ok"
                                      : m.latestVerification.overallAssessment === "FAIL"
                                      ? "badge-cancelled"
                                      : "badge-progress"
                                  }`}
                                  style={{ fontSize: "10px", fontWeight: 500 }}
                                >
                                  AI: {m.latestVerification.overallAssessment}
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  style={{ padding: "2px 8px", fontSize: "11px", whiteSpace: "nowrap" }}
                                  onClick={() =>
                                    setActiveVerificationModal({
                                      milestone: m,
                                      verification: m.latestVerification!,
                                    })
                                  }
                                >
                                  <SparkleIcon />
                                  <span>View AI report</span>
                                </button>
                              </div>
                            )}
                          </div>
                          {m.prTitle && (
                            <p style={{ color: "var(--color-ink-2)", margin: 0 }}>
                              {m.prTitle}
                            </p>
                          )}
                        </div>
                      )}

                      {m.decisionNotes && (
                        <div
                          style={{
                            marginTop: "var(--space-xs)",
                            padding: "var(--space-xs)",
                            background: "var(--color-paper)",
                            borderRadius: "var(--radius-pill)",
                            border: "var(--rule-hair) solid var(--color-rule)",
                            fontSize: "var(--text-xs)",
                          }}
                        >
                          <span className="field-label">
                            Review decision notes
                          </span>
                          <p style={{ color: "var(--color-ink-2)" }}>
                            {m.decisionNotes}
                          </p>
                        </div>
                      )}

                      <div
                        style={{
                          marginTop: "var(--space-sm)",
                          paddingTop: "var(--space-xs)",
                          borderTop: "var(--rule-hair) solid var(--color-rule)",
                          display: "flex",
                          justifyContent: "flex-end",
                          alignItems: "center",
                        }}
                      >
                        {isApproved && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "var(--space-sm)",
                              flexWrap: "wrap",
                              fontSize: "var(--text-xs)",
                            }}
                          >
                            <span
                              style={{
                                color: "var(--color-ok)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "var(--space-2xs)",
                              }}
                            >
                              <LockIcon />
                              <span>Approved deliverable</span>
                            </span>

                            {/* Task 2D: Financial Payout Status Badge */}
                            {m.payoutStatus === "SUCCESS" && (
                              <span
                                className="status-badge badge-ok"
                                title={`PayPal Transaction: ${m.payoutTransactionId || "Recorded"}`}
                                style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2xs)" }}
                              >
                                <CheckIcon />
                                <span>Paid via PayPal</span>
                              </span>
                            )}

                            {m.payoutStatus === "PROCESSING" && (
                              <span
                                className="status-badge badge-progress"
                                title="PayPal payout batch is currently processing"
                                style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2xs)" }}
                              >
                                <RefreshIcon className="spin-icon" width="10" height="10" />
                                <span>Processing via PayPal</span>
                              </span>
                            )}

                            {m.payoutStatus === "AWAITING_PAYOUT_INFO" && (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-xs)" }}>
                                <span className="status-badge badge-draft" style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2xs)" }}>
                                  <AlertIcon width="10" height="10" />
                                  <span>Awaiting PayPal email</span>
                                </span>
                                {isAssignedContributor && (
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    style={{ padding: "2px 8px", fontSize: "11px" }}
                                    onClick={() => {
                                      setPayoutEmailInput(currentUser?.paypalEmail || currentUser?.email || "");
                                      setShowPayoutEmailModal(true);
                                    }}
                                  >
                                    Add PayPal email
                                  </button>
                                )}
                              </div>
                            )}

                            {m.payoutStatus === "FAILED" && (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-xs)" }}>
                                <span className="status-badge badge-cancelled" title={m.payoutError?.message || "Payout failed"} style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2xs)" }}>
                                  <AlertIcon width="10" height="10" />
                                  <span>Payout failed</span>
                                </span>
                                {(isCreator || currentUser?.role === "ADMIN") && (
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    style={{ padding: "2px 8px", fontSize: "11px" }}
                                    onClick={() => handleRetryPayout(m._id || m.id!)}
                                  >
                                    Retry payout
                                  </button>
                                )}
                              </div>
                            )}

                            {m.payoutStatus === "UNCERTAIN" && (
                              <span className="status-badge badge-draft" style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2xs)" }}>
                                <InfoIcon width="10" height="10" />
                                <span>Payout uncertain</span>
                              </span>
                            )}

                            {m.payoutStatus === "UNCLAIMED" && (
                              <span className="status-badge badge-progress" style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2xs)" }}>
                                <InfoIcon width="10" height="10" />
                                <span>Unclaimed in PayPal</span>
                              </span>
                            )}

                            {(!m.payoutStatus || m.payoutStatus === "UNPAID") && (
                              <span className="status-badge badge-draft" style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2xs)" }}>
                                <LockIcon width="10" height="10" />
                                <span>
                                  {bounty.fundingStatus === "FUNDED" || bounty.fundingStatus === "PARTIALLY_DISBURSED"
                                    ? "Escrow funded (queued)"
                                    : "Awaiting bounty funding"}
                                </span>
                              </span>
                            )}
                          </div>
                        )}

                        {canSubmitThis && (
                          <div style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ whiteSpace: "nowrap" }}
                              onClick={() => setSelectedMilestoneForPRSubmit(m)}
                            >
                              <GitIssueIcon />
                              <span>{m.prUrl ? "Resubmit PR" : "Submit PR deliverable"}</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{ whiteSpace: "nowrap" }}
                              onClick={() => setSelectedMilestoneForSubmit(m)}
                            >
                              Notes only
                            </button>
                          </div>
                        )}

                        {canReviewThis && (
                          <div
                            style={{ display: "flex", gap: "var(--space-xs)", flexWrap: "wrap" }}
                          >
                            {m.latestVerification && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() =>
                                  setActiveVerificationModal({
                                    milestone: m,
                                    verification: m.latestVerification!,
                                  })
                                }
                              >
                                <SparkleIcon />
                                <span>Review PR & AI report</span>
                              </button>
                            )}
                            <button
                              type="button"
                              className={m.latestVerification ? "btn btn-sm" : "btn btn-primary btn-sm"}
                              onClick={() => {
                                setSelectedMilestoneForReview(m);
                                setReviewAction("approve");
                              }}
                            >
                              <CheckIcon />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => {
                                setSelectedMilestoneForReview(m);
                                setReviewAction("reject");
                              }}
                            >
                              Request changes
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              </>
            )}
          </div>
        )}

        {activeTab === "ledger" && (
          <div className="content-panel">
            <div className="ledger-notice-banner">
              <InfoIcon />
              <span>
                GitEscrow’s internal ledger records payment-related events and
                provider references; it does not custody money or provide
                legally protected escrow. Milestone payouts require verified payment provider execution.
              </span>
            </div>

            {ledgerEvents.length === 0 ? (
              <div className="empty-state">
                <p>No escrow ledger events recorded for this bounty yet.</p>
                <p className="hint-text">
                  Events are recorded when funding is captured, milestones are
                  approved, or payouts and refunds occur.
                </p>
              </div>
            ) : (
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Timestamp</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerEvents.map((e) => (
                    <tr key={e._id || e.id}>
                      <td>
                        <span className="event-badge">{e.eventType}</span>
                      </td>
                      <td
                        className="measured"
                        style={{ color: "var(--color-accent)" }}
                      >
                        {formatReward(e.amount, e.currency)}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${getStatusBadgeClass(e.status as any)}`}
                        >
                          {getStatusLabel(e.status as any)}
                        </span>
                      </td>
                      <td
                        className="measured"
                        style={{ color: "var(--color-muted)" }}
                      >
                        {new Date(e.createdAt).toLocaleString()}
                      </td>
                      <td style={{ color: "var(--color-ink-2)" }}>
                        {e.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal: Contributor Submit PR */}
      <ModalDialog
        isOpen={showSubmitPrModal}
        onClose={() => setShowSubmitPrModal(false)}
        title="Submit pull request deliverable"
        subtitle="Provide your merged or ready-for-review GitHub pull request link."
      >
        <form onSubmit={handleSubmitPR}>
          <div className="form-group">
            <label className="field-label">Pull request URL</label>
            <input
              type="url"
              className="input-field"
              placeholder="https://github.com/mock-owner/escrow-repo/pull/1"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="field-label">Pull request number</label>
            <input
              type="number"
              className="input-field measured"
              value={prNumber}
              onChange={(e) => setPrNumber(Number(e.target.value))}
              min={1}
            />
          </div>

          <div className="form-group">
            <label className="field-label">Submission notes and summary</label>
            <textarea
              className="input-field textarea-field"
              rows={3}
              placeholder="Describe your solution, test coverage, and documentation updates…"
              value={submissionNotes}
              onChange={(e) => setSubmissionNotes(e.target.value)}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setShowSubmitPrModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={actionLoading}
            >
              {actionLoading ? "Submitting…" : "Submit deliverable"}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal: Sponsor Review Milestone */}
      <ModalDialog
        isOpen={Boolean(selectedMilestoneForReview)}
        onClose={() => setSelectedMilestoneForReview(null)}
        title={
          reviewAction === "approve" ? "Approve milestone" : "Request changes"
        }
        subtitle={
          selectedMilestoneForReview ? (
            <>
              Milestone #{selectedMilestoneForReview.order}:{" "}
              {selectedMilestoneForReview.title} (
              <span className="measured">
                {formatReward(
                  selectedMilestoneForReview.rewardAmount,
                  selectedMilestoneForReview.currency,
                )}
              </span>
              )
            </>
          ) : undefined
        }
      >
        <form onSubmit={handleMilestoneReview}>
          <div className="form-group">
            <label className="field-label">Decision notes and feedback</label>
            <textarea
              className="input-field textarea-field"
              rows={3}
              placeholder={
                reviewAction === "approve"
                  ? "Confirming that criteria are met and code passes review…"
                  : "Specify what changes are required before this milestone can be approved…"
              }
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              required
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setSelectedMilestoneForReview(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={
                reviewAction === "approve"
                  ? "btn btn-primary btn-sm"
                  : "btn btn-sm"
              }
              disabled={actionLoading}
            >
              {actionLoading
                ? "Processing…"
                : reviewAction === "approve"
                  ? "Confirm approval"
                  : "Submit feedback"}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Modal: Contributor Submit Milestone */}
      <ModalDialog
        isOpen={Boolean(selectedMilestoneForSubmit)}
        onClose={() => setSelectedMilestoneForSubmit(null)}
        title="Submit milestone deliverable"
        subtitle={
          selectedMilestoneForSubmit ? (
            <>
              Milestone #{selectedMilestoneForSubmit.order}:{" "}
              {selectedMilestoneForSubmit.title}
            </>
          ) : undefined
        }
      >
        <form onSubmit={handleMilestoneSubmit}>
          <div className="form-group">
            <label className="field-label">
              Submission details and deliverable links
            </label>
            <textarea
              className="input-field textarea-field"
              rows={4}
              placeholder="Include commits, test run outputs, PR links, or documentation URLs proving acceptance criteria are fulfilled…"
              value={milestoneSubmitDetails}
              onChange={(e) => setMilestoneSubmitDetails(e.target.value)}
              required
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setSelectedMilestoneForSubmit(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={actionLoading}
            >
              {actionLoading ? "Submitting…" : "Submit for review"}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* Task 2C: Contributor Submit PR Modal */}
      {selectedMilestoneForPRSubmit && bounty && (
        <MilestoneSubmitPRModal
          milestone={selectedMilestoneForPRSubmit}
          bounty={bounty}
          onSuccess={(updatedMilestone, verification) => {
            setSelectedMilestoneForPRSubmit(null);
            setMilestones((prev) =>
              prev.map((item) =>
                (item._id || item.id) === (updatedMilestone._id || updatedMilestone.id)
                  ? updatedMilestone
                  : item
              )
            );
            setActiveVerificationModal({
              milestone: updatedMilestone,
              verification,
            });
            setSuccessMsg("Pull request submitted and verified by AI successfully.");
          }}
          onClose={() => setSelectedMilestoneForPRSubmit(null)}
        />
      )}

      {/* Task 2C: AI PR Verification Report & Review Modal */}
      {activeVerificationModal && (
        <PRVerificationModal
          milestone={activeVerificationModal.milestone}
          verification={activeVerificationModal.verification}
          isSponsor={Boolean(isCreator)}
          onDecisionComplete={(updatedMilestone) => {
            setActiveVerificationModal(null);
            setMilestones((prev) =>
              prev.map((item) =>
                (item._id || item.id) === (updatedMilestone._id || updatedMilestone.id)
                  ? updatedMilestone
                  : item
              )
            );
            fetchDetails();
            setSuccessMsg(
              updatedMilestone.status === "APPROVED"
                ? "Milestone approved and locked. Recorded in escrow ledger."
                : "Review feedback submitted to contributor."
            );
          }}
          onClose={() => setActiveVerificationModal(null)}
        />
      )}

      {/* Task 2D: Modal - Configure Contributor PayPal Email */}
      <ModalDialog
        isOpen={showPayoutEmailModal}
        onClose={() => setShowPayoutEmailModal(false)}
        title="Configure PayPal payout email"
        subtitle="Provide your PayPal account email to receive automated disbursements upon deliverable approval."
      >
        <form onSubmit={handleSavePayoutEmail}>
          <div className="form-group">
            <label className="field-label">PayPal account email</label>
            <input
              type="email"
              className="input-field"
              placeholder="contributor@example.com"
              value={payoutEmailInput}
              onChange={(e) => setPayoutEmailInput(e.target.value)}
              required
            />
            <p
              style={{
                color: "var(--color-muted)",
                fontSize: "var(--text-xs)",
                marginTop: "var(--space-2xs)",
                marginBottom: 0,
              }}
            >
              Disbursements are sent via PayPal Payouts. Your address is masked and never exposed publicly.
            </p>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setShowPayoutEmailModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={payoutLoading}
            >
              {payoutLoading ? "Saving…" : "Save payout email"}
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
}
