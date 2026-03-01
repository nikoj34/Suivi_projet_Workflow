import { useState, useEffect } from 'react';
import { getCloudAuth } from '../lib/firebase';
import { db, backup } from '../lib/storage';
import logoDitam from '../assets/logo-ditam.png';

export default function LoginScreen({ config, onLocalAccess }) {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoFromBackup, setLogoFromBackup] = useState(null);

  const cloudAuth = getCloudAuth();
  const noFirebase = !cloudAuth;
  const cfg = config || db.cfg();
  const logoUrl = (cfg && cfg.customLogo) || logoFromBackup || logoDitam;

  useEffect(() => {
    if (logoUrl) return;
    backup.list().then((items) => {
      if (!items.length) return;
      const latest = items[0];
      if (latest.config && latest.config.customLogo) setLogoFromBackup(latest.config.customLogo);
    }).catch(() => {});
  }, [logoUrl]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (noFirebase && onLocalAccess) {
      onLocalAccess();
      return;
    }
    setLoading(true);
    setErr('');
    try {
      await cloudAuth.signInWithEmailAndPassword(email, pwd);
    } catch (error) {
      setErr('Identifiants incorrects ou accès refusé.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] bg-[#f8fafc]">
      <div className="absolute inset-0 opacity-40 pointer-events-none">
        <div className="absolute w-[600px] h-[600px] bg-[#007A78] rounded-full blur-[120px] opacity-20 top-[-200px] left-[-200px] animate-pulse" />
        <div className="absolute w-[500px] h-[500px] bg-[#dd007e] rounded-full blur-[100px] opacity-10 bottom-[-100px] right-[-100px] animate-pulse" />
      </div>
      <div className="relative bg-white/80 backdrop-blur-xl p-10 rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.06)] w-full max-w-md border border-white">
        <div className="flex items-center justify-center mx-auto mb-6" style={{ minHeight: 80 }}>
          {logoUrl && (
            <img src={logoUrl} alt="Logo DITAM" className="h-24 w-auto object-contain mx-auto block mix-blend-multiply" />
          )}
        </div>
        <h2 className="text-center text-2xl font-black text-slate-800 mb-2 uppercase tracking-tighter">Suivi des Travaux DITAM</h2>
        <p className="text-center text-xs text-slate-400 mb-8 font-bold tracking-widest uppercase">Espace Sécurisé</p>
        {err && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-[11px] font-black uppercase tracking-widest rounded-xl text-center">{err}</div>
        )}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Adresse Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-[#007A78] focus:ring-4 focus:ring-[#007A78]/10 transition-all"
              required
              placeholder="nom@cirad.fr"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Mot de passe</label>
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-[#007A78] focus:ring-4 focus:ring-[#007A78]/10 transition-all"
              required
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#007A78] hover:bg-[#006664] text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all mt-2 disabled:opacity-50 shadow-md shadow-teal-200/50 hover:-translate-y-0.5"
          >
            {loading ? 'Vérification...' : 'Se connecter'}
          </button>
          {onLocalAccess && (
            <button
              type="button"
              onClick={onLocalAccess}
              className="w-full py-3 mt-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl transition-all"
            >
              Continuer sans connexion (mode local)
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
