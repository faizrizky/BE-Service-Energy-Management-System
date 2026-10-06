const mockRedis = { set: jest.fn(), exists: jest.fn() };
jest.mock("../../../src/frameworks/tools/redisClient", () => ({ getRedisClient: () => mockRedis }));

const { config } = require("../../../src/config/config");
const { revokeSession, isSessionRevoked } = require("../../../src/frameworks/helpers/sessionRevocation");

beforeEach(() => jest.clearAllMocks());

describe("sessionRevocation", () => {
  test("[positive] revokeSession -> key per sesi dengan TTL umur refresh token", async () => {
    await revokeSession("rt1");
    expect(mockRedis.set).toHaveBeenCalledWith(
      "auth:revoked-session:rt1",
      "1",
      "EX",
      config.jwt.refreshExpiresDays * 24 * 60 * 60,
    );
  });

  test("[positive] isSessionRevoked -> true kalau key ada", async () => {
    mockRedis.exists.mockResolvedValue(1);
    await expect(isSessionRevoked("rt1")).resolves.toBe(true);
    expect(mockRedis.exists).toHaveBeenCalledWith("auth:revoked-session:rt1");
  });

  test("[negative] key nggak ada -> false", async () => {
    mockRedis.exists.mockResolvedValue(0);
    await expect(isSessionRevoked("rt1")).resolves.toBe(false);
  });

  test("[negative] token lama tanpa sid -> false tanpa nanya Redis", async () => {
    await expect(isSessionRevoked(undefined)).resolves.toBe(false);
    expect(mockRedis.exists).not.toHaveBeenCalled();
  });
});
