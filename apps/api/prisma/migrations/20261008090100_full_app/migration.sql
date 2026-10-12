-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('SQ', 'EN', 'MK');

-- CreateEnum
CREATE TYPE "AuthTokenKind" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'BIOMETRIC');

-- CreateEnum
CREATE TYPE "SubscriptionSource" AS ENUM ('INSURANCE', 'PREPAID', 'DEMO');

-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('HEALTH', 'FAMILY', 'CORPORATE', 'TRAVEL');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('FOLDER_CREATED', 'FOLDER_COMMENT', 'FOLDER_DOCUMENT', 'FREE_LINE', 'SUBSCRIPTION_ACTIVATED', 'EVENT_JOINED', 'ANNOUNCEMENT');

-- CreateEnum
CREATE TYPE "ConcernCategory" AS ENUM ('GENERAL', 'CARDIOLOGY', 'RESPIRATORY', 'DERMATOLOGY', 'GASTROENTEROLOGY', 'NEUROLOGY', 'PEDIATRICS', 'MENTAL_HEALTH', 'ORTHOPEDICS', 'OTHER');

-- CreateEnum
CREATE TYPE "AttemptOutcome" AS ENUM ('RINGING', 'ACCEPTED', 'DECLINED', 'NO_ANSWER', 'CANCELED', 'FAILED');

-- CreateEnum
CREATE TYPE "InviteState" AS ENUM ('RINGING', 'ACCEPTED', 'DECLINED', 'NO_ANSWER', 'LEFT', 'CANCELED');

-- DropForeignKey
ALTER TABLE "calls" DROP CONSTRAINT "calls_doctorId_fkey";

-- DropIndex
DROP INDEX "users_username_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "username",
ADD COLUMN     "avatarFile" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "language" "Language" NOT NULL DEFAULT 'SQ',
ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "personalId" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "sex" "Sex";

-- AlterTable
ALTER TABLE "calls" ADD COLUMN     "eventId" UUID,
ADD COLUMN     "preferredDoctorId" UUID,
ADD COLUMN     "ringingAt" TIMESTAMP(3),
ALTER COLUMN "doctorId" DROP NOT NULL,
ALTER COLUMN "state" SET DEFAULT 'QUEUED';

-- CreateTable
CREATE TABLE "doctor_profiles" (
    "userId" UUID NOT NULL,
    "specialty" TEXT,
    "bio" TEXT,
    "licenceNumber" TEXT,
    "country" TEXT,
    "city" TEXT,
    "healthCentre" TEXT,

    CONSTRAINT "doctor_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "AuthTokenKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "source" "SubscriptionSource" NOT NULL,
    "planName" TEXT NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "policyId" UUID,
    "prepaidCardId" UUID,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurance_policies" (
    "id" UUID NOT NULL,
    "type" "PolicyType" NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prepaid_cards" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "redeemedAt" TIMESTAMP(3),

    CONSTRAINT "prepaid_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "claims" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ALL',
    "status" "ClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stories" (
    "id" UUID NOT NULL,
    "title" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "imageUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benefits" (
    "id" UUID NOT NULL,
    "title" JSONB NOT NULL,
    "subtitle" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "imageUrl" TEXT,
    "url" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "benefits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" UUID NOT NULL,
    "title" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "body" JSONB NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "imageUrl" TEXT,
    "readMinutes" INTEGER NOT NULL DEFAULT 3,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "title" JSONB NOT NULL,
    "description" JSONB NOT NULL,
    "specialistId" UUID NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_participants" (
    "eventId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "title" JSONB,
    "body" JSONB,
    "folderId" UUID,
    "eventId" UUID,
    "doctorId" UUID,
    "url" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medical_folders" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "symptoms" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "prescription" TEXT,
    "recommendations" TEXT,
    "medicalComments" TEXT,
    "concernCategory" "ConcernCategory" NOT NULL DEFAULT 'GENERAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_folders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folder_comments" (
    "id" UUID NOT NULL,
    "folderId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folder_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folder_documents" (
    "id" UUID NOT NULL,
    "folderId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folder_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_blocks" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "liftedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_attempts" (
    "id" UUID NOT NULL,
    "callId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "outcome" "AttemptOutcome" NOT NULL DEFAULT 'RINGING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "call_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_invites" (
    "id" UUID NOT NULL,
    "callId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "invitedById" UUID NOT NULL,
    "state" "InviteState" NOT NULL DEFAULT 'RINGING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "call_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_feedback" (
    "callId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_feedback_pkey" PRIMARY KEY ("callId")
);

-- CreateIndex
CREATE INDEX "auth_tokens_tokenHash_idx" ON "auth_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_tokens_userId_kind_idx" ON "auth_tokens"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_policyId_key" ON "subscriptions"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_prepaidCardId_key" ON "subscriptions"("prepaidCardId");

-- CreateIndex
CREATE INDEX "subscriptions_userId_endsAt_idx" ON "subscriptions"("userId", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_policies_type_cardNumber_key" ON "insurance_policies"("type", "cardNumber");

-- CreateIndex
CREATE UNIQUE INDEX "prepaid_cards_code_key" ON "prepaid_cards"("code");

-- CreateIndex
CREATE UNIQUE INDEX "claims_number_key" ON "claims"("number");

-- CreateIndex
CREATE INDEX "claims_userId_submittedAt_idx" ON "claims"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "events_startsAt_idx" ON "events"("startsAt");

-- CreateIndex
CREATE INDEX "event_participants_userId_idx" ON "event_participants"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "medical_folders_patientId_visitDate_idx" ON "medical_folders"("patientId", "visitDate");

-- CreateIndex
CREATE INDEX "medical_folders_doctorId_idx" ON "medical_folders"("doctorId");

-- CreateIndex
CREATE INDEX "folder_comments_folderId_createdAt_idx" ON "folder_comments"("folderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "folder_documents_storageKey_key" ON "folder_documents"("storageKey");

-- CreateIndex
CREATE INDEX "folder_documents_folderId_createdAt_idx" ON "folder_documents"("folderId", "createdAt");

-- CreateIndex
CREATE INDEX "patient_blocks_patientId_endsAt_idx" ON "patient_blocks"("patientId", "endsAt");

-- CreateIndex
CREATE INDEX "call_attempts_callId_idx" ON "call_attempts"("callId");

-- CreateIndex
CREATE INDEX "call_attempts_doctorId_startedAt_idx" ON "call_attempts"("doctorId", "startedAt");

-- CreateIndex
CREATE INDEX "call_invites_callId_idx" ON "call_invites"("callId");

-- CreateIndex
CREATE INDEX "call_invites_doctorId_createdAt_idx" ON "call_invites"("doctorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_personalId_key" ON "users"("personalId");

-- CreateIndex
CREATE INDEX "calls_state_createdAt_idx" ON "calls"("state", "createdAt");

-- AddForeignKey
ALTER TABLE "doctor_profiles" ADD CONSTRAINT "doctor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "insurance_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_prepaidCardId_fkey" FOREIGN KEY ("prepaidCardId") REFERENCES "prepaid_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "claims" ADD CONSTRAINT "claims_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_folders" ADD CONSTRAINT "medical_folders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_folders" ADD CONSTRAINT "medical_folders_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_comments" ADD CONSTRAINT "folder_comments_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "medical_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_comments" ADD CONSTRAINT "folder_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_documents" ADD CONSTRAINT "folder_documents_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "medical_folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folder_documents" ADD CONSTRAINT "folder_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_blocks" ADD CONSTRAINT "patient_blocks_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_blocks" ADD CONSTRAINT "patient_blocks_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_preferredDoctorId_fkey" FOREIGN KEY ("preferredDoctorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_attempts" ADD CONSTRAINT "call_attempts_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_invites" ADD CONSTRAINT "call_invites_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_invites" ADD CONSTRAINT "call_invites_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_invites" ADD CONSTRAINT "call_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_feedback" ADD CONSTRAINT "call_feedback_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Accounts from before email confirmation existed count as confirmed.
UPDATE "users" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;

-- One active call per patient now includes queued calls (Prisma can't express partial indexes).
-- The per-doctor index stays as it was: queued calls have no doctor.
DROP INDEX "calls_one_active_per_patient";
CREATE UNIQUE INDEX "calls_one_active_per_patient" ON "calls"("patientId") WHERE "state" IN ('QUEUED', 'RINGING', 'ACCEPTED');

-- One ringing or answered "add doctor" invite per doctor.
CREATE UNIQUE INDEX "call_invites_one_active_per_doctor" ON "call_invites"("doctorId") WHERE "state" IN ('RINGING', 'ACCEPTED');
