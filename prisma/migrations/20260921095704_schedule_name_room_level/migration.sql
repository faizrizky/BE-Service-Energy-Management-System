-- 1. nama & deskripsi (nama nullable dulu supaya baris lama bisa diisi)
ALTER TABLE "schedules" ADD COLUMN "name" TEXT, ADD COLUMN "description" TEXT;

-- 2. nama otomatis buat jadwal lama: "<room> · <device atau All devices> · ON/OFF <jam>"
UPDATE "schedules" s
SET "name" = LEFT(
  (SELECT r."name" FROM "rooms" r WHERE r."id" = s."roomId") || ' · ' ||
  COALESCE((SELECT d."name" FROM "devices" d WHERE d."id" = s."deviceId"), 'All devices') || ' · ' ||
  CASE WHEN s."action" = 'on' THEN 'ON' ELSE 'OFF' END || ' ' || s."startTime",
  120
);

-- 3. jadwal khusus satu device cuma aman jadi level room kalau room-nya TEPAT satu device
--    (dan device itu memang milik room-nya). Yang aktif dan nggak memenuhi ini dinonaktifkan.
UPDATE "schedules" s
SET "status" = 'completed',
    "description" = 'Dinonaktifkan otomatis saat migrasi: jadwal ini dulu khusus satu device di room yang punya lebih dari satu device. Buat ulang jika masih dibutuhkan.'
WHERE s."deviceId" IS NOT NULL
  AND s."status" = 'active'
  AND NOT (
    (SELECT COUNT(*) FROM "devices" d WHERE d."roomId" = s."roomId") = 1
    AND EXISTS (SELECT 1 FROM "devices" d WHERE d."id" = s."deviceId" AND d."roomId" = s."roomId")
  );

-- 4. nama wajib
ALTER TABLE "schedules" ALTER COLUMN "name" SET NOT NULL;

-- 5. buang kolom device
ALTER TABLE "schedules" DROP CONSTRAINT "schedules_deviceId_fkey";
ALTER TABLE "schedules" DROP COLUMN "deviceId";