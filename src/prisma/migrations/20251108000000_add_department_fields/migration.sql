-- CreateEnum
CREATE TYPE "Department" AS ENUM ('IT_SUPPORT', 'BILLING', 'PRODUCT', 'DESIGN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "department" "Department";

-- AlterTable
ALTER TABLE "Room" ADD COLUMN "department" "Department";

-- CreateIndex
CREATE INDEX "Room_department_idx" ON "Room"("department");

