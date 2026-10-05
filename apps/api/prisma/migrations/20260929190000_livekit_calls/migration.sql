-- Calls still open from the Azure Communication Services version: their ACS rooms are gone.
UPDATE "calls" SET "state" = 'FAILED', "endedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
WHERE "state" IN ('RINGING', 'ACCEPTED');

-- DropIndex
DROP INDEX "users_acsUserId_key";

-- DropIndex
DROP INDEX "calls_acsRoomId_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "acsUserId";

-- AlterTable
ALTER TABLE "calls" DROP COLUMN "acsRoomId";
