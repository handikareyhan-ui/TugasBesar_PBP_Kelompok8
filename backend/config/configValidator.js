'use strict';

function validateConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  const requiredVars = [
    'NODE_ENV',
    'JWT_SECRET',
    'MONGODB_URI',
    'USE_MOCK',
    'FABRIC_NETWORK_PATH',
    'FABRIC_WALLET_PATH',
    'FABRIC_CHANNEL',
    'FABRIC_CHAINCODE'
  ];

  const missing = [];

  for (const variable of requiredVars) {
    if (!process.env[variable]) {
      missing.push(`${variable} is not set in environment`);
    }
  }

  // Reject default JWT secrets when NODE_ENV=production
  if (isProduction && process.env.JWT_SECRET === 'bansoschain_secret_key_2026') {
    missing.push("JWT_SECRET cannot use the default value ('bansoschain_secret_key_2026') in production mode");
  }

  // Reject USE_MOCK = true in production mode
  if (isProduction && process.env.USE_MOCK === 'true') {
    missing.push("USE_MOCK cannot be 'true' in production mode");
  }

  if (missing.length > 0) {
    console.error("\n==================================================");
    console.error("❌ CRITICAL: CONFIGURATION VALIDATION FAILED");
    console.error("Startup terminated due to the following errors:");
    missing.forEach(err => console.error(`   - ${err}`));
    console.error("==================================================\n");
    process.exit(1);
  }
}

module.exports = { validateConfig };
