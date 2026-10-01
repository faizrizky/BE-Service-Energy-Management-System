const { prisma } = require("../../../src/frameworks/database/prismaClient");
const logger = require("../../../src/frameworks/helpers/logger");
const { httpError } = require("../../../src/frameworks/helpers/httpError");
const {
  hashToken,
  generateRawToken,
} = require("../../../src/frameworks/helpers/tokenHash");
const { logSecurityEvent } = require("../../../src/frameworks/helpers/securityLog");
const { resetPrismaMock } = require("../../helpers/prisma");

beforeEach(() => {
  resetPrismaMock(prisma);
  jest.clearAllMocks();
});

describe("httpError", () => {
  test("[positive] membuat Error dengan message dan status yang diberikan", () => {
    const err = httpError("Tidak ditemukan", 404);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Tidak ditemukan");
    expect(err.status).toBe(404);
  });

  test("[negative] tanpa status -> default 500", () => {
    expect(httpError("boom").status).toBe(500);
  });
});

describe("tokenHash", () => {
  test("[positive] hashToken deterministik dan berupa sha256 hex (64 char)", () => {
    const a = hashToken("secret-token");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken("secret-token")).toBe(a);
  });

  test("[negative] token berbeda -> hash berbeda", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  test("[positive] generateRawToken menghasilkan 80 char hex dan selalu unik", () => {
    const tokens = new Set(Array.from({ length: 50 }, generateRawToken));
    expect(tokens.size).toBe(50);
    for (const t of tokens) expect(t).toMatch(/^[0-9a-f]{80}$/);
  });
});

describe("logSecurityEvent", () => {
  test("[positive] menyimpan event lengkap dengan ip & user-agent dari request", async () => {
    prisma.securityEvent.create.mockResolvedValue({});
    await logSecurityEvent({
      type: "LOGIN_FAILED",
      username: "admin",
      userId: "u1",
      detail: "Password salah",
      req: { ip: "10.0.0.1", headers: { "user-agent": "jest" } },
    });

    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: {
        type: "LOGIN_FAILED",
        username: "admin",
        userId: "u1",
        ip: "10.0.0.1",
        userAgent: "jest",
        detail: "Password salah",
      },
    });
  });

  test("[positive] field opsional kosong & tanpa req -> disimpan sebagai null", async () => {
    prisma.securityEvent.create.mockResolvedValue({});
    await logSecurityEvent({ type: "PERMISSION_DENIED" });
    expect(prisma.securityEvent.create).toHaveBeenCalledWith({
      data: {
        type: "PERMISSION_DENIED",
        username: null,
        userId: null,
        ip: null,
        userAgent: null,
        detail: null,
      },
    });
  });

  test("[negative] DB error tidak dilempar ke pemanggil, hanya dicatat di log", async () => {
    prisma.securityEvent.create.mockRejectedValue(new Error("db down"));
    await expect(logSecurityEvent({ type: "X" })).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      "[SecurityLog] Gagal mencatat event:",
      "db down",
    );
  });
});

describe("formatDateTime", () => {
  const { formatDateTime } = jest.requireActual("../../../src/frameworks/helpers/dateFormat");
  const { config } = require("../../../src/config/config");

  test("[positive] pakai zona waktu aplikasi (Asia/Jakarta), bukan zona server", () => {
    expect(formatDateTime(new Date("2026-10-01T04:50:00Z"))).toBe("1 Okt 2026, 11.50");
  });

  test("[positive] ikut SCHEDULE_TIMEZONE kalau diganti", () => {
    const original = config.schedule.timezone;
    config.schedule.timezone = "UTC";
    try {
      expect(formatDateTime(new Date("2026-10-01T04:50:00Z"))).toBe("1 Okt 2026, 04.50");
    } finally {
      config.schedule.timezone = original;
    }
  });
});

describe("formatDateKey & formatTimeHm", () => {
  const { formatDateKey, formatTimeHm } = jest.requireActual("../../../src/frameworks/helpers/dateFormat");

  test("[positive] pakai jam WIB, termasuk ganti hari (18.30 UTC = 01.30 WIB besoknya)", () => {
    const at = new Date("2026-09-30T18:30:00Z");
    expect(formatDateKey(at)).toBe("2026-10-01");
    expect(formatTimeHm(at)).toBe("01:30");
  });

  test("[positive] jam 0-9 & tengah malam tetap 2 digit format 24 jam", () => {
    const at = new Date("2026-01-04T17:05:00Z"); // 00:05 WIB
    expect(formatDateKey(at)).toBe("2026-01-05");
    expect(formatTimeHm(at)).toBe("00:05");
  });

  test("[positive] nerima string ISO juga", () => {
    expect(formatTimeHm("2026-10-01T09:25:11.615Z")).toBe("16:25");
  });
});
