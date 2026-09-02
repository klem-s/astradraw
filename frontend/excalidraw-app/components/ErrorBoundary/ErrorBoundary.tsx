import React from "react";

import { t } from "@excalidraw/excalidraw/i18n";

import styles from "./ErrorBoundary.module.scss";

export interface ErrorBoundaryProps {
  /** Custom fallback UI to render when an error is caught */
  fallback?: React.ReactNode | ((props: FallbackProps) => React.ReactNode);
  /** Callback fired when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Callback fired when the boundary is reset */
  onReset?: () => void;
  /** Children to render */
  children: React.ReactNode;
}

export interface FallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * A reusable error boundary component that catches JavaScript errors
 * in its child component tree and displays a fallback UI.
 *
 * Features:
 * - Customizable fallback UI (component or render prop)
 * - Reset capability to retry rendering
 * - Error callback for logging/reporting
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  resetErrorBoundary = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const { fallback } = this.props;

      // If fallback is a function, call it with props
      if (typeof fallback === "function") {
        return fallback({
          error: this.state.error,
          resetErrorBoundary: this.resetErrorBoundary,
        });
      }

      // If fallback is a React node, render it
      if (fallback) {
        return fallback;
      }

      // Default fallback if none provided
      return (
        <div className={styles.fallback}>
          <p>{t("errorBoundary.genericMessage")}</p>
          <button className={styles.retry} onClick={this.resetErrorBoundary}>
            {t("errorBoundary.retry")}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
