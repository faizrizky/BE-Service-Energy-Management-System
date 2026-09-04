const { z } = require("zod");

const createRoomSchema = z.object({
  name: z.string().min(1, "name wajib diisi").max(120),
  picName: z.string().max(120).optional().or(z.literal("")),
  picPhone: z.string().max(30).optional().or(z.literal("")),
  location: z.string().max(255).optional().or(z.literal("")),
  description: z.string().max(500).optional().or(z.literal("")),
  imageUrl: z
    .string()
    .url("Image Url harus URL valid")
    .optional()
    .or(z.literal("")),
  isCritical: z.boolean().optional(),
});

const updateRoomSchema = createRoomSchema.partial();

const powerActionSchema = z.object({
  action: z.enum(["on", "off"], { message: 'action harus "on" atau "off"' }),
});

module.exports = { createRoomSchema, updateRoomSchema, powerActionSchema };
