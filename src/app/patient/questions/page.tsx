"use client";

import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { Sparkles, Mic, Check, User, AlertCircle, Send, RotateCcw, Loader2, Volume2, ArrowRight, ArrowLeft } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, updateSession } from '@/lib/store/store';
import type { Answer, RedFlag, Question, PatientSession } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';
import { useBhashiniVoice } from '@/hooks/useBhashiniVoice';
import { useSync } from '@/hooks/useSync';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { normalizeQuestion, mapAnswerToNormalizedEnglish } from '@/lib/questionNormalizer';

export default function QuestionsPage() {
  const [chiefComplaint, setChiefComplaint] = useState<string | undefined>(undefined);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [normalizedAnswer, setNormalizedAnswer] = useState('');
  const [selectedChoice, setSelectedChoice] = useState<string>('');
  const [selectedMultiChoices, setSelectedMultiChoices] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [historyStack, setHistoryStack] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const [redFlagAlert, setRedFlagAlert] = useState(false);
  const [backHref, setBackHref] = useState('/patient/complaint');
  
  const router = useRouter();
  const { t, lang } = useTranslation();
  const { sync } = useSync();
  const initialized = useRef(false);
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

  // Normalize current question across schemas and formats
  const normalizedQ = useMemo(() => {
    return currentQ ? normalizeQuestion(currentQ, lang) : null;
  }, [currentQ, lang]);

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

      // Determine back link based on body map requirement
      const lowerComplaint = session.chiefComplaint.toLowerCase();
      const bodyMapKeywords = ['pain', 'ache', 'injury', 'hurt', 'swelling', 'discomfort', 'stomach', 'chest', 'back', 'joint', 'cramp', 'sore'];
      if (bodyMapKeywords.some(keyword => lowerComplaint.includes(keyword))) {
        setBackHref('/patient/body-map');
      }
    }
  }, []);

  const totalSteps = 13;
  const progress = Math.min(answers.length + 8, totalSteps);

  // Restore previously saved answer when question changes
  useEffect(() => {
    if (!currentQ) return;
    
    const existing = answers.find(a => a.questionId === currentQ.id);
    if (existing) {
      setCurrentAnswer(existing.answer || '');
      setNormalizedAnswer(existing.normalizedEnglishText || '');
      setSelectedChoice(existing.answer || '');
      if (existing.selectedChoices && existing.selectedChoices.length > 0) {
        setSelectedMultiChoices(existing.selectedChoices);
      } else if (existing.answer) {
        setSelectedMultiChoices(existing.answer.split(',').map(s => s.trim()).filter(Boolean));
      } else {
        setSelectedMultiChoices([]);
      }
    } else {
      setCurrentAnswer('');
      setNormalizedAnswer('');
      setSelectedChoice('');
      setSelectedMultiChoices([]);
    }
  }, [currentQ, answers]);

  useEffect(() => {
    if (transcript && !isListening && !isProcessing) {
      setCurrentAnswer(transcript);
      setNormalizedAnswer(voiceNormalized || transcript);
    }
  }, [transcript, isListening, isProcessing, voiceNormalized]);

  useEffect(() => {
    if (currentQ) {
      cancel();
    }
  }, [currentQ, cancel]);

  const submitAnswer = async (val: string, englishVal?: string, choicesArray?: string[]) => {
    if (!currentQ || !val.trim()) return;
    
    const qText = normalizedQ?.text || (typeof currentQ.text === 'string' 
      ? currentQ.text 
      : (currentQ.text[lang] || currentQ.text['en']));

    const currentModule = getSession()?.activeModules?.[0] || 'clarification';

    const normalizedEng = englishVal || mapAnswerToNormalizedEnglish(val, normalizedQ?.options) || normalizedAnswer || val;

    const answerEntry: Answer = {
      questionId: currentQ.id, 
      moduleId: currentModule,
      questionText: qText, 
      answer: val,
      selectedChoices: choicesArray,
      originalTranscript: val,
      normalizedEnglishText: normalizedEng,
      transcriptionSource: transcriptionSource,
      timestamp: new Date().toISOString(),
      language: lang
    };

    // Update existing answer by questionId instead of duplicate entries
    const existingIdx = answers.findIndex(a => a.questionId === currentQ.id);
    const newAnswers = existingIdx >= 0
      ? answers.map((a, i) => i === existingIdx ? answerEntry : a)
      : [...answers, answerEntry];
    
    setAnswers(newAnswers);
    
    // Maintain navigation history stack
    setHistoryStack(prev => {
      const filtered = prev.filter(q => q.id !== currentQ.id);
      return [...filtered, currentQ];
    });

    setCurrentAnswer('');
    setNormalizedAnswer('');
    setSelectedChoice('');
    setSelectedMultiChoices([]);
    reset();
    
    const session = updateSession({ answers: newAnswers });
    sync();

    await fetchNextQuestion(session);
  };

  const handlePreviousQuestion = () => {
    if (historyStack.length === 0) return;
    const prevQ = historyStack[historyStack.length - 1];
    setHistoryStack(prev => prev.slice(0, -1));
    setCurrentQ(prevQ);
    setDone(false);
    setRedFlagAlert(false);
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

  const questionDisplayText = normalizedQ?.text || '';

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title="Adaptive Questions" backHref={backHref} />
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

        {!done && !loading && currentQ && normalizedQ && (
          <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-6 md:p-12 mb-6">
            <div className="flex items-center gap-2 mb-2.5 text-xs font-bold text-[#234e32] uppercase tracking-wide">
              <span className="w-2.5 h-2.5 rounded-full bg-[#234e32] animate-pulse-soft" /> {t('AI Question')}
            </div>
            
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-1">
                <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#1b3d27] leading-snug">
                  {questionDisplayText}
                </h3>
                
                {(isListening || isProcessing || speechError) && (
                  <div className="mt-3 flex items-center gap-3">
                    {isListening && (
                      <span className="text-sm font-bold text-[#b83b3b] flex items-center gap-1.5">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#d63a4a] opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#d63a4a]"></span>
                        </span>
                        {t('Listening...')}
                      </span>
                    )}
                    {isProcessing && (
                      <span className="text-sm font-bold text-[#556358] flex items-center gap-1.5">
                        <Loader2 size={16} className="animate-spin" /> {t('Processing...')}
                      </span>
                    )}
                    {speechError && (
                      <span className="text-sm font-bold text-[#9a2c2c] flex items-center gap-1.5">
                        <AlertCircle size={16} /> {t(speechError)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0 mt-1">
                {supported && (
                  <button 
                    onClick={() => isSpeaking ? cancel() : speak(questionDisplayText)}
                    className={`p-2.5 rounded-full transition-colors flex-shrink-0 ${
                      isSpeaking ? 'bg-[#234e32] text-white shadow-md' : 'bg-[#e4ede1] text-[#234e32] hover:bg-[#d5e3d0]'
                    }`}
                    aria-label={t('Listen to question')}
                    title={t('Listen to question')}
                  >
                    <Volume2 size={24} className={isSpeaking ? 'animate-pulse' : ''} />
                  </button>
                )}
                
                <button 
                  onClick={handleListen}
                  disabled={isProcessing}
                  className={`p-2.5 rounded-full transition-colors flex-shrink-0 relative ${
                    isListening ? 'bg-[#ffebef] text-[#d63a4a] border border-[#d63a4a] shadow-md' : 
                    isProcessing ? 'bg-[#e4ede1] text-[#556358]' :
                    'bg-[#e4ede1] text-[#234e32] hover:bg-[#d5e3d0]'
                  }`}
                  aria-label={t('Tap to Speak')}
                  title={t('Tap to Speak')}
                >
                  <Mic size={24} className={`${isListening ? 'animate-pulse text-[#d63a4a]' : isProcessing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Conversation Log Box */}
            <details className="bg-[#f8f5ee] rounded-2xl mb-6 border border-[#ded5c2] group overflow-hidden">
              <summary className="p-4 flex justify-between items-center cursor-pointer select-none outline-none list-none text-xs font-extrabold text-[#829277] uppercase tracking-widest hover:bg-[#ede8db] transition">
                <span>{t('Previous Answers')}</span>
                <span className="text-[10px] opacity-70 group-open:rotate-180 transition-transform duration-300">▼</span>
              </summary>
              <div className="p-5 pt-2 space-y-3 text-sm border-t border-[#ded5c2]/50 bg-[#fbf9f4]">
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
            </details>

            {/* Input Component By Normalized Question Type */}
            {normalizedQ.type === 'yes_no' ? (
              /* Yes/No with Haan, Nahin, Pakka Nahin */
              <div className="mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {normalizedQ.options.map((opt) => {
                    const isSelected = selectedChoice.toLowerCase() === opt.value.toLowerCase() ||
                      selectedChoice.toLowerCase() === opt.label.toLowerCase();
                    return (
                      <button
                        key={opt.id || opt.value}
                        type="button"
                        onClick={() => {
                          setSelectedChoice(opt.value);
                          submitAnswer(opt.value, opt.normalizedEnglishText);
                        }}
                        className={`rounded-2xl border-2 p-5 font-bold text-base transition flex items-center justify-between shadow-xs ${
                          isSelected
                            ? 'border-[#234e32] bg-[#234e32] text-white shadow-md ring-2 ring-[#234e32]/30'
                            : 'border-[#ded5c2] hover:border-[#234e32] bg-[#f8f5ee] hover:bg-[#e8f1e6] text-[#1c241e]'
                        }`}
                      >
                        <span className="leading-snug">{t(opt.label)}</span>
                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-white text-[#234e32] flex items-center justify-center shrink-0 ml-2">
                            <Check size={16} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-[#ded5c2] shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : normalizedQ.type === 'single' && normalizedQ.options.length > 0 ? (
              /* Single Choice with Predefined Options */
              <div className="mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {normalizedQ.options.map((opt) => {
                    const isSelected = selectedChoice.toLowerCase() === opt.value.toLowerCase() ||
                      selectedChoice.toLowerCase() === opt.label.toLowerCase();
                    return (
                      <button
                        key={opt.id || opt.value}
                        type="button"
                        onClick={() => {
                          setSelectedChoice(opt.value);
                          submitAnswer(opt.value, opt.normalizedEnglishText);
                        }}
                        className={`rounded-2xl border-2 p-4 font-bold text-sm text-left transition flex items-center justify-between shadow-xs ${
                          isSelected
                            ? 'border-[#234e32] bg-[#234e32] text-white shadow-md ring-2 ring-[#234e32]/30'
                            : 'border-[#ded5c2] hover:border-[#234e32] bg-[#f8f5ee] hover:bg-[#e8f1e6] text-[#1c241e]'
                        }`}
                      >
                        <span className="leading-snug">{t(opt.label)}</span>
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-white text-[#234e32] flex items-center justify-center shrink-0 ml-2">
                            <Check size={14} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-5 h-5 rounded-full border border-[#ded5c2] shrink-0 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : normalizedQ.type === 'multi_choice' && normalizedQ.options.length > 0 ? (
              /* Multiple Choice with Predefined Options */
              <div className="space-y-4 mb-6">
                <div className="text-xs font-bold text-[#6b7c6e] uppercase tracking-wider">
                  {t('Select all that apply')}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {normalizedQ.options.map((opt) => {
                    const isSelected = selectedMultiChoices.some(
                      c => c.toLowerCase() === opt.value.toLowerCase() || c.toLowerCase() === opt.label.toLowerCase()
                    );
                    return (
                      <button
                        key={opt.id || opt.value}
                        type="button"
                        onClick={() => {
                          setSelectedMultiChoices(prev => 
                            isSelected 
                              ? prev.filter(c => c.toLowerCase() !== opt.value.toLowerCase() && c.toLowerCase() !== opt.label.toLowerCase())
                              : [...prev, opt.value]
                          );
                        }}
                        className={`rounded-2xl border-2 p-4 font-bold text-sm text-left transition flex items-center justify-between shadow-xs ${
                          isSelected
                            ? 'border-[#234e32] bg-[#234e32] text-white shadow-md ring-2 ring-[#234e32]/30'
                            : 'border-[#ded5c2] hover:border-[#234e32] bg-[#f8f5ee] hover:bg-[#e8f1e6] text-[#1c241e]'
                        }`}
                      >
                        <span className="leading-snug">{t(opt.label)}</span>
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ml-2 border ${
                          isSelected ? 'bg-white text-[#234e32] border-white' : 'border-[#ded5c2] bg-white'
                        }`}>
                          {isSelected && <Check size={14} strokeWidth={3} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    disabled={selectedMultiChoices.length === 0}
                    onClick={() => {
                      const joinedValue = selectedMultiChoices.join(', ');
                      submitAnswer(joinedValue, joinedValue, selectedMultiChoices);
                    }}
                    className={`rounded-2xl px-7 py-3.5 font-bold text-sm transition shadow-sm ${
                      selectedMultiChoices.length > 0
                        ? 'bg-[#234e32] text-white hover:bg-[#1a3b26] shadow-[#234e32]/20 cursor-pointer'
                        : 'bg-[#ded5c2] text-[#8c7e6c] cursor-not-allowed'
                    }`}
                  >
                    {t('Confirm Selection')} {selectedMultiChoices.length > 0 ? `(${selectedMultiChoices.length})` : ''}
                  </button>
                </div>
              </div>
            ) : normalizedQ.type === 'scale' ? (
              /* Scale 0 to 10 */
              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-xs font-bold text-[#6b7c6e]">
                  <span>0 - {t('None')}</span>
                  <span>5 - {t('Moderate')}</span>
                  <span>10 - {t('Severe')}</span>
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-11 gap-2">
                  {normalizedQ.options.map((opt) => {
                    const isSelected = selectedChoice === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setSelectedChoice(opt.value);
                          submitAnswer(opt.value, opt.normalizedEnglishText);
                        }}
                        className={`h-14 rounded-xl border-2 font-bold text-base transition flex items-center justify-center ${
                          isSelected
                            ? 'border-[#234e32] bg-[#234e32] text-white shadow-lg ring-2 ring-[#234e32]/30 scale-105'
                            : 'border-[#ded5c2] bg-[#f8f5ee] hover:bg-[#e8f1e6] text-[#1c241e]'
                        }`}
                      >
                        {opt.value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : normalizedQ.type === 'number' ? (
              /* Numeric Input */
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const val = Math.max(0, (parseFloat(currentAnswer) || 0) - 1);
                      setCurrentAnswer(String(val));
                    }}
                    className="w-14 h-14 rounded-2xl border-2 border-[#ded5c2] bg-[#f8f5ee] hover:bg-[#e8f1e6] text-2xl font-bold text-[#1c241e] flex items-center justify-center"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    placeholder="0"
                    className="flex-1 h-14 text-center rounded-2xl border-2 border-[#ded5c2] focus:border-[#234e32] bg-white text-2xl font-bold text-[#1c241e] focus:outline-none focus:ring-2 focus:ring-[#234e32]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (currentAnswer.trim()) submitAnswer(currentAnswer.trim());
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = (parseFloat(currentAnswer) || 0) + 1;
                      setCurrentAnswer(String(val));
                    }}
                    className="w-14 h-14 rounded-2xl border-2 border-[#ded5c2] bg-[#f8f5ee] hover:bg-[#e8f1e6] text-2xl font-bold text-[#1c241e] flex items-center justify-center"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    disabled={!currentAnswer.trim()}
                    onClick={() => submitAnswer(currentAnswer.trim())}
                    className={`h-14 px-7 rounded-2xl font-bold text-sm transition shadow-sm ${
                      currentAnswer.trim()
                        ? 'bg-[#234e32] text-white hover:bg-[#1a3b26] shadow-[#234e32]/20 cursor-pointer'
                        : 'bg-[#ded5c2] text-[#8c7e6c] cursor-not-allowed'
                    }`}
                  >
                    {t('Next')}
                  </button>
                </div>
              </div>
            ) : (
              /* Open-ended Text / Duration / Fallback Free-text */
              <div className="flex flex-col gap-3 mb-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <textarea 
                    className="w-full rounded-2xl bg-white border border-[#ded5c2] p-5 focus:outline-none focus:ring-2 focus:ring-[#234e32] resize-none transition text-base text-[#1c241e]"
                    rows={4}
                    placeholder={currentQ.example ? t(currentQ.example) : t("e.g. It started a few days ago...")}
                    value={currentAnswer}
                    onChange={(e) => {
                      setCurrentAnswer(e.target.value);
                      setNormalizedAnswer(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (currentAnswer.trim()) submitAnswer(currentAnswer.trim());
                      }
                    }}
                  />
                  <button 
                    type="button"
                    onClick={() => submitAnswer(currentAnswer.trim())}
                    disabled={!currentAnswer.trim()}
                    className={`w-full sm:w-auto rounded-2xl px-7 py-3.5 font-bold text-sm transition shadow-sm ${
                      currentAnswer.trim() ? 'bg-[#234e32] text-white hover:bg-[#1a3b26] shadow-[#234e32]/20 cursor-pointer' : 'bg-[#ded5c2] text-[#8c7e6c] cursor-not-allowed'
                    }`}
                  >
                    {t('Next')}
                  </button>
                </div>
                <p className="text-xs text-[#6b7c6e]">{t('Press Enter or click Next to submit')}</p>
              </div>
            )}

            {/* Voice Confirmation Banner */}
            {(currentAnswer && !isListening && !isProcessing && (normalizedQ.type === 'free_text' || normalizedQ.type === 'duration')) && (
              <div className="mt-4 flex flex-col sm:flex-row gap-3 items-center bg-[#f8f5ee] p-4 rounded-2xl border border-[#ded5c2]">
                <div className="flex-1 w-full text-center sm:text-left">
                  <p className="text-xs font-semibold text-[#667768] uppercase tracking-wider mb-1">{t('We heard:')}</p>
                  <p className="font-bold text-[#1c241e]">"{currentAnswer}"</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <button onClick={() => { reset(); setCurrentAnswer(''); }} className="flex-1 sm:flex-none justify-center inline-flex items-center gap-2 rounded-xl bg-white border border-[#ded5c2] hover:bg-[#ede5d6] text-[#4d2f19] font-bold px-4 py-2.5 transition"><RotateCcw size={16} /> {t('Clear')}</button>
                  <button onClick={() => submitAnswer(currentAnswer)} className="flex-1 sm:flex-none justify-center inline-flex items-center gap-2 rounded-xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-4 py-2.5 transition"><Check size={16} /> {t('Confirm')}</button>
                </div>
              </div>
            )}

            {/* Previous Question Navigation */}
            {historyStack.length > 0 && (
              <div className="flex items-center justify-between pt-5 border-t border-[#ded5c2]">
                <button
                  type="button"
                  onClick={handlePreviousQuestion}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#f8f5ee] border border-[#ded5c2] hover:bg-[#ede5d6] text-[#4d2f19] font-bold px-4 py-2.5 text-xs transition cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  {t('Previous Question')}
                </button>
                <div className="text-xs font-medium text-[#6b7c6e]">
                  {answers.length} {t('answered')}
                </div>
              </div>
            )}
          </div>
        )}

        {done && redFlagAlert && (
          <div className="rounded-3xl bg-[#fff5f5] border-2 border-[#b83b3b] shadow-xl p-8 md:p-12 mb-6 text-center">
            <div className="w-16 h-16 rounded-full bg-[#fde8e8] text-[#b83b3b] flex items-center justify-center mx-auto mb-4"><AlertCircle size={34} /></div>
            <h3 className="text-3xl font-serif font-bold text-[#8a1f1f] mb-3">{t('Immediate Attention Recommended')}</h3>
            <p className="text-[#771d1d] font-medium mb-6 leading-relaxed">{t('Based on your responses, we advise immediate medical evaluation.')}</p>
            <button onClick={() => router.push('/patient/history')} className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-2xl bg-[#b83b3b] hover:bg-[#992828] text-white font-bold px-8 py-3.5 text-base shadow-lg transition">{t('Proceed to Summary')}</button>
          </div>
        )}

        {done && !redFlagAlert && (
          <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-8 md:p-12 mb-6 text-center">
            <h3 className="text-3xl font-serif font-bold text-[#1b3d27] mb-3">{t('Questions Complete')}</h3>
            <p className="text-[#556358] mb-6">{t('Your responses have been structured for clinical review.')}</p>
            <button onClick={() => router.push('/patient/history')} className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-3.5 text-base shadow-lg shadow-[#234e32]/25 transition">
              <span>{t('Review Structured History')}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </AyurvedaBackground>
  );
}
