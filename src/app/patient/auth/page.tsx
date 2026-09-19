"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useTranslation } from '@/lib/i18n';
import Header from '@/components/Header';
import { LogIn, UserPlus, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getSession, updateSession } from '@/lib/store/store';
import { syncSessionToFirestore } from '@/lib/firestore';

export default function PatientAuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [mobile, setMobile] = useState('');
  const [consent, setConsent] = useState(false);
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

    // Capture the old anonymous UID before it gets overwritten by sign in / sign up
    const oldUid = auth.currentUser?.isAnonymous ? auth.currentUser.uid : null;

    try {
      let newUid = '';

      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        newUid = userCredential.user.uid;
      } else {
        if (password !== confirmPassword) {
          setError(t('Passwords do not match'));
          setLoading(false);
          return;
        }
        if (!consent) {
          setError(t('You must agree to the privacy policy to continue'));
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        newUid = userCredential.user.uid;
        
        // Save patient profile to Firestore
        await setDoc(doc(db, 'patients', newUid), {
          id: newUid,
          name,
          age: parseInt(age, 10),
          gender,
          contact: mobile,
          email,
          consent: true,
          createdAt: new Date().toISOString()
        });
      }

      // If we had an anonymous UID, migrate any patientSessions to the new UID
      if (oldUid && newUid && oldUid !== newUid) {
        try {
          const currentLocalSession = getSession();
          if (currentLocalSession && currentLocalSession.answers && currentLocalSession.answers.length > 0) {
            updateSession({ firestoreSessionId: undefined }); // Force creation of new doc with new patientId
            await syncSessionToFirestore({ uid: newUid }, getSession(), updateSession, (currentLocalSession.status as any) || 'active');
            console.log(`Migrated local session to new user ${newUid}`);
          }
        } catch (migrationError) {
          console.error('Failed to migrate anonymous sessions:', migrationError);
        }
      }

      // Redirect to next step in the flow
      router.push('/patient/dashboard');
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
      <Header title={t('Authentication')} />
      <div className="max-w-md mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-2">
            {t('Patient Portal')}
          </h2>
          <p className="text-slate-500">
            {t('Secure access to your health information')}
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-4 text-sm font-bold transition ${isLogin ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600' : 'bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              {t('Sign In')}
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-4 text-sm font-bold transition ${!isLogin ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600' : 'bg-white text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
              {t('Create Account')}
            </button>
          </div>

          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Full Name')}</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="John Doe" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200 transition text-slate-900 font-medium" />
                  </div>
                  <div className="flex gap-4">
                    <div className="w-1/2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Age')}</label>
                      <input type="number" value={age} onChange={(e) => setAge(e.target.value)} required min="1" max="120" placeholder="30" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200 transition text-slate-900 font-medium" />
                    </div>
                    <div className="w-1/2">
                      <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Gender')}</label>
                      <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200 transition text-slate-900 font-medium">
                        <option value="Male">{t('Male')}</option>
                        <option value="Female">{t('Female')}</option>
                        <option value="Other">{t('Other')}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Mobile Number')}</label>
                    <input type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} required placeholder="+91 9876543210" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200 transition text-slate-900 font-medium" />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Email Address')}</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3 text-slate-400" size={18} />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="patient@example.com"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200 transition text-slate-900 font-medium"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Password')}</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3 text-slate-400" size={18} />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200 transition text-slate-900 font-medium"
                  />
                </div>
                {isLogin && (
                   <div className="mt-2 text-right">
                      <a href="#" className="text-sm font-bold text-teal-600 hover:text-teal-700">{t('Forgot Password?')}</a>
                   </div>
                )}
              </div>

              {!isLogin && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">{t('Confirm Password')}</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-3 text-slate-400" size={18} />
                      <input 
                        type="password" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200 transition text-slate-900 font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-2 mt-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <input 
                      type="checkbox" 
                      id="consent"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-1 flex-shrink-0 w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                    />
                    <label htmlFor="consent" className="text-xs text-slate-600 leading-relaxed cursor-pointer select-none">
                      {t('I consent to the collection and use of my personal health information for medical consultation purposes.')}
                    </label>
                  </div>
                </>
              )}

              {error && (
                <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl text-sm font-medium mt-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full mt-4 flex items-center justify-center gap-2 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 shadow-lg shadow-teal-900/20 transition disabled:opacity-70"
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> {t('Processing...')}</>
                ) : (
                  <>
                    {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                    {isLogin ? t('Sign In') : t('Create Account')}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
        
        {isLogin && (
          <div className="mt-8 text-center text-sm font-medium text-slate-500">
            {t("New patient?")}
            <button 
              type="button"
              onClick={() => { setIsLogin(false); setError(''); }} 
              className="ml-2 text-teal-600 hover:text-teal-700 font-bold focus:outline-none underline underline-offset-2"
            >
              {t('Create Account')}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
