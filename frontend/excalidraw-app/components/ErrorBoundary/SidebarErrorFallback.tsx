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

/**
 * Error fallback specifically designed for the sidebar.
 * Compact design that fits within the sidebar width.
 */
export const SidebarErrorFallback: React.FC<Partial<FallbackProps>> = ({
  resetErrorBoundary,
}) => {
  return (
    <div className={`${styles.fallback} ${styles.sidebar}`}>
      <div className={styles.icon}>{alertIcon}</div>
      <p className={styles.message}>{t("errorBoundary.sidebarMessage")}</p>
      {resetErrorBoundary && (
        <button className={styles.retry} onClick={resetErrorBoundary}>
          {refreshIcon}
          {t("errorBoundary.retry")}
        </button>
      )}
    </div>
  );
};
