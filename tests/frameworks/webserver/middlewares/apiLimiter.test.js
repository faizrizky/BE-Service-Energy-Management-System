// Limiter global dites lewat HTTP beneran: jatah dihitung per user (token valid), bukan per IP.
const express = require("express");
const jwt = require("jsonwebtoken");

let server;
let base;

beforeAll(async () => {
  let apiLimiter;
  jest.isolateModules(() => {
    // config harus diambil di dalam isolateModules biar instance-nya sama dengan yang dipakai limiter.
    require("../../../../src/config/config").config.rateLimit.max = 2;
    ({ apiLimiter } = require("../../../../src/frameworks/webserver/middlewares/rateLimiter"));
  });
  const app = express();
  app.use(apiLimiter);
  app.get("/x", (req, res) => res.json({ ok: true }));
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/x`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

const tokenFor = (id, sid) => jwt.sign({ id, sid }, process.env.JWT_SECRET, { expiresIn: "5m" });
const hit = async (token) =>
  (await fetch(base, { headers: token ? { Authorization: `Bearer ${token}` } : {} })).status;

describe("apiLimiter (kunci per user)", () => {
  test("[positive] dua user di IP yang sama punya jatah sendiri-sendiri", async () => {
    const a = tokenFor("user-a");
    const b = tokenFor("user-b");
    expect([await hit(a), await hit(a), await hit(a)]).toEqual([200, 200, 429]);
    expect(await hit(b)).toBe(200);
  });

  test("[positive] akun yang sama dipakai banyak orang (SQA + dev): tiap login (sid beda) punya jatah sendiri", async () => {
    const sqa = tokenFor("akun-bersama", "sesi-sqa");
    const dev = tokenFor("akun-bersama", "sesi-dev");
    expect([await hit(sqa), await hit(sqa), await hit(sqa)]).toEqual([200, 200, 429]);
    expect(await hit(dev)).toBe(200);
  });

  test("[positive] sid sama (beberapa tab, satu login) berbagi satu jatah", async () => {
    const tabA = tokenFor("akun-x", "sesi-x");
    const tabB = tokenFor("akun-x", "sesi-x");
    expect([await hit(tabA), await hit(tabB), await hit(tabA)]).toEqual([200, 200, 429]);
  });

  test("[negative] tanpa token jatuh ke IP, tetap dibatasi", async () => {
    expect([await hit(), await hit(), await hit()]).toEqual([200, 200, 429]);
  });

  test("[negative] token palsu (secret salah) nggak dapat jatah user sendiri -> jatuh ke IP yang udah habis", async () => {
    const forged = jwt.sign({ id: "user-baru" }, "secret-lain");
    expect(await hit(forged)).toBe(429);
  });
});
