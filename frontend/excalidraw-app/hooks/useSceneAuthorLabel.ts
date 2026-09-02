/**
 * useSceneAuthorLabel - Resolves the "last edited by" label for a scene.
 *
 * Looks up the scene's actual last editor (falling back to its owner) against
 * the current workspace's member list, rather than assuming the viewer is
 * always the author.
 */

import { t } from "@excalidraw/excalidraw/i18n";

import { useAtomValue } from "../app-jotai";
import { useAuth } from "../auth";
import { currentWorkspaceAtom } from "../components/Settings/settingsState";

import { useWorkspaceMembers } from "./useWorkspaceMembers";

import type { WorkspaceScene } from "../auth/workspaceApi";

export function useSceneAuthorLabel() {
  const { user } = useAuth();
  const currentWorkspace = useAtomValue(currentWorkspaceAtom);
  const { members } = useWorkspaceMembers({
    workspaceId: currentWorkspace?.id,
  });

  const nameById = new Map(members.map((m) => [m.id, m.name]));

  return (scene: WorkspaceScene): string | undefined => {
    const authorId = scene.lastEditedByUserId ?? scene.userId;
    if (!authorId) {
      return undefined;
    }
    if (authorId === user?.id) {
      return t("workspace.byYou");
    }
    const name = nameById.get(authorId);
    return name ? t("workspace.byAuthor", { name }) : undefined;
  };
}
