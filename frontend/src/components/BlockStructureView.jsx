import React, { useState } from 'react';
import { Database, Link2, Clock, Shield, ChevronRight, Eye } from 'lucide-react';

export default function BlockStructureView({ blocks }) {
  const [selectedBlock, setSelectedBlock] = useState(null);

  if (!blocks || blocks.length === 0) {
    return (
      <div className="glass-panel p-6 rounded-xl text-center text-slate-400">
        Belum ada blok ditemukan. Inisialisasi ledger atau kirim transaksi terlebih dahulu.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-200">
          <Database className="w-5 h-5 text-indigo-400" />
          Visualisasi Blok Ledger Blockchain
        </h3>
        <span className="text-xs text-slate-400 font-mono">Total Blok: {blocks.length}</span>
      </div>

      {/* Visualisasi rantai blok horizontal */}
      <div className="flex items-center gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {blocks.map((block, index) => {
          const isSelected = selectedBlock?.blockNumber === block.blockNumber;
          return (
            <React.Fragment key={block.blockNumber}>
              <div 
                onClick={() => setSelectedBlock(block)}
                className={`flex-shrink-0 w-60 glass-panel p-4 rounded-xl cursor-pointer border transition-all duration-300 ${
                  isSelected 
                    ? 'border-indigo-500 bg-indigo-950/20 shadow-[0_0_20px_rgba(99,102,241,0.25)]' 
                    : 'border-slate-800 hover:border-slate-650 hover:bg-slate-900/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold bg-slate-800 text-indigo-300 px-2 py-0.5 rounded">
                    Blok #{block.blockNumber}
                  </span>
                  <Shield className={`w-4 h-4 ${block.blockNumber === 1 ? 'text-teal-400' : 'text-indigo-400'}`} />
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="text-[11px] text-slate-400 truncate font-mono">
                    Hash: <span className="text-slate-300">{block.hash}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate font-mono">
                    Sebelumnya: <span className="text-slate-300">{block.previousHash}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(block.timestamp).toLocaleTimeString('id-ID')}
                  </div>
                </div>
                <div className="mt-4 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs text-indigo-400 font-medium">
                  <span>Lihat Detail</span>
                  <Eye className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Ikon penghubung rantai antar blok */}
              {index < blocks.length - 1 && (
                <div className="flex-shrink-0 text-slate-600 animate-pulse">
                  <Link2 className="w-5 h-5 rotate-45" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Inspektor Blok yang Dipilih */}
      {selectedBlock && (
        <div className="glass-panel p-5 rounded-xl border border-slate-800/80 slide-in">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
            <div>
              <h4 className="font-bold text-slate-200">Inspektor Blok</h4>
              <p className="text-xs text-slate-400">Memeriksa payload transaksi di dalam Blok #{selectedBlock.blockNumber}</p>
            </div>
            <button 
              onClick={() => setSelectedBlock(null)}
              className="text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/80 px-2.5 py-1 rounded"
            >
              Tutup Inspektor
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 space-y-3">
              <div>
                <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">Hash Blok</span>
                <code className="text-xs text-slate-200 font-mono bg-slate-900 px-2 py-1 rounded block mt-1 overflow-x-auto">
                  {selectedBlock.hash}
                </code>
              </div>
              <div>
                <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">Hash Sebelumnya</span>
                <code className="text-xs text-slate-200 font-mono bg-slate-900 px-2 py-1 rounded block mt-1 overflow-x-auto">
                  {selectedBlock.previousHash}
                </code>
              </div>
              <div>
                <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">Waktu Stempel</span>
                <span className="text-xs text-slate-300 font-mono mt-1 block">
                  {new Date(selectedBlock.timestamp).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="md:col-span-2">
              <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider mb-2">Payload Ledger Transaksi</span>
              <div className="space-y-3">
                {selectedBlock.transactions.map((tx, i) => (
                  <div key={i} className="bg-slate-900/80 border border-slate-800/60 p-4 rounded-lg font-mono text-xs">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-800/50">
                      <div>
                        <span className="text-purple-400 font-bold">{tx.method}()</span>
                        <span className="text-slate-500 text-[10px] ml-2">ID: {tx.txId}</span>
                      </div>
                      <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded font-sans">
                        Penyetor: {tx.creatorMSP}
                      </span>
                    </div>
                    <pre className="text-slate-350 overflow-x-auto leading-relaxed bg-black/30 p-3 rounded">
                      {JSON.stringify(tx.payload, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
