"use client";

import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { Stethoscope, Pill, ShieldAlert, Check, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/store/store';
import { buildHistory } from '@/lib/clinicalHistory';
import { ClinicalHistory } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';

export default function HistoryPage() {
  const [history, setHistory] = useState<ClinicalHistory | null>(null);
  const [redFlags, setRedFlags] = useState<any[]>([]);
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    const session = getSession();
    if (session?.answers) {
      setHistory(buildHistory(session.chiefComplaint, session.answers));
    }
    if (session?.redFlags) {
      setRedFlags(session.redFlags);
    }
  }, []);

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title={t('Clinical History')} backHref="/patient/questions" />
      <div className="max-w-4xl mx-auto px-6 py-12 sm:py-16">
        <ProgressBar current={10} total={13} />
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1b3d27] mb-2">{t('Review Structured History')}</h2>
          <p className="text-[#556358] text-sm">{t('Review the structured information before sending to the doctor.')}</p>
        </div>

        {history ? (
          <div className="space-y-6">
            <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-8 md:p-12">
              <h3 className="text-2xl font-serif font-bold text-[#1b3d27] mb-6">{t('Clinical History')}</h3>
              <div className="grid md:grid-cols-2 gap-5">
                <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                  <div className="text-xs font-extrabold text-[#829277] uppercase tracking-widest mb-1.5">{t('Chief Complaint:')}</div>
                  <div className="text-xl font-serif font-bold text-[#1c241e]">{history.chiefComplaint || t('None reported')}</div>
                </div>
                <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                  <div className="text-xs font-extrabold text-[#829277] uppercase tracking-widest mb-1.5">{t('Duration:')}</div>
                  <div className="text-xl font-serif font-bold text-[#1c241e]">{history.duration || t('Not specified')}</div>
                </div>
                <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                  <div className="text-xs font-extrabold text-[#829277] uppercase tracking-widest mb-1.5">{t('Associated Symptoms:')}</div>
                  <div className="text-base font-semibold text-[#1c241e]">{history.associatedSymptoms.length > 0 ? history.associatedSymptoms.join(', ') : t('None reported')}</div>
                </div>
                <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                  <div className="text-xs font-extrabold text-[#829277] uppercase tracking-widest mb-1.5">{t('Medication:')}</div>
                  <div className="text-base font-semibold text-[#1c241e]">{history.medicationTaken || t('None')}</div>
                </div>
              </div>
            </div>

            {redFlags.length > 0 && (
              <div className="rounded-3xl bg-[#fff5f5] border-2 border-[#b83b3b] p-7 shadow-md">
                <div className="font-serif font-bold text-[#8a1f1f] text-lg mb-1 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{t('Potential Red Flags')}</span>
                </div>
                <p className="text-[#771d1d] text-sm font-medium leading-relaxed">{t("Based on your responses, we've noted a condition that may require prompt attention. Please ensure you inform the healthcare staff.")}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-8 md:p-12 mb-6 text-center">
            <p className="text-[#556358] font-medium">{t('Loading your clinical history...')}</p>
          </div>
        )}

        <div className="mt-8 flex gap-3.5">
          <button 
            onClick={() => router.push('/patient/reports')} 
            className="inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-3.5 text-base shadow-lg shadow-[#234e32]/25 transition"
          >
            <span>{t('Continue')}</span>
            <ArrowRight size={18} />
          </button>
          <button 
            onClick={() => router.back()} 
            className="inline-flex items-center gap-2 rounded-2xl bg-[#fbf9f4] border border-[#ded5c2] hover:bg-[#ede5d6] text-[#4d2f19] font-bold px-7 py-3.5 text-base transition"
          >
            {t('Back')}
          </button>
        </div>
      </div>
    </AyurvedaBackground>
  );
}

