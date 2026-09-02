/**
 * Base API client with centralized error handling
 */

export const getApiBaseUrl = (): string => {
  // First check runtime env (Docker) - window.__ENV__ is set by env-config.js
  const runtimeEnv = (window as { __ENV__?: Record<string, string> }).__ENV__;
  if (runtimeEnv?.VITE_APP_HTTP_STORAGE_BACKEND_URL) {
    return runtimeEnv.VITE_APP_HTTP_STORAGE_BACKEND_URL;
  }
  // Fallback to build-time env (development)
  const envUrl = import.meta.env.VITE_APP_HTTP_STORAGE_BACKEND_URL;
  if (envUrl) {
    return envUrl;
  }
  // Fallback to same origin
  return `${window.location.origin}/api/v2`;
};

/**
 * Custom error class for API errors with status code
 */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Get error message from response based on status code
 */
async function getErrorMessage(
  response: Response,
  defaultMessage: string,
): Promise<string> {
  // Try to extract message from JSON response
  try {
    const json = await response.json();
    if (json.message) {
      return json.message;
    }
  } catch {
    // Response is not JSON, use default
  }

  // Standard error messages based on status
  switch (response.status) {
    case 401:
      return "Not authenticated";
    case 403:
      return "Access denied";
    case 404:
      return "Not found";
    case 409:
      return "Conflict";
    case 413:
      return "Request too large";
    default:
      return defaultMessage;
  }
}

/**
 * Base API request function with automatic error handling
 */
export async function apiRequest<T>(
  path: string,
  options?: RequestInit & { errorMessage?: string },
): Promise<T> {
  const { errorMessage = "Request failed", ...fetchOptions } = options || {};

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    credentials: "include",
    ...fetchOptions,
  });

  if (!response.ok) {
    const message = await getErrorMessage(response, errorMessage);
    throw new ApiError(response.status, message);
  }

  return response.json();
}

/**
 * API request that returns raw response (for binary data like ArrayBuffer)
 */
export async function apiRequestRaw(
  path: string,
  options?: RequestInit & { errorMessage?: string },
): Promise<Response> {
  const { errorMessage = "Request failed", ...fetchOptions } = options || {};

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    credentials: "include",
    ...fetchOptions,
  });

  if (!response.ok) {
    const message = await getErrorMessage(response, errorMessage);
    throw new ApiError(response.status, message);
  }

  return response;
}

/**
 * Helper to create JSON body request options
 */
export function jsonBody(data: unknown): RequestInit {
  return {
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  };
}

/**
 * Helper to create binary body request options
 */
export function binaryBody(data: Blob | ArrayBuffer): RequestInit {
  return {
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: data,
  };
}
