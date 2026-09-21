"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { Clock, CheckCircle2, ShieldAlert, Users, Stethoscope, ArrowRight, Sparkles } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { getSession, clearSession } from '@/lib/store/store';
import { usePatientQueuePolling } from '@/hooks/usePatientQueuePolling';
import { useAuth } from '@/context/AuthContext';

export default function QueuePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const session = getSession();
  const { currentUser } = useAuth();
  
  // Use session firestoreSessionId or currentUser UID as fallback
  const sessionId = session?.firestoreSessionId;
  const patientId = currentUser?.uid;

  const { patientQueueInfo, loading } = usePatientQueuePolling(sessionId, patientId);

  useEffect(() => {
    // If neither session ID nor user is present, route back
    if (!sessionId && !patientId) {
      router.push('/patient/summary');
    }
  }, [sessionId, patientId, router]);

  const handleReturnHome = () => {
    clearSession();
    window.location.href = '/patient';
  };

  if ((!sessionId && !patientId) || loading) {
    return (
      <AyurvedaBackground variant="kiosk">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 border-4 border-[#234e32] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-[#234e32] tracking-wide animate-pulse">
            {t('Connecting to real-time clinic queue...')}
          </p>
        </div>
      </AyurvedaBackground>
    );
  }

  // If patient has been marked 'completed'
  if (!patientQueueInfo || patientQueueInfo.queueStatus === 'completed' || patientQueueInfo.doctorStatus === 'completed') {
    return (
      <AyurvedaBackground variant="kiosk">
        <Header />
        <section className="relative z-10 max-w-3xl mx-auto px-6 py-16 sm:py-24 text-center flex flex-col items-center justify-center">
          <div className="w-full rounded-3xl bg-white shadow-2xl p-10 sm:p-14 flex flex-col items-center border border-[#e2e8f0]">
            <CheckCircle2 size={72} className="text-[#16a34a] mb-6 animate-bounce" />
            <h1 className="text-4xl font-black text-[#1b3d27] mb-4">{t('Consultation Completed')}</h1>
            <p className="text-xl text-[#556358] mb-10">{t('Your consultation has finished. Thank you for visiting MediKiosk.')}</p>
            <button 
              onClick={handleReturnHome}
              className="px-10 py-4 bg-[#234e32] text-white rounded-2xl font-bold hover:bg-[#1b3d27] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {t('Return to Home')}
            </button>
          </div>
        </section>
      </AyurvedaBackground>
    );
  }

  const {
    queueStatus,
    queuePriority,
    queuePosition = 1,
    estimatedWaitMinutes = 0,
    queueTokenNumber,
    currentServingToken = '--',
    firestoreSessionId
  } = patientQueueInfo;

  const displayToken = queueTokenNumber || `#${(firestoreSessionId || 'TKN').substring(0, 4).toUpperCase()}`;
  const patientsAhead = patientQueueInfo.patientsAhead !== undefined
    ? patientQueueInfo.patientsAhead
    : Math.max(0, queuePosition - 1);

  // When patientsAhead is 0, or doctor review is active, it is the patient's turn
  const isYourTurn = patientsAhead === 0 || queueStatus === 'doctor_review' || patientQueueInfo.doctorStatus === 'in_progress';
  const displayServingToken = isYourTurn ? displayToken : (currentServingToken || '--');
  const displayWait = isYourTurn ? '0 min' : `~${estimatedWaitMinutes} min`;
  const displayStatusText = isYourTurn ? 'YOUR TURN' : (queueStatus === 'triage' ? 'In Triage' : 'Waiting');

  return (
    <AyurvedaBackground variant="kiosk">
      <Header />
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex-1 flex flex-col">
        <div className="w-full rounded-[2.5rem] bg-white/95 border border-[#e2e8f0] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] overflow-hidden">
          
          {/* Header Bar */}
          <div className="bg-[#f8fafc] border-b border-[#e2e8f0] p-6 sm:p-8 text-center flex flex-wrap items-center justify-between gap-4">
            <div className="text-left">
              <h1 className="text-2xl sm:text-3xl font-serif font-black text-[#0f172a] mb-1">
                {t('Waiting Room & Smart Queue')}
              </h1>
              <p className="text-[#64748b] text-sm sm:text-base font-medium">
                {t('Live real-time queue position synchronized with physician desk')}
              </p>
            </div>
            
            {/* Live Indicator */}
            <div className="flex items-center gap-2 bg-[#f0fdf4] text-[#16a34a] px-4 py-2 rounded-full border border-[#bbf7d0] font-bold text-sm shadow-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#16a34a]"></span>
              </span>
              {t('Live Real-Time Sync')}
            </div>
          </div>

          <div className="p-6 sm:p-10">

            {/* Banner when it's patient's turn */}
            {isYourTurn && (
              <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-[#166534] via-[#15803d] to-[#16a34a] text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
                <div className="flex items-center gap-4 text-center sm:text-left">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <Sparkles size={32} className="text-amber-300" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">{t("IT'S YOUR TURN NOW!")}</h2>
                    <p className="text-sm font-medium text-emerald-100 mt-0.5">
                      {t('The doctor is ready to see you. Please proceed directly to the OPD Consultation Room.')}
                    </p>
                  </div>
                </div>
                <div className="px-5 py-2.5 rounded-xl bg-white text-[#166534] font-black text-sm uppercase tracking-wider shadow-md shrink-0 flex items-center gap-1.5">
                  <ArrowRight size={18} />
                  <span>{t('Proceed to Doctor')}</span>
                </div>
              </div>
            )}
            
            {/* The 4 Core Smart Queue Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              
              {/* Card 1: Your Token */}
              <div className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] rounded-[1.75rem] p-6 flex flex-col justify-between text-white shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between text-[#94a3b8] mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">{t('Your Token')}</span>
                  <Users size={18} className="text-[#38bdf8]" />
                </div>
                <div className="text-5xl font-black text-white tracking-tight my-2 drop-shadow-sm">
                  {displayToken}
                </div>
                <div className="text-xs text-slate-300 font-medium">
                  {t('Assigned intake token')}
                </div>
              </div>

              {/* Card 2: Currently Serving / Now Serving */}
              <div className="bg-gradient-to-br from-[#1b3d27] to-[#2d5f3e] rounded-[1.75rem] p-6 flex flex-col justify-between text-white shadow-lg relative overflow-hidden">
                <div className="flex items-center justify-between text-[#a7f3d0] mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">{t('Now Serving')}</span>
                  <Stethoscope size={18} className="text-amber-300" />
                </div>
                <div className="text-5xl font-black text-white tracking-tight my-2 drop-shadow-sm">
                  {displayServingToken}
                </div>
                <div className="text-xs text-emerald-200 font-medium">
                  {isYourTurn ? t('You are currently being called') : t('Currently with physician')}
                </div>
              </div>

              {/* Card 3: Patients Ahead */}
              <div className="bg-[#f8fafc] border-2 border-[#e2e8f0] rounded-[1.75rem] p-6 flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between text-[#64748b] mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">{t('Patients Ahead')}</span>
                  <Users size={18} className="text-[#64748b]" />
                </div>
                <div className="text-5xl font-black text-[#0f172a] tracking-tight my-2">
                  {patientsAhead}
                </div>
                <div className="text-xs text-[#64748b] font-medium">
                  {patientsAhead === 0 ? t('You are next in line!') : t(patientsAhead === 1 ? '1 patient in line' : `${patientsAhead} patients in line`)}
                </div>
              </div>

              {/* Card 4: Estimated Wait Time */}
              <div className="bg-[#f0f9ff] border-2 border-[#bae6fd] rounded-[1.75rem] p-6 flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between text-[#0369a1] mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">{t('Estimated Wait')}</span>
                  <Clock size={18} className="text-[#0284c7]" />
                </div>
                <div className="text-5xl font-black text-[#0c4a6e] tracking-tight my-2">
                  {displayWait}
                </div>
                <div className="text-xs text-[#0284c7] font-medium">
                  {isYourTurn ? t('Ready for consultation') : t('Calculated at ~10 min / patient')}
                </div>
              </div>

            </div>

            {/* Bottom Row: Queue Status & Priority Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
              
              {/* Queue Status Box */}
              <div className={`p-6 rounded-2xl border-2 flex items-center gap-5 ${
                isYourTurn 
                  ? 'bg-[#f0fdf4] border-[#86efac] text-[#166534]' 
                  : 'bg-white border-[#e2e8f0] text-[#0f172a]'
              }`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                  isYourTurn 
                    ? 'bg-[#dcfce7] text-[#16a34a]' 
                    : 'bg-[#fef9c3] text-[#ca8a04]'
                }`}>
                  {isYourTurn ? <CheckCircle2 size={30} /> : <Clock size={30} />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">{t('Queue Status')}</h4>
                  <div className={`text-2xl font-black ${isYourTurn ? 'text-[#166534]' : 'text-[#0f172a]'}`}>
                    {displayStatusText}
                  </div>
                  <p className="text-xs text-[#64748b] mt-0.5">
                    {isYourTurn 
                      ? t('Please enter the physician consultation cabin.')
                      : t('Please wait in the seating lounge until your token is called.')
                    }
                  </p>
                </div>
              </div>

              {/* Priority Assessment Box */}
              {(queuePriority === 'emergency' || queuePriority === 'high') ? (
                <div className={`border-2 rounded-2xl p-6 shadow-xs flex items-center gap-5 ${
                  queuePriority === 'emergency' ? 'bg-[#fef2f2] border-[#fecaca]' : 'bg-[#fffbeb] border-[#fde68a]'
                }`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                    queuePriority === 'emergency' ? 'bg-[#fee2e2] text-[#dc2626]' : 'bg-[#fef3c7] text-[#d97706]'
                  }`}>
                    <ShieldAlert size={30} />
                  </div>
                  <div>
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                      queuePriority === 'emergency' ? 'text-[#b91c1c]' : 'text-[#b45309]'
                    }`}>{t('Priority Assessment')}</h4>
                    <div className={`text-xl sm:text-2xl font-black ${
                      queuePriority === 'emergency' ? 'text-[#991b1b]' : 'text-[#92400e]'
                    }`}>
                      {queuePriority === 'emergency' ? t('Emergency Priority') : t('High Priority')}
                    </div>
                    <p className="text-xs text-[#64748b] mt-0.5">
                      {t('Triage priority applied based on deterministic clinical findings.')}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-white border-2 border-[#e2e8f0] rounded-2xl p-6 shadow-xs flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner bg-[#f1f5f9] text-[#64748b]">
                    <CheckCircle2 size={30} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#64748b] uppercase tracking-wider mb-1">{t('Priority Assessment')}</h4>
                    <div className="text-xl sm:text-2xl font-black text-[#475569]">
                      {t('Standard FIFO Queue')}
                    </div>
                    <p className="text-xs text-[#64748b] mt-0.5">
                      {t('Normal intake checkup, served in sequence of registration.')}
                    </p>
                  </div>
                </div>
              )}

            </div>

            {/* Footer Navigation */}
            <div className="text-center border-t border-[#e2e8f0] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[#64748b] text-xs sm:text-sm font-medium text-center sm:text-left">
                {t('This screen updates automatically in real-time. Do not close if you wish to monitor your status.')}
              </p>
              <button 
                onClick={handleReturnHome}
                className="bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#475569] border border-[#cbd5e1] hover:text-[#0f172a] px-8 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs"
              >
                {t('Return to Home Screen')}
              </button>
            </div>

          </div>
        </div>
      </section>
    </AyurvedaBackground>
  );
}
