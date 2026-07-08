'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class DistributeFundsWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    async submitTransaction() {
        this.txIndex++;
        const recipientID = `caliper_recipient_dist_${this.roundIndex}_${this.clientIndex}_${this.txIndex}`;
        const region = 'ID-JK-01';
        const docHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        const commitment = 'dummy-commitment';

        // 1. Register recipient first
        const registerArgs = {
            contractId: this.workerArguments.contractId,
            contractFunction: 'registerRecipient',
            invokerIdentity: 'Admin@kemensos.bansochain.gov.id',
            contractArguments: [recipientID, region, docHash, commitment, 'CaliperSystem'],
            readOnly: false
        };
        await this.sutAdapter.sendRequests(registerArgs);

        // 2. Distribute funds
        const disburseArgs = {
            contractId: this.workerArguments.contractId,
            contractFunction: 'distributeFunds',
            invokerIdentity: 'Admin@kemensos.bansochain.gov.id',
            contractArguments: [recipientID, 'CaliperSystem'],
            readOnly: false
        };

        return this.sutAdapter.sendRequests(disburseArgs);
    }
}

function createWorkloadModule() {
    return new DistributeFundsWorkload();
}

module.exports = { createWorkloadModule };
