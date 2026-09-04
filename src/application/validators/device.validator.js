const { z } = require("zod");

const createDeviceSchema = z.object({
  eui: z.string().min(1, "eui wajib diisi").max(100),
  tbDeviceId: z
    .string()
    .uuid("tbDeviceId harus UUID valid")
    .optional()
    .nullable()
    .or(z.literal("")),
  name: z.string().min(1, "name wajib diisi").max(120),
  deviceType: z.string().max(50).optional().or(z.literal("")),
  intervalMinutes: z.coerce
    .number()
    .int()
    .min(1, "Interval minutes minimal 1")
    .max(1440)
    .optional(),
  roomId: z.string().uuid("Room Id tidak valid"),
  gatewayId: z.string().uuid("Gateway Id tidak valid"),
});

const updateDeviceSchema = createDeviceSchema.partial();

const powerActionSchema = z.object({
  action: z.enum(["on", "off"], { message: 'action harus "on" atau "off"' }),
});

module.exports = { createDeviceSchema, updateDeviceSchema, powerActionSchema };
