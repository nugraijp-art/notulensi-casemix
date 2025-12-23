import React, { useState, useEffect } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { 
  ClipboardCheck, Send, AlertCircle, 
  Loader2, Calendar, Wand2, Printer, 
  History, PlusCircle, Trash2,
  Globe, ShieldCheck, Search,
  User, Tag, FileText, Users,
  CheckCircle2, Sparkles
} from 'lucide-react';

// --- Firebase & API Config ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'notulensi-casemix-rsud';
const apiKey = ""; 
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyGsKICs5mdWgBKmA44Yh-BRywoNZdY3fB69zYlRuaiMcAdLIHwrFernlKgSOdpvPrF/exec"; 

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [view, setView] = useState('input'); 
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const [formData, setFormData] = useState({
    nama: '',
    waktu: new Date().toISOString().split('T')[0],
    tema: '',
    peserta: '', 
    isi: ''
  });

  useEffect(() => {
    const savedDraft = localStorage.getItem('casemix_notulen_v25_draft');
    if (savedDraft) {
      try {
        setFormData(JSON.parse(savedDraft));
      } catch(e) { console.error("Draft error"); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('casemix_notulen_v25_draft', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        setError("Koneksi keamanan gagal.");
      }
    };
    initAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'notulensi');
    const unsubscribeData = onSnapshot(query(colRef), 
      (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setHistory(data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      }, 
      (err) => setError("Gagal sinkronisasi data.")
    );
    return () => unsubscribeData();
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Hapus permanen dokumen ini?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'notulensi', id));
      setSuccessMsg("🗑️ Dokumen berhasil dihapus.");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err) {
      setError("Gagal menghapus.");
    }
  };

  const handleRefine = async () => {
    if (!formData.isi) return;
    setAiLoading(true);
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Format text ini menjadi notulensi rapat profesional (gunakan poin-poin/bullet): ${formData.isi}` }] }],
          systemInstruction: { parts: [{ text: "Anda adalah asisten administrasi rumah sakit RSUD Dr. Iskak yang ramah dan profesional." }] }
        })
      });
      const resData = await response.json();
      const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) setFormData(p => ({ ...p, isi: text.trim() }));
    } catch (e) { setError("AI sedang sibuk."); }
    finally { setAiLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const colRef = collection(db, 'artifacts', appId, 'public', 'data', 'notulensi');
      await addDoc(colRef, { ...formData, userId: user.uid, createdAt: serverTimestamp() });
      
      if (WEB_APP_URL) {
        // Mengirimkan data lengkap termasuk peserta ke Apps Script
        fetch(WEB_APP_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(formData) });
      }

      setLoading(false);
      setSuccessMsg("✨ Mantap! Berhasil disimpan ke Cloud!");
      localStorage.removeItem('casemix_notulen_v25_draft');
      setTimeout(() => setView('history'), 1000);
    } catch (err) {
      setError("Gagal menyimpan.");
      setLoading(false);
    }
  };

  const filteredHistory = history.filter(item => 
    item.tema.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.nama.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const participantCount = formData.peserta.split('\n').filter(p => p.trim()).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <div className="w-full max-w-4xl mx-auto bg-white md:my-6 md:rounded-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col flex-1">
        
        {/* Header Section */}
        <header className="bg-blue-900 p-6 md:p-8 text-white relative no-print">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 rounded-xl backdrop-blur-md border border-white/20">
                <ClipboardCheck size={28} className="text-blue-200" />
              </div>
              <div>
                <h1 className="text-xl font-black uppercase tracking-tight">RSUD DR. ISKAK</h1>
                <p className="text-[10px] text-blue-300 font-bold uppercase tracking-[0.3em]">CMS CASEMIX v2.5 ✨</p>
              </div>
            </div>
            <div className="hidden md:flex flex-col items-end opacity-60">
              <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><ShieldCheck size={12}/> Secure Cloud</span>
              <span className="text-[9px] font-medium uppercase tracking-widest">{user?.uid ? `SID: ${user.uid.slice(0,8)}` : 'Connecting...'}</span>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <nav className="flex border-b no-print bg-white sticky top-0 z-20">
          <button onClick={() => setView('input')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${view === 'input' ? 'text-blue-700 border-b-4 border-blue-700 bg-blue-50/30' : 'text-slate-400'}`}>
            <PlusCircle size={16} /> Input Baru 📝
          </button>
          <button onClick={() => setView('history')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${view === 'history' ? 'text-blue-700 border-b-4 border-blue-700 bg-blue-50/30' : 'text-slate-400'}`}>
            <History size={16} /> Arsip Digital 📁
          </button>
        </nav>

        <main className="flex-1 overflow-y-auto selection:bg-blue-100">
          {successMsg && <div className="bg-emerald-600 text-white p-3 text-center text-[10px] font-black uppercase animate-pulse">{successMsg}</div>}
          {error && <div className="bg-red-600 text-white p-3 text-center text-[10px] font-black uppercase">{error}</div>}

          {view === 'input' && (
            <div className="p-6 md:p-10 animate-in fade-in slide-in-from-bottom-2 no-print">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><User size={12}/> Petugas Notulis 🧑‍💼</label>
                    <input required name="nama" value={formData.nama} onChange={handleChange} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 font-bold text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all" placeholder="Nama Lengkap" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><Calendar size={12}/> Tanggal Rapat 📅</label>
                    <input required type="date" name="waktu" value={formData.waktu} onChange={handleChange} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 font-bold text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><Tag size={12}/> Tema Pembahasan 📌</label>
                  <input required name="tema" value={formData.tema} onChange={handleChange} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 font-bold text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all" placeholder="Topik Utama Rapat" />
                </div>

                {/* Field Daftar Hadir */}
                <div className="space-y-1.5 p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black text-blue-700 uppercase flex items-center gap-2"><Users size={12}/> Daftar Hadir Peserta 👥</label>
                    <span className="text-[9px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full">{participantCount} ORANG</span>
                  </div>
                  <textarea rows="3" name="peserta" value={formData.peserta} onChange={handleChange} className="w-full p-4 rounded-xl border border-blue-200 bg-white font-medium text-xs focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none" placeholder="Ketik nama peserta (Enter untuk baris baru)..." />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2"><FileText size={12}/> Isi Pembahasan 🖋️</label>
                    <button type="button" onClick={handleRefine} disabled={aiLoading || !formData.isi} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[9px] font-black hover:bg-blue-700 flex items-center gap-2 shadow-sm">
                      {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} AI RAPIKAN ✨
                    </button>
                  </div>
                  <textarea required rows="10" name="isi" value={formData.isi} onChange={handleChange} className="w-full p-5 rounded-xl border border-slate-200 bg-slate-50 font-medium text-sm focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none leading-relaxed" placeholder="Tuliskan poin-poin rapat di sini..." />
                </div>

                <button type="submit" disabled={loading} className="w-full bg-blue-900 text-white py-5 rounded-xl font-black text-[11px] uppercase tracking-[0.3em] shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3">
                  {loading ? <Loader2 className="animate-spin" /> : <><Send size={18}/> Simpan & Arsipkan 🚀</>}
                </button>
              </form>
            </div>
          )}

          {view === 'history' && (
            <div className="p-6 md:p-10 no-print">
              <div className="mb-8 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Cari Tema atau Petugas..." className="w-full pl-12 pr-6 py-4 rounded-2xl border border-slate-200 bg-white font-bold text-sm outline-none focus:ring-4 focus:ring-blue-50 transition-all shadow-sm" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredHistory.map(item => (
                  <div key={item.id} onClick={() => { setFormData(item); setView('review'); }} className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-blue-600 cursor-pointer transition-all shadow-sm group relative overflow-hidden">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md">{item.waktu}</span>
                      <button onClick={(e) => handleDelete(item.id, e)} className="p-2 text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <h3 className="font-bold text-slate-800 uppercase text-sm mb-2 line-clamp-1">{item.tema}</h3>
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-50">
                       <span className="text-[10px] font-bold text-slate-400 uppercase">🧑‍💼 {item.nama}</span>
                       <span className="text-[9px] font-black text-blue-700 flex items-center gap-1"><Users size={10}/> {item.peserta ? item.peserta.split('\n').filter(p=>p.trim()).length : 0} Peserta</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'review' && (
            <div className="p-6 md:p-10">
              <div className="flex flex-col md:flex-row gap-3 mb-8 no-print">
                <button onClick={() => window.print()} className="flex-1 bg-blue-900 text-white py-4 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg"><Printer size={16}/> Cetak Dokumen 🖨️</button>
                <button onClick={() => setView('history')} className="flex-1 bg-white text-slate-500 border py-4 rounded-xl font-black text-[10px] uppercase flex items-center justify-center gap-2">Kembali 🔙</button>
              </div>

              <div id="printable-area" className="bg-white p-4 font-calibri text-slate-900">
                <div className="text-center border-b-[5px] border-blue-900 pb-6 mb-8">
                  <h2 className="text-2xl font-black text-blue-900 uppercase leading-tight">PEMERINTAH KABUPATEN TULUNGAGUNG</h2>
                  <h3 className="text-xl font-black text-blue-900 uppercase">RSUD DR. ISKAK TULUNGAGUNG</h3>
                  <p className="text-[9px] font-bold uppercase tracking-[0.5em] mt-2 text-blue-800">INSTALASI CASEMIX • RISALAH RAPAT & DAFTAR HADIR</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[11px] mb-8 pb-4 border-b">
                  <div><span className="text-slate-400 uppercase text-[8px] font-black block">Penyusun:</span> <span className="font-bold text-base">🧑‍💼 {formData.nama}</span></div>
                  <div className="text-right"><span className="text-slate-400 uppercase text-[8px] font-black block">Tanggal:</span> <span className="font-bold text-base">📅 {formData.waktu}</span></div>
                </div>

                <div className="mb-8">
                  <span className="text-slate-400 uppercase text-[8px] font-black block mb-1">Topik Utama:</span>
                  <h4 className="text-lg font-black bg-slate-50 p-4 border-l-8 border-blue-900 uppercase tracking-tight">📌 {formData.tema}</h4>
                </div>

                {formData.peserta && (
                  <div className="mb-8 bg-white border border-slate-200 p-6 rounded-lg">
                    <span className="text-slate-400 uppercase text-[8px] font-black block mb-4 border-b pb-1">Daftar Hadir Peserta Rapat:</span>
                    <div className="grid grid-cols-2 gap-x-12 gap-y-2 text-[10.5pt]">
                      {formData.peserta.split('\n').filter(p => p.trim()).map((name, idx) => (
                        <div key={idx} className="flex items-center gap-3 border-b border-slate-50 pb-1">
                          <span className="text-[9px] font-black text-slate-300 w-4">{idx + 1}.</span>
                          <span className="font-medium text-slate-800 uppercase">{name}</span>
                          <span className="ml-auto opacity-20"><CheckCircle2 size={12}/></span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="min-h-[400px] mb-12">
                  <span className="text-slate-400 uppercase text-[8px] font-black block mb-4 border-b pb-1">Hasil Pembahasan / Notulensi:</span>
                  <div className="text-[12pt] leading-relaxed whitespace-pre-wrap font-medium">
                    {formData.isi}
                  </div>
                </div>

                <div className="mt-20 grid grid-cols-2 text-center text-[10px] font-bold gap-12">
                  <div>
                    <p className="mb-24 uppercase tracking-widest italic text-slate-400 font-normal">Mengetahui,</p>
                    <div className="border-t-2 border-slate-900 pt-2 uppercase">( ........................................ )</div>
                  </div>
                  <div>
                    <p className="mb-24 uppercase tracking-widest italic text-slate-400 font-normal">Notulis,</p>
                    <div className="border-t-2 border-slate-900 pt-2 uppercase">({formData.nama})</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="p-4 text-center no-print text-[8px] font-black text-slate-300 tracking-[0.4em] uppercase border-t bg-slate-50">
          RSUD DR ISKAK • CASEMIX DIGITAL ASSET v2.5 ✨
        </footer>

        <style>{`
          @import url('https://fonts.cdnfonts.com/css/calibri');
          .font-calibri { font-family: 'Calibri', sans-serif; }
          .line-clamp-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; padding: 0 !important; }
            .w-full { max-width: 100% !important; border: none !important; border-radius: 0 !important; margin: 0 !important; }
            main { overflow: visible !important; }
            #printable-area { padding: 0 !important; }
          }
        `}</style>
      </div>
    </div>
  );
}
