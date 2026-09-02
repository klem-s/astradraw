import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceRole, WorkspaceType } from '@prisma/client';
import { isAdminRole } from '../workspaces/workspace-role.util';

export type SceneAccessResult = {
  canView: boolean;
  canEdit: boolean;
  canCollaborate: boolean;
};

@Injectable()
export class SceneAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Determine a user's access to a scene based on workspace → collection → team rules.
   */
  async checkAccess(
    sceneId: string,
    userId: string,
  ): Promise<SceneAccessResult> {
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        collection: {
          include: {
            workspace: true,
          },
        },
      },
    });

    if (!scene) {
      return { canView: false, canEdit: false, canCollaborate: false };
    }

    if (!scene.collection) {
      const isOwner = scene.userId === userId;
      return {
        canView: isOwner,
        canEdit: isOwner,
        canCollaborate: false,
      };
    }

    const workspace = scene.collection.workspace;

    // Workspace membership check
    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId },
      },
    });

    if (!membership) {
      return { canView: false, canEdit: false, canCollaborate: false };
    }

    // Personal workspace: owner only, no collaboration
    if (workspace.type === WorkspaceType.PERSONAL) {
      const isOwner = scene.userId === userId;
      return {
        canView: isOwner,
        canEdit: isOwner,
        canCollaborate: false,
      };
    }

    // Shared workspace
    if (isAdminRole(membership.role)) {
      return {
        canView: true,
        canEdit: true,
        canCollaborate: !!scene.collaborationEnabled,
      };
    }

    // Private collection: viewable by any workspace member, editable by the owner
    if (scene.collection.isPrivate) {
      const isOwner = scene.collection.userId === userId;
      return {
        canView: true,
        canEdit: isOwner && membership.role !== WorkspaceRole.VIEWER,
        canCollaborate: isOwner && !!scene.collaborationEnabled,
      };
    }

    // Non-private collection: viewable by any workspace member, and editable
    // by any MEMBER (VIEWERs stay read-only).
    const canEdit = membership.role !== WorkspaceRole.VIEWER;

    return {
      canView: true,
      canEdit,
      canCollaborate: !!scene.collaborationEnabled && canEdit,
    };
  }
}
