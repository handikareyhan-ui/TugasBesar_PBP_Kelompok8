'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

class RegisterRecipientWorkload extends WorkloadModuleBase {
    constructor() {
        super();
        this.txIndex = 0;
    }

    async submitTransaction() {
        this.txIndex++;
        const recipientID = `caliper_recipient_reg_${this.roundIndex}_${this.clientIndex}_${this.txIndex}`;
        const region = 'ID-JK-01';
        const docHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        const commitment = `caliper_commitment_reg_${this.roundIndex}_${this.clientIndex}_${this.txIndex}`;

        const registerArgs = {
            contractId: this.workerArguments.contractId,
            contractFunction: 'registerRecipient',
            invokerIdentity: 'Admin@kemensos.bansochain.gov.id',
            contractArguments: [recipientID, region, docHash, commitment, 'CaliperSystem'],
            readOnly: false
        };

        return this.sutAdapter.sendRequests(registerArgs);
    }
}

function createWorkloadModule() {
    return new RegisterRecipientWorkload();
}

module.exports = { createWorkloadModule };
