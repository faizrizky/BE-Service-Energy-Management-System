-- AlterTable
ALTER TABLE "gateways" ADD COLUMN     "installedById" TEXT;

-- AddForeignKey
ALTER TABLE "gateways" ADD CONSTRAINT "gateways_installedById_fkey" FOREIGN KEY ("installedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
