import React from 'react';
import { History, Shield, Check, Clock } from 'lucide-react';

export default function AuditTrailTable({ history }) {
  if (!history || history.length === 0) {
    return (
      <div className="glass-panel p-6 rounded-xl text-center text-slate-400">
        Belum ada riwayat transaksi. Jalankan verifikasi ZKP atau salurkan dana terlebih dahulu.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <History className="w-5 h-5 text-indigo-400" />
        <h3 className="text-lg font-semibold text-slate-200">Linimasa Riwayat Audit Ledger</h3>
      </div>

      <div className="relative border-l border-slate-800 ml-4 pl-6 space-y-6">
        {history.map((tx, idx) => {
          const val = tx.value || {};
          const logItem = val.auditLog ? val.auditLog[val.auditLog.length - 1] : null;
          const actionName = logItem ? logItem.action : "TRANSAKSI";
          const actorName = logItem ? logItem.actor : "Klien Fabric MSP";
          const timestampVal = logItem ? logItem.timestamp : tx.timestamp;

          let badgeColor = "bg-indigo-500/10 text-indigo-400 border-indigo-500/30";
          if (actionName.includes("SUCCESS")) {
            badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
          } else if (actionName.includes("DISTRIBUTED")) {
            badgeColor = "bg-teal-500/10 text-teal-400 border-teal-500/30";
          } else if (actionName.includes("FAILED")) {
            badgeColor = "bg-red-500/10 text-red-400 border-red-500/30";
          }

          return (
            <div key={idx} className="relative group">
              {/* Indikator penunjuk kronologis */}
              <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 border border-indigo-500 group-hover:bg-indigo-500 transition-all duration-300">
                <Check className="h-2 w-2 text-indigo-400 group-hover:text-slate-950" />
              </span>

              <div className="glass-panel p-4 rounded-xl border border-slate-800/80 hover:border-slate-700/80 transition-all duration-300">
                <div className="flex flex-wrap justify-between items-start gap-2">
                  <div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${badgeColor}`}>
                      {actionName}
                    </span>
                    <h4 className="text-sm font-semibold text-slate-100 mt-2">
                      ID Penyetor: <span className="font-mono text-xs text-indigo-300">{actorName}</span>
                    </h4>
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(timestampVal).toLocaleString('id-ID')}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-3 border-t border-slate-800/40 font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-sans">ZK Terverifikasi</span>
                    <span className={val.zkpVerified ? "text-indigo-400 font-bold" : "text-slate-400"}>
                      {val.zkpVerified ? "YA" : "TIDAK"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-sans">Kelayakan</span>
                    <span className={val.eligible ? "text-emerald-400 font-bold" : "text-slate-400"}>
                      {val.eligible ? "LAYAK" : "TIDAK LAYAK"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block font-sans">Disalurkan</span>
                    <span className={val.fundsDistributed ? "text-teal-400 font-bold" : "text-slate-400"}>
                      {val.fundsDistributed ? "SUDAH" : "BELUM"}
                    </span>
                  </div>
                  <div className="truncate">
                    <span className="text-[10px] text-slate-500 uppercase block font-sans">Hash Dokumen</span>
                    <span className="text-slate-300" title={val.documentHash}>
                      {val.documentHash ? val.documentHash.substring(0, 8) + "..." : "N/A"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2 text-[10px] text-slate-500 font-mono border-t border-slate-800/20">
                  TxID Transaksi: <span className="text-slate-450">{tx.txId}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
