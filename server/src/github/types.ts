/**
 * GitEscrow GitHub API Types
 * Based on GitHub REST API version 2022-11-28.
 */

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url?: string;
  html_url?: string;
  type?: string;
  site_admin?: boolean;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubUser;
  html_url: string;
  description: string | null;
  fork: boolean;
  default_branch: string;
  open_issues_count: number;
  stargazers_count: number;
  forks_count: number;
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    triage?: boolean;
    pull?: boolean;
  };
}

export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description?: string | null;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  user: GitHubUser | null;
  labels: GitHubLabel[];
  comments: number;
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  pull_request?: {
    url?: string;
    html_url?: string;
    diff_url?: string;
    patch_url?: string;
  };
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  locked: boolean;
  merged: boolean;
  mergeable: boolean | null;
  mergeable_state: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  user: GitHubUser | null;
  html_url: string;
  diff_url: string;
  patch_url: string;
  head: {
    label: string;
    ref: string;
    sha: string;
    user: GitHubUser;
    repo: GitHubRepo | null;
  };
  base: {
    label: string;
    ref: string;
    sha: string;
    user: GitHubUser;
    repo: GitHubRepo;
  };
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface GitHubFileChange {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  blob_url?: string;
  raw_url?: string;
  contents_url?: string;
  patch?: string;
  previous_filename?: string;
}

export interface GitHubReview {
  id: number;
  user: GitHubUser | null;
  body: string | null;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
  html_url: string;
  submitted_at: string | null;
  commit_id: string;
}

export interface GitHubCheckRun {
  id: number;
  name: string;
  head_sha: string;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required' | 'skipped' | 'stale' | null;
  started_at: string | null;
  completed_at: string | null;
  html_url: string | null;
  app: {
    id: number;
    slug?: string;
    name: string;
  } | null;
}

export interface GitHubCheckRunsResponse {
  total_count: number;
  check_runs: GitHubCheckRun[];
}

export interface GitHubCombinedStatus {
  state: 'pending' | 'success' | 'failure' | 'error';
  sha: string;
  total_count: number;
  statuses: Array<{
    id: number;
    state: string;
    description: string | null;
    target_url: string | null;
    context: string;
    created_at: string;
    updated_at: string;
  }>;
  repository: GitHubRepo;
  commit_url: string;
}

export interface IssueListOptions {
  state?: 'open' | 'closed' | 'all';
  labels?: string;
  sort?: 'created' | 'updated' | 'comments';
  direction?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

