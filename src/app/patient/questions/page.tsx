"use client";

import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { Sparkles, Mic, Check, User, AlertCircle, Send, RotateCcw, Loader2, Volume2, ArrowRight } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, updateSession } from '@/lib/store/store';
import type { Answer, RedFlag, Question, PatientSession } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';
import { useWebSpeech } from '@/hooks/useWebSpeech';
import { useSync } from '@/hooks/useSync';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

export default function QuestionsPage() {
  const [chiefComplaint, setChiefComplaint] = useState<string | undefined>(undefined);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [redFlagAlert, setRedFlagAlert] = useState(false);
  
  const router = useRouter();
  const { t, lang } = useTranslation();
  const { sync } = useSync();
  const initialized = useRef(false);
  const { speak, cancel, isSpeaking, supported } = useTextToSpeech(lang);

  const {
    isListening,
    transcript,
    error: speechError,
    startListening,
    stopListening,
    reset,
  } = useWebSpeech(lang);

  const fetchNextQuestion = async (session: PatientSession) => {
    setLoading(true);
    try {
      const res = await fetch('/api/question-engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session })
      });
      const data = await res.json();
      
      let nextSession = { ...session };
      
      if (data.activeModules || data.completedModules || data.newAnswers || data.knownFacts) {
        nextSession = updateSession({ 
          activeModules: data.activeModules || session.activeModules, 
          completedModules: data.completedModules || session.completedModules,
          answers: data.newAnswers || session.answers,
          knownFacts: data.knownFacts || session.knownFacts
        });
        if (data.newAnswers) setAnswers(data.newAnswers);
      }

      if (data.action === 'URGENT_001') {
         setRedFlagAlert(true);
         setDone(true);
         updateSession({
           redFlags: [...(session.redFlags || []), {
             id: 'URGENT_001',
             type: 'Engine Alert',
             description: 'Red flag triggered during AI routing',
             severity: 'high',
             detectedAt: new Date().toISOString()
           }]
         });
      } else if (data.action === 'MODULE_END') {
         setDone(true);
      } else if (data.action === 'CONTINUE' && data.question) {
         setCurrentQ(data.question);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    const session = getSession();
    if (session?.chiefComplaint) {
      setChiefComplaint(session.chiefComplaint);
      setAnswers(session.answers || []);
      fetchNextQuestion(session);
    }
  }, []);

  const totalSteps = 8;
  const progress = Math.min(answers.length + 1, totalSteps);

  useEffect(() => {
    if (transcript && !isListening) {
      setCurrentAnswer(transcript);
    }
  }, [transcript, isListening]);

  useEffect(() => {
    if (currentQ) {
      cancel();
    }
  }, [currentQ, cancel]);

  const submitAnswer = async (val: string) => {
    if (!currentQ || !val.trim()) return;
    
    const qText = typeof currentQ.text === 'string' 
      ? currentQ.text 
      : (currentQ.text[lang] || currentQ.text['en']);

    const currentModule = getSession()?.activeModules?.[0] || 'clarification';

    const newAnswers = [...answers, { 
      questionId: currentQ.id, 
      moduleId: currentModule,
      questionText: qText, 
      answer: val, 
      timestamp: new Date().toISOString(),
      language: lang
    }];
    
    setAnswers(newAnswers);
    setCurrentAnswer('');
    reset();
    
    const session = updateSession({ answers: newAnswers });
    sync();

    await fetchNextQuestion(session);
  };

  const handleListen = () => {
    if (isListening) {
      stopListening();
    } else {
      reset();
      setCurrentAnswer('');
      startListening();
    }
  };

  const renderQText = (q: Question) => {
    if (typeof q.text === 'string') return t(q.text);
    return q.text[lang] || q.text['en'];
  };

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title="Adaptive Questions" backHref="/patient/complaint" />
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        <ProgressBar current={progress} total={totalSteps} />
        <div className="mb-6 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#234e32] text-white flex items-center justify-center shadow-lg shadow-[#234e32]/25">
            <Sparkles size={22} className="text-[#e8f1e6]" />
          </div>
          <div>
            <div className="text-xs font-bold text-[#6f4827] uppercase tracking-widest">{t('AI Assistant')}</div>
            <div className="text-2xl font-serif font-bold text-[#1b3d27]">{t('Adaptive Clinical Questions')}</div>
          </div>
        </div>

        {loading && !done && (
          <div className="flex flex-col items-center justify-center p-12 bg-[#fbf9f4]/95 rounded-3xl border border-[#ded5c2] shadow-xl">
            <Loader2 className="w-10 h-10 text-[#234e32] animate-spin mb-4" />
            <p className="text-[#3e4a3f] font-bold">{t('Analyzing response and determining next question...')}</p>
          </div>
        )}

        {!done && !loading && currentQ && (
          <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-8 md:p-12 mb-6">
            <div className="flex items-center gap-2 mb-2.5 text-xs font-bold text-[#234e32] uppercase tracking-wide">
              <span className="w-2.5 h-2.5 rounded-full bg-[#234e32] animate-pulse-soft" /> {t('AI Question')}
            </div>
            
            <div className="flex items-start gap-4 mb-6">
              <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#1b3d27] leading-snug flex-1">
                {renderQText(currentQ)}
              </h3>
              {supported && (
                <button 
                  onClick={() => isSpeaking ? cancel() : speak(renderQText(currentQ))}
                  className={`p-2.5 rounded-full transition-colors flex-shrink-0 mt-1 ${
                    isSpeaking ? 'bg-[#234e32] text-white shadow-md' : 'bg-[#e4ede1] text-[#234e32] hover:bg-[#d5e3d0]'
                  }`}
                  aria-label={t('Listen to question')}
                  title={t('Listen to question')}
                >
                  <Volume2 size={24} className={isSpeaking ? 'animate-pulse' : ''} />
                </button>
              )}
            </div>

            {/* Conversation Log Box */}
            <div className="bg-[#f8f5ee] rounded-2xl p-5 mb-6 border border-[#ded5c2]">
              <h4 className="text-xs font-extrabold text-[#829277] uppercase tracking-widest mb-3">{t('Conversation')}</h4>
              <div className="space-y-3 text-sm">
                {chiefComplaint && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#e8e2d2] text-[#4d2f19] flex items-center justify-center text-xs font-extrabold shrink-0">🌿</div>
                    <div>
                      <div className="text-[#6b7c6e] text-xs font-medium">{t('Chief Complaint')}</div>
                      <div className="font-bold text-[#1c241e]">{t(chiefComplaint)}</div>
                    </div>
                  </div>
                )}
                {answers.map((a, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#234e32] text-white flex items-center justify-center text-xs font-extrabold shrink-0">AI</div>
                    <div>
                      <div className="text-[#6b7c6e] text-xs font-medium">{t(a.questionText || '')}</div>
                      <div className="font-bold text-[#1c241e]">{t(a.answer)}</div>
                    </div>
                  </div>
                ))}
                {currentAnswer && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#6f4827] text-white flex items-center justify-center text-xs font-extrabold shrink-0"><User size={13} /></div>
                    <div>
                      <div className="text-[#6b7c6e] text-xs font-medium">{t('You')}</div>
                      <div className="font-bold text-[#1c241e]">{t(currentAnswer)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input Options / Free Text */}
            {currentQ.type === 'free_text' || currentQ.type === 'duration' || currentQ.type === 'number' || currentQ.type === 'text' || (!currentQ.options && !currentQ.choices && !currentQ.type.includes('yes_no')) ? (
              <div className="flex flex-col gap-3 mb-6">
                <div className="flex gap-3">
                  <input 
                    type="text"
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    className="flex-1 rounded-2xl border border-[#ded5c2] focus:border-[#234e32] bg-[#f8f5ee] text-[#1c241e] font-semibold px-5 py-3.5 text-base transition focus:outline-none focus:ring-3 focus:ring-[#234e32]/25" 
                    placeholder={currentQ.example ? t(currentQ.example) : t('Or type your concern')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value) {
                        submitAnswer(e.currentTarget.value);
                      }
                    }}
                  />
                  <button 
                    onClick={() => submitAnswer(currentAnswer)}
                    disabled={!currentAnswer.trim()}
                    className={`rounded-2xl px-7 py-3.5 font-bold text-sm transition shadow-sm ${
                      currentAnswer.trim() ? 'bg-[#234e32] text-white hover:bg-[#1a3b26] shadow-[#234e32]/20' : 'bg-[#ded5c2] text-[#8c7e6c] cursor-not-allowed'
                    }`}
                  >
                    {t('Next')}
                  </button>
                </div>
                <p className="text-xs text-[#6b7c6e]">{t('Press Enter or click Next to submit')}</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 mb-6">
                {(currentQ.options || currentQ.choices || ['Yes', 'No', 'Not sure']).map((choice) => (
                  <button 
                    key={choice} 
                    onClick={() => submitAnswer(choice)} 
                    className="rounded-2xl border-2 border-[#ded5c2] hover:border-[#234e32] bg-[#f8f5ee] text-[#1c241e] font-bold px-6 py-3.5 text-sm transition focus:outline-none focus:ring-3 focus:ring-[#234e32]/25 hover:bg-[#e8f1e6]"
                  >
                    {t(choice)}
                  </button>
                ))}
              </div>
            )}

            {/* Voice Input Section */}
            <div className="flex flex-col gap-3 pt-2 border-t border-[#ded5c2]">
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleListen} 
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md transition focus:outline-none focus:ring-3 focus:ring-[#234e32]/25 ${
                    isListening ? 'bg-[#b83b3b] animate-listen text-white' : transcript ? 'bg-[#234e32] text-white' : 'bg-[#234e32] hover:bg-[#1a3b26] text-white'
                  }`} 
                  aria-label="Speak answer"
                >
                  <Mic size={24} />
                </button>
                <div className="text-sm font-medium flex-1">
                  {speechError ? (
                    <div className="flex items-center gap-2 text-[#9a2c2c] font-bold"><AlertCircle size={16}/> {t(speechError)}</div>
                  ) : isListening ? (
                    <span className="text-[#b83b3b] font-bold animate-pulse-soft">{t('Listening...')}</span>
                  ) : transcript ? (
                    <div className="flex flex-col">
                      <span className="text-[#6b7c6e] text-xs">{t('We heard:')}</span>
                      <span className="text-[#1c241e] font-bold">"{transcript}"</span>
                    </div>
                  ) : (
                    <span className="text-[#6b7c6e]">{t('Tap to Speak')}</span>
                  )}
                </div>
              </div>
              {transcript && !isListening && (
                 <div className="flex gap-2 mt-2">
                   <button onClick={() => submitAnswer(transcript)} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-4 py-2.5 transition"><Check size={16} /> {t('Confirm')}</button>
                   <button onClick={() => { reset(); setCurrentAnswer(''); }} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#f8f5ee] border border-[#ded5c2] hover:bg-[#ede5d6] text-[#4d2f19] font-bold px-4 py-2.5 transition"><RotateCcw size={16} /> {t('Try Again')}</button>
                 </div>
              )}
            </div>
          </div>
        )}

        {done && redFlagAlert && (
          <div className="rounded-3xl bg-[#fff5f5] border-2 border-[#b83b3b] shadow-xl p-8 md:p-12 mb-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#fde8e8] text-[#b83b3b] flex items-center justify-center mx-auto mb-4"><AlertCircle size={34} /></div>
            <h3 className="text-3xl font-serif font-bold text-[#8a1f1f] mb-3">{t('Immediate Attention Recommended')}</h3>
            <p className="text-[#771d1d] font-medium mb-6 leading-relaxed">{t('Based on your responses, we advise immediate medical evaluation.')}</p>
            <button onClick={() => router.push('/patient/history')} className="inline-flex items-center gap-2 rounded-2xl bg-[#b83b3b] hover:bg-[#992828] text-white font-bold px-8 py-3.5 text-base shadow-lg transition">{t('Proceed to Summary')}</button>
          </div>
        )}

        {done && !redFlagAlert && (
          <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-8 md:p-12 mb-6 text-center">
            <h3 className="text-3xl font-serif font-bold text-[#1b3d27] mb-3">{t('Questions Complete')}</h3>
            <p className="text-[#556358] mb-6">{t('Your responses have been structured for clinical review.')}</p>
            <button onClick={() => router.push('/patient/history')} className="inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-3.5 text-base shadow-lg shadow-[#234e32]/25 transition">
              <span>{t('Review Structured History')}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </AyurvedaBackground>
  );
}
