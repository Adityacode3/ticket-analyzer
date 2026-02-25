// backend/jest.config.js
// Jest configuration for the backend test suite.
//
// We use the default Node test environment (not jsdom) since this
// is a pure Node.js/Express backend with no browser APIs.
// --runInBand is set in package.json to run tests serially,
// which avoids race conditions if tests ever touch a real DB.

'use strict';

module.exports = {
  // Use Node.js environment (default for backend — no DOM needed)
  testEnvironment: 'node',

  // Look for tests in the /tests directory or any __tests__ folder
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.test.js',
  ],

  // Collect coverage from analyzer and config only
  // (service/controller coverage would require a live DB — out of scope here)
  collectCoverageFrom: [
    'src/analyzer/**/*.js',
    'src/config/**/*.js',
  ],

  // Print each test name as it runs for easy debugging
  verbose: true,

  // Fail fast: stop after first test suite failure
  // Remove this line if you want all suites to run regardless
  // bail: 1,

  // How long (ms) before a single test is considered hung
  testTimeout: 10000,
};