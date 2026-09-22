/*
  Warnings:

  - You are about to drop the column `sentAt` on the `command_logs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "command_logs" DROP COLUMN "sentAt";
