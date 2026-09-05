const { z } = require("zod");

const loginSchema = z.object({
  username: z.string().min(1, "Username wajib diisi").max(100),
  password: z.string().min(1, "Password wajib diisi").max(100),
  captchaToken: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20, "Refresh Token tidak valid"),
});

module.exports = { loginSchema, refreshSchema };
