"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useTranslation } from '@/lib/i18n';
import Header from '@/components/Header';
import { LogIn, UserPlus, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function PatientAuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();
  const router = useRouter();
  const { currentUser } = useAuth();

  const handleAuthError = (err: any) => {
    switch (err.code) {
      case 'auth/invalid-email':
        return t('Invalid email format');
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return t('Invalid email or password');
      case 'auth/email-already-in-use':
        return t('Email already in use');
      case 'auth/weak-password':
        return t('Password is too weak');
      default:
        return t('An error occurred during authentication');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      // Redirect to next step in the flow
      router.push('/patient/language');
    } catch (err: any) {
      setError(handleAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  if (currentUser) {
    return (
      <main className="min-h-screen bg-slate-50">
        <Header title={t('Authentication')} />
        <div className="max-w-md mx-auto px-6 py-24 text-center">
          <div className="bg-teal-50 border border-teal-200 p-8 rounded-3xl">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{t('Already logged in')}</h2>
            <p className="text-slate-600 mb-6">{currentUser.email}</p>
            <button 
              onClick={() => router.push('/patient/language')}
              className="w-full rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 shadow-lg shadow-teal-900/20 transition"
            >
              {t('Continue to Consultation')}
            </button>
            <button 
              onClick={() => auth.signOut()}
              className="w-full mt-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-3 transition"
            >
              {t('Log Out')}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <Header title={isLogin ? t('Login') : t('Sign Up')} />
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-2">
            {isLogin ? t('Welcome Back') : t('Create Account')}
          </h2>
          <p className="text-slate-500">
            {t('Secure access to your health information')}
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">{t('Email Address')}</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 text-slate-400" size={20} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="patient@example.com"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-4 focus:ring-teal-200 transition text-slate-900 font-medium"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">{t('Password')}</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-slate-400" size={20} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-4 focus:ring-teal-200 transition text-slate-900 font-medium"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl text-sm font-medium">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 shadow-lg shadow-teal-900/20 transition disabled:opacity-70"
            >
              {loading ? (
                <><Loader2 size={20} className="animate-spin" /> {t('Processing...')}</>
              ) : (
                <>
                  {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
                  {isLogin ? t('Login') : t('Sign Up')}
                </>
              )}
            </button>
          </form>
          
          <div className="mt-8 text-center text-sm font-medium text-slate-500">
            {isLogin ? t("Don't have an account?") : t("Already have an account?")}
            <button 
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); }} 
              className="ml-2 text-teal-600 hover:text-teal-700 font-bold focus:outline-none"
            >
              {isLogin ? t('Sign Up') : t('Login')}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
