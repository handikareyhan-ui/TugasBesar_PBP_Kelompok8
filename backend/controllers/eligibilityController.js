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

// Verify ZKP Proof and update ledger status (business logic delegated on-chain)
async function verifyEligibility(req, res, next) {
  const { recipientID, proof, publicSignals } = req.body;

  if (!recipientID || !proof || !publicSignals) {
    const err = new Error("Missing recipientID, proof, or publicSignals");
    err.statusCode = 400;
    err.code = "BAD_REQUEST";
    return next(err);
  }

  // Basic structure check for JSON inputs
  if (typeof proof !== 'object' || !Array.isArray(publicSignals)) {
    const err = new Error("Invalid proof or publicSignals payload structure");
    err.statusCode = 400;
    err.code = "BAD_REQUEST";
    return next(err);
  }

  logger.info(`Forwarding ZKP proof verification for recipient ID: ${recipientID} directly on-chain`);

  try {
    const contract = await getContract(getIdentityName(req));
    const actor = req.user ? `${req.user.role}-${req.user.username}` : "KemensosSystem";

    // Forward proof and publicSignals directly to the chaincode
    const ledgerUpdate = await contract.submitTransaction(
      'verifyZKP',
      recipientID,
      JSON.stringify(proof),
      JSON.stringify(publicSignals),
      actor
    );

    const updatedRecipient = JSON.parse(ledgerUpdate.toString('utf8'));
    logger.info(`On-chain proof verification returned success for recipient ID: ${recipientID}`);

    return res.status(200).json({
      message: "ZKP verification succeeded",
      zkpVerified: true,
      eligible: updatedRecipient.eligible,
      recipient: updatedRecipient
    });

  } catch (error) {
    // Detect double spending/replay attempts from the smart contract error message
    if (error.message.includes("already been spent") || error.message.includes("spent")) {
      logger.warn(`[REPLAY ATTACK ATTEMPT] On-chain check detected replay for recipientID: ${recipientID}`);
      const replayErr = new Error("ZKP proof has already been spent");
      replayErr.statusCode = 400;
      replayErr.code = "REPLAY_ATTACK_ATTEMPT";
      return next(replayErr);
    }

    // Detect ZKP cryptographic failures
    if (error.message.includes("Invalid Zero-Knowledge Proof") || error.message.includes("kriptografi") || error.message.includes("ZKP")) {
      logger.warn(`On-chain ZKP verification rejected proof for recipient ID: ${recipientID}`);
      const zkpErr = new Error("ZKP verification failed: invalid cryptographic proof");
      zkpErr.statusCode = 400;
      zkpErr.code = "INVALID_PROOF";
      return next(zkpErr);
    }

    logger.error(`Failed to register proof verification on-chain for ${recipientID}: ${error.message}`);
    clearGatewayCache(getIdentityName(req));

    const customErr = new Error(`Fabric transaction failed: ${error.message}`);
    customErr.statusCode = error.statusCode || 503;
    customErr.code = error.code || "LEDGER_WRITE_FAILED";
    return next(customErr);
  }
}

module.exports = {
  verifyEligibility
};
