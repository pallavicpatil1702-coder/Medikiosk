"use client";

import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { Mic, Check, RotateCcw, Sparkles, AlertCircle, Volume2, VolumeX, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, updateSession } from '@/lib/store/store';
import { useTranslation } from '@/lib/i18n';
import { useBhashiniVoice } from '@/hooks/useBhashiniVoice';
import { useSync } from '@/hooks/useSync';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { requiresBodyMap } from '@/lib/bodyMapLogic';

export default function ComplaintPage() {
  const [mode, setMode] = useState<'touch' | 'voice'>('touch');
  const [spoken, setSpoken] = useState(false);
  const [text, setText] = useState('');
  const [normalizedText, setNormalizedText] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const router = useRouter();
  const { t, lang } = useTranslation();
  const { sync } = useSync();
  const { speak, cancel, isSpeaking, supported } = useTextToSpeech(lang);

  const {
    isListening,
    isProcessing,
    transcript,
    normalizedText: voiceNormalized,
    error: speechError,
    source: transcriptionSource,
    startListening,
    stopListening,
    reset,
  } = useBhashiniVoice(lang);

  useEffect(() => {
    const session = getSession();
    if (session.chiefComplaint) {
      setText(session.chiefComplaint);
    }
  }, []);

  useEffect(() => {
    if (transcript && !isListening && !isProcessing) {
      setSpoken(true);
      setText(transcript);
      setNormalizedText(voiceNormalized || transcript);
    }
  }, [transcript, isListening, isProcessing, voiceNormalized]);

  const handleListen = () => {
    if (isListening) {
      stopListening();
    } else {
      setSpoken(false);
      reset();
      startListening();
    }
  };

  const handleContinue = () => {
    const finalDisplayComplaint = [...selectedOptions, text.trim()].filter(Boolean).join(', ');
    const finalNormalizedComplaint = [...selectedOptions, normalizedText.trim() || text.trim()].filter(Boolean).join(', ');
    
    if (!finalDisplayComplaint) return;
    
    const needsBodyMap = requiresBodyMap(finalNormalizedComplaint, selectedOptions);

    updateSession({ 
      chiefComplaint: finalNormalizedComplaint,
      originalChiefComplaint: finalDisplayComplaint,
      answers: [], 
      knownFacts: [], 
      activeModules: [], 
      completedModules: [], 
      redFlags: [],
      bodyLocations: needsBodyMap ? getSession().bodyLocations : [] 
    });
    sync();

    if (needsBodyMap) {
      router.push('/patient/body-map');
    } else {
      router.push('/patient/questions');
    }
  };

  const quickSelects = ['Fever', 'Cough', 'Pain', 'Headache', 'Stomach problem', 'Injury', 'Other'];

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title="Chief Complaint" backHref="/patient/profile" />
      <div className="max-w-4xl mx-auto px-6 py-12 sm:py-16">
        <ProgressBar current={6} total={13} />
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3.5 mb-2">
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1b3d27]">{t('What brings you to the hospital today?')}</h2>
            {supported && (
              <button 
                onClick={() => isSpeaking ? cancel() : speak(t('What brings you to the hospital today?'))}
                className={`p-2.5 rounded-full transition-colors flex-shrink-0 ${
                  isSpeaking ? 'bg-[#234e32] text-white shadow-md' : 'bg-[#e4ede1] text-[#234e32] hover:bg-[#d5e3d0]'
                }`}
                aria-label={t('Listen to question')}
                title={t('Listen to question')}
              >
                <Volume2 size={24} className={isSpeaking ? 'animate-pulse' : ''} />
              </button>
            )}
          </div>
          <p className="text-[#556358] text-sm">{t('Use touch or voice to describe your main concern.')}</p>
        </div>

        <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl overflow-hidden mb-8">
          <div className="flex border-b border-[#ded5c2]">
            <button 
              onClick={() => setMode('touch')} 
              className={`flex-1 py-4 font-bold text-sm sm:text-base transition ${
                mode === 'touch' 
                  ? 'bg-[#234e32] text-white' 
                  : 'bg-[#f4efe4]/60 text-[#556358] hover:bg-[#ede5d6]'
              }`}
            >
              {t('Touch Mode')}
            </button>
            <button 
              onClick={() => setMode('voice')} 
              className={`flex-1 py-4 font-bold text-sm sm:text-base transition ${
                mode === 'voice' 
                  ? 'bg-[#234e32] text-white' 
                  : 'bg-[#f4efe4]/60 text-[#556358] hover:bg-[#ede5d6]'
              }`}
            >
              {t('Voice Mode')}
            </button>
          </div>

          <div className="p-8 md:p-12">
            {mode === 'touch' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-serif font-bold text-[#1b3d27]">{t('Quick select')}</h3>
                  <span className="text-xs font-bold text-[#234e32] bg-[#e4ede1] px-3.5 py-1.5 rounded-full border border-[#c7d9c2]">
                    {t('Select all that apply')}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3.5 mb-8">
                  {quickSelects.map((item) => {
                    const isSelected = selectedOptions.includes(item);
                    return (
                      <button 
                        key={item} 
                        onClick={() => setSelectedOptions(prev => isSelected ? prev.filter(i => i !== item) : [...prev, item])} 
                        className={`relative rounded-2xl border-2 px-5 py-4 font-bold text-sm transition text-left ${
                          isSelected 
                            ? 'border-[#234e32] bg-[#e8f1e6] text-[#1b3d27] shadow-sm' 
                            : 'border-[#ded5c2] bg-[#f8f5ee] text-[#2d382f] hover:border-[#234e32]/60'
                        }`}
                      >
                        {t(item)}
                        {isSelected && (
                          <div className="absolute top-1/2 -translate-y-1/2 right-4 w-5 h-5 rounded-full bg-[#234e32] text-white flex items-center justify-center">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <label htmlFor="complaint-text" className="block text-sm font-bold text-[#1c241e] mb-2">{t('Or type your concern')}</label>
                <textarea 
                  id="complaint-text"
                  className="w-full rounded-2xl bg-white border border-[#ded5c2] p-5 focus:outline-none focus:ring-2 focus:ring-[#234e32] resize-none transition"
                  rows={4}
                  placeholder={t("e.g. I have had a severe headache since yesterday morning...")}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setNormalizedText(e.target.value); // Manual edits override normalization
                  }}
                ></textarea>
              </div>
            )}

            {mode === 'voice' && (
              <div className="text-center py-4">
                <h3 className="text-2xl font-serif font-bold text-[#1b3d27] mb-6">{t('Tap to Speak')}</h3>
                <button 
                  onClick={handleListen}
                  disabled={isProcessing}
                  className={`mx-auto flex flex-col items-center justify-center p-8 sm:p-12 rounded-full transition shadow-lg relative ${
                    isListening ? 'bg-[#ffebef] text-[#d63a4a] border-2 border-[#d63a4a] animate-pulse' : 
                    isProcessing ? 'bg-[#e4ede1] text-[#556358] border-2 border-[#c7d9c2]' :
                    'bg-[#e4ede1] text-[#234e32] border-2 border-transparent hover:bg-[#d5e3d0]'
                  }`}
                >
                  <Mic size={isProcessing ? 32 : 48} className={`mb-3 sm:mb-4 ${isListening ? 'animate-bounce' : isProcessing ? 'animate-spin' : ''}`} />
                  <span className="font-bold text-lg sm:text-xl">
                    {isListening ? t('Listening...') : isProcessing ? t('Processing...') : t('Tap to Speak')}
                  </span>
                </button>
                <div className="mt-6 min-h-[50px] flex items-center justify-center">
                  {speechError ? (
                    <div className="flex items-center gap-2 text-[#9a2c2c] font-bold">
                      <AlertCircle size={20} />
                      <span>{t(speechError)}</span>
                    </div>
                  ) : isListening ? (
                    <span className="font-extrabold text-[#b83b3b] text-xl animate-pulse-soft">{t('Listening...')}</span>
                  ) : spoken ? (
                    <div>
                      <p className="text-xs font-semibold text-[#667768] uppercase tracking-wider mb-1">{t('We heard:')}</p>
                      <p className="font-serif font-bold text-2xl text-[#1b3d27]">"{text}"</p>
                    </div>
                  ) : (
                    <p className="text-[#6b7c6e] font-medium">{t('Tap the microphone to describe your concern')}</p>
                  )}
                </div>
                {(spoken || speechError) && (
                  <div className="mt-6 flex gap-3.5 justify-center">
                    {spoken && (
                      <button 
                        onClick={() => { setSpoken(false); stopListening(); }} 
                        className="inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-6 py-3 transition shadow-sm"
                      >
                        <Check size={18} /> {t('Confirm')}
                      </button>
                    )}
                    <button 
                      onClick={() => { setSpoken(false); stopListening(); setText(''); reset(); startListening(); }} 
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#fbf9f4] border border-[#ded5c2] hover:bg-[#ede5d6] text-[#4d2f19] font-bold px-6 py-3 transition"
                    >
                      <RotateCcw size={18} /> {t('Try Again')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button 
            onClick={handleContinue} 
            disabled={!(selectedOptions.length > 0 || text.trim())} 
            className={`inline-flex items-center gap-2 rounded-2xl font-bold px-8 py-3.5 text-base shadow-lg transition ${
              (selectedOptions.length > 0 || text.trim()) 
                ? 'bg-[#234e32] hover:bg-[#1a3b26] text-white shadow-[#234e32]/25' 
                : 'bg-[#ded5c2] text-[#8c7e6c] cursor-not-allowed'
            }`}
          >
            <span>{t('Continue')}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </AyurvedaBackground>
  );
}
