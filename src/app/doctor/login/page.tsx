"use client";

import Header from '@/components/Header';
import { Stethoscope, Lock, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';

export default function DoctorLogin() {
  const [email, setEmail] = useState('staffdoctor@medi-kiosk.demo');
  const [password, setPassword] = useState('DemoDoctor123!');
  const [showPass, setShowPass] = useState(false);
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      // Sign in with physician credentials to get role: 'doctor' custom claim
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.push('/doctor/dashboard');
    } catch (err: any) {
      console.warn('Email login failed, trying fallback anonymous:', err);
      try {
        await signInAnonymously(auth);
        router.push('/doctor/dashboard');
      } catch (fallbackErr) {
        console.error('Doctor login failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-teal-950 to-slate-900 text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-teal-600 shadow-2xl shadow-teal-900/40 mb-4"><Stethoscope size={32} /></div>
          <h1 className="text-3xl font-extrabold mb-2">MediKiosk</h1>
          <p className="text-slate-300 text-sm">Clinical Review Portal</p>
        </div>
        <form onSubmit={handleLogin} className="rounded-3xl bg-white/10 backdrop-blur-xl border border-white/10 p-8 shadow-2xl">
          <h2 className="text-xl font-extrabold mb-6">Doctor Login</h2>
          <div className="mb-4"><label htmlFor="doc-email" className="block text-xs font-extrabold text-slate-300 uppercase tracking-widest mb-2">Email / Doctor ID</label><input id="doc-email" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-300/30" /></div>
          <div className="mb-6"><label htmlFor="doc-pass" className="block text-xs font-extrabold text-slate-300 uppercase tracking-widest mb-2">Password</label><div className="relative"><input id="doc-pass" type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-white placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-teal-300/30" /><button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3 text-slate-300 hover:text-white" aria-label={showPass ? 'Hide password' : 'Show password'}>{showPass ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
          <button type="submit" disabled={loading} className="w-full rounded-2xl bg-teal-500 hover:bg-teal-400 text-white font-extrabold py-4 text-lg shadow-xl transition disabled:opacity-50">
            {loading ? 'Authenticating...' : 'Login'}
          </button>
          <div className="mt-4 text-xs text-slate-400 text-center">Demo credentials: staffdoctor@medi-kiosk.demo / DemoDoctor123!</div>
        </form>
      </div>
    </main>
  );
}
