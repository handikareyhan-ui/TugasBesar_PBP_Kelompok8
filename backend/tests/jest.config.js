'use strict';

const path = require('path');

module.exports = {
  testEnvironment: 'node',
  rootDir: path.resolve(__dirname, '..'),
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  verbose: true,
  testTimeout: 30000,
  forceExit: true
};
