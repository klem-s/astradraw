/**
 * Auth API client for workspace authentication
 */

const getApiBaseUrl = (): string => {
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

export interface AuthStatus {
  oidcConfigured: boolean;
  localAuthEnabled: boolean;
  registrationEnabled: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isSuperAdmin?: boolean;
}

export interface LocalLoginResult {
  success: boolean;
  user: User;
}

export interface RegisterResult {
  success: boolean;
  user: User;
}

/**
 * Check auth status and available methods
 */
export async function getAuthStatus(): Promise<AuthStatus> {
  const response = await fetch(`${getApiBaseUrl()}/auth/status`, {
    credentials: "include",
  });
  return response.json();
}

/**
 * Login with local username/password
 */
export async function loginLocal(
  username: string,
  password: string,
): Promise<LocalLoginResult> {
  const response = await fetch(`${getApiBaseUrl()}/auth/login/local`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Login failed");
  }

  return response.json();
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
      credentials: "include",
    });

    if (response.status === 401) {
      return null;
    }

    if (!response.ok) {
      throw new Error("Failed to get user");
    }

    return response.json();
  } catch {
    return null;
  }
}

/**
 * Get login URL - redirects to OIDC provider
 */
export function getLoginUrl(redirectPath?: string): string {
  const baseUrl = getApiBaseUrl();
  const redirect = redirectPath || window.location.pathname;
  return `${baseUrl}/auth/login?redirect=${encodeURIComponent(redirect)}`;
}

/**
 * Get logout URL
 */
export function getLogoutUrl(): string {
  return `${getApiBaseUrl()}/auth/logout`;
}

/**
 * Redirect to login
 */
export function redirectToLogin(redirectPath?: string): void {
  window.location.href = getLoginUrl(redirectPath);
}

/**
 * Logout the current user
 */
export function logout(): void {
  window.location.href = getLogoutUrl();
}

/**
 * Register a new user with email/password
 */
export async function register(
  email: string,
  password: string,
  name?: string,
): Promise<RegisterResult> {
  const response = await fetch(`${getApiBaseUrl()}/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, name }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "Registration failed");
  }

  return response.json();
}
