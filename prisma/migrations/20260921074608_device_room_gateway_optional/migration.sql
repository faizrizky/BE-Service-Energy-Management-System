-- AlterTable
ALTER TABLE "command_logs" ALTER COLUMN "roomId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "devices" ALTER COLUMN "roomId" DROP NOT NULL,
ALTER COLUMN "gatewayId" DROP NOT NULL;
