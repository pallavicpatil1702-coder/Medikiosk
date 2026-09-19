"use client";

import React, { useEffect, useState } from 'react';
import { useAuth, UserRole } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { ShieldAlert, LogOut, ArrowRight, Loader2, Lock } from 'lucide-react';
import AyurvedaBackground from '@/components/AyurvedaBackground';

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
      <AyurvedaBackground variant="kiosk">
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-[#1c241e]">
          <div className="w-14 h-14 rounded-2xl bg-[#e4ede1] border border-[#c7d9c2] flex items-center justify-center text-[#234e32] mb-4 shadow-sm">
            <Loader2 size={28} className="animate-spin" />
          </div>
          <div className="text-sm font-extrabold text-[#1c241e]">Verifying Security Claims...</div>
          <div className="text-xs text-[#556358] mt-1 font-semibold">Checking cryptographic ID token custom claims</div>
        </div>
      </AyurvedaBackground>
    );
  }

  // Not authenticated or anonymous user trying to access staff portal
  if (!currentUser || isAnonymous) {
    return (
      <AyurvedaBackground variant="kiosk">
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-[#1c241e]">
          <div className="w-14 h-14 rounded-2xl bg-[#e4ede1] border border-[#c7d9c2] flex items-center justify-center text-[#234e32] mb-4 shadow-sm">
            <Lock size={26} />
          </div>
          <h2 className="text-lg font-black text-[#1b3d27]">Authentication Required</h2>
          <p className="text-xs text-[#556358] mt-1 mb-5 text-center max-w-sm font-semibold">
            You must be signed in with verified staff or patient credentials to access this clinical station.
          </p>
          <a
            href={`/login?redirect=${encodeURIComponent(pathname)}`}
            className="px-5 py-2.5 rounded-2xl bg-[#234e32] text-white text-xs font-black hover:bg-[#1a3b26] transition shadow-lg shadow-[#234e32]/20 flex items-center gap-2"
          >
            <span>Sign In to Continue</span>
            <ArrowRight size={14} />
          </a>
        </div>
      </AyurvedaBackground>
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
      <AyurvedaBackground variant="kiosk">
        <main className="min-h-screen flex items-center justify-center p-6 text-[#1c241e]">
          <div className="w-full max-w-md rounded-3xl bg-[#fbf9f4] border border-[#ded5c2] p-8 shadow-2xl relative overflow-hidden text-center">
            <div className="w-16 h-16 rounded-3xl bg-[#fef2f2] border border-[#fca5a5] text-[#b91c1c] flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={32} />
            </div>

            <h1 className="text-2xl font-black text-[#1b3d27] tracking-tight">Access Restricted</h1>
            <p className="text-xs text-[#556358] mt-2 font-semibold">
              You do not have permission to view this clinical portal.
            </p>

            <div className="my-6 p-4 rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-[#ded5c2]/60 pb-2">
                <span className="text-[#6b7c6e] font-bold">Authenticated User:</span>
                <span className="font-mono font-bold text-[#1c241e] truncate max-w-[200px]">{currentUser.email}</span>
              </div>
              <div className="flex justify-between border-b border-[#ded5c2]/60 pb-2">
                <span className="text-[#6b7c6e] font-bold">Your Verified Role:</span>
                <span className="font-extrabold uppercase px-2 py-0.5 rounded bg-[#fef2f2] text-[#b91c1c] text-[10px] border border-[#fca5a5]">
                  {role || 'None'}
                </span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-[#6b7c6e] font-bold">Required Role:</span>
                <span className="font-extrabold uppercase text-[#234e32] text-[10px]">
                  {allowedRoles.join(' / ')}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {role && (
                <a
                  href={myDashboard}
                  className="w-full py-3 px-4 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-black text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-[#234e32]/20"
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
                className="w-full py-3 px-4 rounded-2xl bg-[#e4ede1] hover:bg-[#d5e3d0] text-[#234e32] font-bold text-xs transition flex items-center justify-center gap-2 border border-[#c7d9c2]"
              >
                <LogOut size={14} />
                <span>Switch Account / Sign Out</span>
              </button>
            </div>
          </div>
        </main>
      </AyurvedaBackground>
    );
  }

  // Authorized: render children
  return <>{children}</>;
}
