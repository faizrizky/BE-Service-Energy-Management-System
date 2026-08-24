module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],

  collectCoverageFrom: [
    "src/application/use_cases/**/*.js",
    "!**/node_modules/**",
  ],
  verbose: true,
};
