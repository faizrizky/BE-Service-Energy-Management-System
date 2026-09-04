const { z } = require("zod");

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const scheduleSchema = z.object({
  roomId: z.string().uuid("roomId tidak valid"),
  deviceId: z.string().uuid().optional().nullable().or(z.literal("")),
  action: z.enum(["on", "off"]),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format scheduledDate harus YYYY-MM-DD"),
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
});

const updateScheduleSchema = scheduleSchema.partial();

module.exports = { scheduleSchema, updateScheduleSchema };
