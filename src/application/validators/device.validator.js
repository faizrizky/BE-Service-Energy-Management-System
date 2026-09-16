const { z } = require("zod");

const createDeviceSchema = z.object({
  eui: z
    .string()
    .regex(
      /^[0-9a-fA-F]{16}$/,
      "eui harus devEUI ChirpStack (16 karakter hex)",
    ),
  name: z.string().min(1, "name wajib diisi").max(120),
  deviceType: z.string().max(50).optional().or(z.literal("")),
  intervalMinutes: z.coerce
    .number()
    .int()
    .min(15, "Interval minutes minimal 15")
    .max(1440)
    .optional(),
  roomId: z.string().uuid("Room Id tidak valid"),
  gatewayId: z.string().uuid("Gateway Id tidak valid"),
});

const updateDeviceSchema = createDeviceSchema.partial();

const powerActionSchema = z.object({
  action: z.enum(["on", "off"], { message: 'action harus "on" atau "off"' }),
});

const telemetryPingSchema = z.object({
  timeout: z.coerce
    .number()
    .int()
    .min(5000, "timeout minimal 5000 ms")
    .max(300000, "timeout maksimal 300000 ms")
    .optional(),
});

const intervalSchema = z.object({
  intervalMinutes: z.coerce
    .number()
    .int()
    .min(15, "Interval minutes minimal 15")
    .max(1440, "Interval minutes maksimal 1440"),
});

module.exports = {
  createDeviceSchema,
  updateDeviceSchema,
  powerActionSchema,
  telemetryPingSchema,
  intervalSchema,
};
