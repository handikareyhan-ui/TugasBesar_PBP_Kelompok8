'use strict';

require('dotenv').config();

// 1. Validate Environment Configurations
const { validateConfig } = require('./config/configValidator');
validateConfig();

// 2. Initialize Winston Logger
const logger = require('./config/logger');

const fs = require('fs');
const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./middleware/auth');
const { getContract, closeAllGateways } = require('./config/fabricConfig');

// Import routes
const recipientRoutes = require('./routes/recipient');
const eligibilityRoutes = require('./routes/eligibility');
const distributionRoutes = require('./routes/distribution');
const auditRoutes = require('./routes/audit');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

// Enable CORS
app.use(cors());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

logger.info(`BansosChain Server starting up. Environment: ${process.env.NODE_ENV}`);

// Connect to MongoDB
mongoose.set('bufferCommands', false); // Don't buffer, fail fast if not connected
mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 })
  .then(() => {
    logger.info('Successfully connected to MongoDB off-chain database');
  })
  .catch((err) => {
    if (process.env.NODE_ENV === 'production' || process.env.USE_MOCK === 'false') {
      logger.error(`Critical database connection failure: ${err.message}`);
    } else {
      logger.warn(`MongoDB not available. Running in in-memory simulation mode: ${err.message}`);
    }
  });

// ── In-Memory fallback store (used in Dev simulation mode ONLY) ──────────────────
const inMemoryDB = { recipients: [] };

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

// Patch RecipientOffchain model to proxy calls
const OrigRecipientOffchain = require('./models/RecipientOffchain');

global.RecipientOffchainStore = {
  async findOne(query) {
    if (isMongoReady()) return OrigRecipientOffchain.findOne(query);
    if (process.env.NODE_ENV === 'production' || process.env.USE_MOCK === 'false') {
      const err = new Error("Database Service Unavailable");
      err.statusCode = 503;
      err.code = "DATABASE_UNAVAILABLE";
      throw err;
    }
    const key = Object.keys(query)[0];
    return inMemoryDB.recipients.find(r => r[key] === query[key]) || null;
  },
  async find(query = {}) {
    if (isMongoReady()) return OrigRecipientOffchain.find(query).sort({ createdAt: -1 });
    if (process.env.NODE_ENV === 'production' || process.env.USE_MOCK === 'false') {
      const err = new Error("Database Service Unavailable");
      err.statusCode = 503;
      err.code = "DATABASE_UNAVAILABLE";
      throw err;
    }
    return [...inMemoryDB.recipients].reverse();
  },
  async save(doc) {
    if (isMongoReady()) {
      const m = new OrigRecipientOffchain(doc);
      return m.save();
    }
    if (process.env.NODE_ENV === 'production' || process.env.USE_MOCK === 'false') {
      const err = new Error("Database Service Unavailable");
      err.statusCode = 503;
      err.code = "DATABASE_UNAVAILABLE";
      throw err;
    }
    // In-memory: just push
    const record = { ...doc, _id: `mem-${Date.now()}`, createdAt: new Date() };
    inMemoryDB.recipients.push(record);
    return record;
  }
};

// ── Health & Readiness Endpoints ──────────────────────────────────────────────

// GET /health - basic liveness probe
app.get('/health', (req, res) => {
  return res.status(200).json({ status: "UP" });
});

// GET /ready - readiness probe (validates Fabric and MongoDB status)
app.get('/ready', async (req, res) => {
  const diagnostics = {};
  let isReady = true;

  // 1. Validate MongoDB Connectivity
  const mongoConnected = mongoose.connection.readyState === 1;
  diagnostics.mongodb = mongoConnected ? "CONNECTED" : "DISCONNECTED";
  if (!mongoConnected) {
    isReady = false;
  }

  // 2. Validate Wallet availability and Identity
  const walletPath = process.env.FABRIC_WALLET_PATH || path.resolve(__dirname, 'wallet');
  const walletExists = fs.existsSync(walletPath);
  diagnostics.wallet = walletExists ? "AVAILABLE" : "MISSING";
  if (!walletExists) {
    isReady = false;
  } else {
    try {
      const { Wallets } = require('fabric-network');
      const wallet = await Wallets.newFileSystemWallet(walletPath);
      const identity = await wallet.get('kemensos-user');
      diagnostics.identity = identity ? "FOUND" : "MISSING";
      if (!identity) {
        isReady = false;
      }
    } catch (e) {
      diagnostics.identity = "ERROR";
      diagnostics.identityError = e.message;
      isReady = false;
    }
  }

  // 3. Validate Connection Profile
  const ccpPath = process.env.FABRIC_NETWORK_PATH || path.resolve(__dirname, '..', 'network', 'connection-profile.json');
  const ccpExists = fs.existsSync(ccpPath);
  diagnostics.connectionProfile = ccpExists ? "AVAILABLE" : "MISSING";
  if (!ccpExists) {
    isReady = false;
  }

  // 4. Validate Fabric Gateway and Chaincode accessibility
  try {
    const isMock = process.env.USE_MOCK !== 'false';
    if (isMock) {
      diagnostics.mockFallback = "DETECTED (USE_MOCK is true)";
      isReady = false;
    } else {
      diagnostics.mockFallback = "NONE";
    }

    if (isReady) {
      const contract = await getContract('kemensos-user');
      if (contract) {
        diagnostics.fabricGateway = "CONNECTED";
        diagnostics.channelAccess = `SUCCESS (${process.env.FABRIC_CHANNEL || 'bansochannel'})`;
        diagnostics.contractAccess = `SUCCESS (${process.env.FABRIC_CHAINCODE || 'bansocc'})`;

        if (contract.isMock) {
          diagnostics.mockFallback = "DETECTED (contract is mock)";
          isReady = false;
        } else {
          // evaluateTransaction & Ledger read check (using the seeded recipient NIK)
          const evalResult = await contract.evaluateTransaction('getRecipient', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918');
          diagnostics.evaluateTransaction = "SUCCESS";
          diagnostics.ledgerRead = evalResult ? "SUCCESS" : "EMPTY";

          // submitTransaction check via business-impact-free ping
          const submitResult = await contract.submitTransaction('ping');
          diagnostics.submitTransaction = "SUCCESS";
          diagnostics.pingResponse = submitResult.toString('utf8');
        }
      } else {
        diagnostics.fabricGateway = "FAILED";
        diagnostics.channelAccess = "FAILED";
        diagnostics.contractAccess = "FAILED";
        isReady = false;
      }
    }
  } catch (err) {
    diagnostics.fabricGateway = "FAILED";
    diagnostics.fabricError = err.message;
    isReady = false;
  }

  if (isReady) {
    return res.status(200).json({ status: "READY" });
  } else {
    return res.status(503).json({ status: "NOT_READY", diagnostics });
  }
});

// Demo login route to simulate identities
app.post('/api/auth/login', (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    const err = new Error("Nama pengguna dan kata sandi wajib diisi");
    err.statusCode = 400;
    err.code = "BAD_REQUEST";
    return next(err);
  }

  // Pre-configured users for easy demonstration
  let role = "";
  if (username === "kemensos" && password === "admin123") {
    role = "admin"; // Kemensos Admin
  } else if (username === "dinsos" && password === "admin123") {
    role = "admin"; // Dinsos Admin
  } else if (username === "bank" && password === "bank123") {
    role = "bank"; // Bank Penyalur
  } else if (username === "auditor" && password === "audit123") {
    role = "auditor"; // Auditor
  } else {
    logger.warn(`Authentication failure attempt for username: ${username}`);
    const err = new Error("Nama pengguna atau kata sandi salah");
    err.statusCode = 401;
    err.code = "UNAUTHORIZED";
    return next(err);
  }

  const token = jwt.sign(
    { username, role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  logger.info(`Successful login for user: ${username} with role: ${role}`);
  
  return res.status(200).json({
    message: "Login berhasil",
    token,
    username,
    role
  });
});

// Register REST API endpoints
app.use('/api/recipient', recipientRoutes);
app.use('/api/eligibility', eligibilityRoutes);
app.use('/api/distribution', distributionRoutes);
app.use('/api/audit', auditRoutes);

// General status route
app.get('/api/status', (req, res) => {
  return res.status(200).json({
    status: "online",
    system: "BansosChain",
    blockchainMode: process.env.USE_MOCK !== 'false' ? "Simulation (Mock Ledger)" : "Hyperledger Fabric",
    offchainDB: isMongoReady() ? "Connected" : "Simulated In-Memory"
  });
});

// 5. Centralized Error Handler (registered last)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Start Server
const serverInstance = app.listen(PORT, () => {
  logger.info(`BansosChain Backend API Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

// 8. Graceful Shutdown Handler
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Graceful shutdown starting...`);

  // Close server first to stop accepting new requests
  serverInstance.close(async () => {
    logger.info('HTTP REST API server closed.');

    // Disconnect cached Fabric connections
    try {
      await closeAllGateways();
      logger.info('All Fabric gateways closed successfully.');
    } catch (err) {
      logger.error(`Error shutting down Fabric gateways: ${err.message}`);
    }

    // Disconnect MongoDB client
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        logger.info('MongoDB database connection closed.');
      }
    } catch (err) {
      logger.error(`Error shutting down MongoDB connection: ${err.message}`);
    }

    logger.info('Graceful shutdown complete. Exiting process.');
    process.exit(0);
  });

  // Force close process after 10 seconds if hanging
  setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing process exit.');
    process.exit(1);
  }, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = app;
