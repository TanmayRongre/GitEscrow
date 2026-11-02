import {
  GitHubUser,
  GitHubRepo,
  GitHubIssue,
  GitHubPullRequest,
  GitHubFileChange,
  GitHubReview,
  GitHubCheckRunsResponse,
  GitHubCombinedStatus,
  IssueListOptions
} from './types';

export class GitHubApiError extends Error {
  public readonly status: number;
  public readonly rateLimitRemaining?: number;
  public readonly rateLimitReset?: number;
  public readonly responseBody?: unknown;

  constructor(
    status: number,
    message: string,
    responseBody?: unknown,
    rateLimitRemaining?: number,
    rateLimitReset?: number
  ) {
    super(`GitHub API Error [${status}]: ${message}`);
    this.name = 'GitHubApiError';
    this.status = status;
    this.responseBody = responseBody;
    this.rateLimitRemaining = rateLimitRemaining;
    this.rateLimitReset = rateLimitReset;
    Object.setPrototypeOf(this, GitHubApiError.prototype);
  }
}

export interface GitHubClientConfig {
  token?: string;
  baseUrl?: string;
}

export class GitHubClient {
  private readonly token?: string;
  private readonly baseUrl: string;

  constructor(config?: string | GitHubClientConfig) {
    if (typeof config === 'string') {
      this.token = config.trim() || undefined;
      this.baseUrl = (process.env.GITHUB_API_BASE_URL || 'https://api.github.com').replace(/\/+$/, '');
    } else {
      this.token = config?.token?.trim() || process.env.GITHUB_TOKEN?.trim() || undefined;
      this.baseUrl = (config?.baseUrl || process.env.GITHUB_API_BASE_URL || 'https://api.github.com').replace(/\/+$/, '');
    }
  }

  private getHeaders(customAccept?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'GitEscrow-Platform/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
      Accept: customAccept || 'application/vnd.github+json'
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  private async request<T>(
    endpoint: string,
    customAccept?: string
  ): Promise<{ data: T; headers: Headers; status: number }> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${cleanEndpoint}`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: this.getHeaders(customAccept)
      });
    } catch (networkErr: any) {
      throw new GitHubApiError(0, `Network failure connecting to GitHub API: ${networkErr.message}`);
    }

    const rateLimitRemaining = res.headers.get('x-ratelimit-remaining')
      ? parseInt(res.headers.get('x-ratelimit-remaining')!, 10)
      : undefined;
    const rateLimitReset = res.headers.get('x-ratelimit-reset')
      ? parseInt(res.headers.get('x-ratelimit-reset')!, 10)
      : undefined;

    const isRaw = customAccept?.includes('diff') || customAccept?.includes('patch');
    const text = await res.text();

    if (!res.ok) {
      let errorJson: any = {};
      try {
        errorJson = JSON.parse(text);
      } catch {
        errorJson = { raw: text };
      }

      let errMessage = errorJson.message || res.statusText || `Request failed with HTTP ${res.status}`;
      if (res.status === 401) {
        errMessage = 'Bad credentials or expired GITHUB_TOKEN';
      } else if (res.status === 403 && rateLimitRemaining === 0) {
        errMessage = `API rate limit exceeded. Resets at ${new Date((rateLimitReset || 0) * 1000).toISOString()}`;
      } else if (res.status === 403) {
        errMessage = `Access forbidden: ${errorJson.message || 'Token lacks required permissions'}`;
      } else if (res.status === 404) {
        errMessage = `Resource not found: ${cleanEndpoint}`;
      } else if (res.status === 422) {
        errMessage = `Validation failed: ${errorJson.message || text}`;
      }

      throw new GitHubApiError(res.status, errMessage, errorJson, rateLimitRemaining, rateLimitReset);
    }

    if (isRaw) {
      return { data: text as unknown as T, headers: res.headers, status: res.status };
    }

    try {
      const data = JSON.parse(text) as T;
      return { data, headers: res.headers, status: res.status };
    } catch {
      return { data: text as unknown as T, headers: res.headers, status: res.status };
    }
  }

  /**
   * 1. Authenticate with GitHub and retrieve the authenticated user.
   */
  public async getAuthenticatedUser(): Promise<GitHubUser> {
    const res = await this.request<GitHubUser>('/user');
    return res.data;
  }

  /**
   * 2. Fetch repository information.
   */
  public async getRepository(owner: string, repo: string): Promise<GitHubRepo> {
    const res = await this.request<GitHubRepo>(`/repos/${owner}/${repo}`);
    return res.data;
  }

  /**
   * 3. Fetch list of issues (open, closed, or all) with pagination.
   */
  public async getIssues(
    owner: string,
    repo: string,
    options?: IssueListOptions
  ): Promise<GitHubIssue[]> {
    const params = new URLSearchParams();
    if (options?.state) params.set('state', options.state);
    if (options?.labels) params.set('labels', options.labels);
    if (options?.sort) params.set('sort', options.sort);
    if (options?.direction) params.set('direction', options.direction);
    if (options?.page) params.set('page', options.page.toString());
    if (options?.per_page) params.set('per_page', options.per_page.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<GitHubIssue[]>(`/repos/${owner}/${repo}/issues${query}`);
    return res.data;
  }

  /**
   * 4. Fetch an individual issue by issue number.
   */
  public async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    const res = await this.request<GitHubIssue>(`/repos/${owner}/${repo}/issues/${issueNumber}`);
    return res.data;
  }

  /**
   * 5. Fetch Pull Request details by PR number.
   */
  public async getPullRequest(owner: string, repo: string, pullNumber: number): Promise<GitHubPullRequest> {
    const res = await this.request<GitHubPullRequest>(`/repos/${owner}/${repo}/pulls/${pullNumber}`);
    return res.data;
  }

  /**
   * 6. Fetch changed files in a pull request with pagination.
   */
  public async getPullRequestFiles(
    owner: string,
    repo: string,
    pullNumber: number,
    page?: number,
    perPage?: number
  ): Promise<GitHubFileChange[]> {
    const params = new URLSearchParams();
    if (page) params.set('page', page.toString());
    if (perPage) params.set('per_page', perPage.toString());
    const query = params.toString() ? `?${params.toString()}` : '';

    const res = await this.request<GitHubFileChange[]>(
      `/repos/${owner}/${repo}/pulls/${pullNumber}/files${query}`
    );
    return res.data;
  }

  /**
   * 7a. Fetch raw unified diff for a pull request (application/vnd.github.v3.diff).
   */
  public async getPullRequestDiff(owner: string, repo: string, pullNumber: number): Promise<string> {
    const res = await this.request<string>(
      `/repos/${owner}/${repo}/pulls/${pullNumber}`,
      'application/vnd.github.v3.diff'
    );
    return res.data;
  }

  /**
   * 7b. Fetch patch content for a pull request (application/vnd.github.v3.patch).
   */
  public async getPullRequestPatch(owner: string, repo: string, pullNumber: number): Promise<string> {
    const res = await this.request<string>(
      `/repos/${owner}/${repo}/pulls/${pullNumber}`,
      'application/vnd.github.v3.patch'
    );
    return res.data;
  }

  /**
   * 8. Fetch PR review information.
   */
  public async getPullRequestReviews(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<GitHubReview[]> {
    const res = await this.request<GitHubReview[]>(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`);
    return res.data;
  }

  /**
   * 9a. Fetch CI check-run status for a commit ref.
   */
  public async getCommitCheckRuns(
    owner: string,
    repo: string,
    ref: string
  ): Promise<GitHubCheckRunsResponse> {
    const res = await this.request<GitHubCheckRunsResponse>(`/repos/${owner}/${repo}/commits/${ref}/check-runs`);
    return res.data;
  }

  /**
   * 9b. Fetch combined commit status (legacy Commit Status API) for a commit ref.
   */
  public async getCombinedStatus(
    owner: string,
    repo: string,
    ref: string
  ): Promise<GitHubCombinedStatus> {
    const res = await this.request<GitHubCombinedStatus>(`/repos/${owner}/${repo}/commits/${ref}/status`);
    return res.data;
  }
}
