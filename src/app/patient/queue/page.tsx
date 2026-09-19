"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { Clock, AlertTriangle, CheckCircle2, ShieldAlert, Users } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { getSession, clearSession } from '@/lib/store/store';
import { usePatientQueuePolling } from '@/hooks/usePatientQueuePolling';

export default function QueuePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const session = getSession();
  const { patientQueueInfo, loading } = usePatientQueuePolling(session?.firestoreSessionId);

  useEffect(() => {
    // If not submitted yet, go back
    if (!session?.firestoreSessionId) {
      router.push('/patient/summary');
    }
  }, [session, router]);

  const handleReturnHome = () => {
    clearSession();
    window.location.href = '/patient';
  };

  if (!session?.firestoreSessionId || loading) {
    return (
      <AyurvedaBackground variant="kiosk">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-[#234e32] border-t-transparent rounded-full animate-spin"></div>
        </div>
      </AyurvedaBackground>
    );
  }

  // If patient info is missing from queue, they have been marked 'completed' or 'rejected'
  if (!patientQueueInfo || patientQueueInfo.queueStatus === 'completed') {
    return (
      <AyurvedaBackground variant="kiosk">
        <Header />
        <section className="relative z-10 max-w-3xl mx-auto px-6 py-16 sm:py-24 text-center flex flex-col items-center justify-center">
          <div className="w-full rounded-3xl bg-white shadow-2xl p-10 sm:p-14 flex flex-col items-center border border-[#e2e8f0]">
            <CheckCircle2 size={72} className="text-[#16a34a] mb-6" />
            <h1 className="text-4xl font-black text-[#1b3d27] mb-4">{t('Consultation Completed')}</h1>
            <p className="text-xl text-[#556358] mb-10">{t('Your consultation has finished. Thank you for visiting.')}</p>
            <button 
              onClick={handleReturnHome}
              className="px-10 py-4 bg-[#234e32] text-white rounded-2xl font-bold hover:bg-[#1b3d27] transition-colors shadow-lg"
            >
              {t('Return to Home')}
            </button>
          </div>
        </section>
      </AyurvedaBackground>
    );
  }

  const { queueStatus, queuePriority, queuePosition = 1, estimatedWaitMinutes, queueTokenNumber, firestoreSessionId } = patientQueueInfo;
  const patientsAhead = Math.max(0, queuePosition - 1);
  const displayToken = queueTokenNumber || `#${(firestoreSessionId || 'TKN').substring(0, 4).toUpperCase()}`;

  return (
    <AyurvedaBackground variant="kiosk">
      <Header />
      <section className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 flex flex-col">
        <div className="w-full rounded-[2.5rem] bg-white/95 border border-[#e2e8f0] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] overflow-hidden">
          
          <div className="bg-[#f8fafc] border-b border-[#e2e8f0] p-6 sm:p-8 text-center flex items-center justify-between">
            <div className="text-left">
              <h1 className="text-2xl sm:text-3xl font-serif font-black text-[#0f172a] mb-1">
                {t('Waiting Room')}
              </h1>
              <p className="text-[#64748b] text-base font-medium">
                {t('Live Queue Status')}
              </p>
            </div>
            
            {/* Live Indicator */}
            <div className="flex items-center gap-2 bg-[#f0fdf4] text-[#16a34a] px-4 py-2 rounded-full border border-[#bbf7d0] font-bold text-sm shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#16a34a]"></span>
              </span>
              {t('Live Updates')}
            </div>
          </div>

          <div className="p-6 sm:p-10 md:p-14">
            
            {/* Top Row: Huge Queue Number & ETA */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
              
              {/* Main Queue Number Box */}
              <div className="md:col-span-3 bg-gradient-to-br from-[#0f172a] to-[#1e293b] rounded-[2rem] p-8 sm:p-12 flex flex-col items-center justify-center text-center shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-10 -mr-10 text-white/5">
                  <Users size={200} />
                </div>
                
                <h2 className="text-[#94a3b8] font-bold text-lg sm:text-xl uppercase tracking-widest mb-4 relative z-10">
                  {t('Your Queue Number')}
                </h2>
                
                <div className="text-7xl sm:text-[8rem] font-black text-white leading-none tracking-tighter mb-4 relative z-10 drop-shadow-lg">
                  {displayToken}
                </div>
                
                <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-6 py-2.5 text-white font-bold text-base sm:text-lg flex items-center gap-2 relative z-10">
                  <Users size={20} className="text-[#a7f3d0]" />
                  <span>
                    <strong className="text-[#a7f3d0] text-xl mr-1">{patientsAhead}</strong> 
                    {t(patientsAhead === 1 ? 'Patient Ahead' : 'Patients Ahead')}
                  </span>
                </div>
              </div>

              {/* ETA Box */}
              <div className="md:col-span-2 bg-[#f0f9ff] border-2 border-[#bae6fd] rounded-[2rem] p-8 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
                <Clock size={48} className="text-[#0ea5e9] mb-4" />
                <h3 className="text-[#0369a1] font-bold text-lg sm:text-xl uppercase tracking-wider mb-2">{t('Estimated Wait')}</h3>
                
                <div className="text-5xl sm:text-6xl font-black text-[#0c4a6e] mb-4">
                  {estimatedWaitMinutes === 0 ? t('Soon') : `~${estimatedWaitMinutes}m`}
                </div>
                
                <p className="text-[#0284c7] text-xs sm:text-sm font-bold bg-[#e0f2fe] border border-[#bae6fd] px-4 py-2 rounded-xl inline-flex items-center text-left">
                  <AlertTriangle size={24} className="mr-2 shrink-0" />
                  {t('This is an estimate. Time may vary based on emergencies.')}
                </p>
              </div>

            </div>

            {/* Bottom Row: Current Status & Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Current Stage Box */}
              <div className="bg-white border-2 border-[#e2e8f0] rounded-[1.5rem] p-6 shadow-sm flex items-center gap-5">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 shadow-inner ${
                  queueStatus === 'waiting' ? 'bg-[#fef9c3] text-[#ca8a04]' :
                  queueStatus === 'triage' ? 'bg-[#dbeafe] text-[#2563eb]' :
                  'bg-[#dcfce3] text-[#16a34a]'
                }`}>
                  {queueStatus === 'waiting' && <Clock size={28} />}
                  {queueStatus === 'triage' && <Users size={28} />}
                  {queueStatus === 'doctor_review' && <CheckCircle2 size={28} />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#64748b] uppercase tracking-wider mb-1">{t('Current Status')}</h4>
                  <div className="text-xl sm:text-2xl font-black text-[#0f172a]">
                    {t(
                      queueStatus === 'waiting' ? 'Waiting for Triage' : 
                      queueStatus === 'triage' ? 'In Triage' : 
                      'Waiting for Doctor'
                    )}
                  </div>
                </div>
              </div>

              {/* Priority Box (Only if Emergency or High) */}
              {(queuePriority === 'emergency' || queuePriority === 'high') ? (
                <div className={`border-2 rounded-[1.5rem] p-6 shadow-sm flex items-center gap-5 ${
                  queuePriority === 'emergency' ? 'bg-[#fef2f2] border-[#fecaca]' : 'bg-[#fffbeb] border-[#fde68a]'
                }`}>
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center shrink-0 shadow-inner ${
                    queuePriority === 'emergency' ? 'bg-[#fee2e2] text-[#dc2626]' : 'bg-[#fef3c7] text-[#d97706]'
                  }`}>
                    <ShieldAlert size={28} />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold uppercase tracking-wider mb-1 ${
                      queuePriority === 'emergency' ? 'text-[#b91c1c]' : 'text-[#b45309]'
                    }`}>{t('Priority Assessment')}</h4>
                    <div className={`text-xl sm:text-2xl font-black ${
                      queuePriority === 'emergency' ? 'text-[#991b1b]' : 'text-[#92400e]'
                    }`}>
                      {queuePriority === 'emergency' ? t('Emergency Priority') : t('High Priority')}
                    </div>
                  </div>
                </div>
              ) : (
                /* Routine Priority Box */
                <div className="bg-white border-2 border-[#e2e8f0] rounded-[1.5rem] p-6 shadow-sm flex items-center gap-5 opacity-70">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 shadow-inner bg-[#f1f5f9] text-[#64748b]">
                    <CheckCircle2 size={28} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#64748b] uppercase tracking-wider mb-1">{t('Priority Assessment')}</h4>
                    <div className="text-xl sm:text-2xl font-black text-[#475569]">
                      {t('Routine Checkup')}
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="mt-10 text-center border-t border-[#e2e8f0] pt-10">
              <p className="text-[#64748b] text-base mb-6 font-medium">
                {t('You can safely leave this screen open or return to the home screen.')} <br className="hidden sm:block" />
                {t('The clinic staff has your queue information.')}
              </p>
              <button 
                onClick={handleReturnHome}
                className="inline-flex items-center justify-center bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1] hover:bg-[#e2e8f0] hover:text-[#0f172a] px-10 py-3.5 rounded-xl font-bold transition-colors shadow-sm"
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
