import React, { useState, useEffect, useCallback, useMemo, useId } from "react";
import { t } from "@excalidraw/excalidraw/i18n";

import { useAtomValue } from "../../../app-jotai";

import {
  listTeams,
  listCollections,
  listWorkspaceMembers,
  listCollectionTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  createCollection,
  updateCollection,
  deleteCollection,
  setCollectionTeamAccess,
  removeCollectionTeamAccess,
  type Team,
  type Collection,
  type WorkspaceMember,
  type CollectionTeamAccess,
} from "../../../auth/workspaceApi";
import { EmojiPicker } from "../../EmojiPicker";
import { showSuccess } from "../../../utils/toast";

import { collectionsRefreshAtom } from "../settingsState";

import styles from "./TeamsCollectionsPage.module.scss";

// Stop keyboard events from propagating
const stopPropagation = (e: React.KeyboardEvent) => {
  e.stopPropagation();
};

export interface TeamsCollectionsPageProps {
  workspaceId: string | null;
  isAdmin: boolean;
}

const TEAM_COLORS = [
  "#ef4444",
  "#f97316",
  "#ec4899",
  "#a855f7",
  "#8b5cf6",
  "#6366f1",
  "#3b82f6",
  "#06b6d4",
  "#14b8a6",
  "#22c55e",
  "#84cc16",
  "#f59e0b",
  "#fb923c",
];

// Default icon for new collections (empty = user must select)
const DEFAULT_COLLECTION_ICON = "";

// Extended collection with team access info
interface CollectionWithTeams extends Collection {
  teamAccess?: CollectionTeamAccess[];
}

export const TeamsCollectionsPage: React.FC<TeamsCollectionsPageProps> = ({
  workspaceId,
  isAdmin,
}) => {
  // Subscribe to collections refresh trigger from other components (e.g., sidebar)
  const collectionsRefresh = useAtomValue(collectionsRefreshAtom);

  const [teams, setTeams] = useState<Team[]>([]);
  const [collections, setCollections] = useState<CollectionWithTeams[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Team dialog state
  const teamDialogNameId = useId();
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState(TEAM_COLORS[0]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>(
    [],
  );

  // Collection dialog state
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionIcon, setNewCollectionIcon] = useState(
    DEFAULT_COLLECTION_ICON,
  );
  const [newCollectionPrivate, setNewCollectionPrivate] = useState(false);

  // Collection team access dialog state
  const [showCollectionTeamsDialog, setShowCollectionTeamsDialog] =
    useState(false);
  const [editingCollection, setEditingCollection] =
    useState<CollectionWithTeams | null>(null);

  // Inline edit states
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(
    null,
  );

  // Count admin members (they are automatically part of every team)
  const adminMembers = useMemo(
    () => members.filter((m) => m.role === "ADMIN"),
    [members],
  );

  const loadData = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [teamsData, collectionsData, membersData] = await Promise.all([
        listTeams(workspaceId),
        listCollections(workspaceId),
        listWorkspaceMembers(workspaceId),
      ]);
      setTeams(teamsData);
      setMembers(membersData);

      // Load team access for each non-private collection
      const collectionsWithTeams: CollectionWithTeams[] = await Promise.all(
        collectionsData.map(async (collection) => {
          if (collection.isPrivate) {
            return { ...collection, teamAccess: [] };
          }
          try {
            const teamAccess = await listCollectionTeams(
              workspaceId,
              collection.id,
            );
            return { ...collection, teamAccess };
          } catch {
            return { ...collection, teamAccess: [] };
          }
        }),
      );
      setCollections(collectionsWithTeams);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadData();
  }, [loadData, collectionsRefresh]);

  // Calculate effective member count (explicit members + admins)
  const getEffectiveMemberCount = useCallback(
    (team: Team) => {
      // Get explicit non-admin members from team
      const explicitMemberIds = new Set(team.members?.map((m) => m.id) || []);
      // Count admins that are not already explicit members
      const adminCount = adminMembers.filter(
        (admin) => !explicitMemberIds.has(admin.id),
      ).length;
      return (team.memberCount || 0) + adminCount;
    },
    [adminMembers],
  );

  // =========================================================================
  // Team handlers
  // =========================================================================

  const openCreateTeamDialog = () => {
    setEditingTeam(null);
    setTeamName("");
    setTeamColor(TEAM_COLORS[0]);
    setSelectedMemberIds([]);
    setSelectedCollectionIds([]);
    setShowTeamDialog(true);
  };

  const openEditTeamDialog = (team: Team) => {
    setEditingTeam(team);
    setTeamName(team.name);
    setTeamColor(team.color);
    // Extract member IDs from team.members
    setSelectedMemberIds(team.members?.map((m) => m.id) || []);
    // Extract collection IDs from team.collections
    setSelectedCollectionIds(team.collections?.map((c) => c.id) || []);
    setShowTeamDialog(true);
  };

  const closeTeamDialog = () => {
    setShowTeamDialog(false);
    setEditingTeam(null);
  };

  const handleSaveTeam = async () => {
    if (!workspaceId || !teamName.trim()) {
      return;
    }

    try {
      if (editingTeam) {
        // Update existing team
        const updated = await updateTeam(editingTeam.id, {
          name: teamName.trim(),
          color: teamColor,
          memberIds: selectedMemberIds,
          collectionIds: selectedCollectionIds,
        });
        setTeams((prev) =>
          prev.map((t) => (t.id === editingTeam.id ? updated : t)),
        );
        showSuccess(t("settings.teamUpdated"));
      } else {
        // Create new team
        const team = await createTeam(workspaceId, {
          name: teamName.trim(),
          color: teamColor,
          memberIds: selectedMemberIds,
          collectionIds: selectedCollectionIds,
        });
        setTeams((prev) => [...prev, team]);
        showSuccess(t("settings.teamCreated"));
      }
      closeTeamDialog();
      // Reload to get updated collection team access
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to save team");
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(t("settings.confirmDeleteTeam", { name: teamName }))) {
      return;
    }

    try {
      await deleteTeam(teamId);
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      showSuccess(t("settings.teamDeleted"));
      // Reload to update collection team access
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to delete team");
    }
  };

  const handleInlineTeamNameUpdate = async (
    teamId: string,
    newName: string,
  ) => {
    if (!newName.trim()) {
      setEditingTeamId(null);
      return;
    }
    try {
      const updated = await updateTeam(teamId, { name: newName.trim() });
      setTeams((prev) => prev.map((t) => (t.id === teamId ? updated : t)));
      setEditingTeamId(null);
      showSuccess(t("settings.teamUpdated"));
    } catch (err: any) {
      setError(err.message || "Failed to update team");
    }
  };

  // =========================================================================
  // Collection handlers
  // =========================================================================

  const handleCreateCollection = async () => {
    if (!workspaceId || !newCollectionName.trim()) {
      return;
    }

    try {
      const collection = await createCollection(workspaceId, {
        name: newCollectionName.trim(),
        icon: newCollectionIcon,
        isPrivate: newCollectionPrivate,
      });
      setCollections((prev) => [...prev, { ...collection, teamAccess: [] }]);
      setShowCreateCollection(false);
      setNewCollectionName("");
      setNewCollectionIcon(DEFAULT_COLLECTION_ICON);
      setNewCollectionPrivate(false);
      showSuccess(t("settings.collectionCreated"));
    } catch (err: any) {
      setError(err.message || "Failed to create collection");
    }
  };

  const handleInlineCollectionNameUpdate = async (
    collectionId: string,
    newName: string,
  ) => {
    if (!newName.trim()) {
      setEditingCollectionId(null);
      return;
    }
    try {
      const updated = await updateCollection(collectionId, {
        name: newName.trim(),
      });
      setCollections((prev) =>
        prev.map((c) => (c.id === collectionId ? { ...c, ...updated } : c)),
      );
      setEditingCollectionId(null);
      showSuccess(t("settings.collectionUpdated"));
    } catch (err: any) {
      setError(err.message || "Failed to update collection");
    }
  };

  const handleDeleteCollection = async (
    collectionId: string,
    collectionName: string,
  ) => {
    if (
      !confirm(t("settings.confirmDeleteCollection", { name: collectionName }))
    ) {
      return;
    }

    try {
      await deleteCollection(collectionId);
      setCollections((prev) => prev.filter((c) => c.id !== collectionId));
      showSuccess(t("settings.collectionDeleted"));
    } catch (err: any) {
      setError(err.message || "Failed to delete collection");
    }
  };

  // =========================================================================
  // Collection Team Access handlers
  // =========================================================================

  const openCollectionTeamsDialog = (collection: CollectionWithTeams) => {
    setEditingCollection(collection);
    setShowCollectionTeamsDialog(true);
  };

  const closeCollectionTeamsDialog = () => {
    setShowCollectionTeamsDialog(false);
    setEditingCollection(null);
  };

  const handleToggleCollectionTeamAccess = async (
    collectionId: string,
    teamId: string,
    hasAccess: boolean,
  ) => {
    if (!workspaceId) {
      return;
    }

    try {
      if (hasAccess) {
        // Remove access
        await removeCollectionTeamAccess(workspaceId, collectionId, teamId);
      } else {
        // Add access
        await setCollectionTeamAccess(
          workspaceId,
          collectionId,
          teamId,
          "EDIT",
        );
      }

      // Update local state
      const updatedTeamAccess = await listCollectionTeams(
        workspaceId,
        collectionId,
      );
      setCollections((prev) =>
        prev.map((c) =>
          c.id === collectionId ? { ...c, teamAccess: updatedTeamAccess } : c,
        ),
      );

      // Update editing collection if open
      if (editingCollection?.id === collectionId) {
        setEditingCollection((prev) =>
          prev ? { ...prev, teamAccess: updatedTeamAccess } : null,
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to update team access");
    }
  };

  // =========================================================================
  // Helper functions
  // =========================================================================

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId],
    );
  };

  const toggleCollectionSelection = (collectionId: string) => {
    setSelectedCollectionIds((prev) =>
      prev.includes(collectionId)
        ? prev.filter((id) => id !== collectionId)
        : [...prev, collectionId],
    );
  };

  const isAdminMember = (member: WorkspaceMember) => {
    return member.role === "ADMIN";
  };

  // Filter out private collections for team assignment
  const nonPrivateCollections = collections.filter((c) => !c.isPrivate);

  if (!workspaceId) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <p>{t("settings.noWorkspaceSelected")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              {t("settings.teamsAndCollections")}
            </h1>
            <p className={styles.subtitle}>
              {t("settings.teamsAndCollectionsDescription")}
            </p>
          </div>
          {isAdmin && (
            <button
              className={styles.headerButton}
              onClick={openCreateTeamDialog}
            >
              {t("settings.createTeam")}
            </button>
          )}
        </div>

        {/* Separator after header */}
        <div className={styles.separator} />

        {/* Error messages */}
        {error && <div className={styles.errorInline}>{error}</div>}

        {isLoading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
          </div>
        ) : (
          <>
            {/* Teams Section */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>{t("settings.teams")}</h2>
              </div>

              <div className={styles.sectionContent}>
                {teams.length === 0 ? (
                  <div className={styles.emptySection}>
                    <p>{t("settings.noTeams")}</p>
                    {isAdmin && (
                      <button
                        className={styles.addButton}
                        onClick={openCreateTeamDialog}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        {t("settings.createTeam")}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className={styles.table}>
                    <div className={styles.tableHeader}>
                      <div className={styles.tableCellTeam}>
                        {t("settings.teams")}
                      </div>
                      <div className={styles.tableCellMembers}>
                        {t("settings.teamMembersLabel")}
                      </div>
                      <div className={styles.tableCellActions} />
                    </div>
                    {teams.map((team) => (
                      <div
                        key={team.id}
                        className={styles.tableRowClickable}
                        onClick={() => isAdmin && openEditTeamDialog(team)}
                      >
                        <div className={styles.tableCellTeam}>
                          <div
                            className={styles.teamColor}
                            style={{ backgroundColor: team.color }}
                          />
                          {editingTeamId === team.id ? (
                            <input
                              id={`team-name-${team.id}`}
                              name={`teamName-${team.id}`}
                              type="text"
                              defaultValue={team.name}
                              onKeyDown={(e) => {
                                stopPropagation(e);
                                if (e.key === "Enter") {
                                  handleInlineTeamNameUpdate(
                                    team.id,
                                    e.currentTarget.value,
                                  );
                                } else if (e.key === "Escape") {
                                  setEditingTeamId(null);
                                }
                              }}
                              onKeyUp={stopPropagation}
                              onBlur={(e) => {
                                if (e.target.value !== team.name) {
                                  handleInlineTeamNameUpdate(
                                    team.id,
                                    e.target.value,
                                  );
                                } else {
                                  setEditingTeamId(null);
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              className={styles.inlineInput}
                            />
                          ) : (
                            <span className={styles.teamName}>{team.name}</span>
                          )}
                        </div>
                        <div className={styles.tableCellMembers}>
                          {t("settings.teamMemberCount", {
                            count: getEffectiveMemberCount(team),
                          })}
                        </div>
                        <div className={styles.tableCellActions}>
                          {isAdmin && (
                            <>
                              <button
                                className={styles.actionButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditTeamDialog(team);
                                }}
                                title={t("settings.edit")}
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                              <button
                                className={styles.actionButtonDanger}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTeam(team.id, team.name);
                                }}
                                title={t("workspace.delete")}
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Collections Section */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  {t("settings.collections")}
                </h2>
              </div>

              <div className={styles.sectionContent}>
                {collections.length === 0 ? (
                  <div className={styles.emptySection}>
                    <p>{t("settings.noCollections")}</p>
                  </div>
                ) : (
                  <div className={styles.table}>
                    <div className={styles.tableHeader}>
                      <div className={styles.tableCellCollection}>
                        {t("settings.collections")}
                      </div>
                      <div className={styles.tableCellAccess}>
                        {t("settings.collectionAccess")}
                      </div>
                      <div className={styles.tableCellActions} />
                    </div>
                    {collections.map((collection) => (
                      <div key={collection.id} className={styles.tableRow}>
                        <div className={styles.tableCellCollection}>
                          <span className={styles.collectionIcon}>
                            {collection.icon || "📁"}
                          </span>
                          {editingCollectionId === collection.id ? (
                            <input
                              id={`collection-name-${collection.id}`}
                              name={`collectionName-${collection.id}`}
                              type="text"
                              defaultValue={collection.name}
                              onKeyDown={(e) => {
                                stopPropagation(e);
                                if (e.key === "Enter") {
                                  handleInlineCollectionNameUpdate(
                                    collection.id,
                                    e.currentTarget.value,
                                  );
                                } else if (e.key === "Escape") {
                                  setEditingCollectionId(null);
                                }
                              }}
                              onKeyUp={stopPropagation}
                              onBlur={(e) => {
                                if (e.target.value !== collection.name) {
                                  handleInlineCollectionNameUpdate(
                                    collection.id,
                                    e.target.value,
                                  );
                                } else {
                                  setEditingCollectionId(null);
                                }
                              }}
                              autoFocus
                              className={styles.inlineInput}
                            />
                          ) : (
                            <span className={styles.collectionName}>
                              {collection.name}
                            </span>
                          )}
                        </div>
                        <div className={styles.tableCellAccess}>
                          {collection.isPrivate ? (
                            <span className={styles.accessBadgePrivate}>
                              {t("settings.privateCollection")}
                            </span>
                          ) : collection.teamAccess &&
                            collection.teamAccess.length > 0 ? (
                            <div className={styles.teamChips}>
                              {collection.teamAccess.map((ta) => (
                                <span
                                  key={ta.teamId}
                                  className={styles.teamChip}
                                  style={{ backgroundColor: ta.teamColor }}
                                >
                                  {ta.teamName}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className={styles.accessBadgeEveryone}>
                              {t("settings.allMembers")}
                            </span>
                          )}
                        </div>
                        <div className={styles.tableCellActions}>
                          {isAdmin && !collection.isPrivate && (
                            <button
                              className={styles.actionButton}
                              onClick={() =>
                                openCollectionTeamsDialog(collection)
                              }
                              title={t("settings.edit")}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              className={styles.actionButtonDanger}
                              onClick={() =>
                                handleDeleteCollection(
                                  collection.id,
                                  collection.name,
                                )
                              }
                              title={t("workspace.delete")}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      {/* Team Create/Edit Dialog */}
      {showTeamDialog && (
        <div className={styles.dialogOverlay} onClick={closeTeamDialog}>
          <div
            className={styles.dialogWide}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.dialogHeader}>
              <h2>
                {editingTeam
                  ? t("settings.editTeam")
                  : t("settings.createTeam")}
              </h2>
              <button className={styles.dialogClose} onClick={closeTeamDialog}>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={styles.dialogContentTwoColumn}>
              {/* Left Column: Name, Color, Collections */}
              <div className={styles.dialogColumn}>
                <div className={styles.formGroup}>
                  <label>{t("settings.teamNameLabel")}</label>
                  <input
                    id={teamDialogNameId}
                    name="teamName"
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    onKeyDown={(e) => {
                      stopPropagation(e);
                      if (e.key === "Enter") {
                        handleSaveTeam();
                      }
                    }}
                    onKeyUp={stopPropagation}
                    placeholder={t("settings.teamNamePlaceholder")}
                    autoFocus
                    className={styles.input}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>{t("settings.teamColorLabel")}</label>
                  <div className={styles.colorPicker}>
                    {TEAM_COLORS.map((color) => (
                      <button
                        key={color}
                        className={
                          teamColor === color
                            ? styles.colorOptionSelected
                            : styles.colorOption
                        }
                        style={{ backgroundColor: color }}
                        onClick={() => setTeamColor(color)}
                      />
                    ))}
                  </div>
                </div>

                <div className={styles.formGroupGrow}>
                  <label>{t("settings.teamCollectionsLabel")}</label>
                  <p className={styles.formHint}>
                    {t("settings.teamCollectionsDescription")}
                  </p>
                  {nonPrivateCollections.length === 0 ? (
                    <div className={styles.emptyList}>
                      <p>{t("settings.noCollectionsYet")}</p>
                      <button
                        className={styles.addButton}
                        onClick={() => {
                          closeTeamDialog();
                          setShowCreateCollection(true);
                        }}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        {t("settings.createCollection")}
                      </button>
                    </div>
                  ) : (
                    <div className={styles.memberList}>
                      {nonPrivateCollections.map((collection) => (
                        <div
                          key={collection.id}
                          className={styles.memberRow}
                          onClick={() =>
                            toggleCollectionSelection(collection.id)
                          }
                        >
                          <span className={styles.collectionIcon}>
                            {collection.icon || "📁"}
                          </span>
                          <span className={styles.memberName}>
                            {collection.name}
                          </span>
                          <input
                            type="checkbox"
                            checked={selectedCollectionIds.includes(
                              collection.id,
                            )}
                            onChange={() =>
                              toggleCollectionSelection(collection.id)
                            }
                            onClick={(e) => e.stopPropagation()}
                            className={styles.rowCheckbox}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Members */}
              <div className={styles.dialogColumn}>
                <div className={styles.formGroupGrow}>
                  <label>{t("settings.teamMembersLabel")}</label>
                  <p className={styles.formHint}>
                    {t("settings.teamMembersDialogHint")}
                  </p>

                  <div className={styles.memberList}>
                    {members.map((member) => {
                      const memberIsAdmin = isAdminMember(member);
                      return (
                        <div
                          key={member.id}
                          className={
                            memberIsAdmin
                              ? styles.memberRowDisabled
                              : styles.memberRow
                          }
                          title={
                            memberIsAdmin
                              ? t("settings.adminAlwaysInTeam")
                              : undefined
                          }
                          onClick={() => {
                            if (!memberIsAdmin) {
                              toggleMemberSelection(member.id);
                            }
                          }}
                        >
                          {member.user.avatarUrl ? (
                            <img
                              src={member.user.avatarUrl}
                              alt=""
                              className={styles.memberAvatar}
                            />
                          ) : (
                            <div className={styles.memberAvatarPlaceholder}>
                              {(member.user.name || member.user.email)
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                          )}
                          <span className={styles.memberName}>
                            {member.user.name || member.user.email}
                          </span>
                          {memberIsAdmin && (
                            <span className={styles.roleBadge}>
                              {t("settings.roleAdmin")}
                            </span>
                          )}
                          <input
                            type="checkbox"
                            checked={
                              memberIsAdmin ||
                              selectedMemberIds.includes(member.id)
                            }
                            onChange={() => {
                              if (!memberIsAdmin) {
                                toggleMemberSelection(member.id);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            disabled={memberIsAdmin}
                            className={styles.rowCheckbox}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.dialogFooter}>
              <button className={styles.button} onClick={closeTeamDialog}>
                {t("settings.cancel")}
              </button>
              <button
                className={styles.buttonPrimary}
                onClick={handleSaveTeam}
                disabled={!teamName.trim()}
              >
                {editingTeam ? t("settings.save") : t("settings.createTeam")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collection Team Access Dialog */}
      {showCollectionTeamsDialog && editingCollection && (
        <div
          className={styles.dialogOverlay}
          onClick={closeCollectionTeamsDialog}
        >
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h2>
                {t("settings.collectionTitle", {
                  name: editingCollection.name,
                })}
              </h2>
              <button
                className={styles.dialogClose}
                onClick={closeCollectionTeamsDialog}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={styles.dialogContent}>
              <div className={styles.formGroup}>
                <label>{t("settings.teams")}</label>
                <p className={styles.formHint}>
                  {t("settings.collectionTeamsDescription")}
                </p>

                {teams.length === 0 ? (
                  <div className={styles.emptyList}>
                    <p>{t("settings.noTeamsYet")}</p>
                    <button
                      className={styles.addButton}
                      onClick={() => {
                        closeCollectionTeamsDialog();
                        openCreateTeamDialog();
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      {t("settings.createTeam")}
                    </button>
                  </div>
                ) : (
                  <div className={styles.memberList}>
                    {teams.map((team) => {
                      const hasAccess = editingCollection.teamAccess?.some(
                        (ta) => ta.teamId === team.id,
                      );
                      return (
                        <label key={team.id} className={styles.memberRow}>
                          <div
                            className={styles.teamColor}
                            style={{ backgroundColor: team.color }}
                          />
                          <span className={styles.memberName}>{team.name}</span>
                          <input
                            type="checkbox"
                            checked={hasAccess}
                            onChange={() =>
                              handleToggleCollectionTeamAccess(
                                editingCollection.id,
                                team.id,
                                hasAccess || false,
                              )
                            }
                            className={styles.rowCheckbox}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className={styles.dialogFooter}>
              <button
                className={styles.buttonPrimary}
                onClick={closeCollectionTeamsDialog}
              >
                {t("settings.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Collection Dialog */}
      {showCreateCollection && (
        <div
          className={styles.dialogOverlay}
          onClick={() => setShowCreateCollection(false)}
        >
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.dialogHeader}>
              <h2>{t("settings.createCollection")}</h2>
              <button
                className={styles.dialogClose}
                onClick={() => setShowCreateCollection(false)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className={styles.dialogContent}>
              <div className={styles.formRow}>
                <div className={styles.formGroupIcon}>
                  <label>{t("settings.collectionIcon")}</label>
                  <EmojiPicker
                    value={newCollectionIcon}
                    onSelect={setNewCollectionIcon}
                  />
                </div>
                <div className={styles.formGroupName}>
                  <label>{t("settings.collectionName")}</label>
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    onKeyDown={(e) => {
                      stopPropagation(e);
                      if (e.key === "Enter") {
                        handleCreateCollection();
                      }
                    }}
                    onKeyUp={stopPropagation}
                    placeholder={t("settings.collectionNamePlaceholder")}
                    className={styles.input}
                  />
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={newCollectionPrivate}
                    onChange={(e) => setNewCollectionPrivate(e.target.checked)}
                  />
                  <span>{t("settings.privateCollection")}</span>
                </label>
                <p className={styles.formHint}>
                  {t("settings.privateCollectionHint")}
                </p>
              </div>
              <button
                className={styles.buttonPrimaryFull}
                onClick={handleCreateCollection}
                disabled={!newCollectionName.trim()}
              >
                {t("settings.createCollection")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsCollectionsPage;
