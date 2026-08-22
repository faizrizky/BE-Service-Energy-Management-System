/*
  Warnings:

  - A unique constraint covering the columns `[tbDeviceId]` on the table `devices` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "tbDeviceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "devices_tbDeviceId_key" ON "devices"("tbDeviceId");
