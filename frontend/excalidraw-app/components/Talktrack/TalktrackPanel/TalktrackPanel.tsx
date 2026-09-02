import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";

import { newEmbeddableElement } from "@excalidraw/element";

import { t } from "@excalidraw/excalidraw/i18n";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  listTalktracks,
  updateTalktrack,
  deleteTalktrack,
  updateTalktrackStatus,
  type TalktrackRecording,
} from "../../../auth/workspaceApi";

import {
  isKinescopeConfigured,
  getKinescopeEmbedUrl,
  checkVideoStatus,
} from "../kinescopeApi";

import styles from "./TalktrackPanel.module.scss";

interface TalktrackPanelProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onStartRecording: () => void;
  sceneId: string | null;
}

interface RecordingItemProps {
  recording: TalktrackRecording;
  onAddToBoard: (recording: TalktrackRecording) => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onCopyLink: (recording: TalktrackRecording) => void;
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) {
    return `${secs} sec`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const RecordingItem: React.FC<RecordingItemProps> = ({
  recording,
  onAddToBoard,
  onRename,
  onDelete,
  onCopyLink,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(recording.title);

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(!isMenuOpen);
  };

  const handleRename = () => {
    setIsEditing(true);
    setIsMenuOpen(false);
  };

  const handleSaveRename = () => {
    if (editTitle.trim() && editTitle !== recording.title) {
      onRename(recording.id, editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveRename();
    } else if (e.key === "Escape") {
      setEditTitle(recording.title);
      setIsEditing(false);
    }
  };

  const handleDelete = () => {
    onDelete(recording.id);
    setIsMenuOpen(false);
  };

  const handleCopyLink = () => {
    onCopyLink(recording);
    setIsMenuOpen(false);
  };

  // Close menu when clicking outside
  useEffect(() => {
    if (isMenuOpen) {
      const handleClickOutside = () => setIsMenuOpen(false);
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isMenuOpen]);

  const isProcessing =
    recording.processingStatus === "processing" ||
    recording.processingStatus === "uploading";
  const isOwner = recording.isOwner;

  return (
    <div className={styles.recording}>
      <div
        className={clsx(styles.recordingThumbnail, {
          [styles.recordingThumbnailProcessing]: isProcessing,
        })}
      >
        {/* Placeholder thumbnail - Kinescope provides thumbnails after processing */}
        <div className={styles.recordingThumbnailPlaceholder}>
          {isProcessing ? (
            <div className={styles.processingIndicator}>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" opacity="0.25" />
                <path d="M12 2 A 10 10 0 0 1 22 12" strokeLinecap="round">
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0 12 12"
                    to="360 12 12"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                </path>
              </svg>
            </div>
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </div>
        {isProcessing && (
          <div className={styles.processingOverlay}>
            <span>{t("talktrack.processing")}</span>
          </div>
        )}
      </div>

      <div className={styles.recordingInfo}>
        {isEditing ? (
          <input
            type="text"
            className={styles.recordingTitleInput}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSaveRename}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        ) : (
          <div className={styles.recordingTitle}>{recording.title}</div>
        )}
        <div className={styles.recordingMeta}>
          <span className={styles.recordingDuration}>
            {formatDuration(recording.duration)}
          </span>
          <span>{formatDate(recording.createdAt)}</span>
        </div>
      </div>

      <div className={styles.recordingActions}>
        <button
          className={styles.actionButton}
          onClick={handleCopyLink}
          title={t("talktrack.copyLink")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>

        {/* Only show menu for owners */}
        {isOwner && (
          <div className={styles.menuContainer}>
            <button
              className={styles.actionButton}
              onClick={handleMenuClick}
              title={t("talktrack.moreOptions")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>

            {isMenuOpen && (
              <div className={styles.menu}>
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    onAddToBoard(recording);
                    setIsMenuOpen(false);
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  {t("talktrack.addToBoard")}
                </button>
                <button className={styles.menuItem} onClick={handleRename}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  {t("talktrack.rename")}
                </button>
                <button
                  className={clsx(styles.menuItem, styles.menuItemDanger)}
                  onClick={handleDelete}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  {t("talktrack.delete")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ onRecord: () => void }> = ({ onRecord }) => (
  <div className={styles.empty}>
    <div className={styles.emptyIcon}>
      <svg
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <circle cx="18" cy="7" r="1" fill="currentColor" />
      </svg>
    </div>
    <h3 className={styles.emptyTitle}>{t("talktrack.emptyTitle")}</h3>
    <p className={styles.emptyDescription}>{t("talktrack.emptyDescription")}</p>
    <button className={styles.recordButton} onClick={onRecord}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="12" r="10" />
      </svg>
      {t("talktrack.recordTalktrack")}
    </button>
  </div>
);

const NotConfigured: React.FC = () => (
  <div className={styles.notConfigured}>
    <div className={styles.notConfiguredIcon}>⚠️</div>
    <h3 className={styles.notConfiguredTitle}>
      {t("talktrack.notConfiguredTitle")}
    </h3>
    <p className={styles.notConfiguredDescription}>
      {t("talktrack.notConfiguredDescription")}
    </p>
  </div>
);

const NoSceneState: React.FC = () => (
  <div className={styles.noScene}>
    <div className={styles.noSceneIcon}>
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
    </div>
    <h3 className={styles.noSceneTitle}>
      {t("talktrack.noSceneTitle") || "Save your scene first"}
    </h3>
    <p className={styles.noSceneDescription}>
      {t("talktrack.noSceneDescription") ||
        "Talktrack recordings are saved with your scene. Save your scene to the workspace to start recording."}
    </p>
  </div>
);

export const TalktrackPanel: React.FC<TalktrackPanelProps> = ({
  excalidrawAPI,
  onStartRecording,
  sceneId,
}) => {
  const [recordings, setRecordings] = useState<TalktrackRecording[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load recordings when sceneId changes
  const loadRecordings = useCallback(async () => {
    if (!sceneId) {
      setRecordings([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await listTalktracks(sceneId);
      setRecordings(data);
    } catch (err) {
      console.error("Failed to load recordings:", err);
      setError("Failed to load recordings");
      setRecordings([]);
    } finally {
      setIsLoading(false);
    }
  }, [sceneId]);

  // Load recordings on mount and when sceneId changes
  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  // Poll for processing status updates
  useEffect(() => {
    if (!sceneId) {
      return;
    }

    const processingRecordings = recordings.filter(
      (r) =>
        r.processingStatus === "processing" ||
        r.processingStatus === "uploading",
    );

    if (processingRecordings.length === 0) {
      return;
    }

    // Check status every 10 seconds
    const intervalId = setInterval(async () => {
      for (const recording of processingRecordings) {
        try {
          const status = await checkVideoStatus(recording.kinescopeVideoId);
          if (status !== "processing") {
            await updateTalktrackStatus(sceneId, recording.id, status);
            loadRecordings();
          }
        } catch (error) {
          console.error("Failed to check video status:", error);
        }
      }
    }, 10000); // 10 seconds

    // Also check immediately
    (async () => {
      for (const recording of processingRecordings) {
        try {
          const status = await checkVideoStatus(recording.kinescopeVideoId);
          if (status !== "processing") {
            await updateTalktrackStatus(sceneId, recording.id, status);
            loadRecordings();
          }
        } catch (error) {
          console.error("Failed to check video status:", error);
        }
      }
    })();

    return () => clearInterval(intervalId);
  }, [recordings, sceneId, loadRecordings]);

  const handleAddToBoard = useCallback(
    (recording: TalktrackRecording) => {
      if (!excalidrawAPI) {
        return;
      }

      const embedUrl = getKinescopeEmbedUrl(recording.kinescopeVideoId);
      const appState = excalidrawAPI.getAppState();
      const elements = excalidrawAPI.getSceneElements();

      // Calculate center of viewport
      const x =
        -appState.scrollX + appState.width / (2 * appState.zoom.value) - 320;
      const y =
        -appState.scrollY + appState.height / (2 * appState.zoom.value) - 180;

      const embeddableElement = newEmbeddableElement({
        type: "embeddable",
        x,
        y,
        width: 640,
        height: 360,
        link: embedUrl,
      });

      excalidrawAPI.updateScene({
        elements: [...elements, embeddableElement],
      });

      excalidrawAPI.setToast({
        message: t("talktrack.addedToBoard"),
        duration: 2000,
        closable: true,
      });
    },
    [excalidrawAPI],
  );

  const handleRename = useCallback(
    async (id: string, newTitle: string) => {
      if (!sceneId) {
        return;
      }

      try {
        await updateTalktrack(sceneId, id, { title: newTitle });
        loadRecordings();
      } catch (err) {
        console.error("Failed to rename recording:", err);
        excalidrawAPI?.setToast({
          message: t("talktrack.renameError") || "Failed to rename recording",
          duration: 3000,
          closable: true,
        });
      }
    },
    [sceneId, loadRecordings, excalidrawAPI],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!sceneId) {
        return;
      }

      // Show deleting toast
      excalidrawAPI?.setToast({
        message: t("talktrack.deleting"),
        duration: 0,
        closable: false,
      });

      try {
        await deleteTalktrack(sceneId, id);
        loadRecordings();
        excalidrawAPI?.setToast({
          message: t("talktrack.deleteSuccess"),
          duration: 2000,
          closable: true,
        });
      } catch (err) {
        console.error("Failed to delete recording:", err);
        excalidrawAPI?.setToast({
          message: t("talktrack.deleteError"),
          duration: 3000,
          closable: true,
        });
      }
    },
    [sceneId, loadRecordings, excalidrawAPI],
  );

  const handleCopyLink = useCallback(
    (recording: TalktrackRecording) => {
      const url = getKinescopeEmbedUrl(recording.kinescopeVideoId);
      navigator.clipboard.writeText(url).then(() => {
        excalidrawAPI?.setToast({
          message: t("talktrack.linkCopied"),
          duration: 2000,
          closable: true,
        });
      });
    },
    [excalidrawAPI],
  );

  // Check if Kinescope is configured
  if (!isKinescopeConfigured()) {
    return (
      <div className={styles.panel} onWheel={(e) => e.stopPropagation()}>
        <NotConfigured />
      </div>
    );
  }

  // Show "save scene first" message if no sceneId
  if (!sceneId) {
    return (
      <div className={styles.panel} onWheel={(e) => e.stopPropagation()}>
        <NoSceneState />
      </div>
    );
  }

  // Show loading state
  if (isLoading && recordings.length === 0) {
    return (
      <div className={styles.panel} onWheel={(e) => e.stopPropagation()}>
        <div className={styles.loading}>
          <div className={styles.processingIndicator}>
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" opacity="0.25" />
              <path d="M12 2 A 10 10 0 0 1 22 12" strokeLinecap="round">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 12 12"
                  to="360 12 12"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </path>
            </svg>
          </div>
          <span>{t("talktrack.loading") || "Loading recordings..."}</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={styles.panel} onWheel={(e) => e.stopPropagation()}>
        <div className={styles.error}>
          <span>{error}</span>
          <button onClick={loadRecordings}>
            {t("talktrack.retry") || "Retry"}
          </button>
        </div>
      </div>
    );
  }

  const hasRecordings = recordings.length > 0;

  return (
    <div className={styles.panel} onWheel={(e) => e.stopPropagation()}>
      {hasRecordings ? (
        <>
          {/* Header */}
          <div className={styles.header}>
            <span className={styles.title}>{t("talktrack.title")}</span>
          </div>

          {/* Recordings list */}
          <div className={styles.recordings}>
            {recordings.map((recording) => (
              <RecordingItem
                key={recording.id}
                recording={recording}
                onAddToBoard={handleAddToBoard}
                onRename={handleRename}
                onDelete={handleDelete}
                onCopyLink={handleCopyLink}
              />
            ))}
          </div>

          {/* Record button at bottom */}
          <div className={styles.footer}>
            <button className={styles.recordButton} onClick={onStartRecording}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="12" cy="12" r="10" />
              </svg>
              {t("talktrack.recordTalktrack")}
            </button>
          </div>
        </>
      ) : (
        <EmptyState onRecord={onStartRecording} />
      )}
    </div>
  );
};
