/**
 * GitEscrow Frontend API Client
 * Configured with credentialed requests (HttpOnly cookies) and error handling.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Array<{ field: string; message: string }>;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: Array<{ field: string; message: string }>;

  constructor(
    status: number,
    message: string,
    code?: string,
    details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let inFlightRefresh: Promise<boolean> | null = null;

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const config: RequestInit = {
    ...options,
    credentials: "include", // Includes HttpOnly cookies (access_token, refresh_token)
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err: any) {
    throw new ApiError(
      0,
      `Cannot connect to GitEscrow server (${err.message || "connection refused"}). Ensure the backend server is running on http://localhost:5000.`,
    );
  }

  // Attempt automatic session restoration if 401 and not already attempting refresh or auth endpoints
  if (
    response.status === 401 &&
    !endpoint.includes("/auth/login") &&
    !endpoint.includes("/auth/register") &&
    !endpoint.includes("/auth/refresh")
  ) {
    if (!inFlightRefresh) {
      inFlightRefresh = (async () => {
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
          return refreshRes.ok;
        } catch {
          return false;
        } finally {
          inFlightRefresh = null;
        }
      })();
    }

    const refreshSuccess = await inFlightRefresh;
    if (refreshSuccess) {
      // Retry original request once
      response = await fetch(url, config);
    }
  }

  const text = await response.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const errorMsg =
      data.error ||
      data.message ||
      `Request failed with HTTP ${response.status}`;
    throw new ApiError(response.status, errorMsg, data.code, data.details);
  }

  return data as T;
}
