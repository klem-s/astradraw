import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

import { appJotaiStore, authUserAtom } from "../app-jotai";
import { clearWorkspaceDataAtom } from "../components/Settings/settingsState";

import {
  getAuthStatus,
  getCurrentUser,
  redirectToLogin,
  loginLocal as loginLocalApi,
  logout as logoutApi,
  register as registerApi,
  type User,
} from "./authApi";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  oidcConfigured: boolean;
  localAuthEnabled: boolean;
  registrationEnabled: boolean;
  login: (redirectPath?: string) => void;
  loginLocal: (username: string, password: string) => Promise<boolean>;
  register: (
    email: string,
    password: string,
    name?: string,
  ) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [oidcConfigured, setOidcConfigured] = useState(false);
  const [localAuthEnabled, setLocalAuthEnabled] = useState(false);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error("Failed to refresh user:", error);
      setUser(null);
    }
  }, []);

  // Sync user state to Jotai atom for cross-component access (e.g., Collab class component)
  useEffect(() => {
    if (user) {
      appJotaiStore.set(authUserAtom, {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
      });
    } else {
      appJotaiStore.set(authUserAtom, null);
    }
  }, [user]);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Check auth status
        const status = await getAuthStatus();
        setOidcConfigured(status.oidcConfigured);
        setLocalAuthEnabled(status.localAuthEnabled);
        setRegistrationEnabled(status.registrationEnabled);

        // Try to get current user (might be already logged in via cookie)
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        // Check for auth callback result in URL
        if (window.location.hash.includes("auth=success")) {
          // Clean up URL
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.search,
          );
          // Refresh user after successful auth
          await refreshUser();
        }

        // Check for auth error in URL
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get("error");
        if (error) {
          console.error("Auth error:", error);
          // Clean up URL
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
        }
      } catch (error) {
        console.error("Failed to initialize auth:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, [refreshUser]);

  const login = useCallback((redirectPath?: string) => {
    redirectToLogin(redirectPath);
  }, []);

  const loginLocal = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      try {
        const result = await loginLocalApi(username, password);
        if (result.success && result.user) {
          setUser(result.user);
          return true;
        }
        return false;
      } catch (error) {
        console.error("Local login failed:", error);
        return false;
      }
    },
    [],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      name?: string,
    ): Promise<boolean> => {
      try {
        const result = await registerApi(email, password, name);
        if (result.success && result.user) {
          setUser(result.user);
          return true;
        }
        return false;
      } catch (error) {
        console.error("Registration failed:", error);
        throw error; // Re-throw to let the UI show the error message
      }
    },
    [],
  );

  const logout = useCallback(() => {
    logoutApi();
    setUser(null);
    // Clear all workspace data and signal logout
    // This triggers logoutSignalAtom which App.tsx subscribes to for canvas reset
    appJotaiStore.set(clearWorkspaceDataAtom);
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    oidcConfigured,
    localAuthEnabled,
    registrationEnabled,
    login,
    loginLocal,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
