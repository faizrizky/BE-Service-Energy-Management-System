const { z } = require("zod");

const createGatewaySchema = z.object({
  eui: z.string().min(1, "eui wajib diisi").max(100),
  name: z.string().min(1, "Name gateway wajib diisi").max(120),
  description: z.string().max(500).optional().or(z.literal("")),
  simcard: z.string().max(50).optional().or(z.literal("")),
  powerSource: z.string().max(50).optional().or(z.literal("")),
  modelUnit: z.string().max(100).optional().or(z.literal("")),
  installationDate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .or(z.literal("")),
  installedById: z.string().uuid().optional().or(z.literal("")),
});

const updateGatewaySchema = createGatewaySchema.partial();

module.exports = { createGatewaySchema, updateGatewaySchema };
