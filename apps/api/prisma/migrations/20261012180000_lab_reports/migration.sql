-- CreateEnum
CREATE TYPE "LabReportType" AS ENUM ('BLOOD', 'URINE');

-- CreateTable
CREATE TABLE "lab_reports" (
    "id" UUID NOT NULL,
    "patientId" UUID NOT NULL,
    "type" "LabReportType" NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "lab" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_results" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "name" JSONB NOT NULL,
    "unit" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "scaleMin" DOUBLE PRECISION NOT NULL,
    "scaleMax" DOUBLE PRECISION NOT NULL,
    "ranges" JSONB NOT NULL,

    CONSTRAINT "lab_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lab_reports_patientId_type_takenAt_idx" ON "lab_reports"("patientId", "type", "takenAt");

-- CreateIndex
CREATE INDEX "lab_results_reportId_position_idx" ON "lab_results"("reportId", "position");

-- AddForeignKey
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_results" ADD CONSTRAINT "lab_results_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "lab_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

