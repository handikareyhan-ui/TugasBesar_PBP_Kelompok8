'use strict';

const fs = require('fs');
const path = require('path');

// Determine if we should force mock mode
const USE_MOCK = process.env.USE_MOCK !== 'false';

// Simple in-memory mock database that replicates the Fabric ledger history and CouchDB states
class MockLedger {
  constructor() {
    this.ledger = new Map();
    this.history = new Map();
    this.blocks = [];
    this.init();
  }

  init() {
    const dummyRecipients = [
      {
        recipientID: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
        region: "ID-JK-01",
        eligible: true,
        fundsDistributed: false,
        documentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        recipientCommitment: "dummy-commitment-1",
        zkpVerified: true,
        auditLog: [
          {
            timestamp: new Date().toISOString(),
            action: "INITIAL_REGISTRATION",
            actor: "KemensosAdmin"
          },
          {
            timestamp: new Date().toISOString(),
            action: "ZKP_ELIGIBILITY_VERIFIED",
            actor: "KemensosSystem"
          }
        ]
      },
      {
        recipientID: "f4dfc746e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
        region: "ID-JB-02",
        eligible: false,
        fundsDistributed: false,
        documentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b856",
        recipientCommitment: "dummy-commitment-2",
        zkpVerified: false,
        auditLog: [
          {
            timestamp: new Date().toISOString(),
            action: "INITIAL_REGISTRATION",
            actor: "DinsosAdmin"
          }
        ]
      }
    ];

    // Seed mock ledger and block structure
    for (const r of dummyRecipients) {
      this.ledger.set(r.recipientID, JSON.stringify(r));
      const txId = "tx_" + Math.random().toString(36).substr(2, 9);
      this.history.set(r.recipientID, [{
        txId: txId,
        timestamp: new Date().toISOString(),
        isDelete: false,
        value: r
      }]);
      
      this.addBlock(txId, "initLedger", r.recipientID, r);
    }
  }

  addBlock(txId, method, key, value) {
    const prevHash = this.blocks.length > 0 ? this.blocks[this.blocks.length - 1].hash : "00000000000000000000000000000000";
    const blockNum = this.blocks.length + 1;
    
    // Simple mock SHA-256 generation
    const dataStr = JSON.stringify({ txId, method, key, value, prevHash });
    let hash = 0;
    for (let i = 0; i < dataStr.length; i++) {
      hash = (hash << 5) - hash + dataStr.charCodeAt(i);
      hash |= 0;
    }
    const blockHash = "block_hash_" + Math.abs(hash).toString(16);

    this.blocks.push({
      blockNumber: blockNum,
      hash: blockHash,
      previousHash: prevHash,
      timestamp: new Date().toISOString(),
      transactions: [{
        txId,
        creatorMSP: method === "distributeFunds" ? "BankMSP" : "KemensosMSP",
        method,
        payload: { key, value }
      }]
    });
  }

  async execute(method, args) {
    const txId = "tx_" + Math.random().toString(36).substr(2, 9);
    const now = new Date().toISOString();

    if (method === 'initLedger') {
      this.init();
      return { success: true };
    }

    if (method === 'registerRecipient') {
      const [recipientID, region, documentHash, recipientCommitment, actor] = args;
      if (this.ledger.has(recipientID)) {
        throw new Error(`The recipient ${recipientID} already exists`);
      }
      const recipient = {
        recipientID,
        region,
        eligible: false,
        fundsDistributed: false,
        documentHash,
        recipientCommitment,
        zkpVerified: false,
        auditLog: [{
          timestamp: now,
          action: "REGISTRATION",
          actor: actor || "Kemensos"
        }]
      };
      this.ledger.set(recipientID, JSON.stringify(recipient));
      
      const hist = this.history.get(recipientID) || [];
      hist.push({ txId, timestamp: now, isDelete: false, value: recipient });
      this.history.set(recipientID, hist);
      this.addBlock(txId, method, recipientID, recipient);
      
      return JSON.stringify(recipient);
    }

    if (method === 'verifyZKP') {
      const [recipientID, proofStr, publicSignalsStr, actor] = args;
      if (!this.ledger.has(recipientID)) {
        throw new Error(`The recipient ${recipientID} does not exist`);
      }
      const recipient = JSON.parse(this.ledger.get(recipientID));

      const proof = JSON.parse(proofStr);
      const publicSignals = JSON.parse(publicSignalsStr);

      // 1. Cryptographic verify in mock/simulated mode
      const snarkjs = require('snarkjs');
      const fs = require('fs');
      const path = require('path');
      const vkeyPath = path.resolve(__dirname, '..', '..', 'zkp', 'keys', 'verification_key.json');
      if (!fs.existsSync(vkeyPath)) {
        throw new Error("Verification key not found on server. Cannot verify ZKP proof.");
      }
      const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));

      let verificationSuccess = false;
      try {
        verificationSuccess = await snarkjs.groth16.verify(vKey, publicSignals, proof);
      } catch (err) {
        throw new Error(`ZKP cryptographic verification process failed: ${err.message}`);
      }

      if (!verificationSuccess) {
        throw new Error("Invalid Zero-Knowledge Proof");
      }

      // 2. Identity Binding
      if (recipient.recipientCommitment !== publicSignals[1]) {
        throw new Error(`Identity commitment mismatch: proof commitment '${publicSignals[1]}' does not match registered commitment '${recipient.recipientCommitment}'`);
      }

      // 3. Replay Protection (Nullifier check)
      const nullifier = publicSignals[2];
      const nullifierKey = "nullifier_" + nullifier;
      if (this.ledger.has(nullifierKey)) {
        throw new Error("ZKP proof has already been spent");
      }
      this.ledger.set(nullifierKey, "spent");

      // 4. Policy Verification
      const expectedThreshold = "2000000";
      const expectedMinDependents = "1";
      if (publicSignals[3] !== expectedThreshold || publicSignals[4] !== expectedMinDependents) {
        throw new Error(`Policy threshold mismatch: proof uses threshold=${publicSignals[3]}, minDependents=${publicSignals[4]} instead of threshold=${expectedThreshold}, minDependents=${expectedMinDependents}`);
      }

      // 5. Eligibility Flag Check
      const eligibleSignal = publicSignals[0];
      if (eligibleSignal !== "1" && eligibleSignal !== 1) {
        throw new Error("Proof indicates recipient is not eligible");
      }

      recipient.zkpVerified = true;
      recipient.eligible = true;
      recipient.auditLog.push({
        timestamp: now,
        action: "ZKP_ELIGIBILITY_VERIFIED_SUCCESS",
        actor: actor || "System"
      });
      this.ledger.set(recipientID, JSON.stringify(recipient));

      const hist = this.history.get(recipientID) || [];
      hist.push({ txId, timestamp: now, isDelete: false, value: recipient });
      this.history.set(recipientID, hist);
      this.addBlock(txId, method, recipientID, recipient);

      return JSON.stringify(recipient);
    }

    if (method === 'distributeFunds') {
      const [recipientID, actor] = args;
      if (!this.ledger.has(recipientID)) {
        throw new Error(`The recipient ${recipientID} does not exist`);
      }
      const recipient = JSON.parse(this.ledger.get(recipientID));
      
      if (recipient.zkpVerified !== true) {
        throw new Error(`The recipient ${recipientID} has not verified eligibility via Zero-Knowledge Proof`);
      }
      if (recipient.eligible !== true) {
        throw new Error(`The recipient ${recipientID} is not marked as eligible for bansos`);
      }
      if (recipient.fundsDistributed !== false) {
        throw new Error(`The recipient ${recipientID} has already received funds`);
      }
      
      recipient.fundsDistributed = true;
      recipient.auditLog.push({
        txId,
        timestamp: now,
        actor: actor || "BankPenyalur",
        recipientID,
        action: "FUNDS_DISTRIBUTED",
        amount: 2000000,
        txStatus: "SUCCESS"
      });
      this.ledger.set(recipientID, JSON.stringify(recipient));

      const hist = this.history.get(recipientID) || [];
      hist.push({ txId, timestamp: now, isDelete: false, value: recipient });
      this.history.set(recipientID, hist);
      this.addBlock(txId, method, recipientID, recipient);

      return JSON.stringify(recipient);
    }

    if (method === 'revokeAccess') {
      const [recipientID, reason, actor] = args;
      if (!this.ledger.has(recipientID)) {
        throw new Error(`The recipient ${recipientID} does not exist`);
      }
      const recipient = JSON.parse(this.ledger.get(recipientID));
      
      recipient.eligible = false;
      recipient.auditLog.push({
        timestamp: now,
        action: "ACCESS_REVOKED",
        actor: actor || "SystemAdmin",
        reason: reason || "Revocation request"
      });
      this.ledger.set(recipientID, JSON.stringify(recipient));

      const hist = this.history.get(recipientID) || [];
      hist.push({ txId, timestamp: now, isDelete: false, value: recipient });
      this.history.set(recipientID, hist);
      this.addBlock(txId, method, recipientID, recipient);

      return JSON.stringify(recipient);
    }

    if (method === 'getRecipient') {
      const [recipientID] = args;
      if (!this.ledger.has(recipientID)) {
        throw new Error(`The recipient ${recipientID} does not exist`);
      }
      return this.ledger.get(recipientID);
    }

    if (method === 'getRecipientHistory' || method === 'queryHistory') {
      const [recipientID] = args;
      if (!this.ledger.has(recipientID)) {
        throw new Error(`The recipient ${recipientID} does not exist`);
      }
      return JSON.stringify(this.history.get(recipientID));
    }

    throw new Error(`Method ${method} not found in chaincode`);
  }
}

const mockLedgerInstance = new MockLedger();

// Connection pools to share Fabric clients
const gateways = new Map();  // identityName -> Gateway
const contracts = new Map(); // identityName -> Contract

// Function to clear a single gateway client connection cache (trigger reconnect)
function clearGatewayCache(identityName) {
  const logger = global.logger || console;
  logger.info(`Clearing cached Fabric Gateway client for identity: ${identityName}`);
  
  const gateway = gateways.get(identityName);
  if (gateway) {
    try {
      gateway.disconnect();
    } catch (e) {
      // ignore
    }
    gateways.delete(identityName);
    contracts.delete(identityName);
  }
}

// Function to close all active cached connections (during graceful shutdown)
async function closeAllGateways() {
  const logger = global.logger || console;
  logger.info("Closing all active Fabric Gateway client connections...");
  
  for (const [identityName, gateway] of gateways.entries()) {
    try {
      await gateway.disconnect();
      logger.info(`Fabric Gateway disconnected for identity: ${identityName}`);
    } catch (err) {
      logger.error(`Error disconnecting Fabric Gateway for ${identityName}: ${err.message}`);
    }
  }
  gateways.clear();
  contracts.clear();
}

// Export function to get Fabric gateway and contract
async function getContract(identityName = 'kemensos-user') {
  const logger = global.logger || console;
  const isProduction = process.env.NODE_ENV === 'production';

  // Fallback to simulation ONLY if not in production and USE_MOCK is set
  if (USE_MOCK && !isProduction) {
    logger.debug(`[FABRIC MOCK] Executing query in mock/simulation mode with user: ${identityName}`);
    return {
      submitTransaction: async (method, ...args) => {
        return mockLedgerInstance.execute(method, args);
      },
      evaluateTransaction: async (method, ...args) => {
        return mockLedgerInstance.execute(method, args);
      },
      getBlocks: () => {
        return mockLedgerInstance.blocks;
      },
      isMock: true
    };
  }

  // Enforce Real Gateway connection (Production or Mock turned off)
  if (contracts.has(identityName)) {
    logger.debug(`Reusing cached Fabric contract instance for user: ${identityName}`);
    return contracts.get(identityName);
  }

  try {
    const { Gateway, Wallets } = require('fabric-network');
    
    // Resolve profile path
    const ccpPath = process.env.FABRIC_NETWORK_PATH || path.resolve(__dirname, '..', '..', 'network', 'connection-profile.json');
    if (!fs.existsSync(ccpPath)) {
      throw new Error(`Connection profile not found at ${ccpPath}`);
    }
    const ccp = JSON.parse(fs.readFileSync(ccpPath, 'utf8'));

    // Dynamically resolve relative certificate paths to absolute paths
    const ccpDir = path.dirname(ccpPath);
    if (ccp.peers) {
      for (const peerName in ccp.peers) {
        const peer = ccp.peers[peerName];
        if (peer.tlsCACerts && peer.tlsCACerts.path) {
          peer.tlsCACerts.path = path.resolve(ccpDir, peer.tlsCACerts.path);
        }
      }
    }
    if (ccp.certificateAuthorities) {
      for (const caName in ccp.certificateAuthorities) {
        const ca = ccp.certificateAuthorities[caName];
        if (ca.tlsCACerts && ca.tlsCACerts.path) {
          ca.tlsCACerts.path = path.resolve(ccpDir, ca.tlsCACerts.path);
        }
      }
    }

    const walletPath = process.env.FABRIC_WALLET_PATH || path.resolve(__dirname, '..', 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    const identity = await wallet.get(identityName);
    if (!identity) {
      throw new Error(`Identity '${identityName}' not found in wallet. Run CA enrollment first.`);
    }

    logger.info(`Establishing new Fabric Gateway client connection for: ${identityName}`);
    const gateway = new Gateway();
    
    const connectOptions = {
      wallet,
      identity: identityName,
      discovery: { 
        enabled: true, 
        asLocalhost: process.env.FABRIC_AS_LOCALHOST !== 'false' 
      },
      queryHandlerOptions: {
        // Enforce Query Evaluation Timeout
        timeout: parseInt(process.env.FABRIC_QUERY_TIMEOUT || '10') 
      }
    };

    // Apply Gateway connection timeout logic
    await Promise.race([
      gateway.connect(ccp, connectOptions),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Fabric Gateway connection timeout expired')), 
        parseInt(process.env.FABRIC_GATEWAY_TIMEOUT || '10000'))
      )
    ]);

    const channelName = process.env.FABRIC_CHANNEL || 'bansochannel';
    const chaincodeName = process.env.FABRIC_CHAINCODE || 'bansocc';

    const network = await gateway.getNetwork(channelName);
    const contract = network.getContract(chaincodeName);
    
    contract.isMock = false;

    // Store in cache pools
    gateways.set(identityName, gateway);
    contracts.set(identityName, contract);

    logger.info(`Fabric Gateway connected successfully to channel '${channelName}', chaincode '${chaincodeName}'`);
    return contract;
  } catch (error) {
    logger.error(`Failed to connect to Fabric Gateway: ${error.message}`);
    const serviceError = new Error(`Fabric Gateway is unavailable: ${error.message}`);
    serviceError.statusCode = 503;
    serviceError.code = "BLOCKCHAIN_UNAVAILABLE";
    throw serviceError;
  }
}

module.exports = { getContract, clearGatewayCache, closeAllGateways };
