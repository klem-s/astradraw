import React, { useState, useRef, useEffect, useCallback } from "react";
import { t } from "@excalidraw/excalidraw/i18n";
import { Tooltip } from "@excalidraw/excalidraw/components/Tooltip";

import styles from "./SaveStatusIndicator.module.scss";

export type SaveStatus = "saved" | "saving" | "pending" | "error" | "offline";

// Icons
const CheckCircleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const SpinnerIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={styles.statusIconSpinning}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const DotIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={styles.statusIconPulsing}
  >
    <circle cx="12" cy="12" r="4" />
  </svg>
);

const AlertTriangleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const WifiOffIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
    <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  lastSavedTime: Date | null;
  sceneTitle: string;
  onTitleChange: (newTitle: string) => Promise<void>;
  onRetry: () => void;
  isMobile?: boolean;
}

const formatRelativeTime = (date: Date): string => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 10) {
    return t("saveStatus.justNow");
  }
  if (seconds < 60) {
    return t("saveStatus.secondsAgo", { count: seconds });
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return t("saveStatus.minutesAgo", { count: minutes });
  }

  const hours = Math.floor(minutes / 60);
  return t("saveStatus.hoursAgo", { count: hours });
};

const statusConfig: Record<
  SaveStatus,
  {
    icon: React.ReactNode;
    colorClass: string;
    getText: (isMobile: boolean) => string;
  }
> = {
  saved: {
    icon: <CheckCircleIcon />,
    colorClass: styles.statusSaved,
    getText: () => t("saveStatus.saved"),
  },
  saving: {
    icon: <SpinnerIcon />,
    colorClass: styles.statusSaving,
    getText: () => t("saveStatus.saving"),
  },
  pending: {
    icon: <DotIcon />,
    colorClass: styles.statusPending,
    getText: (isMobile) =>
      isMobile ? t("saveStatus.pendingShort") : t("saveStatus.pending"),
  },
  error: {
    icon: <AlertTriangleIcon />,
    colorClass: styles.statusError,
    getText: () => t("saveStatus.error"),
  },
  offline: {
    icon: <WifiOffIcon />,
    colorClass: styles.statusOffline,
    getText: () => t("saveStatus.offline"),
  },
};

export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({
  status,
  lastSavedTime,
  sceneTitle,
  onTitleChange,
  onRetry,
  isMobile = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(sceneTitle);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update editValue when sceneTitle changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditValue(sceneTitle);
    }
  }, [sceneTitle, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleTitleClick = useCallback(() => {
    if (!isSavingTitle) {
      setIsEditing(true);
    }
  }, [isSavingTitle]);

  const handleSaveTitle = useCallback(async () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== sceneTitle) {
      setIsSavingTitle(true);
      try {
        await onTitleChange(trimmedValue);
      } catch (error) {
        console.error("Failed to save title:", error);
        // Revert to original title on error
        setEditValue(sceneTitle);
      } finally {
        setIsSavingTitle(false);
      }
    } else {
      // Revert if empty or unchanged
      setEditValue(sceneTitle);
    }
    setIsEditing(false);
  }, [editValue, sceneTitle, onTitleChange]);

  const handleCancelEdit = useCallback(() => {
    setEditValue(sceneTitle);
    setIsEditing(false);
  }, [sceneTitle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Stop propagation to prevent Excalidraw shortcuts
      e.stopPropagation();

      if (e.key === "Enter") {
        e.preventDefault();
        handleSaveTitle();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancelEdit();
      }
    },
    [handleSaveTitle, handleCancelEdit],
  );

  const handleKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Stop propagation to prevent Excalidraw shortcuts
      e.stopPropagation();
    },
    [],
  );

  const handleStatusClick = useCallback(() => {
    if (status === "error") {
      onRetry();
    }
  }, [status, onRetry]);

  const config = statusConfig[status];
  const showTimestamp = status === "saved" && lastSavedTime && !isMobile;
  const isClickable = status === "error";

  const indicatorClasses = [
    styles.indicator,
    isMobile ? styles.indicatorMobile : "",
  ]
    .filter(Boolean)
    .join(" ");

  const inputClasses = [
    styles.sceneTitleInput,
    isSavingTitle ? styles.sceneTitleInputSaving : "",
  ]
    .filter(Boolean)
    .join(" ");

  const statusClasses = [
    styles.status,
    config.colorClass,
    isClickable ? styles.statusClickable : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={indicatorClasses}>
      {/* Scene Title */}
      <div className={styles.sceneTitle}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className={inputClasses}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            disabled={isSavingTitle}
            aria-label={t("saveStatus.sceneTitle")}
          />
        ) : (
          <button
            type="button"
            className={styles.sceneTitleText}
            onClick={handleTitleClick}
            title={sceneTitle}
          >
            {sceneTitle}
          </button>
        )}
      </div>

      {/* Separator */}
      <span className={styles.separator}>•</span>

      {/* Save Status */}
      {isClickable ? (
        <Tooltip label={t("saveStatus.clickToRetry")}>
          <div
            className={statusClasses}
            onClick={handleStatusClick}
            role="alert"
            aria-live="polite"
          >
            <span className={styles.statusIcon}>{config.icon}</span>
            <span className={styles.statusText}>
              {config.getText(isMobile)}
            </span>
          </div>
        </Tooltip>
      ) : (
        <div className={statusClasses} role="status" aria-live="polite">
          <span className={styles.statusIcon}>{config.icon}</span>
          <span className={styles.statusText}>{config.getText(isMobile)}</span>
          {showTimestamp && (
            <span className={styles.statusTime}>
              {formatRelativeTime(lastSavedTime)}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default SaveStatusIndicator;
