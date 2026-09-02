-- Promote the earliest ADMIN member of each workspace to OWNER
WITH first_admins AS (
  SELECT DISTINCT ON ("workspaceId") id
  FROM "workspace_members"
  WHERE role = 'ADMIN'
  ORDER BY "workspaceId", "createdAt" ASC
)
UPDATE "workspace_members"
SET role = 'OWNER'
WHERE id IN (SELECT id FROM first_admins);
