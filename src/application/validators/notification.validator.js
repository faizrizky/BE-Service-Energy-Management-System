const { z } = require("zod");

const createNotificationSchema = z.object({
  data: z.union([ z.record(z.string(), z.unknown()), z.array(z.record(z.string(), z.unknown())), ]),
  eventType: z.enum(["success", "SUCCESS", "warning", "WARNING"]).optional().or(z.literal("")),
  message: z.string().max(255).optional().or(z.literal("")),
  readAt: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
});

const findNotificationSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  rowsPerPage: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  orderBy: z.enum(["asc", "ASC", "desc", "DESC"]).optional(),
  readAt: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
});

module.exports = { createNotificationSchema, findNotificationSchema };
