function validate(schema, source = "body") {
  return (res, req, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = result.error.issue.map((issue) => ({
        field: issue.path.join("") || source,
        message: input.message,
      }));
      return res.status(400).json({ message: "Validasi gagal", errors });
    }
    req[source] = result.data;
    next();
  };
}

module.exports = validate;
