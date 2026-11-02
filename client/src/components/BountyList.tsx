import { useState, useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { apiRequest } from '../api/client';
import type { IBounty, BountyStatus } from '../types/bounty';
import { GitForkIcon, GitIssueIcon, UserIcon, SearchIcon, RefreshIcon } from './Icons';
import { animateGridEntrance, animateCardHover } from '../motion/transitions';

interface BountyListProps {
  onSelectBounty: (bountyId: string) => void;
  onCreateNew?: () => void;
  isAuthenticated: boolean;
}

const STATUS_FILTERS: Array<{ label: string; value: string }> = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'OPEN' },
  { label: 'Assigned', value: 'ASSIGNED' },
  { label: 'In progress', value: 'IN_PROGRESS' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Drafts', value: 'DRAFT' }
];

export function BountyList({ onSelectBounty, onCreateNew, isAuthenticated }: BountyListProps) {
  const [bounties, setBounties] = useState<IBounty[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [, setTotalCount] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { contextSafe } = useGSAP(
    () => {
      if (!loading && bounties.length > 0 && containerRef.current) {
        animateGridEntrance('.bounty-card', containerRef.current);
      }
    },
    { dependencies: [bounties, loading], scope: containerRef }
  );

  const onCardMouseEnter = contextSafe((e: React.MouseEvent<HTMLDivElement>) => {
    animateCardHover(e.currentTarget, true);
  });

  const onCardMouseLeave = contextSafe((e: React.MouseEvent<HTMLDivElement>) => {
    animateCardHover(e.currentTarget, false);
  });

  const fetchBounties = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selectedStatus) params.append('status', selectedStatus);
      if (searchTerm.trim()) params.append('repository', searchTerm.trim());
      params.append('page', page.toString());
      params.append('limit', '12');

      const res = await apiRequest<{
        bounties: IBounty[];
        total: number;
        page: number;
        totalPages: number;
      }>(`/bounties?${params.toString()}`);

      setBounties(res.bounties || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load bounties.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBounties();
  }, [selectedStatus, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBounties();
  };

  const formatReward = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(amount);
  };

  const getStatusBadgeClass = (status: BountyStatus) => {
    switch (status) {
      case 'OPEN':
        return 'badge-open';
      case 'ASSIGNED':
      case 'IN_PROGRESS':
        return 'badge-progress';
      case 'SUBMITTED':
      case 'UNDER_REVIEW':
        return 'badge-submitted';
      case 'COMPLETED':
        return 'badge-completed';
      case 'CANCELLED':
      case 'EXPIRED':
        return 'badge-cancelled';
      case 'DRAFT':
      default:
        return 'badge-draft';
    }
  };

  const getStatusLabel = (status: BountyStatus) => {
    switch (status) {
      case 'OPEN':
        return 'open';
      case 'ASSIGNED':
        return 'assigned';
      case 'IN_PROGRESS':
        return 'in progress';
      case 'SUBMITTED':
        return 'submitted';
      case 'UNDER_REVIEW':
        return 'under review';
      case 'COMPLETED':
        return 'completed';
      case 'CANCELLED':
        return 'cancelled';
      case 'EXPIRED':
        return 'expired';
      case 'DRAFT':
      default:
        return 'draft';
    }
  };

  return (
    <div ref={containerRef} className="marketplace-container">
      {/* Marketplace Header */}
      <div className="marketplace-header">
        <div className="marketplace-header-text">
          <h1 className="marketplace-heading">Open-source bounty marketplace</h1>
          <p className="marketplace-lead">
            Discover verified GitHub issues, contribute solutions and earn milestone-based rewards.
          </p>
        </div>
        {isAuthenticated && onCreateNew && (
          <button type="button" className="btn btn-primary" onClick={onCreateNew}>
            Create bounty
          </button>
        )}
      </div>

      {/* Filter and Search Toolbar */}
      <div className="filter-search-bar">
        <div className="status-filter-group" role="tablist" aria-label="Filter bounties by status">
          {STATUS_FILTERS.map((f) => {
            const isSelected = selectedStatus === f.value;
            return (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`filter-tab ${isSelected ? 'filter-tab-active' : ''}`}
                onClick={() => {
                  setSelectedStatus(f.value);
                  setPage(1);
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSearchSubmit} className="search-form">
          <div className="search-input-wrapper">
            <SearchIcon className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search repository…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search repository"
            />
          </div>
          <button type="submit" className="btn btn-sm">
            Filter
          </button>
          {searchTerm && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setSearchTerm('');
                setPage(1);
                fetchBounties();
              }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="alert-box alert-error" role="alert">
          <div className="alert-message">
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={fetchBounties}
            disabled={loading}
          >
            <RefreshIcon />
            <span>Retry connection</span>
          </button>
        </div>
      )}

      {/* Loading state or Empty state or Grid */}
      {loading ? (
        <div className="loading-state">
          <p>Loading available bounties…</p>
        </div>
      ) : bounties.length === 0 ? (
        <div className="empty-state">
          <GitIssueIcon width="28" height="28" style={{ marginInline: 'auto', marginBottom: 'var(--space-sm)', color: 'var(--color-muted)' }} />
          <h3 className="empty-title">No bounties found</h3>
          <p className="empty-desc">
            {selectedStatus || searchTerm
              ? 'No bounties match your current filter criteria.'
              : 'There are currently no bounties published in the system.'}
          </p>
          <div className="empty-actions">
            {selectedStatus || searchTerm ? (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setSelectedStatus('');
                  setSearchTerm('');
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            ) : isAuthenticated && onCreateNew ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={onCreateNew}>
                Create bounty
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="bounty-grid">
            {bounties.map((b) => {
              const orgName =
                typeof b.organizationId === 'object' && b.organizationId?.name
                  ? b.organizationId.name
                  : 'Organization';
              const contributorName =
                typeof b.assignedContributorId === 'object' && b.assignedContributorId?.username
                  ? `@${b.assignedContributorId.username}`
                  : null;

              return (
                <div
                  key={b._id || b.id}
                  className="bounty-card"
                  onClick={() => onSelectBounty(b._id || b.id || '')}
                  onMouseEnter={onCardMouseEnter}
                  onMouseLeave={onCardMouseLeave}
                  tabIndex={0}
                  role="button"
                  aria-label={`View bounty: ${b.title}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectBounty(b._id || b.id || '');
                    }
                  }}
                >
                  <div className="bounty-card-header">
                    <span className={`status-badge ${getStatusBadgeClass(b.status)}`}>
                      {getStatusLabel(b.status)}
                    </span>
                    <span className="reward-tag measured">
                      {formatReward(b.rewardAmount, b.currency)}
                    </span>
                  </div>

                  <h3 className="bounty-card-title">{b.title}</h3>

                  <div className="bounty-card-repo">
                    <GitForkIcon />
                    <span className="repo-slug">{b.repositoryFullName}</span>
                    <span className="issue-num measured">#{b.issueNumber}</span>
                  </div>

                  <p className="bounty-card-desc">
                    {b.description.length > 130
                      ? `${b.description.slice(0, 130)}…`
                      : b.description}
                  </p>

                  <div className="bounty-card-footer">
                    <div className="bounty-org">
                      <span className="bounty-org-label">Org: </span>
                      <span className="bounty-org-name">{orgName}</span>
                      {orgName === 'Cyberdyne Systems' && (
                        <span className="badge-demo" title="Demonstration organization (application-generated)">Demo org</span>
                      )}
                    </div>

                    {contributorName ? (
                      <span className="contributor-tag">
                        <UserIcon />
                        <span>{contributorName}</span>
                      </span>
                    ) : (
                      <span className="unclaimed-tag">Open for claims</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="pagination-bar">
              <button
                type="button"
                className="btn btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="page-indicator measured">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="btn btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
