const { z } = require("zod");

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const deviceIdMustBeEmpty = z
  .any()
  .optional()
  .refine((value) => value === undefined || value === null || value === "", {
    message:
      "deviceId tidak didukung lagi: jadwal berlaku untuk seluruh device di room",
  });

const scheduleShape = {
  name: z.string().trim().min(1, "name wajib diisi").max(120),
  description: z.string().trim().max(500).optional().nullable(),
  roomId: z.string().uuid("roomId tidak valid"),
  deviceId: deviceIdMustBeEmpty,
  action: z.enum(["on", "off"]),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format scheduledDate harus YYYY-MM-DD")
    .optional(),
  startTime: z.string().regex(timeRegex, "Format startTime harus HH:mm"),
  endTime: z
    .string()
    .regex(timeRegex, "Format endTime harus HH:mm")
    .optional()
    .nullable()
    .or(z.literal("")),
  repeatType: z.enum(["none", "daily", "weekly"]).optional(),
  repeatDays: z.array(z.number().int().min(0).max(6)).optional(),
  status: z.enum(["active", "completed"]).optional(),
};

const scheduleSchema = z.object(scheduleShape);
const updateScheduleSchema = z.object(scheduleShape).partial();

module.exports = { scheduleSchema, updateScheduleSchema };
