import React, { useState, useEffect } from 'react';
import { Landmark, Shield, LogOut, CheckCircle, ShieldAlert, Network, UserCircle, Users } from 'lucide-react';
import { login, logout, getCurrentUser, getRecipients, getRecipientState, getSystemStatus } from './services/api';
import AdminDashboard from './pages/AdminDashboard';
import UserPortal from './pages/UserPortal';
import AuditorPanel from './pages/AuditorPanel';
import DistributionTable from './components/DistributionTable';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('portal'); // portal, admin, bank, auditor
  const [authForm, setAuthForm] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const [recipients, setRecipients] = useState([]);

  useEffect(() => {
    setCurrentUser(getCurrentUser());
    fetchStatus();
    if (getCurrentUser()) {
      const user = getCurrentUser();
      if (user.role === 'admin') setActiveTab('admin');
      else if (user.role === 'bank') setActiveTab('bank');
      else if (user.role === 'auditor') setActiveTab('auditor');
      fetchRecipients();
    }
  }, []);

  const fetchStatus = async () => {
    try {
      const status = await getSystemStatus();
      setSystemStatus(status);
    } catch (err) {
      console.warn("Tidak dapat menghubungi API backend.", err.message);
    }
  };

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

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await login(authForm.username, authForm.password);
      setCurrentUser(res);
      fetchRecipients();
      
      if (res.role === 'admin') setActiveTab('admin');
      else if (res.role === 'bank') setActiveTab('bank');
      else if (res.role === 'auditor') setActiveTab('auditor');
    } catch (err) {
      console.error(err);
      setAuthError(err.response?.data?.error || "Login tidak diizinkan. Periksa kredensial Anda.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setActiveTab('portal');
    setAuthForm({ username: '', password: '' });
  };

  const fillMockCredentials = (username, password) => {
    setAuthForm({ username, password });
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col justify-between selection:bg-teal-500/30 font-sans">
      
      {/* Header Bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="bg-gradient-to-tr from-teal-500 to-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-teal-500/10">
              <Shield className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-teal-400 to-indigo-400 bg-clip-text text-transparent">BansosChain</h1>
              <p className="text-[10px] font-semibold text-slate-500 tracking-widest uppercase">Protokol Kepercayaan Terdesentralisasi</p>
            </div>
          </div>

          {/* Navigasi */}
          <nav className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
            <button 
              onClick={() => setActiveTab('portal')}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${activeTab === 'portal' ? 'bg-slate-900 text-teal-400 border border-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Portal Publik
            </button>

            {currentUser?.role === 'admin' && (
              <button 
                onClick={() => setActiveTab('admin')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${activeTab === 'admin' ? 'bg-slate-900 text-teal-400 border border-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Konsol Kemensos
              </button>
            )}

            {currentUser?.role === 'bank' && (
              <button 
                onClick={() => setActiveTab('bank')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${activeTab === 'bank' ? 'bg-slate-900 text-teal-400 border border-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Penyaluran Dana
              </button>
            )}

            {currentUser?.role === 'auditor' && (
              <button 
                onClick={() => setActiveTab('auditor')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${activeTab === 'auditor' ? 'bg-slate-900 text-teal-400 border border-slate-800' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Jejak Audit
              </button>
            )}

            {currentUser ? (
              <button 
                onClick={handleLogout}
                className="ml-2 flex items-center gap-1.5 bg-red-950/40 hover:bg-red-950/80 text-red-400 font-semibold px-3.5 py-2 rounded-lg transition-all border border-red-900/30 text-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                Keluar
              </button>
            ) : (
              activeTab !== 'portal' && setActiveTab('portal')
            )}
          </nav>
        </div>
      </header>

      {/* Area Konten Utama */}
      <main className="max-w-7xl mx-auto px-4 py-8 flex-grow w-full">
        {/* Spanduk Status Jaringan */}
        {systemStatus && (
          <div className="mb-6 bg-slate-950/60 border border-slate-900 p-3 rounded-xl flex items-center justify-between text-xs text-slate-400 font-mono">
            <span className="flex items-center gap-2">
              <Network className="w-4 h-4 text-teal-400" />
              API: <span className="text-emerald-400 uppercase">{systemStatus.status}</span>
            </span>
            <span className="text-slate-500">
              Ledger Fabric: <span className="text-slate-350">{systemStatus.blockchainMode}</span>
            </span>
          </div>
        )}

        {/* Routing Tab */}
        <div className="space-y-6">
          {activeTab === 'portal' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Kiri: Pencarian */}
              <div className="xl:col-span-2">
                <UserPortal />
              </div>
              
              {/* Kanan: Kartu Masuk */}
              <div className="xl:col-span-1">
                {!currentUser ? (
                  <div className="glass-panel p-6 rounded-xl border border-slate-800/80 shadow-2xl space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <UserCircle className="w-5 h-5 text-teal-400" />
                      <h3 className="text-base font-bold text-slate-200">Portal Otoritas Aman</h3>
                    </div>
                    
                    <form onSubmit={handleLogin} className="space-y-4 text-xs">
                      {authError && (
                        <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-red-400 font-medium">
                          {authError}
                        </div>
                      )}
                      <div>
                        <label className="text-slate-400 block font-semibold mb-1">Nama Pengguna</label>
                        <input 
                          type="text" 
                          value={authForm.username}
                          onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                          placeholder="kemensos / bank / auditor" 
                          className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-lg p-2.5 mt-1 text-slate-200 outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block font-semibold mb-1">Kata Sandi</label>
                        <input 
                          type="password" 
                          value={authForm.password}
                          onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                          placeholder="Masukkan kata sandi" 
                          className="w-full bg-slate-900 border border-slate-800 focus:border-teal-500 rounded-lg p-2.5 mt-1 text-slate-200 outline-none"
                          required
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={authLoading}
                        className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                      >
                        {authLoading ? 'Sedang Masuk...' : 'Masuk'}
                      </button>
                    </form>

                    {/* Tombol Isi Otomatis Demo */}
                    <div className="pt-4 border-t border-slate-900 space-y-2">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Ganti Identitas Cepat (Demo)</span>
                      <div className="grid grid-cols-3 gap-1.5 text-[9px] font-bold font-mono">
                        <button 
                          onClick={() => fillMockCredentials('kemensos', 'admin123')}
                          className="bg-slate-900 hover:bg-slate-850 p-1.5 rounded text-indigo-400 border border-indigo-950"
                        >
                          KEMENSOS
                        </button>
                        <button 
                          onClick={() => fillMockCredentials('bank', 'bank123')}
                          className="bg-slate-900 hover:bg-slate-850 p-1.5 rounded text-emerald-400 border border-emerald-950"
                        >
                          BANK
                        </button>
                        <button 
                          onClick={() => fillMockCredentials('auditor', 'audit123')}
                          className="bg-slate-900 hover:bg-slate-850 p-1.5 rounded text-purple-400 border border-purple-950"
                        >
                          AUDITOR
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="glass-panel p-6 rounded-xl border border-slate-800/80 shadow-2xl text-center space-y-4">
                    <div className="w-12 h-12 bg-teal-500/10 rounded-full flex items-center justify-center mx-auto border border-teal-500/25">
                      <CheckCircle className="w-6 h-6 text-teal-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-200">Identitas Berhasil Masuk</h4>
                      <p className="text-xs text-slate-400 mt-1 font-mono">Pengguna: {currentUser.username} | Peran: {currentUser.role}</p>
                    </div>
                    <div className="text-[10px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                      Gunakan bilah navigasi atas untuk mengakses konsol ledger khusus sesuai level izin Anda.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'admin' && currentUser?.role === 'admin' && (
            <AdminDashboard />
          )}

          {activeTab === 'bank' && currentUser?.role === 'bank' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 glow-text-teal">Konsol Penyaluran Dana Bank</h2>
                <p className="text-xs text-slate-400">Bank Penyalur — Manajemen Distribusi Dana Bantuan Sosial</p>
              </div>
              <div className="glass-panel p-5 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-emerald-400" />
                    Antrian Penyaluran Dana Terverifikasi
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">Jumlah Penerima: {recipients.length}</span>
                </div>
                <DistributionTable 
                  recipients={recipients} 
                  isBankUser={true}
                  onDistributeSuccess={fetchRecipients}
                />
              </div>
            </div>
          )}

          {activeTab === 'auditor' && currentUser?.role === 'auditor' && (
            <AuditorPanel />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/60 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-600 font-mono">
          <span>BansosChain &copy; 2024 — Sistem Transparansi Bantuan Sosial Berbasis Blockchain</span>
          <span className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-teal-700" />
            Hyperledger Fabric + ZKP + MongoDB Off-Chain
          </span>
        </div>
      </footer>
    </div>
  );
}
