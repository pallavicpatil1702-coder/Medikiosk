"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import Header from '@/components/Header';
import { 
  Activity, 
  Stethoscope, 
  ShieldCheck, 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Sparkles, 
  AlertCircle,
  QrCode
} from 'lucide-react';

const DEMO_ACCOUNTS = [
  {
    role: 'nurse',
    title: 'Triage Nurse',
    email: 'nurse@medi-kiosk.demo',
    password: 'DemoNurse123!',
    icon: Activity,
    color: 'border-[#a65832] bg-[#fdf8f5] text-[#8a421f]',
    destination: '/nurse/dashboard'
  },
  {
    role: 'doctor',
    title: 'Attending Physician',
    email: 'doctor@medi-kiosk.demo',
    password: 'DemoDoctor123!',
    icon: Stethoscope,
    color: 'border-[#3a6073] bg-[#f4f7f9] text-[#284959]',
    destination: '/doctor/dashboard'
  },
  {
    role: 'admin',
    title: 'System Admin',
    email: 'admin@medi-kiosk.demo',
    password: 'DemoAdmin123!',
    icon: ShieldCheck,
    color: 'border-[#6e4368] bg-[#faf5f9] text-[#542e4f]',
    destination: '/admin/dashboard'
  },
  {
    role: 'patient',
    title: 'Registered Patient',
    email: 'patient@medi-kiosk.demo',
    password: 'DemoPatient123!',
    icon: User,
    color: 'border-[#234e32] bg-[#f2f7f3] text-[#1b3d27]',
    destination: '/patient/dashboard'
  }
];

function LoginForm() {
  const [email, setEmail] = useState('nurse@medi-kiosk.demo');
  const [password, setPassword] = useState('DemoNurse123!');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const { currentUser, role, isAnonymous } = useAuth();

  useEffect(() => {
    if (currentUser && !isAnonymous && role) {
      const destination = getDestinationForRole(role);
      router.push(destination);
    }
  }, [currentUser, isAnonymous, role, router]);

  const getDestinationForRole = (userRole: string): string => {
    if (redirectParam && redirectParam.startsWith('/')) {
      return redirectParam;
    }
    switch (userRole) {
      case 'nurse':
        return '/nurse/dashboard';
      case 'doctor':
        return '/doctor/dashboard';
      case 'admin':
        return '/admin/dashboard';
      case 'patient':
        return '/patient/dashboard';
      default:
        return '/';
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        // Sign up flow
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        
        // Save patient profile
        await setDoc(doc(db, 'patients', cred.user.uid), {
          id: cred.user.uid,
          name: name.trim(),
          age: parseInt(age, 10) || 0,
          contact: phone.trim(),
          email: email.trim(),
          createdAt: new Date().toISOString()
        });

        // Assign role using our admin API route
        const response = await fetch('/api/admin/set-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), role: 'patient' }),
        });
        
        if (!response.ok) {
           throw new Error('Failed to assign role. Please contact support.');
        }

        // Force token refresh to get new claims
        await cred.user.getIdToken(true);
        const destination = getDestinationForRole('patient');
        router.push(destination);
      } else {
        // Login flow
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const tokenResult = await cred.user.getIdTokenResult(true);
        const userRole = (tokenResult.claims.role as string) || null;

        if (!userRole) {
          setError('Login successful, but no custom claim role is assigned to this account. Please contact the administrator.');
          setLoading(false);
          return;
        }

        const destination = getDestinationForRole(userRole);
        router.push(destination);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Invalid email or password. Please verify credentials or use the demo buttons below.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 6 characters.');
      } else {
        setError(err.message || 'Authentication failed. Please check credentials.');
      }
      setLoading(false);
    }
  };

  const selectDemoRole = (demo: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(demo.email);
    setPassword(demo.password);
    setError(null);
  };

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title="Staff & Patient Portal" backHref="/" />
      
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 py-10 sm:py-14">
        <div className="w-full max-w-lg">
          {/* Header Brand */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[#234e32] text-white shadow-xl shadow-[#234e32]/25 mb-4">
              <svg viewBox="0 0 24 24" className="w-8 h-8 fill-none stroke-current" strokeWidth="1.8">
                <path d="M12 2C8 6 4 9 4 14a8 8 0 0 0 16 0c0-5-4-8-8-12z" />
                <path d="M12 2v18" />
                <path d="M12 11c2.5-2 5-1.5 6 0" />
                <path d="M12 15c-2.5-2-5-1.5-6 0" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight text-[#1b3d27] mb-2">
              MediKiosk Portal
            </h1>
            <p className="text-xs sm:text-sm text-[#556358] max-w-sm mx-auto leading-relaxed">
              Unified authentication with cryptographic role-based access for patients, clinical staff, and administrators.
            </p>
          </div>

          {/* Quick Demo Selector Tabs */}
          <div className="mb-6">
            <div className="text-[11px] font-extrabold text-[#6f4827] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Sparkles size={13} className="text-[#c59b27]" />
              <span>One-Click Demo Account Quick Select:</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {DEMO_ACCOUNTS.map((demo) => {
                const isSelected = email === demo.email;
                const IconComponent = demo.icon;
                return (
                  <button
                    key={demo.role}
                    type="button"
                    onClick={() => selectDemoRole(demo)}
                    className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1.5 ${
                      isSelected 
                        ? 'ring-2 ring-[#234e32] shadow-sm ' + demo.color 
                        : 'bg-[#fbf9f4]/80 border-[#ded5c2] text-[#556358] hover:text-[#1c241e] hover:bg-[#fbf9f4]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <IconComponent size={16} />
                      <span className="text-[10px] font-mono uppercase font-bold tracking-wider">
                        {demo.role}
                      </span>
                    </div>
                    <div className="text-xs font-bold truncate">{demo.title}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Login Card */}
          <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] p-7 sm:p-9 shadow-2xl relative overflow-hidden">
            <form onSubmit={handleAuth} className="space-y-4 relative z-10">
              {error && (
                <div className="rounded-2xl bg-[#fff5f5] border border-[#b83b3b]/30 p-4 text-xs text-[#8a1f1f] font-medium flex items-start gap-2.5">
                  <AlertCircle size={17} className="shrink-0 text-[#b83b3b] mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {isSignUp && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#1c241e] uppercase tracking-wider mb-2">Full Name</label>
                    <input
                      type="text"
                      required={isSignUp}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] px-4 py-3.5 text-sm text-[#1c241e] placeholder:text-[#829277] focus:outline-none focus:ring-3 focus:ring-[#234e32]/25 focus:border-[#234e32] transition font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-[#1c241e] uppercase tracking-wider mb-2">Age</label>
                      <input
                        type="number"
                        required={isSignUp}
                        min="0"
                        max="120"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="e.g. 30"
                        className="w-full rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] px-4 py-3.5 text-sm text-[#1c241e] placeholder:text-[#829277] focus:outline-none focus:ring-3 focus:ring-[#234e32]/25 focus:border-[#234e32] transition font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#1c241e] uppercase tracking-wider mb-2">Phone Number</label>
                      <input
                        type="tel"
                        required={isSignUp}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91..."
                        className="w-full rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] px-4 py-3.5 text-sm text-[#1c241e] placeholder:text-[#829277] focus:outline-none focus:ring-3 focus:ring-[#234e32]/25 focus:border-[#234e32] transition font-medium"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-[#1c241e] uppercase tracking-wider mb-2">
                  Staff / Patient Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@medi-kiosk.demo"
                  className="w-full rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] px-4 py-3.5 text-sm text-[#1c241e] placeholder:text-[#829277] focus:outline-none focus:ring-3 focus:ring-[#234e32]/25 focus:border-[#234e32] transition font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1c241e] uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] px-4 py-3.5 text-sm text-[#1c241e] placeholder:text-[#829277] focus:outline-none focus:ring-3 focus:ring-[#234e32]/25 focus:border-[#234e32] transition font-medium pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-3.5 text-[#829277] hover:text-[#1c241e] transition"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold py-4 px-6 text-sm shadow-xl shadow-[#234e32]/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <span>{isSignUp ? 'Creating Account...' : 'Verifying Custom Claims...'}</span>
                ) : (
                  <>
                    <span>{isSignUp ? 'Sign Up' : 'Sign In to Portal'}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
              
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs font-bold text-[#556358] hover:text-[#234e32] transition"
                >
                  {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                </button>
              </div>
            </form>
          </div>

          {/* Anonymous Patient Intake Kiosk Card (No Login Required) */}
          <div className="mt-6 rounded-3xl bg-[#fbf9f4]/90 border border-[#ded5c2] p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#e4ede1] text-[#234e32] flex items-center justify-center shrink-0 border border-[#c7d9c2]">
                <QrCode size={20} />
              </div>
              <div>
                <div className="text-xs font-bold text-[#1c241e]">Walk-in Patient at Kiosk?</div>
                <div className="text-[11px] text-[#556358]">No login required. Complete voice & AI intake directly.</div>
              </div>
            </div>
            <a
              href="/patient"
              className="px-4 py-2 rounded-xl bg-[#234e32] hover:bg-[#1a3b26] text-white text-xs font-bold transition whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-xs"
            >
              <span>Launch Kiosk</span>
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </div>

      <footer className="py-4 text-center text-xs text-[#6b7c6e] border-t border-[#ded5c2]/60">
        MediKiosk SIH MVP • Cryptographic Role-Based Access Control Architecture
      </footer>
    </AyurvedaBackground>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#fbf9f4] text-[#1c241e] flex items-center justify-center text-xs font-bold">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
