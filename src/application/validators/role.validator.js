const { z } = require("zod");

const createRoleSchema = z.object({
  name: z.string().min(1, "Role name wajib diisi").max(80),
  description: z.string().max(300).optional().or(z.literal("")),
  permissionIds: z.array(z.string().uuid()).optional(),
});

const updateRoleSchema = createRoleSchema.partial();

module.exports = { createRoleSchema, updateRoleSchema };
