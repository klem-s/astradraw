import { useCallback, useEffect, useState, useRef } from "react";

import { t } from "@excalidraw/excalidraw/i18n";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useSetAtom } from "../../app-jotai";
import { createTalktrack } from "../../auth/workspaceApi";
import { closeWorkspaceSidebarAtom } from "../Settings/settingsState";

import {
  getTalktrackRecorder,
  disposeTalktrackRecorder,
  type RecordingState,
  type TalktrackRecorder,
} from "./TalktrackRecorder";
import { uploadToKinescope, type UploadProgress } from "./kinescopeApi";
import { TalktrackSetupDialog } from "./TalktrackSetupDialog";
import { TalktrackToolbar } from "./TalktrackToolbar";

interface TalktrackManagerProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  isRecordingDialogOpen: boolean;
  onCloseRecordingDialog: () => void;
  sceneId: string | null;
  onRecordingSaved?: () => void;
}

export const TalktrackManager: React.FC<TalktrackManagerProps> = ({
  excalidrawAPI,
  isRecordingDialogOpen,
  onCloseRecordingDialog,
  sceneId,
  onRecordingSaved,
}) => {
  // Use Jotai atom directly to close workspace sidebar
  const closeWorkspaceSidebar = useSetAtom(closeWorkspaceSidebarAtom);
  const [recordingState, setRecordingState] = useState<RecordingState>({
    status: "idle",
    duration: 0,
  });
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null,
  );
  const [countdown, setCountdown] = useState<number | null>(null);

  const recorderRef = useRef<TalktrackRecorder | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // Initialize recorder
  useEffect(() => {
    recorderRef.current = getTalktrackRecorder();
    recorderRef.current.setOnStateChange(setRecordingState);

    return () => {
      // Use disposeTalktrackRecorder to properly reset the singleton
      // This ensures a fresh instance is created on next mount (e.g., after collection switch)
      disposeTalktrackRecorder();
    };
  }, []);

  // Start recording with countdown
  const startRecording = useCallback(
    async (videoDeviceId: string | null, audioDeviceId: string | null) => {
      if (!recorderRef.current) {
        return;
      }

      // Check if scene is saved
      if (!sceneId) {
        excalidrawAPI?.setToast({
          message:
            t("talktrack.saveSceneFirst") ||
            "Please save your scene first to record a talktrack",
          duration: 4000,
          closable: true,
        });
        onCloseRecordingDialog();
        return;
      }

      setCameraEnabled(!!videoDeviceId);
      onCloseRecordingDialog();

      // Close the workspace sidebar before recording to ensure full canvas width
      // This prevents black bars on the sides of the recording
      closeWorkspaceSidebar();

      // Small delay to allow sidebar animation to complete and canvas to resize
      await new Promise((resolve) => setTimeout(resolve, 300));

      try {
        // Prepare the recorder
        await recorderRef.current.prepare({
          videoDeviceId,
          audioDeviceId,
        });

        // Start countdown
        setCountdown(3);

        countdownIntervalRef.current = window.setInterval(() => {
          setCountdown((prev) => {
            if (prev === null || prev <= 1) {
              // Clear interval and start recording
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }

              // Start recording
              recorderRef.current?.start().catch((err) => {
                console.error("Failed to start recording:", err);
                excalidrawAPI?.setToast({
                  message: t("talktrack.recordingError"),
                  duration: 3000,
                  closable: true,
                });
              });

              return null;
            }
            return prev - 1;
          });
        }, 1000);
      } catch (err) {
        console.error("Failed to prepare recording:", err);
        excalidrawAPI?.setToast({
          message:
            err instanceof Error ? err.message : t("talktrack.recordingError"),
          duration: 3000,
          closable: true,
        });
      }
    },
    [excalidrawAPI, onCloseRecordingDialog, closeWorkspaceSidebar, sceneId],
  );

  // Stop recording and upload
  const stopRecording = useCallback(async () => {
    if (!recorderRef.current || !sceneId) {
      return;
    }

    try {
      const blob = await recorderRef.current.stop();
      const duration = recordingState.duration;

      // Generate title with timestamp (prefixed with AstraDraw for easy identification in Kinescope)
      const now = new Date();
      const title = `AstraDraw Recording ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

      // Show uploading state
      setIsUploading(true);
      setUploadProgress({ loaded: 0, total: blob.size, percentage: 0 });

      excalidrawAPI?.setToast({
        message: t("talktrack.uploading"),
        duration: 0, // Don't auto-dismiss
        closable: false,
      });

      // Upload to Kinescope
      const videoId = await uploadToKinescope(blob, title, (progress) => {
        setUploadProgress(progress);
      });

      // Save recording to backend API (linked to scene)
      await createTalktrack(sceneId, {
        title,
        kinescopeVideoId: videoId,
        duration,
        processingStatus: "processing",
      });

      // Notify parent to refresh recordings list
      onRecordingSaved?.();

      // Show success
      excalidrawAPI?.setToast({
        message: t("talktrack.uploadSuccess"),
        duration: 3000,
        closable: true,
      });
    } catch (err) {
      console.error("Failed to stop/upload recording:", err);
      excalidrawAPI?.setToast({
        message:
          err instanceof Error ? err.message : t("talktrack.uploadError"),
        duration: 5000,
        closable: true,
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }, [excalidrawAPI, recordingState.duration, sceneId, onRecordingSaved]);

  // Delete (cancel) recording
  const deleteRecording = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
    recorderRef.current?.cancel();
  }, []);

  // Restart recording
  const restartRecording = useCallback(async () => {
    if (!recorderRef.current) {
      return;
    }

    recorderRef.current.cancel();

    // Re-start countdown
    setCountdown(3);

    countdownIntervalRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }

          recorderRef.current?.start().catch(console.error);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Pause recording
  const pauseRecording = useCallback(() => {
    recorderRef.current?.pause();
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    recorderRef.current?.resume();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  const isActive =
    recordingState.status === "recording" ||
    recordingState.status === "paused" ||
    countdown !== null;

  // Format bytes to human readable
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) {
      return "0 B";
    }
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <>
      {/* Setup dialog */}
      <TalktrackSetupDialog
        isOpen={isRecordingDialogOpen}
        onClose={onCloseRecordingDialog}
        onStart={startRecording}
      />

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="talktrack-countdown">
          <div className="talktrack-countdown__number">{countdown}</div>
        </div>
      )}

      {/* Recording toolbar */}
      {isActive && countdown === null && (
        <TalktrackToolbar
          recordingState={recordingState}
          onDelete={deleteRecording}
          onRestart={restartRecording}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onStop={stopRecording}
          cameraEnabled={cameraEnabled}
        />
      )}

      {/* Upload progress overlay */}
      {isUploading && uploadProgress && (
        <div className="talktrack-upload-overlay">
          <div className="talktrack-upload-modal">
            <div className="talktrack-upload-modal__icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <h3 className="talktrack-upload-modal__title">
              {t("talktrack.uploadingTitle")}
            </h3>
            <p className="talktrack-upload-modal__subtitle">
              {t("talktrack.uploadingSubtitle")}
            </p>

            <div className="talktrack-upload-modal__progress-container">
              <div className="talktrack-upload-modal__progress-bar">
                <div
                  className="talktrack-upload-modal__progress-fill"
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>
              <div className="talktrack-upload-modal__progress-info">
                <span className="talktrack-upload-modal__progress-percent">
                  {uploadProgress.percentage}%
                </span>
                <span className="talktrack-upload-modal__progress-size">
                  {formatBytes(uploadProgress.loaded)} /{" "}
                  {formatBytes(uploadProgress.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        .talktrack-countdown {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        .talktrack-countdown__number {
          font-size: 120px;
          font-weight: 700;
          color: white;
          animation: talktrack-countdown-pulse 1s ease-in-out;
        }
        @keyframes talktrack-countdown-pulse {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        .talktrack-upload-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        
        .talktrack-upload-modal {
          background: white;
          border-radius: 16px;
          padding: 32px 40px;
          max-width: 400px;
          width: 90%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        
        .talktrack-upload-modal__icon {
          color: var(--color-primary, #6965db);
          margin-bottom: 16px;
          animation: talktrack-upload-bounce 1s ease-in-out infinite;
        }
        
        @keyframes talktrack-upload-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        
        .talktrack-upload-modal__title {
          margin: 0 0 8px;
          font-size: 20px;
          font-weight: 600;
          color: #333;
        }
        
        .talktrack-upload-modal__subtitle {
          margin: 0 0 24px;
          font-size: 14px;
          color: #666;
        }
        
        .talktrack-upload-modal__progress-container {
          margin-top: 8px;
        }
        
        .talktrack-upload-modal__progress-bar {
          width: 100%;
          height: 8px;
          background: #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
        }
        
        .talktrack-upload-modal__progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--color-primary, #6965db) 0%, #8b87e8 100%);
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        
        .talktrack-upload-modal__progress-info {
          display: flex;
          justify-content: space-between;
          margin-top: 12px;
          font-size: 13px;
        }
        
        .talktrack-upload-modal__progress-percent {
          font-weight: 600;
          color: var(--color-primary, #6965db);
        }
        
        .talktrack-upload-modal__progress-size {
          color: #888;
        }
      `}</style>
    </>
  );
};
