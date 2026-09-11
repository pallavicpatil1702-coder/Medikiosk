"use client";

import React, { useEffect, useState } from 'react';
import { useAuth, UserRole } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { ShieldAlert, LogOut, ArrowRight, Loader2, Lock } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: Array<'patient' | 'nurse' | 'doctor' | 'admin'>;
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { currentUser, role, loading, isAnonymous, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && mounted) {
      if (!currentUser || isAnonymous) {
        // Redirect unauthorized/unauthenticated visitors to unified login
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      }
    }
  }, [currentUser, isAnonymous, loading, mounted, pathname, router]);

  // Loading state
  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-14 h-14 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-4 animate-pulse">
          <Loader2 size={28} className="animate-spin" />
        </div>
        <div className="text-sm font-bold text-slate-200">Verifying Security Claims...</div>
        <div className="text-xs text-slate-500 mt-1">Checking cryptographic ID token custom claims</div>
      </div>
    );
  }

  // Not authenticated or anonymous user trying to access staff portal
  if (!currentUser || isAnonymous) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-4">
          <Lock size={26} />
        </div>
        <h2 className="text-lg font-black text-white">Authentication Required</h2>
        <p className="text-xs text-slate-400 mt-1 mb-5 text-center max-w-sm">
          You must be signed in with verified staff or patient credentials to access this clinical station.
        </p>
        <a
          href={`/login?redirect=${encodeURIComponent(pathname)}`}
          className="px-5 py-2.5 rounded-2xl bg-teal-500 text-slate-950 text-xs font-black hover:bg-teal-400 transition shadow-lg shadow-teal-500/20 flex items-center gap-2"
        >
          <span>Sign In to Continue</span>
          <ArrowRight size={14} />
        </a>
      </div>
    );
  }

  // Check role authorization
  const isAuthorized = role && allowedRoles.includes(role);

  if (!isAuthorized) {
    const roleDashboardMap: Record<string, string> = {
      patient: '/patient/dashboard',
      nurse: '/nurse/dashboard',
      doctor: '/doctor/dashboard',
      admin: '/admin/dashboard',
    };

    const myDashboard = role ? roleDashboardMap[role] : '/login';

    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-rose-500/30 p-8 shadow-2xl relative overflow-hidden text-center">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} />
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">Access Restricted</h1>
          <p className="text-xs text-slate-400 mt-2">
            You do not have permission to view this clinical portal.
          </p>

          <div className="my-6 p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 text-left space-y-2 text-xs">
            <div className="flex justify-between border-b border-slate-700/60 pb-2">
              <span className="text-slate-400">Authenticated User:</span>
              <span className="font-mono font-bold text-white truncate max-w-[200px]">{currentUser.email}</span>
            </div>
            <div className="flex justify-between border-b border-slate-700/60 pb-2">
              <span className="text-slate-400">Your Verified Role:</span>
              <span className="font-extrabold uppercase px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px]">
                {role || 'None'}
              </span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span className="text-slate-400">Required Role:</span>
              <span className="font-extrabold uppercase text-teal-300 text-[10px]">
                {allowedRoles.join(' / ')}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {role && (
              <a
                href={myDashboard}
                className="w-full py-3 px-4 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
              >
                <span>Go to Your {role.toUpperCase()} Portal</span>
                <ArrowRight size={14} />
              </a>
            )}

            <button
              onClick={async () => {
                await logout();
                router.push('/login');
              }}
              className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition flex items-center justify-center gap-2 border border-slate-700"
            >
              <LogOut size={14} />
              <span>Switch Account / Sign Out</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  // Authorized: render children
  return <>{children}</>;
}
