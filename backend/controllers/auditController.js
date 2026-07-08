'use strict';

const { getContract, clearGatewayCache } = require('../config/fabricConfig');
const logger = require('../config/logger');
const RecipientOffchain = require('../models/RecipientOffchain');

// In-memory fallback store proxy
function getStore() {
  return global.RecipientOffchainStore || {
    findOne: (q) => RecipientOffchain.findOne(q),
    find: () => RecipientOffchain.find({}).sort({ createdAt: -1 }),
  };
}

// Helper to map authenticated user to Fabric wallet identity
function getIdentityName(req) {
  if (!req || !req.user) return 'kemensos-user';
  if (req.user.username === 'kemensos') return 'kemensos-user';
  if (req.user.username === 'dinsos') return 'dinsos-user';
  if (req.user.username === 'bank') return 'bank-user';
  return 'kemensos-user';
}

// Get blockchain history for a recipient
async function getHistory(req, res, next) {
  const { recipientID } = req.params;

  if (!recipientID) {
    const err = new Error("Missing recipientID parameter");
    err.statusCode = 400;
    err.code = "BAD_REQUEST";
    return next(err);
  }

  logger.info(`Fetching ledger transaction history for recipient ID: ${recipientID}`);

  try {
    const identity = getIdentityName(req);
    const contract = await getContract(identity);
    const historyData = await contract.evaluateTransaction('queryHistory', recipientID);
    
    const parsedHistory = JSON.parse(historyData.toString('utf8'));
    logger.debug(`Ledger transaction history retrieved successfully for ID: ${recipientID}`);
    return res.status(200).json(parsedHistory);

  } catch (error) {
    logger.error(`Failed to fetch ledger history for ID: ${recipientID}: ${error.message}`);
    clearGatewayCache(getIdentityName(req));
    
    const customErr = new Error(`Fabric transaction failed: ${error.message}`);
    customErr.statusCode = error.statusCode || 503;
    customErr.code = error.code || "LEDGER_READ_FAILED";
    return next(customErr);
  }
}

// Get details of a single recipient on-ledger state
async function getLedgerState(req, res, next) {
  const { recipientID } = req.params;

  if (!recipientID) {
    const err = new Error("Missing recipientID parameter");
    err.statusCode = 400;
    err.code = "BAD_REQUEST";
    return next(err);
  }

  logger.info(`Fetching direct ledger state details for recipient ID: ${recipientID}`);

  try {
    const identity = getIdentityName(req);
    const contract = await getContract(identity);
    const stateData = await contract.evaluateTransaction('getRecipient', recipientID);
    
    const parsedState = JSON.parse(stateData.toString('utf8'));
    logger.debug(`Ledger state retrieved successfully for ID: ${recipientID}`);
    return res.status(200).json(parsedState);

  } catch (error) {
    logger.error(`Failed to fetch direct ledger state for ID: ${recipientID}: ${error.message}`);
    clearGatewayCache(getIdentityName(req));

    // Differentiate not found / ledger failure
    const statusCode = error.message.includes("does not exist") ? 404 : (error.statusCode || 503);
    const customErr = new Error(`Fabric transaction failed: ${error.message}`);
    customErr.statusCode = statusCode;
    customErr.code = statusCode === 404 ? "NOT_FOUND" : "LEDGER_READ_FAILED";
    return next(customErr);
  }
}

// Get mock block structures (for visualizer) or real Fabric transaction history
async function getBlocks(req, res, next) {
  logger.info("Fetching block visualizer chain structures or real transaction history");
  try {
    const identity = getIdentityName(req);
    const contract = await getContract(identity);

    // If mock is active, return the mock ledger block structures for dev compatibility
    if (contract.isMock) {
      const blocks = contract.getBlocks ? contract.getBlocks() : [];
      return res.status(200).json(blocks);
    }

    // Real Fabric connection - query actual transaction histories
    // 1. Gather all recipient IDs (seeded ones + offchain dynamic ones)
    const recipientIDs = new Set([
      "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
      "f4dfc746e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"
    ]);

    try {
      const store = getStore();
      const offchainRecipients = await store.find({});
      if (offchainRecipients && offchainRecipients.length > 0) {
        offchainRecipients.forEach(r => {
          if (r.recipientID) {
            recipientIDs.add(r.recipientID);
          }
        });
      }
    } catch (dbErr) {
      logger.warn(`Could not fetch offchain recipients for history aggregation: ${dbErr.message}`);
    }

    // 2. Fetch history for each recipient ID and build state transitions
    const allHistoryEvents = [];
    
    for (const recipientID of recipientIDs) {
      try {
        const historyBytes = await contract.evaluateTransaction('queryHistory', recipientID);
        if (historyBytes && historyBytes.length > 0) {
          const historyList = JSON.parse(historyBytes.toString('utf8'));
          
          // History returned is typically sorted oldest-first.
          // Let's compute state transitions (oldValue and newValue)
          for (let i = 0; i < historyList.length; i++) {
            const currentEvent = historyList[i];
            const prevEvent = i > 0 ? historyList[i - 1] : null;

            // Determine transaction timestamp
            let timestampStr = new Date().toISOString();
            if (currentEvent.timestamp) {
              if (currentEvent.timestamp.seconds) {
                let seconds = currentEvent.timestamp.seconds;
                if (typeof seconds === 'object' && seconds !== null) {
                  seconds = seconds.low || 0;
                }
                timestampStr = new Date(Number(seconds) * 1000).toISOString();
              } else if (typeof currentEvent.timestamp === 'string') {
                timestampStr = currentEvent.timestamp;
              } else if (currentEvent.timestamp.toDate) {
                timestampStr = currentEvent.timestamp.toDate().toISOString();
              }
            }

            // Determine action and creatorMSP based on auditLog updates
            let action = "REGISTER_RECIPIENT";
            let creatorMSP = "KemensosMSP";
            
            if (currentEvent.value && currentEvent.value.auditLog && currentEvent.value.auditLog.length > 0) {
              const lastLog = currentEvent.value.auditLog[currentEvent.value.auditLog.length - 1];
              action = lastLog.action || "UPDATE";
              
              if (action === "FUNDS_DISTRIBUTED") {
                creatorMSP = "BankMSP";
              } else if (action === "REGISTRATION" || action === "INITIAL_REGISTRATION") {
                if (lastLog.actor && lastLog.actor.toLowerCase().includes("dinsos")) {
                  creatorMSP = "DinsosMSP";
                } else {
                  creatorMSP = "KemensosMSP";
                }
              } else if (action.includes("ZKP")) {
                creatorMSP = "KemensosMSP";
              } else if (action === "ACCESS_REVOKED") {
                creatorMSP = "KemensosMSP";
              }
            }

            allHistoryEvents.push({
              txId: currentEvent.txId,
              timestamp: timestampStr,
              creatorMSP: creatorMSP,
              action: action,
              key: recipientID,
              oldValue: prevEvent ? prevEvent.value : null,
              newValue: currentEvent.isDelete ? null : currentEvent.value,
              txStatus: "VALID"
            });
          }
        }
      } catch (err) {
        // Skip recipient if it doesn't exist on ledger or other errors
        logger.debug(`Recipient ${recipientID} history query skipped: ${err.message}`);
      }
    }

    // 3. Sort all transactions by timestamp descending (newest first)
    allHistoryEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.status(200).json(allHistoryEvents);
  } catch (error) {
    logger.error(`Failed to fetch transaction history log: ${error.message}`);
    return next(error);
  }
}

module.exports = {
  getHistory,
  getLedgerState,
  getBlocks
};
