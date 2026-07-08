# BansosChain

BansosChain is a permissioned blockchain system designed for transparent, privacy-preserving, and accountable distribution of social assistance (bantuan sosial - bansos) in Indonesia. 

The system leverages **Hyperledger Fabric v2.5** for maintaining an immutable transaction log and auditing trail, **Zero-Knowledge Proofs (ZKP)** using Circom 2.x and Snarkjs to verify recipient eligibility without exposing sensitive financial records on-chain, and an off-chain **MongoDB** database to secure personally identifiable information (PII) according to Indonesian Personal Data Protection regulations (UU PDP).

---

## 🛠️ Tech Stack
- **Blockchain Core**: Hyperledger Fabric v2.5 (3 peer nodes + 1 Raft orderer + 3 Organization CAs)
- **Chaincode (Smart Contract)**: Node.js (JavaScript) using `fabric-contract-api`
- **Zero-Knowledge Proofs**: Circom 2.0.0 + Snarkjs (Groth16 setup)
- **Off-chain Database**: MongoDB (storing sensitive recipient records)
- **Backend API**: Express.js + Node.js with JWT authentication
- **Frontend App**: React.js + Tailwind CSS with Vite

---

## 📁 Folder Structure
```
bansochain/
├── network/                        # Hyperledger Fabric configuration files
│   ├── configtx.yaml               # Channel profile & Raft consenter configs
│   ├── crypto-config.yaml          # Certificate authority setups
│   ├── docker-compose.yaml         # Peer, Orderer, CA, CouchDB services
│   ├── connection-profile.json     # Gateway connection rules for SDK
│   └── scripts/
│       ├── startNetwork.sh         # Boots containers, channel & commits contract
│       ├── stopNetwork.sh          # Cleans docker states & local keys
│       ├── enrollAdmin.js          # Admin enrollment script
│       └── enrollAdmin.sh          # Bash runner for admin enroll
├── chaincode/                      # Smart Contract (chaincode)
│   └── bansos/
│       ├── package.json
│       ├── index.js
│       └── lib/
│           └── BansosContract.js   # Main ledger functions & history iterators
├── zkp/                            # ZK Eligibility Proof
│   ├── circuits/
│   │   └── eligibility.circom      # Comparator circuit (income < threshold)
│   ├── scripts/
│   │   ├── compile.sh              # Compiles circuit & sets up Groth16 keys
│   │   ├── generateProof.js        # Generates proof.json given private income
│   │   └── verifyProof.js          # Cryptographic proof validation runner
│   └── keys/                       # Location for proof and verification keys
├── backend/                        # Express API Server
│   ├── config/
│   │   └── fabricConfig.js         # Fabric client config (Dual Real/Mock Mode)
│   ├── controllers/                # Request validation controllers
│   ├── middleware/
│   │   └── auth.js                 # Role checks & token decoders
│   ├── models/
│   │   └── RecipientOffchain.js    # Sensitive PII MongoDB Schema
│   ├── routes/                     # REST API path routers
│   └── server.js                   # API Server engine
├── frontend/                       # React Dashboard Webapp
│   ├── src/
│   │   ├── components/             # Reusable UI widgets
│   │   │   ├── BlockStructureView.jsx  # Blockchain block-link viz
│   │   │   ├── NodeStatusCard.jsx      # NOC status grid
│   │   │   ├── ZKPProofForm.jsx        # ZK Generator & payload display
│   │   │   ├── DistributionTable.jsx   # Bank disburse clicker table
│   │   │   └── AuditTrailTable.jsx     # Auditor timeline view
│   │   ├── pages/
│   │   │   ├── AdminDashboard.jsx  # Kemensos/Dinsos register console
│   │   │   ├── UserPortal.jsx      # Public status check & ZK upload portal
│   │   │   └── AuditorPanel.jsx    # Immutable trail searching
│   │   ├── services/
│   │   │   └── api.js              # Axios backend connection client
│   │   └── App.jsx                 # Nav layouts & Auth handler
│   └── package.json
└── caliper/                        # Stress testing configurations
    ├── caliper.yaml                # Caliper benchmark round definitions
    └── workload/
        └── verifyEligibility.js    # Target submission stress generator
```

---

## 🚀 Execution & Setup Guide

The backend features a **Dual-Mode execution engine**. If Hyperledger Fabric is not actively running (e.g. running on local Windows environments without WSL/Fabric setups), it automatically falls back to a simulated in-memory ledger and mock ZKP validation. This enables full verification of the user flows, dashboards, and audit visualizers out-of-the-box.

### 1. Start the Backend API
1. Open a terminal in `backend/`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up a `.env` file (Optional - defaults are applied automatically):
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/bansoschain
   USE_MOCK=true
   JWT_SECRET=bansoschain_secret_key_2026
   ```
4. Boot the server:
   ```bash
   npm start
   ```

### 2. Start the Frontend React Webapp
1. Open a separate terminal in `frontend/`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Boot the Vite local dev server:
   ```bash
   npm run dev
   ```
4. Access the web dashboard at `http://localhost:3000`

---

## 🔑 Demo Access Credentials

The Public Portal allows entering any National ID (NIK) to check status. To log in as administrative personnel and test permissions, use the following credentials (buttons are provided in the UI for instant auto-fill):

| Institution | Role | Username | Password |
| :--- | :--- | :--- | :--- |
| **Kementerian Sosial** | `admin` | `kemensos` | `admin123` |
| **Dinas Sosial Daerah** | `admin` | `dinsos` | `admin123` |
| **Bank Penyalur** | `bank` | `bank` | `bank123` |
| **Independent Auditor** | `auditor` | `auditor` | `audit123` |

---

## ⚙️ Running Hyperledger Fabric (WSL/Linux or Docker Desktop)
To run the project on actual Fabric nodes:
1. Ensure Docker Desktop is active.
2. Navigate to `network/scripts/`
3. Run the bootstrap script:
   ```bash
   chmod +x startNetwork.sh stopNetwork.sh enrollAdmin.sh
   ./startNetwork.sh
   ```
4. Enroll the API credentials into the backend wallet:
   ```bash
   ./enrollAdmin.sh
   ```
5. Toggle off the mock state in `backend/.env`:
   ```env
   USE_MOCK=false
   ```
