'use strict';

const { getContract, clearGatewayCache } = require('../config/fabricConfig');
const logger = require('../config/logger');

// Helper to map authenticated user to Fabric wallet identity
function getIdentityName(req) {
  if (!req || !req.user) return 'kemensos-user';
  if (req.user.username === 'kemensos') return 'kemensos-user';
  if (req.user.username === 'dinsos') return 'dinsos-user';
  if (req.user.username === 'bank') return 'bank-user';
  return 'kemensos-user';
}

// Distribute social assistance funds (Bank role only)
async function distributeBansos(req, res, next) {
  if (!req.user || req.user.role !== 'bank') {
    const err = new Error("Unauthorized: Only Bank is authorized to execute distributeFunds");
    err.statusCode = 403;
    err.code = "UNAUTHORIZED";
    return next(err);
  }

  const { recipientID } = req.body;

  if (!recipientID) {
    const err = new Error("Missing recipientID");
    err.statusCode = 400;
    err.code = "BAD_REQUEST";
    return next(err);
  }

  logger.info(`Starting bansos disbursement check for recipient ID: ${recipientID}`);

  try {
    const identity = getIdentityName(req);
    const contract = await getContract(identity);
    const actor = req.user ? `${req.user.role}-${req.user.username}` : "BankPenyalurAdmin";

    // Pre-verify conditions on-ledger
    logger.info(`Pre-verifying distribution status for recipient: ${recipientID}`);
    const ledgerState = await contract.evaluateTransaction('getRecipient', recipientID);
    const recipient = JSON.parse(ledgerState.toString('utf8'));

    if (recipient.zkpVerified !== true) {
      const err = new Error(`The recipient ${recipientID} has not verified eligibility via Zero-Knowledge Proof`);
      err.statusCode = 400;
      err.code = "DISTRIBUTION_POLICY_VIOLATION";
      return next(err);
    }

    if (recipient.eligible !== true) {
      const err = new Error(`The recipient ${recipientID} is not marked as eligible for bansos`);
      err.statusCode = 400;
      err.code = "DISTRIBUTION_POLICY_VIOLATION";
      return next(err);
    }

    if (recipient.fundsDistributed !== false) {
      const err = new Error(`The recipient ${recipientID} has already received funds`);
      err.statusCode = 400;
      err.code = "DISTRIBUTION_POLICY_VIOLATION";
      return next(err);
    }

    logger.info(`Submitting Fabric transaction 'distributeFunds' for ID: ${recipientID} by actor ${actor}`);
    
    // Submit transaction to blockchain
    const ledgerUpdate = await contract.submitTransaction('distributeFunds', recipientID, actor);
    const updatedRecipient = JSON.parse(ledgerUpdate.toString('utf8'));

    logger.info(`Bansos disbursement succeeded for ID: ${recipientID}. Ledger updated.`);

    return res.status(200).json({
      message: "Bansos funds distributed successfully",
      recipientID,
      fundsDistributed: updatedRecipient.fundsDistributed,
      recipient: updatedRecipient
    });

  } catch (error) {
    logger.error(`Bansos disbursement failed for ID: ${recipientID}: ${error.message}`);
    
    // Evict failed Fabric client connection
    clearGatewayCache(getIdentityName(req));

    // Handle nonexistent recipient errors
    if (error.message.includes("does not exist")) {
      const notFoundErr = new Error(error.message);
      notFoundErr.statusCode = 404;
      notFoundErr.code = "NOT_FOUND";
      return next(notFoundErr);
    }

    // Handle duplicate distribution or eligibility check errors specifically from smart contract
    if (error.message.includes("already received") || error.message.includes("not marked as eligible") || error.message.includes("not verified eligibility")) {
      const policyErr = new Error(error.message);
      policyErr.statusCode = 400;
      policyErr.code = "DISTRIBUTION_POLICY_VIOLATION";
      return next(policyErr);
    }

    const customErr = new Error(`Fabric transaction failed: ${error.message}`);
    customErr.statusCode = error.statusCode || 503;
    customErr.code = error.code || "LEDGER_WRITE_FAILED";
    return next(customErr);
  }
}

module.exports = {
  distributeBansos
};
