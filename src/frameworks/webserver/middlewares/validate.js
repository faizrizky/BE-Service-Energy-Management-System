/**
 * Bikin middleware validasi zod buat req.body (atau source lain): bales 400
 * plus daftar error per field, atau ganti req[source] pake data hasil parse.
 *
 * Dipake di: Route yang nerima body di routes auth, device, gateway, role,
 *   room, schedule, sama user.
 */
function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join(".") || source,
        message: issue.message,
      }));
      return res.status(400).json({ message: "Validasi gagal", errors });
    }

    req[source] = result.data;
    next();
  };
}

module.exports = validate;
