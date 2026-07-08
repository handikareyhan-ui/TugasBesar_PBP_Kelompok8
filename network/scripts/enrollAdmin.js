'use strict';

const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        // Load connection profile
        const ccpPath = path.resolve(__dirname, '..', 'connection-profile.json');
        if (!fs.existsSync(ccpPath)) {
            console.log('Using default configuration for enrollment...');
        }

        const caURL = 'https://localhost:7054'; // ca.kemensos
        const mspId = 'KemensosMSP';
        const caName = 'ca.kemensos';

        // Create a new CA client for interacting with the CA
        const caInfo = { url: caURL, tlsCACerts: { pem: [] }, caName: caName };
        // In development/test, we often bypass strict TLS if certs are self-signed
        const ca = new FabricCAServices(caURL, { verify: false }, caName);

        // Create a new file system based wallet for managing identities
        const walletPath = path.join(__dirname, '..', '..', 'backend', 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        console.log(`Wallet path: ${walletPath}`);

        // Check to see if we've already enrolled the admin user
        const identity = await wallet.get('admin');
        if (identity) {
            console.log('An identity for the admin user "admin" already exists in the wallet');
            return;
        }

        // Enroll the admin user, and import the new identity into the wallet
        const enrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        const x509Identity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: mspId,
            type: 'X.509',
        };
        await wallet.put('admin', x509Identity);
        console.log('Successfully enrolled admin user "admin" and imported it into the wallet');

    } catch (error) {
        console.error(`Failed to enroll admin user "admin": ${error}`);
        process.exit(1);
    }
}

main();
