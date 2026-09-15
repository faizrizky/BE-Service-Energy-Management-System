const MODELS = [
  "user",
  "role",
  "permission",
  "rolePermission",
  "refreshToken",
  "room",
  "gateway",
  "device",
  "energyReading",
  "schedule",
  "commandLog",
  "webhookEvent",
  "securityEvent",
];

const METHODS = [
  "findUnique",
  "findFirst",
  "findMany",
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
];

function applyDefaults(prisma) {
  prisma.$transaction.mockImplementation(async (arg) =>
    typeof arg === "function" ? arg(prisma) : Promise.all(arg),
  );
}

function createPrismaMock() {
  const prisma = {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
  for (const model of MODELS) {
    prisma[model] = {};
    for (const method of METHODS) prisma[model][method] = jest.fn();
  }
  applyDefaults(prisma);
  return prisma;
}

/** Reset call & implementasi semua mock, lalu pasang lagi default $transaction. */
function resetPrismaMock(prisma) {
  for (const value of Object.values(prisma)) {
    if (typeof value === "function" && value.mockReset) {
      value.mockReset();
    } else if (value && typeof value === "object") {
      for (const fn of Object.values(value)) fn.mockReset?.();
    }
  }
  applyDefaults(prisma);
}

module.exports = { createPrismaMock, resetPrismaMock, MODELS, METHODS };
