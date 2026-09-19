"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import InteractiveBodyMap from '@/components/InteractiveBodyMap';
import { getSession, updateSession } from '@/lib/store/store';
import { useTranslation } from '@/lib/i18n';
import { useSync } from '@/hooks/useSync';
import { ArrowRight, SkipForward } from 'lucide-react';
import type { BodyLocation } from '@/lib/types';

export default function BodyMapPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { sync } = useSync();
  const [selectedLocations, setSelectedLocations] = useState<BodyLocation[]>([]);

  useEffect(() => {
    const session = getSession();
    if (session.bodyLocations) {
      setSelectedLocations(session.bodyLocations);
    }
  }, []);

  const handleContinue = () => {
    updateSession({ bodyLocations: selectedLocations });
    sync();
    router.push('/patient/questions');
  };

  const handleSkip = () => {
    // Treat skip as zero selection
    updateSession({ bodyLocations: [] });
    sync();
    router.push('/patient/questions');
  };

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title={t('Interactive Body Map')} backHref="/patient/complaint" />
      <div className="max-w-4xl mx-auto px-6 py-12 sm:py-16">
        <ProgressBar current={7} total={13} />
        
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1b3d27] mb-2">
            {t('Where are you experiencing discomfort?')}
          </h2>
          <p className="text-[#556358] text-sm max-w-2xl mx-auto">
            {t('Tap the areas on the body map below to indicate where you feel pain or discomfort.')}
          </p>
        </div>

        <div className="bg-[#fbf9f4]/95 border border-[#ded5c2] rounded-3xl shadow-xl overflow-hidden p-6 md:p-8 mb-8">
          <InteractiveBodyMap 
            selectedLocations={selectedLocations} 
            onChange={setSelectedLocations} 
          />
        </div>

        <div className="flex justify-between items-center">
          <button 
            onClick={handleSkip} 
            className="inline-flex items-center gap-2 rounded-2xl bg-white border border-[#ded5c2] text-[#556358] hover:bg-[#ede5d6] hover:text-[#1c241e] font-bold px-6 py-3 transition shadow-sm"
          >
            <span>{t('Skip')}</span>
            <SkipForward size={18} />
          </button>

          <button 
            onClick={handleContinue} 
            className="inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-3.5 shadow-lg transition shadow-[#234e32]/25"
          >
            <span>{t('Continue')}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </AyurvedaBackground>
  );
}
