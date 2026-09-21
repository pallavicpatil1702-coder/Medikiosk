"use client";

import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { Globe, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { saveToStore, loadFromStore, STORAGE_KEYS, updateSession, clearSession } from '@/lib/store/store';
import { useTranslation } from '@/lib/i18n';
import { useSync } from '@/hooks/useSync';
import { usePatientAuth } from '@/hooks/usePatientAuth';

const languages = [
  { code: 'en', name: 'English', label: 'English', flagCode: 'gb' },
  { code: 'hi', name: 'Hindi', label: 'हिन्दी', flagCode: 'in' },
  { code: 'mr', name: 'Marathi', label: 'मराठी', flagCode: 'in' },
  { code: 'bn', name: 'Bengali', label: 'বাংলা', flagCode: 'in' },
  { code: 'te', name: 'Telugu', label: 'తెలుగు', flagCode: 'in' },
  { code: 'ta', name: 'Tamil', label: 'தமிழ்', flagCode: 'in' },
  { code: 'gu', name: 'Gujarati', label: 'ગુજરાતી', flagCode: 'in' },
  { code: 'kn', name: 'Kannada', label: 'ಕನ್ನಡ', flagCode: 'in' },
  { code: 'ml', name: 'Malayalam', label: 'മലയാളം', flagCode: 'in' },
];

export default function LanguagePage() {
  const [selected, setSelected] = useState('en');
  const { t } = useTranslation();
  const { sync } = useSync();
  const { isReady } = usePatientAuth();

  useEffect(() => {
    const saved = loadFromStore<string>(STORAGE_KEYS.language);
    if (saved) setSelected(saved);
  }, []);

  const handleContinue = () => {
    saveToStore(STORAGE_KEYS.language, selected);
    
    // Isolate session state on new consultation using static import
    clearSession();
    
    // Re-initialize with completely fresh state
    updateSession({ 
      patient: { id: '', name: '', age: 0, gender: '', language: selected, createdAt: new Date().toISOString() },
      chiefComplaint: '',
      bodyLocations: [],
      answers: [],
      redFlags: [],
      documents: [],
      knownFacts: [],
      activeModules: [],
      completedModules: []
    });
    sync();
    window.location.href = '/patient/identify';
  };

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title="Choose Language" backHref="/patient" />
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        <ProgressBar current={2} total={13} />
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] shadow-xs mb-4">
            <Globe size={32} />
          </div>
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1b3d27] mb-2">{t('Choose your language')}</h2>
          <p className="text-[#556358] max-w-md mx-auto text-sm">{t('Select your preferred language for the intake process. All important information will be clearly shown.')}</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-5 mb-10">
          {languages.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => {
                setSelected(l.code);
                saveToStore(STORAGE_KEYS.language, l.code);
                window.dispatchEvent(new Event('language-changed'));
              }}
              className={`relative rounded-3xl border-2 p-6 text-left transition shadow-xs hover:shadow-md focus:outline-none focus:ring-4 focus:ring-[#234e32]/20 cursor-pointer touch-manipulation select-none ${
                selected === l.code 
                  ? 'border-[#234e32] bg-[#fbf9f4] shadow-md ring-2 ring-[#234e32]/20' 
                  : 'border-[#ded5c2] bg-[#fbf9f4]/80 hover:border-[#829277]'
              }`}
              aria-pressed={selected === l.code}
            >
              <div className="mb-3 h-7 flex items-center pointer-events-none select-none">
                <img src={`https://flagcdn.com/${l.flagCode}.svg`} className="h-full rounded-sm shadow-xs object-contain pointer-events-none select-none" alt={`${l.name} flag`} />
              </div>
              <div className="text-xl font-bold text-[#1c241e] pointer-events-none select-none">{l.name}</div>
              <div className="text-xs font-semibold text-[#6e7d70] mt-0.5 pointer-events-none select-none">{l.label}</div>
              {selected === l.code && (
                <div className="absolute top-4 right-4 w-7 h-7 rounded-full bg-[#234e32] text-white flex items-center justify-center shadow-sm pointer-events-none">
                  <Check size={14} strokeWidth={3} />
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button 
            type="button"
            onClick={handleContinue} 
            className="w-full sm:w-auto inline-flex justify-center items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-4 text-base shadow-lg shadow-[#234e32]/25 transition cursor-pointer touch-manipulation select-none"
          >
            {t('Continue')} <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </AyurvedaBackground>
  );
}

