'use strict';

const { Contract } = require('fabric-contract-api');
const snarkjs = require('snarkjs');
const vKey = require('./verification_key.json');

class BansosContract extends Contract {

    // Helper to check if asset exists
    async assetExists(ctx, recipientID) {
        const assetJSON = await ctx.stub.getState(recipientID);
        return assetJSON && assetJSON.length > 0;
    }

    // Helper to get deterministic timestamp as ISO String
    _getTxTimestamp(ctx) {
        const txTimestamp = ctx.stub.getTxTimestamp();
        const seconds = txTimestamp.seconds.low || (txTimestamp.seconds.toNumber ? txTimestamp.seconds.toNumber() : Number(txTimestamp.seconds));
        const nanos = txTimestamp.nanos || 0;
        return new Date(seconds * 1000 + Math.round(nanos / 1000000)).toISOString();
    }

    // Initialize Ledger with mock data
    async initLedger(ctx) {
        const exists = await this.assetExists(ctx, "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918");
        if (exists) {
            console.info("Ledger is already initialized. Skipping.");
            return;
        }
        const now = this._getTxTimestamp(ctx);
        const recipients = [
            {
                recipientID: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918", // Hashed dummy NIK
                region: "ID-JK-01",
                eligible: true,
                fundsDistributed: false,
                documentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                recipientCommitment: "dummy-commitment-1",
                zkpVerified: true,
                auditLog: [
                    {
                        timestamp: now,
                        action: "INITIAL_REGISTRATION",
                        actor: "KemensosAdmin"
                    },
                    {
                        timestamp: now,
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
                        timestamp: now,
                        action: "INITIAL_REGISTRATION",
                        actor: "DinsosAdmin"
                    }
                ]
            }
        ];

        for (const recipient of recipients) {
            await ctx.stub.putState(recipient.recipientID, Buffer.from(JSON.stringify(recipient)));
            console.info(`Asset ${recipient.recipientID} initialized`);
        }
    }

    // Register a new recipient (authorized for Kemensos or Dinsos MSP)
    async registerRecipient(ctx, recipientID, region, documentHash, recipientCommitment, actor) {
        const mspid = ctx.clientIdentity.getMSPID();
        if (mspid !== 'KemensosMSP' && mspid !== 'DinsosMSP') {
            throw new Error(`Unauthorized: Client from MSP ${mspid} is not authorized to register recipients`);
        }

        const exists = await this.assetExists(ctx, recipientID);
        if (exists) {
            throw new Error(`The recipient ${recipientID} already exists`);
        }

        const now = this._getTxTimestamp(ctx);
        const recipient = {
            recipientID,
            region,
            eligible: false,
            fundsDistributed: false,
            documentHash,
            recipientCommitment,
            zkpVerified: false,
            auditLog: [
                {
                    timestamp: now,
                    action: "REGISTRATION",
                    actor: actor || "Kemensos"
                }
            ]
        };

        await ctx.stub.putState(recipientID, Buffer.from(JSON.stringify(recipient)));
        return JSON.stringify(recipient);
    }

    // Update ZKP verification status and eligibility (authorized for Kemensos or Dinsos MSP)
    async verifyZKP(ctx, recipientID, proofStr, publicSignalsStr, actor) {
        const mspid = ctx.clientIdentity.getMSPID();
        if (mspid !== 'KemensosMSP' && mspid !== 'DinsosMSP') {
            throw new Error(`Unauthorized: Client from MSP ${mspid} is not authorized to verify ZKP proofs`);
        }

        const exists = await this.assetExists(ctx, recipientID);
        if (!exists) {
            throw new Error(`The recipient ${recipientID} does not exist`);
        }

        const assetBytes = await ctx.stub.getState(recipientID);
        const recipient = JSON.parse(assetBytes.toString('utf8'));

        const proof = JSON.parse(proofStr);
        const publicSignals = JSON.parse(publicSignalsStr);

        // 1. Cryptographic Zero-Knowledge Proof Verification on-chain
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
        const nullifierBytes = await ctx.stub.getState(nullifierKey);
        if (nullifierBytes && nullifierBytes.length > 0) {
            throw new Error("ZKP proof has already been spent");
        }
        await ctx.stub.putState(nullifierKey, Buffer.from("spent"));

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
        
        const now = this._getTxTimestamp(ctx);
        recipient.auditLog.push({
            timestamp: now,
            action: "ZKP_ELIGIBILITY_VERIFIED_SUCCESS",
            actor: actor || "System"
        });

        await ctx.stub.putState(recipientID, Buffer.from(JSON.stringify(recipient)));
        return JSON.stringify(recipient);
    }

    // Mark funds as distributed (authorized for Bank MSP only, prevents double distribution)
    async distributeFunds(ctx, recipientID, actor) {
        const mspid = ctx.clientIdentity.getMSPID();
        if (mspid !== 'BankMSP') {
            throw new Error(`Unauthorized: Client from MSP ${mspid} is not authorized to distribute funds`);
        }

        const exists = await this.assetExists(ctx, recipientID);
        if (!exists) {
            throw new Error(`The recipient ${recipientID} does not exist`);
        }

        const assetBytes = await ctx.stub.getState(recipientID);
        const recipient = JSON.parse(assetBytes.toString('utf8'));

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
        
        const txId = ctx.stub.getTxID();
        const now = this._getTxTimestamp(ctx);
        recipient.auditLog.push({
            txId: txId,
            timestamp: now,
            actor: actor || "BankPenyalur",
            recipientID: recipientID,
            action: "FUNDS_DISTRIBUTED",
            amount: 2000000,
            txStatus: "SUCCESS"
        });

        await ctx.stub.putState(recipientID, Buffer.from(JSON.stringify(recipient)));
        return JSON.stringify(recipient);
    }

    // Retrieve recipient state
    async getRecipient(ctx, recipientID) {
        const exists = await this.assetExists(ctx, recipientID);
        if (!exists) {
            throw new Error(`The recipient ${recipientID} does not exist`);
        }

        const assetBytes = await ctx.stub.getState(recipientID);
        return assetBytes.toString('utf8');
    }

    // Revoke recipient access eligibility (authorized for Kemensos or Dinsos MSP)
    async revokeAccess(ctx, recipientID, reason, actor) {
        const mspid = ctx.clientIdentity.getMSPID();
        if (mspid !== 'KemensosMSP' && mspid !== 'DinsosMSP') {
            throw new Error(`Unauthorized: Client from MSP ${mspid} is not authorized to revoke access`);
        }

        const exists = await this.assetExists(ctx, recipientID);
        if (!exists) {
            throw new Error(`The recipient ${recipientID} does not exist`);
        }

        const assetBytes = await ctx.stub.getState(recipientID);
        const recipient = JSON.parse(assetBytes.toString('utf8'));

        recipient.eligible = false;
        
        const now = this._getTxTimestamp(ctx);
        recipient.auditLog.push({
            timestamp: now,
            action: "ACCESS_REVOKED",
            actor: actor || "SystemAdmin",
            reason: reason || "Revocation request"
        });

        await ctx.stub.putState(recipientID, Buffer.from(JSON.stringify(recipient)));
        return JSON.stringify(recipient);
    }

    // Retrieve recipient audit trail (blockchain history)
    async queryHistory(ctx, recipientID) {
        const exists = await this.assetExists(ctx, recipientID);
        if (!exists) {
            throw new Error(`The recipient ${recipientID} does not exist`);
        }

        const iterator = await ctx.stub.getHistoryForKey(recipientID);
        const results = [];
        let res = await iterator.next();

        while (!res.done) {
            if (res.value) {
                const txInfo = {
                    txId: res.value.txId,
                    timestamp: res.value.timestamp,
                    isDelete: res.value.isDelete,
                    value: null
                };
                if (!res.value.isDelete) {
                    txInfo.value = JSON.parse(res.value.value.toString('utf8'));
                }
                results.push(txInfo);
            }
            res = await iterator.next();
        }
        await iterator.close();
        return JSON.stringify(results);
    }

    // Legacy wrapper alias for queryHistory
    async getRecipientHistory(ctx, recipientID) {
        return this.queryHistory(ctx, recipientID);
    }

    // Dedicated ping method for readiness verification
    async ping(ctx) {
        return "pong";
    }
}

module.exports = BansosContract;
