import React from 'react';
import { Server, Activity, ShieldCheck, Cpu } from 'lucide-react';

export default function NodeStatusCard({ status }) {
  const nodes = [
    {
      name: "orderer.bansochain.gov.id",
      org: "Layanan Orderer",
      msp: "OrdererMSP",
      role: "Orderer (Raft)",
      port: "7050",
      status: "Aktif",
      color: "border-teal-500/30 text-teal-400 bg-teal-500/10"
    },
    {
      name: "peer0.kemensos.bansochain.gov.id",
      org: "Kementerian Sosial",
      msp: "KemensosMSP",
      role: "Endorser/Committer",
      port: "7051",
      status: "Aktif",
      color: "border-indigo-500/30 text-indigo-400 bg-indigo-500/10"
    },
    {
      name: "peer0.dinsos.bansochain.gov.id",
      org: "Dinas Sosial Daerah",
      msp: "DinsosMSP",
      role: "Endorser/Committer",
      port: "8051",
      status: "Aktif",
      color: "border-purple-500/30 text-purple-400 bg-purple-500/10"
    },
    {
      name: "peer0.bank.bansochain.gov.id",
      org: "Bank Penyalur",
      msp: "BankMSP",
      role: "Endorser/Committer",
      port: "9051",
      status: "Aktif",
      color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
    }
  ];

  const cas = [
    { name: "ca.kemensos", port: "7054", org: "CA Kemensos" },
    { name: "ca.dinsos", port: "8054", org: "CA Dinsos" },
    { name: "ca.bank", port: "9054", org: "CA Bank" }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Node Blockchain */}
      <div className="lg:col-span-2 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-200">
          <Server className="w-5 h-5 text-teal-400" />
          Node Peer & Orderer Fabric
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {nodes.map((node, i) => (
            <div key={i} className="glass-panel p-4 rounded-xl flex flex-col justify-between border border-slate-800/80 hover:border-slate-700/80 transition-all duration-300">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-mono text-sm font-semibold text-slate-100 truncate w-48">{node.name}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{node.org} ({node.msp})</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${node.color}`}>
                  {node.status}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/50 pt-3">
                <span className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5 text-teal-400" />
                  Port {node.port}
                </span>
                <span className="font-mono text-[10px] uppercase bg-slate-800/50 px-2 py-0.5 rounded">
                  {node.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Otoritas Sertifikat & Status Konsensus */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-slate-200">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          Identitas & Konfigurasi Ledger
        </h3>
        <div className="glass-panel p-5 rounded-xl border border-slate-800/80 space-y-4 h-[calc(100%-2.25rem)] flex flex-col justify-between">
          <div className="space-y-3">
            <h4 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Status Fabric CA</h4>
            <div className="space-y-2">
              {cas.map((ca, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-850 last:border-0">
                  <span className="font-mono text-slate-300">{ca.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-mono">Port {ca.port}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/40 mt-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Cpu className="w-4 h-4 text-purple-400" />
              Konsensus & Kapabilitas
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] text-slate-400 font-mono">
              <div>Tipe: <span className="text-slate-200">Raft (etcdraft)</span></div>
              <div>Kanal: <span className="text-slate-200">bansochannel</span></div>
              <div>Kapabilitas: <span className="text-slate-200">V2_0</span></div>
              <div>Status: <span className="text-emerald-400">Tersinkronisasi</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
