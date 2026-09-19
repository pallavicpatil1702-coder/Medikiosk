"use client";

import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { ShieldCheck, Lock, Check } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateSession } from '@/lib/store/store';
import { useTranslation } from '@/lib/i18n';
import { useSync } from '@/hooks/useSync';

export default function ConsentPage() {
  const [agreed, setAgreed] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();
  const { sync } = useSync();

  const handleContinue = () => {
    if (agreed) {
      updateSession({
        consent: {
          given: true,
          timestamp: new Date().toISOString(),
          purpose: 'Clinical Intake and Summarization (Demo)',
        }
      });
      sync();
      router.push('/patient/profile');
    }
  };

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title="Your Consent" backHref="/patient/identify" />
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        <ProgressBar current={4} total={13} />
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1b3d27] mb-2">{t('Your Consent')}</h2>
          <p className="text-[#556358] text-sm">{t('Before we proceed, please review how your information will be used.')}</p>
        </div>
        <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-8 sm:p-12 mb-8">
          <div className="flex items-center gap-3.5 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] flex items-center justify-center shadow-xs">
              <Lock size={26} />
            </div>
            <h3 className="text-2xl font-serif font-bold text-[#1b3d27]">{t('Privacy & Secure Session')}</h3>
          </div>
          <blockquote className="text-base sm:text-lg text-[#3e4a3f] leading-relaxed mb-8 border-l-4 border-[#234e32] pl-6 italic bg-[#e4ede1]/40 rounded-r-2xl py-4 pr-4">
            {t('MediKiosk will collect information about your current health concern and previous medical records to prepare an information summary for the healthcare professional.')}
          </blockquote>
          <ul className="space-y-3.5 mb-8 text-[#4a5749] text-sm">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] flex items-center justify-center text-xs font-extrabold shrink-0">1</span>
              <span><strong className="text-[#1c241e]">{t('Information use:')}</strong> {t('To help prepare a clinical intake summary before your consultation.')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] flex items-center justify-center text-xs font-extrabold shrink-0">2</span>
              <span><strong className="text-[#1c241e]">{t('Doctor review required:')}</strong> {t('All AI-assisted summaries must be reviewed by a healthcare professional.')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] flex items-center justify-center text-xs font-extrabold shrink-0">3</span>
              <span><strong className="text-[#1c241e]">{t('Not a diagnosis:')}</strong> {t('This system does not diagnose or prescribe treatments.')}</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] flex items-center justify-center text-xs font-extrabold shrink-0">4</span>
              <span><strong className="text-[#1c241e]">{t('Demo / Sandbox:')}</strong> {t('No real ABDM or ABHA data is transmitted.')}</span>
            </li>
          </ul>
          <label className="flex items-start gap-4 cursor-pointer p-4 rounded-2xl bg-[#f4efe4]/70 border border-[#ded5c2] transition hover:bg-[#efe9dc]">
            <button
              onClick={() => setAgreed(!agreed)}
              className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition shrink-0 mt-0.5 ${
                agreed ? 'bg-[#234e32] border-[#234e32] text-white shadow-sm' : 'border-[#b8a98f] bg-white hover:border-[#234e32]'
              }`}
              aria-checked={agreed}
              role="checkbox"
            >
              {agreed && <Check size={16} strokeWidth={3} />}
            </button>
            <div className="text-sm leading-relaxed text-[#3e4a3f]">
              <span className="font-bold text-[#1b3d27]">{t('I agree')}</span> {t('— I understand this is an AI-assisted intake system, that a healthcare professional must review my information, and that this is a demo / sandbox environment.')}
            </div>
          </label>
          <div className="mt-8 flex gap-3.5">
            <button 
              onClick={handleContinue} 
              disabled={!agreed} 
              className={`inline-flex items-center gap-2 rounded-2xl font-bold px-8 py-3.5 text-base shadow-lg transition ${
                agreed ? 'bg-[#234e32] hover:bg-[#1a3b26] text-white shadow-[#234e32]/25' : 'bg-[#ded5c2] text-[#8c7e6c] cursor-not-allowed'
              }`}
            >
              {t('I Agree & Continue')}
            </button>
            <a 
              href="/patient/identify" 
              className="inline-flex items-center gap-2 rounded-2xl bg-[#fbf9f4] border border-[#ded5c2] hover:bg-[#f2ece0] text-[#4d2f19] font-bold px-7 py-3.5 text-base transition"
            >
              {t('Back')}
            </a>
          </div>
        </div>
      </div>
    </AyurvedaBackground>
  );
}

