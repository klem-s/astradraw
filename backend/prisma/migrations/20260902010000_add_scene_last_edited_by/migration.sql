-- AlterTable
ALTER TABLE "scenes" ADD COLUMN "lastEditedByUserId" TEXT;

-- Backfill: default last editor to the scene owner
UPDATE "scenes" SET "lastEditedByUserId" = "userId" WHERE "lastEditedByUserId" IS NULL;

-- CreateIndex
CREATE INDEX "scenes_lastEditedByUserId_idx" ON "scenes"("lastEditedByUserId");

-- AddForeignKey
ALTER TABLE "scenes" ADD CONSTRAINT "scenes_lastEditedByUserId_fkey" FOREIGN KEY ("lastEditedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
