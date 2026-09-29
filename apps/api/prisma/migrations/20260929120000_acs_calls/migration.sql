-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PATIENT', 'DOCTOR');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID');

-- CreateEnum
CREATE TYPE "PushKind" AS ENUM ('VOIP', 'FCM');

-- CreateEnum
CREATE TYPE "CallMedia" AS ENUM ('AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "CallState" AS ENUM ('RINGING', 'ACCEPTED', 'ENDED', 'DECLINED', 'CANCELED', 'UNANSWERED', 'FAILED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "acsUserId" TEXT,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'PATIENT';

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "kind" "PushKind" NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "doctorId" UUID NOT NULL,
    "media" "CallMedia" NOT NULL,
    "state" "CallState" NOT NULL DEFAULT 'RINGING',
    "acsRoomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "devices_token_key" ON "devices"("token");

-- CreateIndex
CREATE INDEX "devices_userId_idx" ON "devices"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "calls_acsRoomId_key" ON "calls"("acsRoomId");

-- CreateIndex
CREATE INDEX "calls_patientId_createdAt_idx" ON "calls"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "calls_doctorId_createdAt_idx" ON "calls"("doctorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_acsUserId_key" ON "users"("acsUserId");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- One active call per patient and one per doctor (Prisma can't express partial indexes).
CREATE UNIQUE INDEX "calls_one_active_per_patient" ON "calls"("patientId") WHERE "state" IN ('RINGING', 'ACCEPTED');
CREATE UNIQUE INDEX "calls_one_active_per_doctor" ON "calls"("doctorId") WHERE "state" IN ('RINGING', 'ACCEPTED');
