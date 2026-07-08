const FabricCAServices = require('fabric-ca-client');
const { Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');

async function enrollOrgUser(caUrl, caName, mspId, orgName, userName, userSecret) {
    const walletPath = path.resolve(__dirname, '..', '..', 'backend', 'wallet');
    const wallet = await Wallets.newFileSystemWallet(walletPath);

    console.log(`\n=== Enrolling user for CA ${caName} (${mspId}) ===`);
    const ca = new FabricCAServices(caUrl, { verify: false }, caName);

    // 1. Enroll CA admin
    const adminIdentityName = `${orgName}-admin-ca`;
    let adminIdentity = await wallet.get(adminIdentityName);
    
    if (!adminIdentity) {
        console.log(`Enrolling CA admin '${adminIdentityName}'...`);
        const adminEnrollment = await ca.enroll({ enrollmentID: 'admin', enrollmentSecret: 'adminpw' });
        adminIdentity = {
            credentials: {
                certificate: adminEnrollment.certificate,
                privateKey: adminEnrollment.key.toBytes(),
            },
            mspId: mspId,
            type: 'X.509',
        };
        await wallet.put(adminIdentityName, adminIdentity);
        console.log(`CA Admin '${adminIdentityName}' enrolled successfully.`);
    } else {
        console.log(`CA Admin '${adminIdentityName}' already exists in wallet.`);
    }

    // 2. Register and Enroll the user identity
    const provider = wallet.getProviderRegistry().getProvider(adminIdentity.type);
    const adminUser = await provider.getUserContext(adminIdentity, adminIdentityName);

    let userIdentity = await wallet.get(userName);
    if (!userIdentity) {
        console.log(`Registering user '${userName}'...`);
        try {
            await ca.register({
                enrollmentID: userName,
                enrollmentSecret: userSecret,
                role: 'client',
            }, adminUser);
            console.log(`Successfully registered user '${userName}'`);
        } catch (registerError) {
            if (registerError.message && registerError.message.includes('already registered')) {
                console.log(`User '${userName}' was already registered.`);
            } else {
                throw registerError;
            }
        }

        console.log(`Enrolling user '${userName}'...`);
        const enrollment = await ca.enroll({ enrollmentID: userName, enrollmentSecret: userSecret });
        userIdentity = {
            credentials: {
                certificate: enrollment.certificate,
                privateKey: enrollment.key.toBytes(),
            },
            mspId: mspId,
            type: 'X.509',
        };
        await wallet.put(userName, userIdentity);
        console.log(`Successfully enrolled user '${userName}' and saved to wallet.`);
    } else {
        console.log(`User '${userName}' already exists in wallet.`);
    }
}

async function main() {
    try {
        await enrollOrgUser('https://localhost:7054', 'ca.kemensos', 'KemensosMSP', 'kemensos', 'kemensos-user', 'kemensos-pw');
        await enrollOrgUser('https://localhost:8054', 'ca.dinsos', 'DinsosMSP', 'dinsos', 'dinsos-user', 'dinsos-pw');
        await enrollOrgUser('https://localhost:9054', 'ca.bank', 'BankMSP', 'bank', 'bank-user', 'bank-pw');

        // Dynamically copy CA-enrolled kemensos-user to 'admin' for compatibility if needed
        const walletPath = path.resolve(__dirname, '..', '..', 'backend', 'wallet');
        const wallet = await Wallets.newFileSystemWallet(walletPath);
        const kemensosUser = await wallet.get('kemensos-user');
        await wallet.put('admin', kemensosUser);
        console.log("\nSuccessfully finished enrolling all organization identities.");
    } catch (error) {
        console.error(`CA enrollment failed: ${error}`);
        process.exit(1);
    }
}

main();
