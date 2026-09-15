module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  setupFiles: ["<rootDir>/tests/setup/env.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup/mocks.js"],
  testTimeout: 10000,

  collectCoverageFrom: [
    "src/**/*.js",
    "!src/app.js",
    // Kode lama yang sudah tidak dipakai (diganti ChirpStack), tidak di-mount di server.
    "!src/frameworks/mqtt/**",
    "!src/frameworks/thingsboard/**",
    "!src/adapters/controllers/thingsboard-webhook.controller.js",
    "!src/frameworks/webserver/routes/thingsboard.routes.js",
    "!src/frameworks/webserver/requireCaptcha.js",
    "!**/node_modules/**",
  ],
  verbose: true,
};
