"use client";

import Header from '@/components/Header';
import { Activity, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function NurseLogin() {
  const [email, setEmail] = useState('testnurse@medi-kiosk.demo');
  const [password, setPassword] = useState('DemoNurse123!');
  const [showPass, setShowPass] = useState(false);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push('/nurse/dashboard');
    } catch (err: any) {
      console.error('Nurse login failed:', err);
      setError(err?.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-900 text-white flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-teal-500 shadow-2xl shadow-teal-500/30 mb-4 ring-8 ring-teal-500/20">
            <Activity size={32} className="text-white animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">MediKiosk</h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck size={14} /> Clinical Triage Portal
          </div>
        </div>

        <form onSubmit={handleLogin} className="rounded-3xl bg-white/10 backdrop-blur-2xl border border-white/10 p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-36 h-36 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <h2 className="text-xl font-extrabold mb-1 text-white">Nurse Authentication</h2>
          <p className="text-xs text-slate-400 mb-6">Enter triage staff credentials to manage patient queue and priority assessment.</p>

          {error && (
            <div className="mb-5 rounded-2xl bg-rose-500/20 border border-rose-500/40 p-3.5 text-xs text-rose-200 font-medium">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="nurse-email" className="block text-[11px] font-extrabold text-slate-300 uppercase tracking-wider mb-2">
              Staff Email / ID
            </label>
            <input
              id="nurse-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition"
              placeholder="nurse@hospital.org"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="nurse-pass" className="block text-[11px] font-extrabold text-slate-300 uppercase tracking-wider mb-2">
              Security Key / Password
            </label>
            <div className="relative">
              <input
                id="nurse-pass"
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/15 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition pr-11"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-white transition"
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-extrabold py-3.5 px-6 shadow-lg shadow-teal-500/25 transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>Verifying Custom Claims...</span>
            ) : (
              <>
                <span>Access Triage Station</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <div className="text-[11px] font-semibold text-slate-400">
              Verified Triage Station Demo Credentials:
            </div>
            <div className="mt-1 font-mono text-[11px] text-teal-300 bg-teal-950/60 rounded-lg py-1 px-2 border border-teal-800/40 inline-block">
              testnurse@medi-kiosk.demo • DemoNurse123!
            </div>
          </div>
        </form>

        <div className="text-center mt-6">
          <a href="/" className="text-xs text-slate-400 hover:text-white transition">
            ← Return to MediKiosk Home
          </a>
        </div>
      </div>
    </main>
  );
}
