/** Jest configuration for the NIMCET mock project. */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/components", "<rootDir>/tests"],
  testMatch: ["**/__tests__/**/*.test.{ts,tsx}", "<rootDir>/tests/**/*.test.{ts,tsx}"],
  setupFiles: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { isolatedModules: true, esModuleInterop: true }],
  },
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
};
