import React, { useState, useEffect } from 'react';
import * as snarkjs from 'snarkjs';
import { buildPoseidon } from 'circomlibjs';
import { EyeOff, FileKey, ShieldAlert, CheckCircle, RefreshCw, Cpu, HelpCircle } from 'lucide-react';
import { verifyZKP } from '../services/api';

let poseidon;
async function getPoseidon() {
  if (!poseidon) {
    poseidon = await buildPoseidon();
  }
  return poseidon;
}

export default function ZKPProofForm({ recipientID, registeredSalt, onVerificationSuccess }) {
  const [nikInput, setNikInput] = useState('');
  const [nonce, setNonce] = useState('1');
  const [income, setIncome] = useState("1500000");
  const [dependents, setDependents] = useState("2");
  const [salt, setSalt] = useState("987654321");
  
  const [incomeThreshold, setIncomeThreshold] = useState("2000000");
  const [minDependents, setMinDependents] = useState("1");

  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [proofTime, setProofTime] = useState(0);
  const [step, setStep] = useState(1); // 1: Input, 2: Pembuatan Bukti, 3: Selesai
  const [generatedProof, setGeneratedProof] = useState(null);
  const [generatedPublic, setGeneratedPublic] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (registeredSalt) {
      setSalt(registeredSalt);
    }
  }, [registeredSalt]);

  const handleGenerateProof = async (e) => {
    e.preventDefault();
    if (!nikInput) {
      setError("Masukkan NIK pribadi Anda untuk identitas binding.");
      return;
    }
    setLoading(true);
    setError(null);
    setStep(2);

    try {
      const t0 = performance.now();

      setLoadingStatus("Loading WASM...");
      await new Promise(r => setTimeout(r, 100));

      setLoadingStatus("Generating witness (Poseidon hashes)...");
      const p = await getPoseidon();
      const hashCommitment = p([BigInt(nikInput), BigInt(salt)]);
      const commitment = p.F.toString(hashCommitment);
      
      const hashNullifier = p([BigInt(nikInput), BigInt(salt), BigInt(nonce)]);
      const nullifierVal = p.F.toString(hashNullifier);

      setLoadingStatus("Generating proof...");

      const input = {
        nik: nikInput.toString(),
        salt: salt.toString(),
        nonce: nonce.toString(),
        income: income.toString(),
        dependents: dependents.toString(),
        eligible: (Number(income) <= Number(incomeThreshold) && Number(dependents) >= Number(minDependents)) ? "1" : "0",
        recipientCommitment: commitment,
        nullifier: nullifierVal,
        incomeThreshold: incomeThreshold.toString(),
        minDependents: minDependents.toString()
      };

      console.log("Generating real Groth16 proof with input:", input);
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        input,
        "/zkp/eligibility.wasm",
        "/zkp/eligibility_final.zkey"
      );

      const t1 = performance.now();
      setProofTime((t1 - t0).toFixed(2));
      setLoadingStatus("Proof generated.");

      console.log("Generated Proof:", proof);
      console.log("Generated Public Signals (Ordering matches circuit):", publicSignals);

      setGeneratedProof(proof);
      setGeneratedPublic(publicSignals);
    } catch (err) {
      console.error("ZKP generation failed:", err);
      setError("Gagal membuat bukti kriptografi: " + err.message);
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitProof = async () => {
    if (!recipientID) {
      setError("Tentukan hash NIK penerima (recipientID) terlebih dahulu.");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // Send only recipientID, proof, and publicSignals (never private parameters)
      const res = await verifyZKP(recipientID, generatedProof, generatedPublic);
      setResult(res);
      setStep(3);
      if (res.zkpVerified && onVerificationSuccess) {
        onVerificationSuccess(res);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Gagal mengirim dan memverifikasi bukti di blockchain.");
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setGeneratedProof(null);
    setGeneratedPublic(null);
    setResult(null);
    setError(null);
    setProofTime(0);
    setLoadingStatus('');
    setNikInput('');
  };

  return (
    <div className="glass-panel p-6 rounded-xl border border-slate-800/80">
      <div className="flex items-center gap-2 mb-4">
        <Cpu className="w-5 h-5 text-purple-400" />
        <h3 className="text-sm font-semibold text-slate-200">Generator Kelayakan Multi-Kendala ZKP</h3>
      </div>

      {step === 1 && (
        <form onSubmit={handleGenerateProof} className="space-y-4">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Buktikan bahwa penghasilan bulanan Anda <strong>di bawah atau sama dengan batas</strong> DAN Anda menanggung <strong>minimal jumlah tanggungan yang ditentukan</strong>. 
            Semua perhitungan terjadi di browser. Hanya bukti ZK yang dikirim ke jaringan.
          </p>

          <div className="space-y-3">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block border-b border-slate-900 pb-1">Data Rahasia Pribadi (Input)</span>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                  <EyeOff className="w-3 h-3 text-indigo-400" />
                  NIK (Data Rahasia)
                </label>
                <input 
                  type="password" 
                  value={nikInput}
                  onChange={(e) => setNikInput(e.target.value)}
                  placeholder="Masukkan NIK 16 digit Anda"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 mt-1 text-slate-200 font-mono text-xs outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                  <EyeOff className="w-3 h-3 text-indigo-400" />
                  Nonce (Replay Protection)
                </label>
                <input 
                  type="number" 
                  value={nonce}
                  onChange={(e) => setNonce(e.target.value)}
                  placeholder="1"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 mt-1 text-slate-200 font-mono text-xs outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                  <EyeOff className="w-3 h-3 text-indigo-400" />
                  Penghasilan Bulanan (Rp)
                </label>
                <input 
                  type="number" 
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder="mis. 1500000"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 mt-1 text-slate-200 font-mono text-xs outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                  <EyeOff className="w-3 h-3 text-indigo-400" />
                  Jumlah Tanggungan
                </label>
                <input 
                  type="number" 
                  value={dependents}
                  onChange={(e) => setDependents(e.target.value)}
                  placeholder="mis. 2"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 mt-1 text-slate-200 font-mono text-xs outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                  <HelpCircle className="w-3 h-3 text-indigo-450" />
                  Tanda Tangan Salt
                </label>
                <input 
                  type="text" 
                  value={salt}
                  onChange={(e) => setSalt(e.target.value)}
                  placeholder="nilai acak"
                  className="w-full bg-slate-800 border border-slate-800 focus:border-indigo-500 rounded-lg p-2 mt-1 text-slate-400 font-mono text-xs outline-none"
                  readOnly
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block border-b border-slate-900 pb-1">Parameter Kebijakan Publik</span>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                  <FileKey className="w-3 h-3 text-teal-400" />
                  Batas Penghasilan (Rp)
                </label>
                <input 
                  type="number" 
                  value={incomeThreshold}
                  onChange={(e) => setIncomeThreshold(e.target.value)}
                  placeholder="mis. 2000000"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-lg p-2 mt-1 text-slate-200 font-mono text-xs outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                  <FileKey className="w-3 h-3 text-teal-400" />
                  Min. Tanggungan
                </label>
                <input 
                  type="number" 
                  value={minDependents}
                  onChange={(e) => setMinDependents(e.target.value)}
                  placeholder="mis. 1"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-lg p-2 mt-1 text-slate-200 font-mono text-xs outline-none"
                  required
                />
              </div>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-indigo-600/20 text-xs"
          >
            Buat Witness & Bukti Groth16
          </button>
        </form>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 flex items-center gap-2 font-mono">
              <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${loading ? 'animate-spin' : ''}`} />
              Bukti Kriptografi Kelayakan
            </span>
            <button onClick={resetForm} className="text-xs text-slate-400 hover:text-slate-200">
              Ulang
            </button>
          </div>

          {loading ? (
            <div className="bg-slate-900/60 p-6 rounded-lg border border-slate-800 text-center space-y-3 font-mono text-[11px]">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-slate-300 font-bold animate-pulse text-indigo-400">{loadingStatus}</p>
              <p className="text-slate-500 text-[9px]">eligible &lt;== LessEqualThan(income, incomeThreshold) * GreaterEqualThan(dependents, minDependents)</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-400 font-semibold">Protokol Kriptografi:</span>
                  <span className="font-mono text-indigo-400 font-bold">Groth16 (snarkjs)</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-400 font-semibold">Kurva Elliptic:</span>
                  <span className="font-mono text-teal-400 font-bold">bn128</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-400 font-semibold">Waktu Komputasi Proving:</span>
                  <span className="font-mono text-purple-400 font-bold">{proofTime} ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-semibold">Sinyal Kelayakan Publik:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {generatedPublic && (generatedPublic[0] === "1" ? "LAYAK (1)" : "TIDAK LAYAK (0)")}
                  </span>
                </div>

                <details className="mt-3 group border border-slate-800 rounded-lg p-2 bg-slate-950">
                  <summary className="text-[10px] text-slate-500 uppercase tracking-wider font-bold cursor-pointer select-none outline-none hover:text-slate-350 flex justify-between items-center">
                    <span>Lihat Bukti Mentah (Payload JSON)</span>
                    <span className="text-[8px] border border-slate-800 px-1 py-0.5 rounded group-open:hidden">BUKA</span>
                    <span className="text-[8px] border border-slate-800 px-1 py-0.5 rounded hidden group-open:inline">TUTUP</span>
                  </summary>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-2 border-t border-slate-800 slide-in">
                    <div>
                      <span className="text-[8px] text-slate-500 uppercase font-bold block mb-1">proof.json</span>
                      <pre className="bg-slate-900 p-2 rounded border border-slate-800 text-[9px] font-mono text-slate-300 overflow-y-auto h-32 leading-tight">
                        {JSON.stringify(generatedProof, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <span className="text-[8px] text-slate-500 uppercase font-bold block mb-1">publicSignals.json</span>
                      <pre className="bg-slate-900 p-2 rounded border border-slate-800 text-[9px] font-mono text-slate-300 overflow-y-auto h-32 leading-tight">
                        {JSON.stringify(generatedPublic, null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg flex items-start gap-2 text-xs text-red-400 font-medium">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button 
                onClick={handleSubmitProof}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 shadow-lg shadow-emerald-600/20 text-xs"
              >
                Kirim & Verifikasi di Blockchain
              </button>
            </div>
          )}
        </div>
      )}

      {step === 3 && result && (
        <div className="bg-slate-900/60 border border-slate-850 p-5 rounded-lg text-center space-y-4 slide-in">
          <CheckCircle className={`w-12 h-12 mx-auto ${result.zkpVerified ? 'text-emerald-400' : 'text-red-400'}`} />
          
          <div>
            <h4 className="font-bold text-slate-200">
              {result.zkpVerified ? 'Bukti ZK Tervalidasi!' : 'Verifikasi ZKP Gagal'}
            </h4>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {result.zkpVerified 
                ? 'Parameter penghasilan dan jumlah keluarga Anda memenuhi kriteria bansos. Entri ledger diperbarui.' 
                : 'Kendala kriptografi gagal. Periksa batas kriteria pribadi Anda.'
              }
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-md text-[10px] font-mono text-slate-400 text-left border border-slate-850">
            <div>ID Ledger: <span className="text-slate-300 font-bold">{recipientID}</span></div>
            <div>Status Kelayakan: <span className={result.eligible ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>{result.eligible ? "LAYAK" : "TIDAK LAYAK"}</span></div>
            <div>ZKP Terverifikasi: <span className="text-indigo-400 font-bold">YA</span></div>
          </div>

          <button 
            onClick={resetForm}
            className="text-xs text-slate-400 hover:text-slate-200 bg-slate-800 px-3.5 py-1.5 rounded-lg font-medium"
          >
            Jalankan Bukti Lain
          </button>
        </div>
      )}
    </div>
  );
}
