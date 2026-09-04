const { z } = require("zod");

const phoneRegex = /^[0-9+\-\s()]{6,20}$/;

const createUserSchema = z.object({
  fullName: z.string().min(1, "Fullname wajib diisi").max(120),
  username: z
    .string()
    .min(3, "Username minimal 3 karakter")
    .max(50)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "username hanya boleh huruf, angka, titik, underscore, dash",
    ),
  email: z.string().email("Format email tidak valid").max(50),
  phone: z
    .string()
    .regex(phoneRegex, "format nomor telepon tidak valid")
    .optional()
    .or(z.literal("")),
  address: z.string().max(255).optional().or(z.literal("")),
  roleId: z.string().uuid("Roleid tidak valid"),
  password: z
    .string()
    .min(6, "Password minimal 6 karakter")
    .max(100)
    .optional(),
});

const updateUserSchema = createUserSchema.partial();

const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  phone: z.string().regex(phoneRegex).optional().or(z.literal("")),
  address: z.string().max(255).optional().or(z.literal("")),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

module.exports = { createUserSchema, updateUserSchema, updateProfileSchema };
