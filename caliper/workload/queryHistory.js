'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class QueryHistoryWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
        this.recipientID = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
    }

    async submitTransaction() {
        this.txIndex++;
        const queryArgs = {
            contractId: this.workerArguments.contractId,
            contractFunction: 'queryHistory',
            invokerIdentity: 'Admin@kemensos.bansochain.gov.id',
            contractArguments: [this.recipientID],
            readOnly: true
        };

        return this.sutAdapter.sendRequests(queryArgs);
    }
}

function createWorkloadModule() {
    return new QueryHistoryWorkload();
}

module.exports = { createWorkloadModule };
