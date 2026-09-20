"use client";

import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { ScanLine, Keyboard, UserPlus, Check, Loader2, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateSession } from '@/lib/store/store';
import { Patient } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';
import { useSync } from '@/hooks/useSync';

export default function IdentifyPage() {
  const [mode, setMode] = useState<'scan' | 'enter' | 'new'>('new');
  const [inputAbhaId, setInputAbhaId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { t } = useTranslation();
  const { sync } = useSync();

  const handleContinueWithAbha = (abhaId?: string) => {
    setLoading(true);
    setError('');
    try {
      const p: Patient = {
        id: crypto.randomUUID(),
        abhaId: abhaId?.trim() || undefined,
        name: '',
        age: 0,
        gender: 'Male',
        createdAt: new Date().toISOString()
      };
      updateSession({ patient: p });
      sync();
      router.push('/patient/consent');
    } catch (err) {
      setError('An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  const handleScanSimulation = () => {
    setLoading(true);
    setTimeout(() => {
      const generatedAbha = `14-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
      handleContinueWithAbha(generatedAbha);
    }, 600);
  };

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title="Identify Yourself" backHref="/patient/language" />
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        <ProgressBar current={3} total={13} />
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1b3d27] mb-2">{t('Identify yourself')}</h2>
          <p className="text-[#556358] text-sm">{t('Select how you would like to begin. You can enter an ABHA ID or continue directly.')}</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-5 mb-10">
          {[
            { key: 'new', label: t('Continue as New Patient'), sub: t('Direct clinical intake'), icon: UserPlus },
            { key: 'enter', label: t('Enter ABHA ID'), sub: t('Manual 14-digit ABHA entry'), icon: Keyboard },
            { key: 'scan', label: t('Scan ABHA QR'), sub: t('QR code scanner'), icon: ScanLine },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => { setMode(opt.key as typeof mode); setError(''); }}
              className={`rounded-3xl border-2 p-6 text-center transition shadow-xs hover:shadow-md focus:outline-none focus:ring-4 focus:ring-[#234e32]/20 ${
                mode === opt.key 
                  ? 'border-[#234e32] bg-[#fbf9f4] ring-2 ring-[#234e32]/20 shadow-sm' 
                  : 'border-[#ded5c2] bg-[#fbf9f4]/80 hover:border-[#829277]'
              }`}
            >
              <div className={`w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-3.5 transition ${
                mode === opt.key ? 'bg-[#234e32] text-white shadow-md' : 'bg-[#e4ede1] text-[#234e32]'
              }`}>
                <opt.icon size={24} />
              </div>
              <div className="font-bold text-base text-[#1c241e]">{opt.label}</div>
              <div className="text-xs font-semibold text-[#6e7d70] mt-0.5">{opt.sub}</div>
            </button>
          ))}
        </div>

        <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-8 sm:p-10">
          {mode === 'new' && (
            <div>
              <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-2">{t('Continue as New Patient')}</h3>
              <p className="text-xs text-[#556358] mb-6">{t('You can provide basic details in the next step. No ABHA is required for this intake.')}</p>
              <div className="flex justify-end">
                <button 
                  onClick={() => handleContinueWithAbha()} 
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-3.5 shadow-lg shadow-[#234e32]/25 transition text-sm"
                >
                  <span>{t('Continue to Consent')}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {mode === 'enter' && (
            <div>
              <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-3">{t('Enter ABHA ID')}</h3>
              <label htmlFor="abha-id" className="block text-xs font-bold text-[#3e4a3f] mb-2">
                {t('ABHA ID / Number (14 digits or @abdm handle)')}
              </label>
              <input 
                id="abha-id" 
                value={inputAbhaId}
                onChange={(e) => setInputAbhaId(e.target.value)}
                placeholder="e.g. 14-1234-5678-9012"
                className="w-full rounded-2xl border border-[#ded5c2] px-4 py-3.5 text-base font-mono focus:outline-none focus:ring-2 focus:ring-[#234e32]/30 bg-white" 
              />
              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => handleContinueWithAbha(inputAbhaId)} 
                  disabled={loading} 
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-3.5 shadow-lg shadow-[#234e32]/25 transition disabled:opacity-50 text-sm"
                >
                  {loading ? <><Loader2 size={18} className="animate-spin" /> {t('Processing...')}</> : <span>{t('Continue to Consent')}</span>}
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {mode === 'scan' && (
            <div className="text-center">
              <div className="w-44 h-44 mx-auto rounded-3xl border-4 border-dashed border-[#829277]/40 bg-[#e4ede1]/40 flex items-center justify-center mb-6 relative overflow-hidden">
                <ScanLine size={56} className="text-[#234e32] animate-pulse" />
              </div>
              <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-1.5">{t('Scan ABHA QR')}</h3>
              <p className="text-xs text-[#556358] mb-6">{t('Position the QR code within the frame to link your health records.')}</p>
              <button 
                onClick={handleScanSimulation} 
                disabled={loading} 
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-3.5 shadow-lg shadow-[#234e32]/25 transition disabled:opacity-50 text-sm"
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> {t('Processing QR Scan...')}</> : <span>{t('Scan & Continue')}</span>}
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {error && <div className="mt-4 text-center text-rose-600 font-bold text-xs">{error}</div>}
        </div>
      </div>
    </AyurvedaBackground>
  );
}

