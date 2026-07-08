import React, { useState, useEffect } from 'react';
import { getBlocks, getRecipientHistory } from '../services/api';
import BlockStructureView from '../components/BlockStructureView';
import AuditTrailTable from '../components/AuditTrailTable';
import NodeStatusCard from '../components/NodeStatusCard';
import { ShieldCheck, Search, Database, FileClock, Network } from 'lucide-react';

export default function AuditorPanel() {
  const [blocks, setBlocks] = useState([]);
  const [searchId, setSearchId] = useState('');
  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBlocks();
  }, []);

  const fetchBlocks = async () => {
    try {
      const data = await getBlocks();
      setBlocks(data);
    } catch (err) {
      console.error("Gagal mengambil header blok:", err);
    }
  };

  const handleAuditSearch = async (e) => {
    e.preventDefault();
    if (!searchId) return;

    setLoadingHistory(true);
    setError(null);
    setHistory(null);

    try {
      let targetID = searchId;
      if (searchId.length !== 64) {
        // Anggap sebagai NIK, hash secara lokal
        const encoder = new TextEncoder();
        const data = encoder.encode(searchId);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        targetID = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }

      const res = await getRecipientHistory(targetID);
      setHistory(res);
    } catch (err) {
      console.error(err);
      setError("Tidak ditemukan catatan ledger yang cocok dengan ID ini. Pastikan penerima sudah terdaftar.");
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-xs md:text-sm">
      <div>
        <h2 className="text-2xl font-bold text-slate-100 glow-text-indigo">Konsol Audit & Ledger Independen</h2>
        <p className="text-xs text-slate-400">Tampilan Auditor Publik — Log Verifikasi Kriptografi Tidak Dapat Diubah</p>
      </div>

      {/* Statistik Jaringan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-5 rounded-xl border border-slate-800/80 flex items-center gap-4">
          <Database className="w-10 h-10 text-teal-400" />
          <div>
            <span className="text-xs text-slate-400 block font-semibold uppercase">Tinggi Blok</span>
            <span className="text-2xl font-mono font-bold text-slate-100">{blocks.length}</span>
          </div>
        </div>
        <div className="glass-panel p-5 rounded-xl border border-slate-800/80 flex items-center gap-4">
          <FileClock className="w-10 h-10 text-indigo-400" />
          <div>
            <span className="text-xs text-slate-400 block font-semibold uppercase">Tingkat Sinkronisasi</span>
            <span className="text-2xl font-mono font-bold text-emerald-400">100%</span>
          </div>
        </div>
        <div className="glass-panel p-5 rounded-xl border border-slate-800/80 flex items-center gap-4">
          <Network className="w-10 h-10 text-purple-400" />
          <div>
            <span className="text-xs text-slate-400 block font-semibold uppercase">Status Konsensus</span>
            <span className="text-sm font-semibold text-slate-200">Raft Orderer Aktif</span>
          </div>
        </div>
      </div>

      {/* Visualisasi Struktur Blok */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800/80">
        <BlockStructureView blocks={blocks} />
      </div>

      {/* Status Node Jaringan */}
      <div className="glass-panel p-5 rounded-xl border border-slate-800/80">
        <NodeStatusCard />
      </div>

      {/* Pencarian Jejak Audit */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 space-y-4">
          <div className="glass-panel p-5 rounded-xl border border-slate-800/80">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Audit Ledger Penerima
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Cari penerima menggunakan NIK atau Hash NIK SHA-256. Panel audit mengambil 
              riwayat lengkap perubahan status dari database blockchain.
            </p>
            <form onSubmit={handleAuditSearch} className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 uppercase block font-semibold mb-1">NIK atau ID Pseudonim</label>
                <input 
                  type="text" 
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="Masukkan NIK atau Hash NIK" 
                  className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-lg p-2.5 mt-1 text-slate-200 font-mono text-xs outline-none"
                  required
                />
              </div>
              <button 
                type="submit" 
                disabled={loadingHistory}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                {loadingHistory ? 'Memuat Ledger...' : 'Verifikasi Jejak Audit'}
              </button>
            </form>
          </div>
        </div>

        <div className="xl:col-span-2">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl text-xs text-red-400 font-medium">
              {error}
            </div>
          )}
          {history && (
            <div className="glass-panel p-5 rounded-xl border border-slate-800/80">
              <AuditTrailTable history={history} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
