import React, { useState, useEffect } from 'react';
import { getRecipients, registerRecipient, getRecipientState } from '../services/api';
import { UserPlus, ClipboardList, ShieldAlert, Cpu, CheckCircle } from 'lucide-react';
import ZKPProofForm from '../components/ZKPProofForm';

export default function AdminDashboard() {
  const [recipients, setRecipients] = useState([]);
  const [formData, setFormData] = useState({
    nik: '',
    name: '',
    address: '',
    region: 'ID-JK-01',
    actualIncome: '',
    dependents: '2',
    documentText: ''
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [evaluatingRecipient, setEvaluatingRecipient] = useState(null);

  useEffect(() => {
    fetchRecipients();
  }, []);

  const fetchRecipients = async () => {
    try {
      const data = await getRecipients();
      const enrichedRecipients = await Promise.all(data.map(async (item) => {
        try {
          const ledgerState = await getRecipientState(item.recipientID);
          return { ...item, ...ledgerState };
        } catch {
          return item;
        }
      }));
      setRecipients(enrichedRecipients);
    } catch (err) {
      console.error("Gagal memuat daftar penerima:", err);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await registerRecipient({
        nik: formData.nik,
        name: formData.name,
        address: formData.address,
        region: formData.region,
        actualIncome: Number(formData.actualIncome),
        dependents: Number(formData.dependents),
        documentText: formData.documentText
      });

      setSuccess(`Penerima berhasil didaftarkan dengan ID Pseudonim: ${res.recipientID}`);
      setFormData({
        nik: '',
        name: '',
        address: '',
        region: 'ID-JK-01',
        actualIncome: '',
        dependents: '2',
        documentText: ''
      });
      fetchRecipients();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Pendaftaran gagal. Periksa koneksi jaringan.");
    } finally {
      setLoading(false);
    }
  };

  const selectRecipientForZKP = (rec) => {
    setEvaluatingRecipient(rec);
  };

  return (
    <div className="space-y-8 animate-fade-in text-xs md:text-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-100 glow-text-teal">Konsol Register Bantuan Sosial</h2>
          <p className="text-xs text-slate-400">Portal Kementerian Sosial & Dinas Sosial — Akses Admin Ledger</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Kartu Pendaftaran Penerima */}
        <div className="xl:col-span-1 space-y-4">
          <div className="glass-panel p-5 rounded-xl border border-slate-800/80">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5 text-teal-400" />
              Daftarkan Penerima Baru (DB Off-chain)
            </h3>
            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-red-400 font-medium text-xs">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg text-emerald-400 font-medium text-xs">
                  {success}
                </div>
              )}
              <div>
                <label className="text-slate-400 block font-semibold mb-1">NIK (Nomor Induk Kependudukan)</label>
                <input 
                  type="text" 
                  name="nik"
                  value={formData.nik}
                  onChange={handleInputChange}
                  placeholder="16 digit nomor identitas" 
                  className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-lg p-2 mt-1 text-slate-200 font-mono text-xs outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 block font-semibold mb-1">Nama Lengkap</label>
                  <input 
                    type="text" 
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Nama sesuai KTP" 
                    className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-lg p-2 mt-1 text-slate-200 text-xs outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold mb-1">Wilayah</label>
                  <select 
                    name="region"
                    value={formData.region}
                    onChange={handleInputChange}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-lg p-2 mt-1 text-slate-200 text-xs outline-none"
                  >
                    <option value="ID-JK-01">DKI Jakarta (ID-JK-01)</option>
                    <option value="ID-JB-02">Jawa Barat (ID-JB-02)</option>
                    <option value="ID-JT-03">Jawa Tengah (ID-JT-03)</option>
                    <option value="ID-JI-04">Jawa Timur (ID-JI-04)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-400 block font-semibold mb-1">Penghasilan Bulanan (Rp)</label>
                  <input 
                    type="number" 
                    name="actualIncome"
                    value={formData.actualIncome}
                    onChange={handleInputChange}
                    placeholder="mis. 1500000" 
                    className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-lg p-2 mt-1 text-slate-200 font-mono text-xs outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-slate-400 block font-semibold mb-1">Jumlah Tanggungan</label>
                  <input 
                    type="number" 
                    name="dependents"
                    value={formData.dependents}
                    onChange={handleInputChange}
                    placeholder="mis. 2" 
                    className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-lg p-2 mt-1 text-slate-200 font-mono text-xs outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-400 block font-semibold mb-1">Referensi Dokumen Pendukung</label>
                <textarea 
                  name="documentText"
                  value={formData.documentText}
                  onChange={handleInputChange}
                  placeholder="mis. log scan KTP / KK"
                  className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-lg p-2 mt-1 text-slate-200 font-mono text-xs outline-none h-16 resize-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-50 text-xs"
              >
                {loading ? 'Mendaftarkan...' : 'Daftarkan & Hash'}
              </button>
            </form>
          </div>
        </div>

        {/* Daftar Penerima Terdaftar & Evaluasi */}
        <div className="xl:col-span-2 space-y-6">
          <div className="glass-panel p-5 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-400" />
                Permohonan Menunggu Verifikasi
              </h3>
              <span className="text-xs text-slate-400 font-mono">Jumlah: {recipients.length}</span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-850">
              <table className="w-full text-left border-collapse bg-slate-950/20 font-sans text-xs">
                <thead>
                  <tr className="bg-slate-900/40 border-b border-slate-850 text-slate-400 font-semibold">
                    <th className="p-3">Nama</th>
                    <th className="p-3">ID Pseudonim</th>
                    <th className="p-3">Penghasilan / Tanggungan</th>
                    <th className="p-3">Status ZKP</th>
                    <th className="p-3 text-right">Cek ZKP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {recipients.map((rec) => (
                    <tr key={rec.recipientID} className="hover:bg-slate-900/10">
                      <td className="p-3 font-semibold text-slate-200">{rec.name}</td>
                      <td className="p-3 font-mono text-slate-450">
                        <span title={rec.recipientID}>{rec.recipientID.substring(0, 10)}...</span>
                      </td>
                      <td className="p-3 font-mono text-slate-350">
                        {rec.actualIncome ? rec.actualIncome.toLocaleString('id-ID') : '0'} Rp / {rec.dependents || 0} tanggungan
                      </td>
                      <td className="p-3">
                        {rec.eligible ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Layak
                          </span>
                        ) : rec.zkpVerified ? (
                          <span className="text-red-400 font-bold">Tidak Layak</span>
                        ) : (
                          <span className="text-slate-500">Belum Diverifikasi</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {rec.eligible ? (
                          <span className="text-slate-500 text-[10px] italic">Sudah Terverifikasi</span>
                        ) : (
                          <button
                            onClick={() => selectRecipientForZKP(rec)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-1 px-2.5 rounded text-[10px] transition-colors"
                          >
                            Verifikasi ZKP
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Panel Evaluasi ZKP Aktif */}
          {evaluatingRecipient && (
            <div className="slide-in">
              <div className="flex justify-between items-center bg-slate-900 border border-slate-800 p-4 rounded-t-xl">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Sedang Evaluasi: {evaluatingRecipient.name}</h4>
                  <span className="text-[10px] font-mono text-slate-500 block">Pseudonim: {evaluatingRecipient.recipientID}</span>
                </div>
                <button 
                  onClick={() => setEvaluatingRecipient(null)}
                  className="text-xs text-slate-400 hover:text-slate-200 bg-slate-850 px-2 py-0.5 rounded"
                >
                  Batal
                </button>
              </div>
              <div className="bg-slate-950 p-4 border-x border-b border-slate-800 rounded-b-xl">
                <ZKPProofForm 
                  recipientID={evaluatingRecipient.recipientID} 
                  onVerificationSuccess={() => {
                    setEvaluatingRecipient(null);
                    fetchRecipients();
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
