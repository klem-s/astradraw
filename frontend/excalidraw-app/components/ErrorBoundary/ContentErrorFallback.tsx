import React from "react";
import { t } from "@excalidraw/excalidraw/i18n";

import styles from "./ErrorBoundary.module.scss";

import type { FallbackProps } from "./ErrorBoundary";

// Icons
const alertIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const refreshIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const homeIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9,22 9,12 15,12 15,22" />
  </svg>
);

interface ContentErrorFallbackProps extends Partial<FallbackProps> {
  /** Optional callback to navigate home */
  onGoHome?: () => void;
}

/**
 * Error fallback for the main content area (dashboard, collection views).
 * Larger design with more context and optional "go home" action.
 */
export const ContentErrorFallback: React.FC<ContentErrorFallbackProps> = ({
  error,
  resetErrorBoundary,
  onGoHome,
}) => {
  return (
    <div className={`${styles.fallback} ${styles.content}`}>
      <div className={styles.icon}>{alertIcon}</div>
      <h3 className={styles.title}>{t("errorBoundary.contentTitle")}</h3>
      <p className={styles.message}>{t("errorBoundary.contentMessage")}</p>
      {error && (
        <details className={styles.details}>
          <summary>{t("errorBoundary.showDetails")}</summary>
          <pre>{error.message}</pre>
        </details>
      )}
      <div className={styles.actions}>
        {resetErrorBoundary && (
          <button className={styles.retry} onClick={resetErrorBoundary}>
            {refreshIcon}
            {t("errorBoundary.retry")}
          </button>
        )}
        {onGoHome && (
          <button className={styles.home} onClick={onGoHome}>
            {homeIcon}
            {t("errorBoundary.goHome")}
          </button>
        )}
      </div>
    </div>
  );
};
