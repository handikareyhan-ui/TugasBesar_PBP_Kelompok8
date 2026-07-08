# PROJECT STATUS REPORT: AUDIT & DOKUMENTASI SISTEM BANSOSCHAIN

Laporan audit menyeluruh terhadap struktur project, riwayat pengerjaan, konsistensi kode, status container saat ini, dan rekomendasi tindak lanjut untuk sistem **BansosChain** (Aplikasi Penyaluran Bantuan Sosial berbasis Hyperledger Fabric dan Zero-Knowledge Proofs).

---

## 1. Ringkasan Status Project

BansosChain adalah sistem penyaluran bantuan sosial (bansos) yang mengintegrasikan **Hyperledger Fabric v2.5** (sebagai ledger on-chain terdistribusi untuk transparansi dan audit trail), **Zero-Knowledge Proofs (ZKP)** berbasis Circom & SnarkJS (untuk menjaga privasi NIK dan kelayakan finansial penerima), serta database **MongoDB** (sebagai penyimpanan off-chain PII sesuai regulasi UU PDP).

Secara garis besar, status komponen utama project saat ini adalah:
- **Blockchain Network**: **AKTIF & RUNNING**. Semua 10 container infrastruktur Fabric (3 CA, 3 Peer, 3 CouchDB, 1 Raft Orderer) ditambah 3 container Dev-chaincode berjalan dengan sehat dan stabil di lingkungan Docker.
- **Smart Contract (Chaincode)**: **BERHASIL DEPLOYED**. Chaincode Node.js `bansocc` versi 1.0 telah di-install di seluruh peer, disetujui oleh masing-masing organisasi (`KemensosMSP`, `DinsosMSP`, `BankMSP`), dikomit secara global ke channel `bansochannel`, dan fungsi inisialisasi awal (`initLedger`) telah berhasil dipicu.
- **ZK-Snark Engine**: **LENGKAP**. Sirkuit pembuktian kelayakan (`eligibility.circom`) telah berhasil dikompilasi ke bentuk WASM dan upacara parameter tepercaya (powers-of-tau) lokal telah dilaksanakan untuk menghasilkan proving key (`eligibility_final.zkey`) serta verification key (`verification_key.json`).
- **Database Off-chain**: **SIMULASI (MOCK)**. Backend Express saat ini jatuh ke mode fallback in-memory database karena service MongoDB lokal tidak terdeteksi aktif saat server di-boot.
- **Dual-Mode Backend**: **AKTIF (USE_MOCK=true)**. Backend berjalan menggunakan database mock dan verifikasi ZKP mock untuk mempermudah jalannya peninjauan visual dashboard tanpa memaksakan integrasi penuh ke gateway blockchain jika tidak diinginkan.

---

## 2. Struktur File & Fungsinya

Berikut adalah pemetaan folder dan berkas penting di dalam repositori beserta fungsinya masing-masing:

### A. Core Blockchain Network (`/network`)
- **[configtx.yaml](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/network/configtx.yaml)**: Konfigurasi pembentukan genesis block dan channel transaction. Mengatur profil organisasi (`KemensosOrg`, `DinsosOrg`, `BankOrg`), MSP ID (`KemensosMSP`, `DinsosMSP`, `BankMSP`), kapabilitas Fabric v2.0+, kebijakan konsensus Raft, serta penunjukan anchor peers masing-masing organisasi.
- **[crypto-config.yaml](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/network/crypto-config.yaml)**: File definisi organisasi untuk generator material kripto (`cryptogen`). Menentukan domain (`bansochain.gov.id`, `kemensos.bansochain.gov.id`, dll.) dan jumlah peer serta user per organisasi.
- **[docker-compose.yaml](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/network/docker-compose.yaml)**: Definisi orkestrasi container Docker. Menampung definisi container untuk 3 peer nodes, 3 CouchDB instances (sebagai statedb untuk pencarian kaya/rich queries), 3 Certificate Authorities (CA), dan 1 Raft orderer node.
- **[connection-profile.json](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/network/connection-profile.json)**: Berkas konfigurasi profil gateway yang digunakan oleh Client SDK di backend untuk memetakan nama host, alamat gRPC/TLS, port CA, dan path sertifikat enkripsi agar backend dapat berkomunikasi dengan peers.
- **[install_cc.sh](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/network/install_cc.sh)**: Script pembantu DevOps untuk menginstall package chaincode `bansocc.tar.gz` di dalam container peer masing-masing organisasi.
- **[invoke_init.sh](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/network/invoke_init.sh)**: Script batch manual untuk mengeksekusi invoke transaksi inisialisasi ledger (`initLedger`). *(Memiliki bug konfigurasi port)*.

### B. Shell Scripts Network (`/network/scripts`)
- **[startNetwork.sh](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/network/scripts/startNetwork.sh)**: Script bootstrap utama. Melakukan pembersihan volume lama, menggenerasikan sertifikat kriptografi via docker `fabric-tools`, menyusun genesis block dan channel transaction, menyalakan docker container, membuat channel, memaksa peer bergabung, mengupdate anchor peer, mengemas (packaging) chaincode Node.js, menginstalnya ke peers, menyetujui (approve) spesifikasinya di setiap organisasi, melakukan commit transaksi global, dan memicu `initLedger`.
- **[stopNetwork.sh](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/network/scripts/stopNetwork.sh)**: Menghentikan seluruh container docker, menghapus volume yang terikat (`-v`), membuang folder crypto-config dan channel-artifacts hasil generator lokal, serta mengosongkan folder `backend/wallet`.
- **[resetNetwork.sh](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/network/scripts/resetNetwork.sh)**: Script DevOps untuk pemulihan cepat (recovery). Menjalankan `stopNetwork.sh` dilanjutkan dengan mengeksekusi `startNetwork.sh` dari kondisi awal yang bersih.
- **[setupNetwork.sh](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/network/scripts/setupNetwork.sh)**: Melakukan instalasi channel, anchor peer, dan lifecycle chaincode pada docker container yang sudah dalam kondisi menyala (duplikasi logis dari bagian eksekusi blockchain di `startNetwork.sh`).
- **[enrollAdmin.js](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/network/scripts/enrollAdmin.js)** / **[enrollAdmin.sh](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/network/scripts/enrollAdmin.sh)**: Script Node.js untuk mendaftarkan identitas "admin" default organisasi Kemensos ke wallet backend Express.
- **[enrollIdentities.js](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/network/scripts/enrollIdentities.js)**: Script registrasi CA tingkat lanjut. Mendaftarkan identitas perwakilan tiap organisasi (`kemensos-user`, `dinsos-user`, `bank-user`) lengkap dengan CA Admin pasangannya ke wallet filesystem backend.

### C. Smart Contract / Chaincode (`/chaincode/bansos`)
- **[package.json](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/chaincode/bansos/package.json)**: Manifestasi metadata dari smart contract. Dependensi penting mencakup `fabric-contract-api` dan `snarkjs` (untuk verifikasi bukti ZKP langsung di blockchain).
- **[index.js](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/chaincode/bansos/index.js)**: Entry point yang mengekspor class contract `BansosContract`.
- **[BansosContract.js](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/chaincode/bansos/lib/BansosContract.js)**: Logika ledger dan transaksi on-chain. Mendefinisikan:
  - `initLedger`: Memasukkan data inisiasi awal (seed penerima).
  - `registerRecipient`: Pendaftaran hash penerima dan commitment ZKP (Hanya untuk `KemensosMSP` dan `DinsosMSP`).
  - `verifyZKP`: Memverifikasi kecocokan cryptographic proof ZKP langsung on-chain terhadap data commitment, nullifier (replay protection), threshold kebijakan bansos, dan status kelayakan penerima.
  - `distributeFunds`: Menandai dana bansos telah ditransfer oleh Bank (Hanya untuk `BankMSP` untuk mencegah double distribution).
  - `revokeAccess`: Pencabutan kelayakan penerima bansos jika terjadi pelanggaran atau tidak lagi layak.
  - `queryHistory` / `getRecipientHistory`: Mengambil data historis transaksi audit blockchain dari key penerima bansos secara lengkap.
- **[verification_key.json](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/chaincode/bansos/lib/verification_key.json)**: Kunci verifikasi publik ZKP yang diekspor dari SnarkJS, dibaca on-chain untuk memvalidasi proof yang disubmit oleh user.

### D. Zero-Knowledge Proofs Engine (`/zkp`)
- **[eligibility.circom](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/zkp/circuits/eligibility.circom)**: Struktur sirkuit ZK. Memverifikasi bahwa data privat pendapatan (income) berada di bawah ambang batas (threshold), jumlah tanggungan (dependents) memenuhi batas minimal, nik terikat secara valid ke commitment (`recipientCommitment === Poseidon(nik, salt)`), dan menghitung nullifier guna mencegah replay attack (`nullifier === Poseidon(nik, salt, nonce)`).
- **[compile.sh](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/zkp/scripts/compile.sh)**: Mengkompilasi sirkuit circom ke R1CS dan WASM, serta menjalankan tahapan upacara powers-of-tau lokal untuk memproduksi file `.zkey` dan `verification_key.json` Groth16. *(Memiliki kelemahan logika pencarian file pot)*.
- **[generateProof.js](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/zkp/scripts/generateProof.js)**: Script helper Node.js untuk menghasilkan berkas bukti `proof.json` dan `public.json` dari parameter baris perintah (CLI).
- **[verifyProof.js](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/zkp/scripts/verifyProof.js)**: Script pengujian untuk melakukan verifikasi lokal secara mandiri terhadap `proof.json` dan `public.json`.

### E. Backend Express API Server (`/backend`)
- **[server.js](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/backend/server.js)**: Entry point server Express. Mengatur koneksi MongoDB off-chain database, routing API RESTful, pendaftaran demo login, pengecekan readiness/healthcheck gateway Fabric, dan handling shutdown aman.
- **[fabricConfig.js](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/backend/config/fabricConfig.js)**: Jantung Dual-Mode API. Jika `USE_MOCK=true`, ia akan menghasilkan interface smart contract buatan (mock) yang mensimulasikan penulisan ledger Fabric secara lokal di memori. Jika `USE_MOCK=false`, ia akan memuat class SDK `fabric-network` nyata, memuat wallet filesystem, meresolusi path sertifikat koneksi profil secara dinamis, dan menghubungkan backend ke gateway blockchain Fabric.
- **[recipientController.js](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/backend/controllers/recipientController.js)**: Handler registrasi penerima bansos. Menjamin atomisitas data dengan menerapkan rollback otomatis di database MongoDB jika penulisan transaksi blockchain ke gateway Fabric gagal.
- **[eligibilityController.js](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/backend/controllers/eligibilityController.js)**: Menerima payload bukti ZKP dari frontend dan meneruskannya langsung untuk verifikasi on-chain di smart contract Fabric.
- **[distributionController.js](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/backend/controllers/distributionController.js)**: Handler penyaluran dana bansos oleh Bank. Mencegah penyaluran ganda melalui pemeriksaan data on-chain.
- **[auditController.js](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/backend/controllers/auditController.js)**: Menyediakan endpoint audit riwayat transaksi blockchain penerima bansos dan struktur block visualizer.
- **[auth.js](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/backend/middleware/auth.js)**: Middleware otorisasi berbasis Role (RBAC) dengan token JWT.

### F. Frontend Dashboard React Webapp (`/frontend`)
- **[App.jsx](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/frontend/src/App.jsx)**: Navigasi dan manajemen sesi login multi-role (Kemensos, Dinsos, Bank, Auditor, Publik).
- **[api.js](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/frontend/src/services/api.js)**: Client penghubung Axios untuk interaksi REST API backend. *(Memiliki hardcoded URL)*.
- **[BlockStructureView.jsx](file:///d:/03_File%20Reyhan/Tugas%20Besar-PBP/frontend/src/components/BlockStructureView.jsx)**: Komponen visualisasi interaktif struktur block blockchain beserta hash transaksi penyusunnya.

---

## 3. Apa Saja yang Sudah Berhasil Dikerjakan

Berdasarkan analisis file, material kripto, database log (`backend/logs/app.log`), dan status sistem saat ini, tahapan pengerjaan yang **telah berhasil diselesaikan** adalah:

### a) Setup Material Kriptografi (cryptogen & CA)
- Material kripto untuk orderer org (`bansochain.gov.id`) dan 3 peer orgs (`kemensos`, `dinsos`, `bank`) sukses digenerasikan menggunakan `cryptogen` dan disimpan di `/network/crypto-config`.
- Enkripsi kunci privat CA berhasil disalin dengan nama seragam `priv_sk` di masing-masing subfolder CA untuk kompatibilitas docker-compose.
- Ketiga container Fabric CA (`ca.kemensos`, `ca.dinsos`, `ca.bank`) berjalan aktif pada port `7054`, `8054`, dan `9054`.
- Script `enrollIdentities.js` sukses mendaftarkan user identity (`kemensos-user`, `dinsos-user`, `bank-user`) ke wallet backend di `/backend/wallet`.

### b) Setup Channel
- Genesis block (`genesis.block`) berhasil dibuat dengan profil `ThreeOrgsChannelGenesis`.
- File transaksi pembuatan channel (`bansochannel.tx`) dan file anchor peer update (`KemensosMSPanchors.tx`, `DinsosMSPanchors.tx`, `BankMSPanchors.tx`) sukses digenerasikan.
- Channel `bansochannel` telah dibuat dan seluruh peers dari ketiga organisasi (`peer0.kemensos`, `peer0.dinsos`, `peer0.bank`) berhasil masuk (joined) ke channel.
- Pembaruan (update) anchor peers sukses dieksekusi di channel untuk memuluskan proses gossip protocol antar organisasi.

### c) Lifecycle Chaincode
- Smart contract Node.js `bansocc` sukses dikemas menjadi file arsip `bansocc.tar.gz` di `/chaincode`.
- Chaincode berhasil di-install pada ketiga peer nodes.
- Persetujuan chaincode (`approveformyorg`) berhasil didapatkan dari ketiga organisasi di bawah sequence 1.
- Chaincode definition berhasil di-commit secara global di channel `bansochannel`.
- Container perantara chaincode (`dev-peer0.kemensos-...`, `dev-peer0.dinsos-...`, `dev-peer0.bank-...`) telah aktif dibentuk oleh peer daemon.

### d) Inisialisasi Data & Pengujian Sistem (Tertera di Log Server)
- Transaksi `initLedger` sukses dieksekusi on-chain, menginisialisasi 2 data dummy penerima bansos (ID `8c6976e5...` dan `f4dfc746...`) ke dalam CouchDB ledger.
- Proses registrasi penerima baru, otentikasi JWT token login, dan validasi kepemilikan role RBAC berjalan normal.
- Mekanisme perlindungan ZKP berhasil diuji: verifikasi proof berhasil meloloskan penerima layak, mendeteksi replay attack (nullifier spent check), mendeteksi pemalsuan data identity commitment mismatch, serta memblokir penyaluran ganda dan penyaluran untuk penerima tidak layak.

### e) Status Container Saat Ini
Berdasarkan pemeriksaan perintah `docker compose ps` di subfolder `/network`, network blockchain dalam status **RUNNING & HEALTHY**.
Berikut rincian status container yang aktif:

| Nama Container | Image | Status | Ports | Deskripsi |
| :--- | :--- | :--- | :--- | :--- |
| `ca.kemensos` | `fabric-ca:1.5.7` | Up (Active) | `7054->7054` | CA Organisasi Kemensos |
| `ca.dinsos` | `fabric-ca:1.5.7` | Up (Active) | `8054->8054` | CA Organisasi Dinas Sosial |
| `ca.bank` | `fabric-ca:1.5.7` | Up (Active) | `9054->9054` | CA Organisasi Bank Penyalur |
| `orderer.bansochain.gov.id` | `fabric-orderer:2.5` | Up (Active) | `7050->7050` | Raft Orderer Node |
| `peer0.kemensos.bansochain.gov.id` | `fabric-peer:2.5` | Up (Active) | `7051->7051` | Peer Node Kemensos |
| `peer0.dinsos.bansochain.gov.id` | `fabric-peer:2.5` | Up (Active) | `8051->8051` | Peer Node Dinas Sosial |
| `peer0.bank.bansochain.gov.id` | `fabric-peer:2.5` | Up (Active) | `9051->9051` | Peer Node Bank Penyalur |
| `couchdb.kemensos` | `couchdb:3.3.2` | Up (Active) | `5984->5984` | StateDB Peer Kemensos |
| `couchdb.dinsos` | `couchdb:3.3.2` | Up (Active) | `6984->5984` | StateDB Peer Dinas Sosial |
| `couchdb.bank` | `couchdb:3.3.2` | Up (Active) | `7984->5984` | StateDB Peer Bank Penyalur |
| *(Cc Dev Containers)* | `dev-peer0.kemensos/dinsos/bank-...` | Up (Active) | - | Container runtime dari chaincode `bansocc_1.0` |

---

## 4. Apa Saja yang Masih Bermasalah / Belum Selesai

Meskipun fondasi blockchain dan ZKP sudah lengkap, terdapat beberapa celah integrasi dan hambatan teknis yang belum terselesaikan sepenuhnya:

1. **MongoDB Off-chain Database Belum Terkoneksi secara Nyata**
   - **Deskripsi Masalah**: Backend memunculkan pesan error `ECONNREFUSED` saat mencoba menyambungkan ke MongoDB port `27017` karena tidak ada service database MongoDB yang aktif/didefinisikan di lingkungan lokal.
   - **Dampak**: Pendaftaran data penerima bansos off-chain jatuh ke mode in-memory array (`inMemoryDB`). Jika backend di-restart, seluruh riwayat data NIK asli, nama, alamat, dan nominal pendapatan privat off-chain akan terhapus, meskipun data hash pseudonimnya tetap tersimpan di blockchain.
2. **Kompilasi ZKP yang Inefisien di Script compiler**
   - **Deskripsi Masalah**: Script `zkp/scripts/compile.sh` mendeteksi file upacara powers-of-tau dengan nama `pot12_beacon.ptau`, tetapi script tersebut memprosesnya menjadi berkas bernama `pot12_final.ptau`.
   - **Dampak**: Logika pemisah `if [ ! -f "$KEYS_DIR/pot12_beacon.ptau" ]` akan selalu bernilai benar (karena file beacon memang tidak pernah dibuat). Ini menyebabkan upacara setup kriptografi fase 1 selalu diulang dari awal setiap kali script compile dijalankan, membuang waktu komputasi secara sia-sia.
3. **API Client React Menggunakan Alamat Hardcoded**
   - **Deskripsi Masalah**: File `frontend/src/services/api.js` menuliskan alamat server API `http://localhost:5000/api` secara langsung (hardcoded) di kode JavaScript.
   - **Dampak**: Aplikasi frontend tidak fleksibel jika dideploy ke server staging/production dengan host IP yang berbeda tanpa melakukan perubahan manual langsung pada kode sumber.

---

## 5. File yang Perlu Dibersihkan atau Berpotensi Bug

Berikut adalah daftar berkas yang teridentifikasi memiliki bug logis, duplikasi, atau perlu dibersihkan dari project:

### ⚠️ `network/invoke_init.sh` (BUG PORT)
Pada perintah pemanggilan transaksi inisialisasi:
```bash
--peerAddresses peer0.kemensos.bansochain.gov.id:7051 \
--tlsRootCertFiles /etc/hyperledger/fabric/tls/ca.crt \
--peerAddresses peer0.dinsos.bansochain.gov.id:7051 \
--tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/dinsos.bansochain.gov.id/peers/peer0.dinsos.bansochain.gov.id/tls/ca.crt \
--peerAddresses peer0.bank.bansochain.gov.id:7051 \
--tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/bank.bansochain.gov.id/peers/peer0.bank.bansochain.gov.id/tls/ca.crt
```
- **Analisis Bug**: Alamat port peer dinsos dan bank ditulis secara salah sebagai `7051` (port milik peer kemensos). Di docker-compose, peer dinsos terekspos pada port `8051` dan peer bank pada port `9051`.
- **Efek**: Jika dieksekusi, script ini akan gagal melangsungkan konsensus transaksi karena memanggil port yang salah. *(Gunakan fungsi inisialisasi bawaan startNetwork.sh yang sudah benar ports-nya)*.

### ⚠️ `zkp/scripts/compile.sh` (BUG LOGIC FILE CHECK)
```bash
if [ ! -f "$KEYS_DIR/pot12_beacon.ptau" ]; then
    ...
    npx snarkjs powersoftau prepare phase2 $KEYS_DIR/pot12_0001.ptau $KEYS_DIR/pot12_final.ptau -v
fi
```
- **Analisis Bug**: Pemeriksaan bersyarat mencari file `pot12_beacon.ptau`, namun baris di dalamnya menuliskan file output sebagai `pot12_final.ptau`.
- **Efek**: Mengakibatkan kompilasi ulang (re-run) upacara kriptografi snarkjs yang berat secara berulang.

### ⚠️ `network/scripts/setupNetwork.sh` (DUPLIKASI LOGIC)
- **Analisis**: Kode script ini 100% sama dengan block logika pembuatan channel hingga inisialisasi ledger di dalam `startNetwork.sh`.
- **Efek**: Duplikasi kode yang tidak perlu. Seharusnya `startNetwork.sh` dipecah menjadi dua modul terpisah secara rapi, atau `setupNetwork.sh` dihapus dan digantikan parameternya.

### ⚠️ Leftover File `proof.json` & `public.json` di Root Project
- **Analisis**: Terdapat file JSON bukti ZKP (`proof.json` dan `public.json`) di root directory project yang merupakan sisa penulisan script pembuktian manual.
- **Efek**: Mengotori workspace utama dan berpotensi tidak sengaja ter-push ke dalam git repository.

---

## 6. Rekomendasi Langkah Selanjutnya

Untuk menyempurnakan project BansosChain ke tahap produksi/siap demonstrasi penuh tanpa mode simulasi, disarankan mengambil langkah perbaikan berikut:

1. **Perbaikan Script & Bug Kritis**
   - **Tindakan**: Perbaiki port di `network/invoke_init.sh` dari `7051` menjadi `8051` (dinsos) dan `9051` (bank).
   - **Tindakan**: Ganti pengecekan `pot12_beacon.ptau` pada `zkp/scripts/compile.sh` menjadi `pot12_final.ptau`.
2. **Integrasi MongoDB Nyata (Containerized)**
   - **Tindakan**: Tambahkan service MongoDB resmi ke dalam `network/docker-compose.yaml` (atau buat file docker-compose extension terpisah) agar MongoDB dijalankan bersama dengan infrastruktur blockchain.
   - **Contoh Tambahan Service**:
     ```yaml
     mongodb.offchain:
       image: mongo:6.0
       ports:
         - "27017:27017"
       container_name: mongodb.offchain
       networks:
         - bansochain-network
     ```
3. **Eksternalisasi Alamat API Frontend**
   - **Tindakan**: Buat file `.env` di subfolder `/frontend` dan definisikan port/URL API target: `VITE_API_URL=http://localhost:5000/api`.
   - **Tindakan**: Ubah baris ke-5 di `frontend/src/services/api.js` agar membaca variabel tersebut secara dinamis.
4. **Nonaktifkan Mode Simulasi di Backend**
   - **Tindakan**: Begitu MongoDB dan Fabric Gateway berjalan stabil secara nyata, ganti variabel `USE_MOCK=true` menjadi `USE_MOCK=false` pada file `backend/.env` untuk menguji alur sistem integrasi penuh secara end-to-end.
5. **Kebijakan Git Ignore**
   - **Tindakan**: Daftarkan file `proof.json`, `public.json`, dan file `.env` ke dalam file `.gitignore` agar tidak diunggah ke repositori git public/private.
