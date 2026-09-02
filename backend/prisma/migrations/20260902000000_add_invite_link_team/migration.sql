-- AlterTable
ALTER TABLE "invite_links" ADD COLUMN "teamId" TEXT;

-- CreateIndex
CREATE INDEX "invite_links_teamId_idx" ON "invite_links"("teamId");

-- AddForeignKey
ALTER TABLE "invite_links" ADD CONSTRAINT "invite_links_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
