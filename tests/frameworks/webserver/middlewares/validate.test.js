const { z } = require("zod");
const validate = require("../../../../src/frameworks/webserver/middlewares/validate");
const { mockReq, mockRes, mockNext } = require("../../../helpers/http");

const schema = z.object({
  name: z.string().min(1, "name wajib"),
  age: z.coerce.number().int().min(1, "age minimal 1"),
  address: z.object({ city: z.string().min(1, "city wajib") }).optional(),
});

function run(mw, reqOverrides) {
  const req = mockReq(reqOverrides);
  const res = mockRes();
  const next = mockNext();
  mw(req, res, next);
  return { req, res, next };
}

describe("validate middleware", () => {
  test("[positive] body valid -> next() & req.body diganti hasil parse (coerce)", () => {
    const { req, next, res } = run(validate(schema), {
      body: { name: "AC", age: "5", extra: "dibuang" },
    });
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.body).toEqual({ name: "AC", age: 5 });
  });

  test("[negative] body invalid -> 400 dengan daftar error per field", () => {
    const { res, next } = run(validate(schema), { body: { name: "", age: 0 } });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Validasi gagal",
      errors: expect.arrayContaining([
        { field: "name", message: "name wajib" },
        { field: "age", message: "age minimal 1" },
      ]),
    });
  });

  test("[negative] error di field nested -> path digabung titik", () => {
    const { res } = run(validate(schema), {
      body: { name: "a", age: 1, address: { city: "" } },
    });
    expect(res.json.mock.calls[0][0].errors).toEqual([
      { field: "address.city", message: "city wajib" },
    ]);
  });

  test("[negative] body bukan object -> field fallback ke nama source", () => {
    const { res } = run(validate(schema), { body: "string" });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].errors[0].field).toBe("body");
  });

  test("[positive] source 'query' divalidasi dari req.query", () => {
    const { req, next } = run(validate(z.object({ page: z.coerce.number() }), "query"), {
      query: { page: "2" },
    });
    expect(next).toHaveBeenCalled();
    expect(req.query).toEqual({ page: 2 });
  });
});
