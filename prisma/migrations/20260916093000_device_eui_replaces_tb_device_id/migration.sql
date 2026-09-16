-- devEUI ChirpStack sekarang disimpan langsung di kolom "eui";
-- kolom "tbDeviceId" (peninggalan ThingsBoard) dibuang.
UPDATE "devices" SET "eui" = "tbDeviceId" WHERE "tbDeviceId" IS NOT NULL;

DROP INDEX IF EXISTS "devices_tbDeviceId_key";

ALTER TABLE "devices" DROP COLUMN "tbDeviceId";
