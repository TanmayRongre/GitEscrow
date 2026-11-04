import { useState, useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { apiRequest } from "../api/client";
import type {
  IBounty,
  BountyStatus,
  DashboardSummaryResponse,
} from "../types/bounty";
import type { User } from "../context/AuthContext";
import {
  GitIssueIcon,
  GitForkIcon,
  UserIcon,
  CheckIcon,
  LockIcon,
  AlertIcon,
  RefreshIcon,
  SparkleIcon,
  ExternalLinkIcon,
} from "./Icons";
import { animateGridEntrance } from "../motion/transitions";

interface DashboardViewProps {
  currentUser: User;
  onSelectBounty: (bountyId: string) => void;
  onCreateBounty: () => void;
  onExploreMarketplace: () => void;
  onOpenProfile: () => void;
}

type DashboardTab = "all" | "sponsored" | "claimed" | "reviews";

export function DashboardView({
  currentUser,
  onSelectBounty,
  onCreateBounty,
  onExploreMarketplace,
  onOpenProfile,
}: DashboardViewProps) {
  const [bounties, setBounties] = useState<IBounty[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("all");
  const [payoutConfigured, setPayoutConfigured] = useState<boolean>(false);
  const [maskedPayoutEmail, setMaskedPayoutEmail] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Global Authoritative Summary Metrics (Task 3B.4)
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState<boolean>(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!loading && bounties.length > 0 && containerRef.current) {
        animateGridEntrance(".dash-card-anim", containerRef.current);
      }
    },
    { dependencies: [bounties.length, loading, activeTab], scope: containerRef },
  );

  const fetchSummary = async () => {
    try {
      setSummaryLoading(true);
      setSummaryError(null);
      const res = await apiRequest<DashboardSummaryResponse>("/bounties/summary");
      setSummary(res);
    } catch (err: any) {
      setSummaryError(err.message || "Failed to load global metrics");
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchData = async (targetPage = page) => {
    try {
      setLoading(true);
      setError(null);

      // Load all relevant status bounties via validated status=ALL query
      const bountyRes = await apiRequest<{
        bounties: IBounty[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/bounties?status=ALL&limit=50&page=${targetPage}`);
      setBounties(bountyRes.bounties || []);
      setTotalCount(bountyRes.total || 0);
      setTotalPages(bountyRes.totalPages || 1);
      setPage(bountyRes.page || targetPage);

      // Load user's payout profile status
      try {
        const profileRes = await apiRequest<{
          payoutProfile: {
            configured: boolean;
            paypalEmail: string | null;
            maskedEmail: string | null;
          };
        }>("/users/me/payout-profile");
        if (profileRes?.payoutProfile) {
          setPayoutConfigured(profileRes.payoutProfile.configured);
          setMaskedPayoutEmail(profileRes.payoutProfile.maskedEmail);
        }
      } catch {
        // Payout endpoint error shouldn't block the dashboard
      }
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchData(1);
  }, []);

  // Filter calculations based on real user identity
  const currentUserId = String(currentUser.id || (currentUser as any)._id || "");

  const sponsoredBounties = bounties.filter((b) => {
    const creatorId =
      typeof b.createdBy === "object" && b.createdBy
        ? String((b.createdBy as any)._id || (b.createdBy as any).id)
        : String(b.createdBy || "");
    return creatorId === currentUserId;
  });

  const claimedBounties = bounties.filter((b) => {
    const contributorId =
      typeof b.assignedContributorId === "object" && b.assignedContributorId
        ? String((b.assignedContributorId as any)._id || (b.assignedContributorId as any).id)
        : String(b.assignedContributorId || "");
    return contributorId === currentUserId;
  });

  const reviewsAwaiting = bounties.filter(
    (b) =>
      (b.status === "SUBMITTED" || b.status === "UNDER_REVIEW") &&
      (sponsoredBounties.some((s) => (s._id || s.id) === (b._id || b.id)) ||
        currentUser.role === "ADMIN"),
  );

  const activeBountiesCount = bounties.filter(
    (b) => b.status === "OPEN" || b.status === "ASSIGNED" || b.status === "IN_PROGRESS",
  ).length;

  const totalFundedCents = sponsoredBounties.reduce(
    (sum, b) => sum + (b.fundedAmountCents || (b.fundedAmount ? b.fundedAmount * 100 : 0) || 0),
    0,
  );

  const totalDisbursedCents = sponsoredBounties.reduce(
    (sum, b) => sum + (b.disbursedAmountCents || (b.disbursedAmount ? b.disbursedAmount * 100 : 0) || 0),
    0,
  );

  const formatCurrency = (amountCents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amountCents / 100);
  };

  const getStatusBadge = (status: BountyStatus) => {
    switch (status) {
      case "OPEN":
        return (
          <span className="status-badge badge-open">
            <span className="badge-dot" />
            <span>Open</span>
          </span>
        );
      case "ASSIGNED":
      case "IN_PROGRESS":
        return (
          <span className="status-badge badge-progress">
            <span className="badge-dot" />
            <span>In Progress</span>
          </span>
        );
      case "SUBMITTED":
      case "UNDER_REVIEW":
        return (
          <span className="status-badge badge-submitted">
            <span className="badge-dot" />
            <span>Under Review</span>
          </span>
        );
      case "COMPLETED":
        return (
          <span className="status-badge badge-completed">
            <CheckIcon width="10" height="10" />
            <span>Completed</span>
          </span>
        );
      case "CANCELLED":
      case "EXPIRED":
        return (
          <span className="status-badge badge-cancelled">
            <AlertIcon width="10" height="10" />
            <span>Cancelled</span>
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="status-badge badge-draft">
            <span>Draft</span>
          </span>
        );
    }
  };

  const filteredBounties = (() => {
    let list: IBounty[];
    switch (activeTab) {
      case "sponsored":
        list = sponsoredBounties;
        break;
      case "claimed":
        list = claimedBounties;
        break;
      case "reviews":
        list = reviewsAwaiting;
        break;
      case "all":
      default:
        list = bounties;
        break;
    }

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter((b) =>
      (b.title && b.title.toLowerCase().includes(q)) ||
      (b.repositoryFullName && b.repositoryFullName.toLowerCase().includes(q)) ||
      (b.issueTitle && b.issueTitle.toLowerCase().includes(q)) ||
      String(b.issueNumber || "").includes(q)
    );
  })();

  return (
    <div ref={containerRef} className="dashboard-view-container">
      {/* Dashboard Top Header */}
      <div className="dash-header-panel">
        <div className="dash-header-content">
          <div className="dash-header-title-row">
            <div className="dash-title-group">
              <h1 className="dash-heading">Developer Escrow Console</h1>
              <p className="dash-lead">
                Monitor funded milestone contracts, cryptographic PR verifications, and automated PayPal disbursements.
              </p>
            </div>
            <div className="dash-actions-group">
              <button
                type="button"
                className="btn btn-primary dash-action-btn"
                onClick={onCreateBounty}
              >
                Create Bounty
              </button>
              <button
                type="button"
                className="btn btn-secondary dash-action-btn"
                onClick={onExploreMarketplace}
              >
                Explore Marketplace
              </button>
            </div>
          </div>
        </div>

        {/* Payout Profile Notification if unconfigured */}
        {!payoutConfigured && (
          <div className="dash-notice-banner" role="status">
            <div className="notice-icon-wrap">
              <AlertIcon />
            </div>
            <div className="notice-body">
              <span className="notice-title">PayPal Payout Email Required</span>
              <span className="notice-text">
                You have not configured a recipient PayPal email. You will not be able to receive milestone disbursements until your payout profile is verified.
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-secondary notice-action"
              onClick={onOpenProfile}
            >
              Configure Payouts
            </button>
          </div>
        )}

        {/* Global Summary Metrics Error Notice */}
        {summaryError && (
          <div
            className="alert-box alert-error dash-metrics-error"
            role="alert"
            style={{ marginBottom: "var(--space-sm)" }}
          >
            <AlertIcon />
            <span>Failed to load global metrics ({summaryError}). Showing local estimates.</span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={fetchSummary}
              disabled={summaryLoading}
            >
              {summaryLoading ? "Retrying…" : "Retry Metrics"}
            </button>
          </div>
        )}

        {/* Summary Metrics KPI Ribbon */}
        <div className="dash-metrics-grid">
          <div className="dash-metric-card dash-card-anim">
            <div className="metric-header">
              <span className="metric-label">Active Bounties</span>
              <GitIssueIcon className="metric-icon text-accent" />
            </div>
            <div className="metric-value font-mono">
              {summaryLoading && !summary
                ? "…"
                : (summary?.activeBounties ?? activeBountiesCount)}
            </div>
            <span className="metric-subtext">Open & in-progress contracts</span>
          </div>

          <div className="dash-metric-card dash-card-anim">
            <div className="metric-header">
              <span className="metric-label">Sponsored Bounties</span>
              <LockIcon className="metric-icon text-cool" />
            </div>
            <div className="metric-value font-mono">
              {summaryLoading && !summary
                ? "…"
                : (summary?.sponsoredBounties ?? sponsoredBounties.length)}
            </div>
            <span className="metric-subtext">Created by @{currentUser.username}</span>
          </div>

          <div className="dash-metric-card dash-card-anim">
            <div className="metric-header">
              <span className="metric-label">Reviews Awaiting</span>
              <SparkleIcon className="metric-icon text-amber" />
            </div>
            <div className="metric-value font-mono">
              {summaryLoading && !summary
                ? "…"
                : (summary?.reviewsAwaiting ?? reviewsAwaiting.length)}
            </div>
            <span className="metric-subtext">Submitted PRs requiring sign-off</span>
          </div>

          <div className="dash-metric-card dash-card-anim">
            <div className="metric-header">
              <span className="metric-label">Escrow Funded</span>
              <CheckIcon className="metric-icon text-success" />
            </div>
            <div className="metric-value font-mono tabular-nums">
              {summaryLoading && !summary
                ? "…"
                : (summary?.formattedFunded ?? formatCurrency(totalFundedCents))}
            </div>
            <span className="metric-subtext">
              {summaryLoading && !summary
                ? "Calculating disbursements…"
                : `Disbursed: ${
                    summary?.formattedDisbursed ?? formatCurrency(totalDisbursedCents)
                  }`}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="dash-main-grid">
        {/* Left Column: Bounties & Activity Table */}
        <div className="dash-table-panel">
          <div className="dash-panel-header">
            <div className="dash-tab-nav" role="tablist" aria-label="Dashboard views">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "all"}
                className={`dash-tab whitespace-nowrap ${activeTab === "all" ? "dash-tab-active" : ""}`}
                onClick={() => setActiveTab("all")}
              >
                All Bounties ({totalCount > bounties.length ? `${bounties.length} of ${totalCount}` : totalCount || (summary?.totalBounties ?? bounties.length)})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "sponsored"}
                className={`dash-tab whitespace-nowrap ${activeTab === "sponsored" ? "dash-tab-active" : ""}`}
                onClick={() => setActiveTab("sponsored")}
              >
                My Sponsored ({summary?.sponsoredBounties ?? sponsoredBounties.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "claimed"}
                className={`dash-tab whitespace-nowrap ${activeTab === "claimed" ? "dash-tab-active" : ""}`}
                onClick={() => setActiveTab("claimed")}
              >
                My Claimed ({summary?.claimedBounties ?? claimedBounties.length})
              </button>
              {(summary?.reviewsAwaiting ?? reviewsAwaiting.length) > 0 && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "reviews"}
                  className={`dash-tab whitespace-nowrap dash-tab-alert ${activeTab === "reviews" ? "dash-tab-active" : ""}`}
                  onClick={() => setActiveTab("reviews")}
                >
                  Pending Reviews ({summary?.reviewsAwaiting ?? reviewsAwaiting.length})
                </button>
              )}
            </div>
            <div className="dash-header-tools">
              <input
                type="text"
                className="input-field dash-search-input font-mono text-xs"
                placeholder="Filter by repo, issue #, or title…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                type="button"
                className="dash-refresh-btn"
                onClick={() => {
                  fetchSummary();
                  fetchData(page);
                }}
                title="Refresh live data"
                disabled={loading || summaryLoading}
              >
                <RefreshIcon className={loading || summaryLoading ? "spin-icon" : ""} />
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="alert-box alert-error" role="alert">
              <AlertIcon />
              <span>{error}</span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  fetchSummary();
                  fetchData(page);
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="dash-loading-state">
              <RefreshIcon className="spin-icon text-muted" width="24" height="24" />
              <p>Synchronizing escrow records…</p>
            </div>
          ) : filteredBounties.length === 0 ? (
            /* Context-Aware Empty State */
            <div className="dash-empty-state">
              <GitIssueIcon width="32" height="32" className="empty-icon text-muted" />
              <h3 className="empty-heading">
                {activeTab === "sponsored"
                  ? "No sponsored bounties yet"
                  : activeTab === "claimed"
                  ? "No claimed bounties yet"
                  : activeTab === "reviews"
                  ? "No reviews awaiting action"
                  : "No bounties found"}
              </h3>
              <p className="empty-description">
                {activeTab === "sponsored"
                  ? "You have not launched any bounties yet. Create a bounty to fund milestones into PayPal escrow."
                  : activeTab === "claimed"
                  ? "You have not claimed any bounties yet. Browse the marketplace to find open issues."
                  : activeTab === "reviews"
                  ? "All pull request verifications are up to date."
                  : "Explore the marketplace or launch a new open-source bounty."}
              </p>
              <div className="empty-actions">
                {activeTab === "sponsored" ? (
                  <button type="button" className="btn btn-primary" onClick={onCreateBounty}>
                    Create Your First Bounty
                  </button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={onExploreMarketplace}>
                    Explore Marketplace
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Professional Dark Fintech Data Table */
            <div className="dash-table-wrap">
              <table className="dash-fintech-table">
                <thead>
                  <tr>
                    <th>Bounty & Repository</th>
                    <th>Status</th>
                    <th>Reward Pool</th>
                    <th>Funding</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBounties.map((b) => {
                    const bountyKey = b._id || b.id || "";
                    const isOwner = sponsoredBounties.some((s) => (s._id || s.id) === bountyKey);
                    return (
                      <tr
                        key={bountyKey}
                        className="dash-table-row"
                        onClick={() => onSelectBounty(bountyKey)}
                        tabIndex={0}
                        role="button"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectBounty(bountyKey);
                          }
                        }}
                      >
                        <td className="cell-primary">
                          <div className="bounty-title-line">
                            <span className="bounty-title-text">{b.title}</span>
                            {isOwner && (
                              <span className="tag-sponsor-owner font-mono text-xs">sponsor</span>
                            )}
                          </div>
                          <div className="bounty-meta-line font-mono text-xs text-muted">
                            <GitForkIcon width="12" height="12" />
                            <span>{b.repositoryFullName}</span>
                            <span>#{b.issueNumber}</span>
                          </div>
                        </td>
                        <td>{getStatusBadge(b.status)}</td>
                        <td>
                          <span className="reward-value font-mono tabular-nums">
                            {formatCurrency((b.rewardAmount || 0) * 100)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`funding-pill font-mono text-xs ${
                              b.fundingStatus === "FUNDED"
                                ? "funding-funded"
                                : b.fundingStatus === "FULLY_DISBURSED"
                                ? "funding-disbursed"
                                : "funding-unfunded"
                            }`}
                          >
                            {b.fundingStatus || "UNFUNDED"}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn btn-sm btn-table-view"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectBounty(bountyKey);
                            }}
                          >
                            <span>Inspect</span>
                            <ExternalLinkIcon width="10" height="10" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="dash-pagination-bar">
              <span className="pagination-info font-mono text-xs text-muted">
                Page {page} of {totalPages} ({totalCount} total records)
              </span>
              <div className="pagination-buttons">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={page <= 1 || loading}
                  onClick={() => fetchData(page - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => fetchData(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Console Quick Overview & Payout Profile */}
        <div className="dash-sidebar-col">
          {/* Quick Actions Panel */}
          <div className="dash-side-panel">
            <h3 className="side-panel-title">Console Actions</h3>
            <div className="side-action-list">
              <button
                type="button"
                className="side-action-item whitespace-nowrap"
                onClick={onCreateBounty}
              >
                <div className="side-action-icon text-accent">
                  <GitIssueIcon />
                </div>
                <div className="side-action-text">
                  <span className="action-title">Create Milestone Bounty</span>
                  <span className="action-desc">Link GitHub issue and configure escrow</span>
                </div>
              </button>

              <button
                type="button"
                className="side-action-item whitespace-nowrap"
                onClick={onExploreMarketplace}
              >
                <div className="side-action-icon text-cool">
                  <GitForkIcon />
                </div>
                <div className="side-action-text">
                  <span className="action-title">Explore Open Bounties</span>
                  <span className="action-desc">Filter available issues and claim milestones</span>
                </div>
              </button>

              <button
                type="button"
                className="side-action-item whitespace-nowrap"
                onClick={onOpenProfile}
              >
                <div className="side-action-icon text-amber">
                  <UserIcon />
                </div>
                <div className="side-action-text">
                  <span className="action-title">Payout & Security Settings</span>
                  <span className="action-desc">
                    {payoutConfigured
                      ? `PayPal: ${maskedPayoutEmail || "Configured"}`
                      : "Configure PayPal payout recipient"}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Escrow Programmatic Ledger Disclaimer */}
          <div className="dash-side-panel side-panel-info">
            <div className="info-badge-row">
              <LockIcon width="12" height="12" className="text-accent" />
              <span className="info-badge-text font-mono text-xs">
                PayPal Authoritative Escrow
              </span>
            </div>
            <p className="side-panel-body">
              GitEscrow ledger entries record programmatic conditions for milestone releases. Funds are authoritatively authorized and disbursed directly through PayPal Sandbox Payouts.
            </p>
            <div className="side-panel-meta font-mono text-xs text-muted">
              <span>Environment: PayPal Sandbox</span>
              <span>Double-entry ledger</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
