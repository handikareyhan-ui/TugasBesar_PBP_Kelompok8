import React, { useState } from 'react';
import axios from 'axios';
import { getRecipientState } from '../services/api';
import { Search, ShieldAlert, CheckCircle2, Clock, HelpCircle, FileText } from 'lucide-react';
import ZKPProofForm from '../components/ZKPProofForm';

export default function UserPortal() {
  const [nik, setNik] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(null);

  const [recipientID, setRecipientID] = useState('');
  const [ledgerState, setLedgerState] = useState(null);
  const [offchainDetails, setOffchainDetails] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!nik || nik.length < 5) {
      setError("Masukkan nomor NIK yang valid.");
      return;
    }

    setLoading(true);
    setError(null);
    setLedgerState(null);
    setOffchainDetails(null);
    setSearched(true);

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(nik);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const computedID = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      setRecipientID(computedID);

      const ledger = await getRecipientState(computedID);
      setLedgerState(ledger);
      
      try {
        const offchain = await axios.get(`http://localhost:5000/api/recipient/public/query/${computedID}`);
        setOffchainDetails(offchain.data);
      } catch (e) {
        console.warn("Failed to fetch offchain salt:", e.message);
      }
      
    } catch (err) {
      console.error(err);
      setError("Tidak ditemukan profil bantuan sosial yang cocok dengan NIK ini. Pastikan pendaftaran telah diselesaikan oleh Kemensos/Dinsos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in text-xs md:text-sm">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-extrabold text-slate-100 glow-text-teal">Portal Publik BansosChain</h2>
        <p className="text-slate-400 text-xs md:text-sm">Verifikasi kelayakan, cek bukti ZKP, dan audit catatan distribusi secara transparan menggunakan NIK Anda.</p>
      </div>

      {/* Kartu Pencarian */}
      <div className="glass-panel p-6 rounded-xl border border-slate-800/80 shadow-xl">
        <form onSubmit={handleSearch} className="space-y-4">
          <label className="text-xs text-slate-400 font-semibold block uppercase tracking-wider">Cari Status Bantuan Sosial (Bansos)</label>
          <div className="flex gap-2">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
              <input 
                type="text" 
                value={nik}
                onChange={(e) => setNik(e.target.value)}
                placeholder="Masukkan 16 digit NIK" 
                className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-lg p-3 pl-10 text-slate-200 font-mono outline-none"
                required
              />
            </div>
            <button 
              type="submit"
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-500 text-white font-semibold px-5 rounded-lg flex items-center gap-1.5 transition-all duration-300 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Cari'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Pesan Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl flex items-start gap-2.5 text-xs text-red-400 font-medium leading-relaxed">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Data Tidak Ditemukan</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Panel Hasil */}
      {searched && ledgerState && (
        <div className="space-y-6 slide-in">
          <div className="glass-panel p-5 rounded-xl border border-slate-800/80 space-y-6">
            <div className="flex justify-between items-start border-b border-slate-800/60 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-200">Status Berkas Permohonan</h3>
                <span className="text-[10px] text-slate-500 font-mono mt-1 block truncate w-60 md:w-full">
                  ID Hash NIK (Kunci Ledger): {recipientID}
                </span>
              </div>
              <span className="text-xs bg-slate-800 text-slate-350 px-2 py-0.5 rounded font-mono">
                Wilayah: {ledgerState.region}
              </span>
            </div>

            {/* Daftar Periksa Verifikasi */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Langkah 1: Off-chain */}
              <div className="bg-slate-900/60 border border-slate-800/40 p-4 rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">1. Berkas Di-hash</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-4">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-teal-400" />
                    Off-Chain Tersimpan
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono mt-1 truncate">
                    Hash: {ledgerState.documentHash?.substring(0, 12)}...
                  </span>
                </div>
              </div>

              {/* Langkah 2: Validasi ZKP */}
              <div className="bg-slate-900/60 border border-slate-800/40 p-4 rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">2. Validasi ZKP</span>
                  {ledgerState.zkpVerified ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <div className="mt-4">
                  <span className={`text-xs font-semibold flex items-center gap-1.5 ${ledgerState.zkpVerified ? 'text-indigo-400' : 'text-amber-400'}`}>
                    <CheckCircle2 className="w-4 h-4" />
                    {ledgerState.zkpVerified ? 'ZKP Terverifikasi' : 'Menunggu Bukti'}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono mt-1">
                    {ledgerState.zkpVerified ? 'Ledger terverifikasi: Layak' : 'Perlu eksekusi kelayakan'}
                  </span>
                </div>
              </div>

              {/* Langkah 3: Penyaluran Dana */}
              <div className="bg-slate-900/60 border border-slate-800/40 p-4 rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">3. Penyaluran Dana</span>
                  {ledgerState.fundsDistributed ? (
                    <CheckCircle2 className="w-4 h-4 text-teal-400" />
                  ) : (
                    <HelpCircle className="w-4 h-4 text-slate-600" />
                  )}
                </div>
                <div className="mt-4">
                  <span className={`text-xs font-semibold flex items-center gap-1.5 ${ledgerState.fundsDistributed ? 'text-teal-400' : 'text-slate-500'}`}>
                    <CheckCircle2 className="w-4 h-4" />
                    {ledgerState.fundsDistributed ? 'Sudah Disalurkan' : 'Menunggu Pembayaran'}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono mt-1">
                    {ledgerState.fundsDistributed ? 'Pembayaran bank selesai' : 'Menunggu tindakan penyaluran bank'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Jika penerima terdaftar tapi BELUM terverifikasi, tampilkan form ZKP */}
          {!ledgerState.zkpVerified && (
            <div className="slide-in">
              <ZKPProofForm 
                recipientID={recipientID} 
                registeredSalt={offchainDetails ? offchainDetails.salt : ''}
                onVerificationSuccess={(res) => {
                  setLedgerState(res.recipient);
                }} 
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
