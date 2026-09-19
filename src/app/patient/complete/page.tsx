"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { CheckCircle2, ArrowRight, Loader2, RefreshCw, Home, PlusCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { getSession, clearSession } from '@/lib/store/store';
import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/hooks/useSync';

export default function CompletePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { sync } = useSync();
  const { currentUser } = useAuth();
  const savedRef = useRef(false);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'sync_error'>('syncing');
  const [retrying, setRetrying] = useState(false);

  const performSync = async () => {
    try {
      setSyncStatus('syncing');
      const result = await sync('completed');
      if (result && result.success) {
        console.log('Session successfully synced to Firestore as completed');
        setSyncStatus('synced');
        setTimeout(() => {
          // If they are an anonymous kiosk user, auto-redirect to the live queue
          // If they are an authenticated patient, don't auto-redirect, let them choose
          if (currentUser?.isAnonymous) {
            router.push('/patient/queue');
          }
        }, 1500);
      } else {
        console.error('Failed to sync session to Firestore:', result?.error);
        setSyncStatus('sync_error');
      }
    } catch (err) {
      console.error('Exception during sync session to Firestore:', err);
      setSyncStatus('sync_error');
    }
  };

  useEffect(() => {
    if (savedRef.current) return;
    savedRef.current = true;
    performSync();
  }, [sync]);

  const handleRetry = async () => {
    setRetrying(true);
    await performSync();
    setRetrying(false);
  };

  const handleStartNew = () => {
    clearSession();
    router.push('/patient/language');
  };

  const handleReturnHome = () => {
    clearSession();
    window.location.href = '/patient';
  };
  
  const handleViewDashboard = () => {
    router.push('/patient/dashboard');
  };

  return (
    <AyurvedaBackground variant="kiosk">
      <Header />
      <section className="relative z-10 max-w-3xl mx-auto px-6 py-16 sm:py-24 text-center flex-1 flex flex-col items-center justify-center">
        <div className="w-full rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-2xl p-10 sm:p-14 flex flex-col items-center">
          {syncStatus === 'syncing' && (
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] shadow-xl mb-8 animate-pulse">
              <Loader2 size={54} className="animate-spin" />
            </div>
          )}
          {syncStatus === 'synced' && (
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-[#234e32] text-white shadow-xl shadow-[#234e32]/30 mb-8">
              <CheckCircle2 size={54} />
            </div>
          )}
          {syncStatus === 'sync_error' && (
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-[#f6ebd0] text-[#6f4827] border border-[#e5d4a4] shadow-xl mb-8">
              <RefreshCw size={50} />
            </div>
          )}
          
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-[#1b3d27] tracking-tight mb-4">
            {syncStatus === 'syncing' && t('Saving information...')}
            {syncStatus === 'synced' && t('Information successfully recorded.')}
            {syncStatus === 'sync_error' && t('Saved locally. Cloud sync pending.')}
          </h1>
          
          <p className="text-base sm:text-lg text-[#556358] mb-8 max-w-lg mx-auto leading-relaxed">
            {syncStatus === 'syncing' && t('Please wait while we securely transmit your data.')}
            {syncStatus === 'synced' && t('Your information has been sent for doctor review.')}
            {syncStatus === 'sync_error' && t('Your intake is preserved locally. Click below to retry transmitting to the clinic.')}
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full max-w-md">
            {syncStatus === 'sync_error' && (
              <button 
                onClick={handleRetry} 
                disabled={retrying} 
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-[#6f4827] hover:bg-[#59391e] text-white font-bold px-7 py-3.5 text-base shadow-md transition disabled:opacity-50"
              >
                <RefreshCw size={18} className={retrying ? 'animate-spin' : ''} />
                <span>{retrying ? 'Retrying Cloud Sync...' : 'Retry Cloud Sync Now'}</span>
              </button>
            )}

            {currentUser && !currentUser.isAnonymous ? (
              <button 
                onClick={handleViewDashboard} 
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-3.5 text-base shadow-lg shadow-[#234e32]/25 transition"
              >
                <Home size={18} />
                <span>{t('Return to Dashboard')}</span>
              </button>
            ) : (
              <>
                <button 
                  onClick={handleStartNew} 
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-3.5 text-base shadow-lg shadow-[#234e32]/25 transition"
                >
                  <PlusCircle size={18} />
                  <span>{t('Start New Consultation')}</span>
                </button>
                <button 
                  onClick={handleReturnHome} 
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-[#fbf9f4] border border-[#ded5c2] hover:bg-[#ede5d6] text-[#4d2f19] font-bold px-7 py-3.5 text-base transition"
                >
                  <Home size={18} />
                  <span>{t('Return to Kiosk Home')}</span>
                </button>
              </>
            )}
          </div>
          
          <div className="mt-12 bg-[#f8f5ee] p-5 rounded-2xl border border-[#ded5c2] text-left w-full">
            <h3 className="font-bold text-sm text-[#1b3d27] mb-1">{t('Privacy & Secure Session')}</h3>
            <p className="text-xs text-[#6b7c6e] mb-0.5">{t('Demo / Sandbox • No real ABDM or ABHA data transmitted')}</p>
            <p className="text-xs text-[#6b7c6e]">{t('AI-assisted information • Doctor review required')}</p>
          </div>
        </div>
      </section>
    </AyurvedaBackground>
  );
}
