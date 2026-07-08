import React, { useState } from 'react';
import { Landmark, ArrowRight, ShieldCheck, Clock, CheckCircle } from 'lucide-react';
import { distributeFunds } from '../services/api';

export default function DistributionTable({ recipients, onDistributeSuccess, isBankUser }) {
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState(null);

  const handleDistribute = async (recipientID) => {
    setLoadingId(recipientID);
    setError(null);
    try {
      await distributeFunds(recipientID);
      if (onDistributeSuccess) {
        onDistributeSuccess(recipientID);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Otorisasi penyaluran gagal. Pastikan penerima sudah terverifikasi dan layak.");
    } finally {
      setLoadingId(null);
    }
  };

  if (!recipients || recipients.length === 0) {
    return (
      <div className="glass-panel p-6 rounded-xl text-center text-slate-400">
        Belum ada penerima terdaftar. Pergi ke Dashboard Admin untuk mendaftarkan penerima.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-lg text-xs text-red-400 font-medium">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800/80">
        <table className="w-full text-left border-collapse bg-slate-950/20 font-sans text-xs">
          <thead>
            <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-semibold">
              <th className="p-4">ID Pseudonim (Hash NIK)</th>
              <th className="p-4">Wilayah</th>
              <th className="p-4">Status Kelayakan</th>
              <th className="p-4">ZKP Terverifikasi</th>
              <th className="p-4">Status Dana</th>
              {isBankUser && <th className="p-4 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850">
            {recipients.map((rec) => (
              <tr key={rec.recipientID} className="hover:bg-slate-900/20 transition-colors">
                <td className="p-4 font-mono text-slate-200">
                  <span title={rec.recipientID}>{rec.recipientID.substring(0, 16)}...</span>
                </td>
                <td className="p-4 text-slate-350">{rec.region || "ID-JB-01"}</td>
                <td className="p-4">
                  {rec.eligible ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Layak
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-800/65">
                      Menunggu ZKP
                    </span>
                  )}
                </td>
                <td className="p-4">
                  {rec.zkpVerified ? (
                    <span className="text-indigo-400 font-semibold bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                      Terverifikasi
                    </span>
                  ) : (
                    <span className="text-slate-500">Belum Diverifikasi</span>
                  )}
                </td>
                <td className="p-4">
                  {rec.fundsDistributed ? (
                    <span className="inline-flex items-center gap-1 text-teal-400 font-semibold bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/20">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Sudah Disalurkan
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                      <Clock className="w-3.5 h-3.5" />
                      Menunggu
                    </span>
                  )}
                </td>
                {isBankUser && (
                  <td className="p-4 text-right">
                    {!rec.eligible ? (
                      <span className="text-[10px] text-slate-500 italic bg-slate-900 px-2.5 py-1 rounded">
                        Menunggu ZKP Admin
                      </span>
                    ) : rec.fundsDistributed ? (
                      <span className="text-teal-500 text-[10px] font-semibold flex items-center justify-end gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Sudah Disalurkan
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDistribute(rec.recipientID)}
                        disabled={loadingId === rec.recipientID}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1.5 ml-auto transition-all disabled:opacity-50"
                      >
                        {loadingId === rec.recipientID ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Landmark className="w-3.5 h-3.5" />
                        )}
                        Salurkan Dana
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
