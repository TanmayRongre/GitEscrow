import { useState, useEffect, useRef } from 'react';
import { useGSAP } from '@gsap/react';
import { apiRequest } from '../api/client';
import type { IOrganization } from '../types/bounty';
import type { IIssueAnalysisResult, ISuggestedMilestone } from '../types/ai';
import { CheckIcon, AlertIcon, SparkleIcon } from './Icons';
import { animateItemSlideIn } from '../motion/transitions';
import { AIAnalysisReviewModal } from './AIAnalysisReviewModal';

interface MilestoneDraft {
  order: number;
  title: string;
  description: string;
  rewardAmount: number;
  acceptanceCriteria: string[];
}

interface CreateBountyFormProps {
  onBountyCreated: (bountyId: string) => void;
  onCancel: () => void;
}

export function CreateBountyForm({ onBountyCreated, onCancel }: CreateBountyFormProps) {
  const [organizations, setOrganizations] = useState<IOrganization[]>([]);
  const [orgLoading, setOrgLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [newOrgName, setNewOrgName] = useState<string>('');
  const [showNewOrgInput, setShowNewOrgInput] = useState<boolean>(false);

  const [repoOwner, setRepoOwner] = useState<string>('mock-owner');
  const [repoName, setRepoName] = useState<string>('escrow-repo');
  const [issueNumber, setIssueNumber] = useState<number>(42);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [rewardAmount, setRewardAmount] = useState<number>(100);
  const [publishImmediately, setPublishImmediately] = useState<boolean>(true);

  // AI Analysis State
  const [analyzingAI, setAnalyzingAI] = useState<boolean>(false);
  const [aiModalOpen, setAIModalOpen] = useState<boolean>(false);
  const [aiAnalysisResult, setAIAnalysisResult] = useState<IIssueAnalysisResult | null>(null);
  const [aiSuccessNotice, setAISuccessNotice] = useState<string | null>(null);

  // Milestones State
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    {
      order: 1,
      title: 'Milestone 1: Core implementation',
      description: 'Implement core logic and wire with repository test harness.',
      rewardAmount: 60,
      acceptanceCriteria: ['Unit tests pass', 'Follows codebase conventions']
    },
    {
      order: 2,
      title: 'Milestone 2: Integration and verification',
      description: 'End-to-end integration and documentation updates.',
      rewardAmount: 40,
      acceptanceCriteria: ['Passes CI check-runs', 'Updated documentation']
    }
  ]);

  const containerRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(milestones.length);

  useGSAP(
    () => {
      if (milestones.length > prevCountRef.current && containerRef.current) {
        const rows = containerRef.current.querySelectorAll('.milestone-editor-row');
        const lastRow = rows[rows.length - 1];
        if (lastRow) {
          animateItemSlideIn(lastRow);
        }
      }
      prevCountRef.current = milestones.length;
    },
    { dependencies: [milestones.length], scope: containerRef }
  );

  // Load user organizations
  const loadOrgs = async () => {
    try {
      setOrgLoading(true);
      const res = await apiRequest<{ organizations: IOrganization[] }>('/organizations');
      const orgs = res.organizations || [];
      setOrganizations(orgs);
      if (orgs.length > 0) {
        setSelectedOrgId(orgs[0]._id || orgs[0].id || '');
      } else {
        setShowNewOrgInput(true);
      }
    } catch (err: any) {
      console.warn('Could not load organizations:', err.message);
      setShowNewOrgInput(true);
    } finally {
      setOrgLoading(false);
    }
  };

  useEffect(() => {
    loadOrgs();
  }, []);

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    try {
      setSubmitting(true);
      setError(null);
      const slug = newOrgName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const res = await apiRequest<{ organization: IOrganization }>('/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: newOrgName.trim(), slug })
      });
      const created = res.organization;
      setOrganizations((prev) => [...prev, created]);
      setSelectedOrgId(created._id || created.id || '');
      setShowNewOrgInput(false);
      setNewOrgName('');
    } catch (err: any) {
      setError(err.message || 'Failed to create organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnalyzeWithAI = async () => {
    if (!repoOwner.trim() || !repoName.trim() || !issueNumber) {
      setError('Please specify repository owner, name, and issue number before running AI analysis.');
      return;
    }
    try {
      setAnalyzingAI(true);
      setError(null);
      setAISuccessNotice(null);

      const res = await apiRequest<{ success: boolean; analysis: IIssueAnalysisResult }>('/ai/analyze-issue', {
        method: 'POST',
        body: JSON.stringify({
          repositoryOwner: repoOwner.trim(),
          repositoryName: repoName.trim(),
          issueNumber: Number(issueNumber),
          totalRewardAmount: Number(rewardAmount) || 100
        })
      });

      setAIAnalysisResult(res.analysis);
      setAIModalOpen(true);
    } catch (err: any) {
      setError(`AI analysis request failed: ${err.message || 'Unable to analyze issue'}`);
    } finally {
      setAnalyzingAI(false);
    }
  };

  const handleApplyAISuggestions = (approvedMilestones: ISuggestedMilestone[], updatedSummary: string) => {
    if (updatedSummary) {
      setDescription(updatedSummary);
    }
    if (aiAnalysisResult?.issue.title && (!title || title === '')) {
      setTitle(`Resolve: ${aiAnalysisResult.issue.title}`);
    }

    const mapped: MilestoneDraft[] = approvedMilestones.map((m) => ({
      order: m.order,
      title: m.title,
      description: m.description,
      rewardAmount: m.suggestedAmount,
      acceptanceCriteria: [...m.acceptanceCriteria]
    }));
    setMilestones(mapped);

    const newTotal = mapped.reduce((acc, m) => acc + m.rewardAmount, 0);
    if (newTotal > 0) {
      setRewardAmount(Math.round(newTotal * 100) / 100);
    }

    setAIModalOpen(false);
    setAISuccessNotice('AI milestone criteria successfully applied to draft! Review the milestones below before saving.');
  };

  const handleAddMilestone = () => {
    const nextOrder = milestones.length + 1;
    setMilestones((prev) => [
      ...prev,
      {
        order: nextOrder,
        title: `Milestone ${nextOrder}: Task deliverable`,
        description: '',
        rewardAmount: 0,
        acceptanceCriteria: ['Acceptance criterion 1']
      }
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    if (milestones.length <= 1) return;
    const updated = milestones.filter((_, i) => i !== index);
    const reindexed = updated.map((m, idx) => ({ ...m, order: idx + 1 }));
    setMilestones(reindexed);
  };

  const handleUpdateMilestone = (index: number, patch: Partial<MilestoneDraft>) => {
    setMilestones((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      return copy;
    });
  };

  const handleAddCriterion = (milestoneIndex: number) => {
    setMilestones((prev) => {
      const copy = [...prev];
      copy[milestoneIndex] = {
        ...copy[milestoneIndex],
        acceptanceCriteria: [...copy[milestoneIndex].acceptanceCriteria, '']
      };
      return copy;
    });
  };

  const handleUpdateCriterion = (milestoneIndex: number, critIndex: number, value: string) => {
    setMilestones((prev) => {
      const copy = [...prev];
      const criteria = [...copy[milestoneIndex].acceptanceCriteria];
      criteria[critIndex] = value;
      copy[milestoneIndex] = { ...copy[milestoneIndex], acceptanceCriteria: criteria };
      return copy;
    });
  };

  const handleRemoveCriterion = (milestoneIndex: number, critIndex: number) => {
    setMilestones((prev) => {
      const copy = [...prev];
      const criteria = copy[milestoneIndex].acceptanceCriteria.filter((_, i) => i !== critIndex);
      copy[milestoneIndex] = {
        ...copy[milestoneIndex],
        acceptanceCriteria: criteria.length > 0 ? criteria : ['Default criterion']
      };
      return copy;
    });
  };

  const milestonesSum = milestones.reduce((acc, m) => acc + (Number(m.rewardAmount) || 0), 0);
  const sumsMatch = Math.round(milestonesSum * 100) === Math.round(rewardAmount * 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedOrgId) {
      setError('Please select or create an organization first.');
      return;
    }

    if (!repoOwner.trim() || !repoName.trim() || !issueNumber) {
      setError('Repository owner, name, and issue number are required.');
      return;
    }

    if (!title.trim() || title.trim().length < 3) {
      setError('Bounty title must be at least 3 characters long.');
      return;
    }

    if (!description.trim() || description.trim().length < 10) {
      setError('Bounty description must be at least 10 characters long.');
      return;
    }

    if (publishImmediately && !sumsMatch) {
      setError(
        `Cannot publish immediately: the sum of milestone rewards ($${milestonesSum.toFixed(
          2
        )}) must equal the bounty reward ($${rewardAmount.toFixed(2)}).`
      );
      return;
    }

    try {
      setSubmitting(true);

      const createBountyPayload = {
        title: title.trim(),
        description: description.trim(),
        organizationId: selectedOrgId,
        repositoryOwner: repoOwner.trim(),
        repositoryName: repoName.trim(),
        issueNumber: Number(issueNumber),
        rewardAmount: Number(rewardAmount),
        currency: 'USD'
      };

      const bountyRes = await apiRequest<{ message: string; bounty: any }>('/bounties', {
        method: 'POST',
        body: JSON.stringify(createBountyPayload)
      });

      const newBountyId = bountyRes.bounty._id || bountyRes.bounty.id;

      for (const m of milestones) {
        const cleanedCriteria = m.acceptanceCriteria
          .map((c) => c.trim())
          .filter((c) => c.length > 0);

        await apiRequest(`/bounties/${newBountyId}/milestones`, {
          method: 'POST',
          body: JSON.stringify({
            title: m.title.trim(),
            description: m.description.trim() || 'Milestone deliverable',
            order: m.order,
            rewardAmount: Number(m.rewardAmount),
            currency: 'USD',
            acceptanceCriteria: cleanedCriteria.length > 0 ? cleanedCriteria : ['Completed task']
          })
        });
      }

      if (publishImmediately) {
        await apiRequest(`/bounties/${newBountyId}/publish`, {
          method: 'POST'
        });
      }

      onBountyCreated(newBountyId);
    } catch (err: any) {
      setError(err.message || 'Failed to create bounty.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={containerRef} className="create-bounty-container">
      <div className="form-panel">
        <div className="form-header">
          <div>
            <h2 className="section-title">Create new escrow bounty</h2>
            <p className="section-subtitle">
              Link an active GitHub issue and define milestone deliverables backed by escrow.
            </p>
          </div>
          <button type="button" className="btn btn-sm" onClick={onCancel}>
            Cancel
          </button>
        </div>

        {error && (
          <div className="alert-box alert-error">
            <span>{error}</span>
          </div>
        )}

        {aiSuccessNotice && (
          <div className="alert-box alert-ok">
            <div className="alert-message">
              <CheckIcon width="14" height="14" className="text-[var(--color-ok)] shrink-0" />
              <span>{aiSuccessNotice}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Organization Selection */}
          <div className="form-section">
            <h3 className="section-label">Sponsoring organization</h3>
            {orgLoading ? (
              <p className="hint-text">Loading organizations…</p>
            ) : showNewOrgInput || organizations.length === 0 ? (
              <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="New organization name (e.g. Acme OSS)"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleCreateOrg}
                  disabled={submitting || !newOrgName.trim()}
                >
                  Create
                </button>
                {organizations.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setShowNewOrgInput(false)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                <select
                  className="input-field"
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                >
                  {organizations.map((org) => (
                    <option key={org._id || org.id} value={org._id || org.id}>
                      {org.name} ({org.slug})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setShowNewOrgInput(true)}
                >
                  New organization
                </button>
              </div>
            )}
          </div>

          {/* GitHub Issue Details */}
          <div className="form-section">
            <h3 className="section-label">GitHub repository and issue reference</h3>
            <p className="hint-text">
              GitEscrow verifies this issue against the GitHub REST API upon creation.
            </p>
            <div className="grid-3">
              <div>
                <label className="field-label">Repository owner</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. mock-owner"
                  value={repoOwner}
                  onChange={(e) => setRepoOwner(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label">Repository name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. escrow-repo"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="field-label">Issue number</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="e.g. 42"
                  value={issueNumber}
                  onChange={(e) => setIssueNumber(Number(e.target.value))}
                  min={1}
                  required
                />
              </div>
            </div>

            {/* AI Issue Decomposition Action */}
            <div className="mt-3 flex items-center justify-between p-3 rounded-[var(--radius-card)] bg-[var(--color-paper-2)] border border-[var(--color-rule-2)]">
              <div className="flex items-center gap-2">
                <span className="badge-ai">
                  <SparkleIcon width="12" height="12" />
                  AI assistant
                </span>
                <span className="text-xs text-[var(--color-muted)]">
                  Deconstruct issue into structured milestones & acceptance criteria.
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm flex items-center gap-1.5 whitespace-nowrap"
                onClick={handleAnalyzeWithAI}
                disabled={analyzingAI || !repoOwner.trim() || !repoName.trim() || !issueNumber}
              >
                {analyzingAI ? (
                  <span className="whitespace-nowrap">Analyzing…</span>
                ) : (
                  <span className="whitespace-nowrap flex items-center gap-1.5">
                    <SparkleIcon width="12" height="12" />
                    AI Analyze
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Bounty Metadata */}
          <div className="form-section">
            <h3 className="section-label">Bounty specifications</h3>
            <div className="form-group">
              <label className="field-label">Bounty title</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Refactor payment webhooks and add signature validation"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="field-label">Total escrow reward (USD)</label>
              <div className="reward-input-group">
                <span className="currency-prefix">$</span>
                <input
                  type="number"
                  className="input-field reward-input measured"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(Number(e.target.value))}
                  min={1}
                  step="0.01"
                  required
                />
                <span className="currency-suffix">USD</span>
              </div>
            </div>

            <div className="form-group">
              <label className="field-label">Bounty scope and description</label>
              <textarea
                className="input-field textarea-field"
                rows={4}
                placeholder="Describe the expected solution, deliverables, constraints, and architecture guidelines…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Dynamic Milestones Section */}
          <div className="form-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
              <div>
                <h3 className="section-label">Escrow milestones</h3>
                <p className="hint-text">
                  Break down the bounty into measurable milestones with clear acceptance criteria.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={handleAddMilestone}
              >
                Add milestone
              </button>
            </div>

            <div className={`milestone-validation-pill ${sumsMatch ? 'pill-match' : 'pill-mismatch'}`}>
              {sumsMatch ? <CheckIcon /> : <AlertIcon />}
              <span>
                Milestones total: <strong className="measured">${milestonesSum.toFixed(2)}</strong> / Bounty total:{' '}
                <strong className="measured">${rewardAmount.toFixed(2)}</strong>
              </span>
              {!sumsMatch && (
                <span style={{ fontSize: 'var(--text-xs)', opacity: 0.85 }}>
                  (Difference: <span className="measured">${(rewardAmount - milestonesSum).toFixed(2)}</span>)
                </span>
              )}
            </div>

            <div className="milestones-editor-list">
              {milestones.map((m, mIdx) => (
                <div key={mIdx} className="milestone-editor-row">
                  <div className="milestone-editor-header">
                    <span className="measured" style={{ color: 'var(--color-accent)', fontSize: 'var(--text-xs)' }}>
                      Milestone {m.order}
                    </span>
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        className="btn-link"
                        style={{ color: 'var(--color-bad)' }}
                        onClick={() => handleRemoveMilestone(mIdx)}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid-2">
                    <div>
                      <label className="field-label">Milestone title</label>
                      <input
                        type="text"
                        className="input-field"
                        value={m.title}
                        onChange={(e) => handleUpdateMilestone(mIdx, { title: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="field-label">Milestone reward (USD)</label>
                      <input
                        type="number"
                        className="input-field measured"
                        value={m.rewardAmount}
                        onChange={(e) =>
                          handleUpdateMilestone(mIdx, { rewardAmount: Number(e.target.value) })
                        }
                        min={0}
                        step="0.01"
                        required
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: 'var(--space-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2xs)' }}>
                      <span className="field-label">Acceptance criteria</span>
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => handleAddCriterion(mIdx)}
                      >
                        Add criterion
                      </button>
                    </div>

                    {m.acceptanceCriteria.map((crit, cIdx) => (
                      <div key={cIdx} className="criterion-row">
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Criterion detail…"
                          value={crit}
                          onChange={(e) => handleUpdateCriterion(mIdx, cIdx, e.target.value)}
                          required
                        />
                        {m.acceptanceCriteria.length > 1 && (
                          <button
                            type="button"
                            className="btn-link"
                            style={{ color: 'var(--color-muted)' }}
                            onClick={() => handleRemoveCriterion(mIdx, cIdx)}
                          >
                            remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginBlock: 'var(--space-md)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={publishImmediately}
                onChange={(e) => setPublishImmediately(e.target.checked)}
              />
              <span>Publish bounty immediately (sets status to open)</span>
            </label>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || (publishImmediately && !sumsMatch)}
            >
              {submitting ? 'Creating bounty…' : publishImmediately ? 'Create and publish' : 'Save draft'}
            </button>
          </div>
        </form>
      </div>

      {aiModalOpen && aiAnalysisResult && (
        <AIAnalysisReviewModal
          analysis={aiAnalysisResult}
          onApply={handleApplyAISuggestions}
          onClose={() => setAIModalOpen(false)}
        />
      )}
    </div>
  );
}
