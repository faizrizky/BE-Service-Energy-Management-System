// Mock global infrastruktur: tidak boleh ada koneksi Redis/BullMQ/Postgres
// sungguhan di unit test. File test tetap boleh override dengan jest.mock sendiri.

jest.mock("bullmq", () => {
  class Queue {
    constructor(name, opts) {
      this.name = name;
      this.opts = opts;
      this.add = jest.fn().mockResolvedValue({ id: "job" });
      this.close = jest.fn().mockResolvedValue(undefined);
    }
  }

  class Worker {
    constructor(name, processor, opts) {
      this.name = name;
      this.processor = processor;
      this.opts = opts;
      this.handlers = {};
      this.on = jest.fn((event, handler) => {
        this.handlers[event] = handler;
        return this;
      });
      this.close = jest.fn().mockResolvedValue(undefined);
    }
  }

  return { Queue, Worker };
});

jest.mock("ioredis", () =>
  jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    ping: jest.fn().mockResolvedValue("PONG"),
    quit: jest.fn().mockResolvedValue("OK"),
  })),
);

jest.mock("../../src/frameworks/database/prismaClient", () => {
  const { createPrismaMock } = require("../helpers/prisma");
  return {
    prisma: createPrismaMock(),
    connectDatabase: jest.fn(),
    disconnectDatabase: jest.fn(),
  };
});

jest.mock("../../src/frameworks/helpers/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
