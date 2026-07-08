'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
const RecipientOffchain = require('../models/RecipientOffchain');
const { getContract, clearGatewayCache } = require('../config/fabricConfig');
const { buildPoseidon } = require('circomlibjs');
const logger = require('../config/logger');

let poseidon;
async function getPoseidon() {
  if (!poseidon) {
    poseidon = await buildPoseidon();
  }
  return poseidon;
}

// Helper to calculate SHA-256 hash
function calculateHash(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Helper to map authenticated user to Fabric wallet identity
function getIdentityName(req) {
  if (!req || !req.user) return 'kemensos-user';
  if (req.user.username === 'kemensos') return 'kemensos-user';
  if (req.user.username === 'dinsos') return 'dinsos-user';
  if (req.user.username === 'bank') return 'bank-user';
  return 'kemensos-user';
}

// In-memory fallback store proxy
function getStore() {
  return global.RecipientOffchainStore || {
    findOne: (q) => RecipientOffchain.findOne(q),
    find: () => RecipientOffchain.find({}).sort({ createdAt: -1 }),
    save: (doc) => new RecipientOffchain(doc).save(),
  };
}

// Register a new recipient (Dinsos / Kemensos role only)
async function registerRecipient(req, res, next) {
  const { nik, name, address = '', region, actualIncome, dependents, documentText } = req.body;

  if (!nik || !name || !region || actualIncome === undefined || actualIncome === null || actualIncome === '') {
    const err = new Error("Missing required fields");
    err.statusCode = 400;
    err.code = "BAD_REQUEST";
    return next(err);
  }

  // Generate pseudonym ID from NIK hash
  const recipientID = calculateHash(nik);

  // Calculate document hash
  const docContent = documentText || `doc-verif-${nik}-${region}-${actualIncome}-${dependents || 2}`;
  const documentHash = calculateHash(docContent);

  logger.info(`Attempting registration of recipient ID: ${recipientID} in region ${region}`);

  let session = null;
  
  try {
    const store = getStore();

    // Check if recipient already exists
    const existingOffchain = await store.findOne({ recipientID });
    if (existingOffchain) {
      const err = new Error("Recipient with this NIK already registered");
      err.statusCode = 409;
      err.code = "DUPLICATE_RECORD";
      return next(err);
    }

    // Generate cryptographically secure salt (avoiding Math.random)
    const salt = crypto.randomInt(100000000, 999999999).toString();
    const p = await getPoseidon();
    const hash = p([BigInt(nik), BigInt(salt)]);
    const recipientCommitment = p.F.toString(hash);

    const newDoc = {
      recipientID,
      nik,
      name,
      address,
      region,
      actualIncome: Number(actualIncome),
      dependents: Number(dependents || 2),
      documentHash,
      documentPath: `/uploads/${recipientID}_doc.txt`,
      salt,
      recipientCommitment
    };

    // Try starting a mongoose session for transactions (only supported on Replica Sets)
    try {
      if (mongoose.connection.readyState === 1) {
        session = await mongoose.startSession();
        session.startTransaction();
        logger.debug("Started MongoDB session transaction");
      }
    } catch (sessionErr) {
      logger.warn(`MongoDB sessions/transactions not supported on this deployment: ${sessionErr.message}. Using manual rollback.`);
      session = null;
    }

    // 1. Save to off-chain DB
    if (session) {
      const modelInstance = new RecipientOffchain(newDoc);
      await modelInstance.save({ session });
      logger.info(`Recipient ID: ${recipientID} off-chain record saved in transaction`);
    } else {
      await store.save(newDoc);
      logger.info(`Recipient ID: ${recipientID} off-chain record saved without transaction`);
    }

    // 2. Invoke Chaincode to register recipient on the blockchain ledger
    try {
      const identity = getIdentityName(req);
      const contract = await getContract(identity);
      const actor = req.user ? `${req.user.role}-${req.user.username}` : "KemensosAdmin";
      
      logger.info(`Submitting Fabric transaction 'registerRecipient' for ID: ${recipientID}`);
      await contract.submitTransaction('registerRecipient', recipientID, region, documentHash, recipientCommitment, actor);

      // Commit MongoDB transaction if using session
      if (session) {
        await session.commitTransaction();
        logger.info(`Committed MongoDB transaction for ID: ${recipientID}`);
      }
      logger.info(`Recipient registered successfully. ID: ${recipientID}`);
    } catch (fabricErr) {
      logger.error(`Fabric blockchain write failed for recipient ID: ${recipientID}: ${fabricErr.message}`);
      
      // Rollback database changes
      if (session) {
        await session.abortTransaction();
        logger.warn(`Aborted MongoDB transaction for recipient ID: ${recipientID}`);
      } else if (mongoose.connection.readyState === 1) {
        // Manual rollback: delete the off-chain record
        await RecipientOffchain.deleteOne({ recipientID });
        logger.warn(`Executed manual rollback (delete) of off-chain record for ID: ${recipientID}`);
      }

      // Evict failed Fabric client connection
      clearGatewayCache(getIdentityName(req));

      const customErr = new Error(`Fabric ledger registration failed: ${fabricErr.message}`);
      customErr.statusCode = fabricErr.statusCode || 503;
      customErr.code = fabricErr.code || "LEDGER_WRITE_FAILED";
      return next(customErr);
    }

    return res.status(201).json({
      message: "Recipient registered successfully",
      recipientID,
      region,
      documentHash,
      offchainRecord: {
        name,
        region,
        actualIncome,
        dependents: Number(dependents || 2)
      }
    });

  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (e) {
        // ignore
      }
    }
    return next(error);
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

// Get all off-chain recipients for dashboard (Authorized Admins only)
async function getAllRecipients(req, res, next) {
  try {
    const store = getStore();
    logger.info(`Fetch all recipients requested by ${req.user ? req.user.username : 'system'}`);
    const recipients = await store.find({});
    return res.status(200).json(recipients);
  } catch (error) {
    return next(error);
  }
}

// Get off-chain detail by recipientID
async function getRecipientDetails(req, res, next) {
  try {
    const { recipientID } = req.params;
    const store = getStore();
    logger.info(`Recipient details requested for ID: ${recipientID} by ${req.user ? req.user.username : 'system'}`);
    const recipient = await store.findOne({ recipientID });
    if (!recipient) {
      const err = new Error("Recipient not found off-chain");
      err.statusCode = 404;
      err.code = "NOT_FOUND";
      return next(err);
    }
    return res.status(200).json(recipient);
  } catch (error) {
    return next(error);
  }
}

// Secure method for public NIK query mapping
async function queryPublicStatus(req, res, next) {
  try {
    const { hash } = req.params;
    const store = getStore();
    logger.info(`Public query status check for recipient hash: ${hash}`);
    const recipient = await store.findOne({ recipientID: hash });
    if (!recipient) {
      const err = new Error("No profile matching hash");
      err.statusCode = 404;
      err.code = "NOT_FOUND";
      return next(err);
    }
    return res.status(200).json({ recipientID: recipient.recipientID, region: recipient.region, salt: recipient.salt });
  } catch (error) {
    return next(error);
  }
}

// Revoke eligibility of a recipient (Admin role only)
async function revokeRecipientAccess(req, res, next) {
  const { recipientID, reason } = req.body;

  if (!recipientID) {
    const err = new Error("Missing recipientID");
    err.statusCode = 400;
    err.code = "BAD_REQUEST";
    return next(err);
  }

  logger.info(`Starting access revocation for recipient ID: ${recipientID}`);

  try {
    const identity = getIdentityName(req);
    const contract = await getContract(identity);
    const actor = req.user ? `${req.user.role}-${req.user.username}` : "KemensosAdmin";

    logger.info(`Submitting Fabric transaction 'revokeAccess' for ID: ${recipientID} by actor ${actor}`);
    const ledgerUpdate = await contract.submitTransaction('revokeAccess', recipientID, reason || "Revocation request", actor);
    const updatedRecipient = JSON.parse(ledgerUpdate.toString('utf8'));

    logger.info(`Recipient ID: ${recipientID} access revoked successfully. Ledger updated.`);

    return res.status(200).json({
      message: "Recipient access revoked successfully",
      recipientID,
      eligible: updatedRecipient.eligible,
      recipient: updatedRecipient
    });

  } catch (error) {
    logger.error(`Revocation failed for recipient ID: ${recipientID}: ${error.message}`);
    clearGatewayCache(getIdentityName(req));

    const customErr = new Error(`Fabric transaction failed: ${error.message}`);
    customErr.statusCode = error.statusCode || 503;
    customErr.code = error.code || "LEDGER_WRITE_FAILED";
    return next(customErr);
  }
}

module.exports = {
  registerRecipient,
  getAllRecipients,
  getRecipientDetails,
  queryPublicStatus,
  revokeRecipientAccess
};
