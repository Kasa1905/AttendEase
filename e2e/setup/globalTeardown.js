// e2e/setup/globalTeardown.js
const { globalTeardown } = require('./globalSetup');

module.exports = async () => {
  await globalTeardown();
};