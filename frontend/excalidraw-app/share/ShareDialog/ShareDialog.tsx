import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { copyTextToSystemClipboard } from "@excalidraw/excalidraw/clipboard";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { FilledButton } from "@excalidraw/excalidraw/components/FilledButton";
import { TextField } from "@excalidraw/excalidraw/components/TextField";
import {
  copyIcon,
  LinkIcon,
  playerPlayIcon,
  playerStopFilledIcon,
  share,
  shareIOS,
  shareWindows,
} from "@excalidraw/excalidraw/components/icons";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { useCopyStatus } from "@excalidraw/excalidraw/hooks/useCopiedIndicator";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { KEYS, getFrame } from "@excalidraw/common";
import { useEffect, useRef, useState } from "react";

import { atom, useAtom, useAtomValue } from "../../app-jotai";
import { activeRoomLinkAtom, type CollabAPI } from "../../collab/Collab";
import {
  startCollaboration as startWorkspaceCollaboration,
  type SceneAccess,
} from "../../data/workspaceSceneLoader";
import { isAutoCollabSceneAtom } from "../../components/Settings";

import styles from "./ShareDialog.module.scss";

type OnExportToBackend = () => void;
type ShareDialogType = "share" | "collaborationOnly";

export const shareDialogStateAtom = atom<
  { isOpen: false } | { isOpen: true; type: ShareDialogType }
>({ isOpen: false });

const getShareIcon = () => {
  const navigator = window.navigator as any;
  const isAppleBrowser = /Apple/.test(navigator.vendor);
  const isWindowsBrowser = navigator.appVersion.indexOf("Win") !== -1;

  if (isAppleBrowser) {
    return shareIOS;
  } else if (isWindowsBrowser) {
    return shareWindows;
  }

  return share;
};

export type ShareDialogProps = {
  collabAPI: CollabAPI | null;
  handleClose: () => void;
  onExportToBackend: OnExportToBackend;
  type: ShareDialogType;
  workspaceSceneContext?: {
    sceneId: string;
    workspaceSlug: string;
    access?: SceneAccess | null;
    roomId?: string | null;
  };
};

const ActiveRoomDialog = ({
  collabAPI,
  activeRoomLink,
  handleClose,
  isAutoCollab,
}: {
  collabAPI: CollabAPI;
  activeRoomLink: string;
  handleClose: () => void;
  isAutoCollab: boolean;
}) => {
  const { t } = useI18n();
  const [, setJustCopied] = useState(false);
  const timerRef = useRef<number>(0);
  const ref = useRef<HTMLInputElement>(null);
  const isShareSupported = "share" in navigator;
  const { onCopy, copyStatus } = useCopyStatus();

  const copyRoomLink = async () => {
    try {
      await copyTextToSystemClipboard(activeRoomLink);
    } catch (e) {
      collabAPI.setCollabError(t("errors.copyToSystemClipboardFailed"));
    }

    setJustCopied(true);

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      setJustCopied(false);
    }, 3000);

    ref.current?.select();
  };

  const shareRoomLink = async () => {
    try {
      await navigator.share({
        title: t("roomDialog.shareTitle"),
        text: t("roomDialog.shareTitle"),
        url: activeRoomLink,
      });
    } catch (error: any) {
      // Just ignore.
    }
  };

  return (
    <>
      <h3 className={styles.activeHeader}>
        {t("labels.liveCollaboration").replace(/\./g, "")}
      </h3>
      <TextField
        defaultValue={collabAPI.getUsername()}
        placeholder="Your name"
        label="Your name"
        onChange={collabAPI.setUsername}
        onKeyDown={(event) => event.key === KEYS.ENTER && handleClose()}
      />
      <div className={styles.activeLinkRow}>
        <TextField
          ref={ref}
          label="Link"
          readonly
          fullWidth
          value={activeRoomLink}
        />
        {isShareSupported && (
          <FilledButton
            size="large"
            variant="icon"
            label="Share"
            icon={getShareIcon()}
            className={styles.activeShare}
            onClick={shareRoomLink}
          />
        )}
        <FilledButton
          size="large"
          label={t("buttons.copyLink")}
          icon={copyIcon}
          status={copyStatus}
          onClick={() => {
            copyRoomLink();
            onCopy();
          }}
        />
      </div>
      <div className={styles.activeDescription}>
        <p>
          <span
            role="img"
            aria-hidden="true"
            className={styles.activeDescriptionEmoji}
          >
            🔒{" "}
          </span>
          {t("roomDialog.desc_privacy")}
        </p>
        {!isAutoCollab && <p>{t("roomDialog.desc_exitSession")}</p>}
      </div>

      {!isAutoCollab && (
        <div className={styles.activeActions}>
          <FilledButton
            size="large"
            variant="outlined"
            color="danger"
            label={t("roomDialog.button_stopSession")}
            icon={playerStopFilledIcon}
            onClick={() => {
              trackEvent("share", "room closed");
              collabAPI.stopCollaboration();
              if (!collabAPI.isCollaborating()) {
                handleClose();
              }
            }}
          />
        </div>
      )}
    </>
  );
};

const WorkspaceSceneShare = ({
  workspaceSlug,
  sceneId,
  access,
  collabAPI,
}: {
  workspaceSlug: string;
  sceneId: string;
  access?: SceneAccess | null;
  collabAPI: CollabAPI | null;
}) => {
  const { t } = useI18n();
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!access?.canView) {
    return null;
  }

  const handleEnable = async () => {
    setIsLoading(true);
    try {
      const { roomId, roomKey } = await startWorkspaceCollaboration(sceneId);
      const link = `${window.location.origin}/workspace/${workspaceSlug}/scene/${sceneId}#key=${roomKey}`;
      setShareLink(link);
      window.history.replaceState({}, "", link);
      if (collabAPI) {
        await collabAPI.startCollaboration({ roomId, roomKey });
      }
    } catch (error) {
      console.error("Failed to enable collaboration:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!access.canCollaborate) {
    return (
      <div className={styles.workspace}>
        <h3>{t("shareDialog.workspaceScene")}</h3>
        <p>{t("shareDialog.viewOnlyAccess")}</p>
        <p>{t("shareDialog.contactAdmin")}</p>
      </div>
    );
  }

  return (
    <div className={styles.workspace}>
      <h3>{t("shareDialog.workspaceScene")}</h3>
      <p>{t("shareDialog.workspaceSceneDescription")}</p>

      {shareLink ? (
        <div className={styles.workspaceLink}>
          <TextField value={shareLink} readonly />
          <FilledButton
            label={t("buttons.copyLink")}
            icon={copyIcon}
            onClick={() => copyTextToSystemClipboard(shareLink)}
          />
        </div>
      ) : (
        <FilledButton
          label={t("shareDialog.enableCollaboration")}
          icon={playerPlayIcon}
          onClick={() => {
            if (isLoading) {
              return;
            }
            handleEnable();
          }}
          status={isLoading ? "loading" : null}
        />
      )}

      <p className={styles.workspaceNote}>
        {t("shareDialog.workspacePermissionNote")}
      </p>
    </div>
  );
};

const ShareDialogPicker = (props: ShareDialogProps) => {
  const { t } = useI18n();

  const { collabAPI } = props;
  const workspaceContext = props.workspaceSceneContext;

  const startCollabJSX = collabAPI ? (
    <>
      <div className={styles.pickerHeader}>
        {t("labels.liveCollaboration").replace(/\./g, "")}
      </div>

      <div className={styles.pickerDescription}>
        <div style={{ marginBottom: "1em" }}>{t("roomDialog.desc_intro")}</div>
        {t("roomDialog.desc_privacy")}
      </div>

      <div className={styles.pickerButton}>
        <FilledButton
          size="large"
          label={t("roomDialog.button_startSession")}
          icon={playerPlayIcon}
          onClick={() => {
            trackEvent("share", "room creation", `ui (${getFrame()})`);
            collabAPI.startCollaboration(null);
          }}
        />
      </div>

      {props.type === "share" && (
        <div className={styles.separator}>
          <span>{t("shareDialog.or")}</span>
        </div>
      )}
    </>
  ) : null;

  return (
    <>
      {workspaceContext && (
        <WorkspaceSceneShare
          workspaceSlug={workspaceContext.workspaceSlug}
          sceneId={workspaceContext.sceneId}
          access={workspaceContext.access}
          collabAPI={collabAPI}
        />
      )}

      {startCollabJSX}

      {props.type === "share" && (
        <>
          <div className={styles.pickerHeader}>
            {t("exportDialog.link_title")}
          </div>
          <div className={styles.pickerDescription}>
            {t("exportDialog.link_details")}
          </div>

          <div className={styles.pickerButton}>
            <FilledButton
              size="large"
              label={t("exportDialog.link_button")}
              icon={LinkIcon}
              onClick={async () => {
                await props.onExportToBackend();
                props.handleClose();
              }}
            />
          </div>
        </>
      )}
    </>
  );
};

const ShareDialogInner = (props: ShareDialogProps) => {
  const activeRoomLink = useAtomValue(activeRoomLinkAtom);
  const isAutoCollab = useAtomValue(isAutoCollabSceneAtom);

  return (
    <Dialog size="small" onCloseRequest={props.handleClose} title={false}>
      <div className={styles.dialog}>
        {props.collabAPI && activeRoomLink ? (
          <ActiveRoomDialog
            collabAPI={props.collabAPI}
            activeRoomLink={activeRoomLink}
            handleClose={props.handleClose}
            isAutoCollab={isAutoCollab}
          />
        ) : (
          <ShareDialogPicker {...props} />
        )}
      </div>
    </Dialog>
  );
};

export const ShareDialog = (props: {
  collabAPI: CollabAPI | null;
  onExportToBackend: OnExportToBackend;
  workspaceSceneContext?: {
    sceneId: string;
    workspaceSlug: string;
    access: SceneAccess | undefined;
    roomId: string | null;
  };
}) => {
  const [shareDialogState, setShareDialogState] = useAtom(shareDialogStateAtom);

  const { openDialog } = useUIAppState();

  useEffect(() => {
    if (openDialog) {
      setShareDialogState({ isOpen: false });
    }
  }, [openDialog, setShareDialogState]);

  if (!shareDialogState.isOpen) {
    return null;
  }

  return (
    <ShareDialogInner
      handleClose={() => setShareDialogState({ isOpen: false })}
      collabAPI={props.collabAPI}
      onExportToBackend={props.onExportToBackend}
      type={shareDialogState.type}
    />
  );
};
