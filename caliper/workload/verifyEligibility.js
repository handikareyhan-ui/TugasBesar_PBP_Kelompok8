'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');
const fs = require('fs');
const path = require('path');

class VerifyEligibilityWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
        this.proof = {};
        this.publicSignals = [];
    }

    async initializeWorkloadModule(number, totalClients, numberWorkloads, sutContext, sutAdapter) {
        await super.initializeWorkloadModule(number, totalClients, numberWorkloads, sutContext, sutAdapter);
        const rootDir = path.resolve(__dirname, '..', '..');
        const proofPath = path.join(rootDir, 'proof.json');
        const publicPath = path.join(rootDir, 'public.json');
        if (fs.existsSync(proofPath)) {
            this.proof = JSON.parse(fs.readFileSync(proofPath, 'utf8'));
        }
        if (fs.existsSync(publicPath)) {
            this.publicSignals = JSON.parse(fs.readFileSync(publicPath, 'utf8'));
        }
    }

    async submitTransaction() {
        this.txIndex++;
        const recipientID = `caliper_recipient_zkp_${this.roundIndex}_${this.clientIndex}_${this.txIndex}`;
        const region = 'ID-JK-01';
        const docHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        
        // Use matching commitment from signals to bypass identity binding check
        const commitment = this.publicSignals[1] || 'dummy-commitment';

        // 1. Register recipient first
        const registerArgs = {
            contractId: this.workerArguments.contractId,
            contractFunction: 'registerRecipient',
            invokerIdentity: 'Admin@kemensos.bansochain.gov.id',
            contractArguments: [recipientID, region, docHash, commitment, 'CaliperSystem'],
            readOnly: false
        };
        await this.sutAdapter.sendRequests(registerArgs);

        // 2. Submit ZKP proof validation
        const verifyArgs = {
            contractId: this.workerArguments.contractId,
            contractFunction: 'verifyZKP',
            invokerIdentity: 'Admin@kemensos.bansochain.gov.id',
            contractArguments: [recipientID, JSON.stringify(this.proof), JSON.stringify(this.publicSignals), 'CaliperSystem'],
            readOnly: false
        };

        return this.sutAdapter.sendRequests(verifyArgs);
    }
}

function createWorkloadModule() {
    return new VerifyEligibilityWorkload();
}

module.exports = { createWorkloadModule };
