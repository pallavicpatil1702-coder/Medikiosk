"use client";

import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { Stethoscope, AlertTriangle, FileText, Pill, User, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, updateSession } from '@/lib/store/store';
import type { PatientSession, ClinicalSummary, AyurvedaReference } from '@/lib/types';
import { buildHistory } from '@/lib/clinicalHistory';
import { useTranslation } from '@/lib/i18n';
import { useSync } from '@/hooks/useSync';
import { generateUUID } from '@/lib/uuid';

export default function SummaryPage() {
  const [session, setSessionState] = useState<PatientSession | null>(null);
  const [ayurvedaReferences, setAyurvedaReferences] = useState<AyurvedaReference[] | null>(null);
  const [isGeneratingAyurveda, setIsGeneratingAyurveda] = useState(false);
  const [hasMedicationSafetyAlerts, setHasMedicationSafetyAlerts] = useState(false);
  const [isGeneratingSafety, setIsGeneratingSafety] = useState(false);
  const router = useRouter();
  const { t } = useTranslation();
  const { sync } = useSync();

  useEffect(() => {
    const s = getSession();
    setSessionState(s);
    if (s && !s.ayurvedaReferences) {
      setIsGeneratingAyurveda(true);
      fetch('/api/ai/generateAyurvedaReference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: s, sessionId: s.firestoreSessionId })
      }).then(res => res.json()).then(data => {
        if (data.references) {
          setAyurvedaReferences(data.references);
          updateSession({ ayurvedaReferences: data.references });
        }
      }).catch(console.error).finally(() => setIsGeneratingAyurveda(false));
    } else if (s && s.ayurvedaReferences) {
      setAyurvedaReferences(s.ayurvedaReferences);
    }

    if (s && !s.medicationSafetyAlerts && s.firestoreSessionId) {
      setIsGeneratingSafety(true);
      fetch('/api/ai/generateMedicationSafety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: s.firestoreSessionId })
      }).then(res => res.json()).then(data => {
        if (data.alerts && data.alerts.length > 0) {
          setHasMedicationSafetyAlerts(true);
          updateSession({ medicationSafetyAlerts: data.alerts });
        }
      }).catch(console.error).finally(() => setIsGeneratingSafety(false));
    } else if (s && s.medicationSafetyAlerts && s.medicationSafetyAlerts.length > 0) {
      setHasMedicationSafetyAlerts(true);
    }
  }, []);

  const handleSendToDoctor = () => {
    if (!session || !session.patient || !session.answers) return;

    const history = session.clinicalHistory || buildHistory(session.chiefComplaint, session.answers);
    const summary: ClinicalSummary = {
      id: generateUUID(),
      patientId: session.patient.id,
      generatedAt: new Date().toISOString(),
      patient: session.patient,
      history: history,
      medications: history.medicationTaken || 'None',
      allergies: history.allergies || 'No known allergy reported',
      pastHistory: history.pastMedicalHistory || 'No major history reported',
      investigationResults: session.extractedData ? JSON.stringify(session.extractedData) : 'No reports',
      previousReports: session.documents?.map(d => d.fileName) || [],
      redFlags: session.redFlags || [],
      aiNotes: 'Auto-generated notes based on patient input. ' + (session.redFlags?.length ? 'Red flags detected, requires prompt attention.' : 'No red flags detected. Routine evaluation recommended.'),
      status: 'pending'
    };

    // Save localized summary for patient-facing views, and set physician summary status to pending
    updateSession({ 
      clinicalSummary: summary,
      physicianSummaryStatus: 'pending'
    });
    
    // Sync the local session to Firestore to ensure sessionId is created and data is saved
    sync('completed');

    // Fire & forget the LLM physician summary generation in the background
    // We do NOT await this because we want to immediately redirect the patient to completion
    if (session.firestoreSessionId) {
      fetch('/api/ai/generatePhysicianSummary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.firestoreSessionId })
      }).catch(err => console.error('Failed to trigger physician summary generation:', err));
    } else {
      // If firestoreSessionId is not instantly available, we rely on a backend trigger or 
      // queue processor, but ideally sync('completed') sets it fast enough, or we can use 
      // the known doc ID. We will wait a brief moment for sync to return if needed.
      setTimeout(() => {
        const updatedSession = getSession();
        if (updatedSession?.firestoreSessionId) {
          fetch('/api/ai/generatePhysicianSummary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: updatedSession.firestoreSessionId })
          }).catch(console.error);
        }
      }, 2000);
    }

    router.push('/patient/complete');
  };

  if (!session || !session.patient) {
    return (
      <AyurvedaBackground variant="kiosk">
        <Header title="Clinical Intake Summary" backHref="/patient/extraction" />
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <p className="text-[#556358]">{t('Loading summary...')}</p>
        </div>
      </AyurvedaBackground>
    );
  }

  const patient = session.patient;
  const history = session.clinicalHistory || buildHistory(session.chiefComplaint, session.answers || []);
  const redFlags = session.redFlags || [];

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title="Clinical Intake Summary" backHref="/patient/extraction" />
      <div className="max-w-4xl mx-auto px-6 py-12 sm:py-16">
        <ProgressBar current={13} total={13} />
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1b3d27] mb-2">{t('Your Clinical Intake Summary')}</h2>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#f6ebd0] border border-[#e5d4a4] px-4 py-1.5 text-xs font-bold text-[#6f4827]">
            <AlertTriangle size={15} /> 
            <span>{t('AI-Assisted Summary • Requires healthcare professional review')}</span>
          </div>
        </div>

        {/* Master Clinical Intake Card */}
        <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-2xl p-6 md:p-12 mb-8">
          <div className="flex items-center gap-3 mb-8 pb-6 border-b border-[#ded5c2]">
            <div className="w-12 h-12 rounded-2xl bg-[#234e32] text-white flex items-center justify-center shadow-md shadow-[#234e32]/20">
              <Sparkles size={24} className="text-[#e8f1e6]" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#829277] uppercase tracking-widest">Pre-Consultation Dossier</span>
              <h3 className="text-2xl font-serif font-bold text-[#1b3d27]">{t('Summary Card')}</h3>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-[#f8f5ee] rounded-2xl p-6 border border-[#ded5c2]">
              <h4 className="text-xs font-extrabold text-[#234e32] uppercase tracking-widest mb-4">{t('Patient Information')}</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-[#ded5c2]/60 py-2">
                  <span className="text-[#6b7c6e]">{t('Name')}</span>
                  <span className="font-bold text-[#1c241e]">{patient.name || t('Unknown')}</span>
                </div>
                <div className="flex justify-between border-b border-[#ded5c2]/60 py-2">
                  <span className="text-[#6b7c6e]">{t('Age')}</span>
                  <span className="font-bold text-[#1c241e]">{patient.age || t('—')}</span>
                </div>
                <div className="flex justify-between border-b border-[#ded5c2]/60 py-2">
                  <span className="text-[#6b7c6e]">{t('Gender')}</span>
                  <span className="font-bold text-[#1c241e]">{t(patient.gender) || t('—')}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-[#6b7c6e]">{t('Contact')}</span>
                  <span className="font-bold text-[#1c241e]">{patient.contact || t('—')}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#f8f5ee] rounded-2xl p-6 border border-[#ded5c2]">
              <h4 className="text-xs font-extrabold text-[#234e32] uppercase tracking-widest mb-2">{t('Chief Complaint')}</h4>
              <div className="text-2xl font-serif font-bold text-[#1b3d27] mb-3">{history.chiefComplaint || t('None')}</div>
              <div className="text-sm text-[#4a5749] mb-1">
                <strong className="text-[#1c241e]">{t('Duration:')}</strong> {history.duration || t('Not specified')}
              </div>
              <div className="text-sm text-[#4a5749]">
                <strong className="text-[#1c241e]">{t('Associated:')}</strong> {history.associatedSymptoms.length > 0 ? history.associatedSymptoms.join(', ') : t('None')}
              </div>
              {session.bodyLocations && session.bodyLocations.length > 0 && (
                <div className="text-sm text-[#4a5749] mt-3 border-t border-[#ded5c2]/60 pt-3">
                  <strong className="text-[#1c241e] block mb-1.5">{t('Affected Areas:')}</strong>
                  <div className="flex flex-wrap gap-1.5">
                    {session.bodyLocations.map(loc => (
                      <span key={loc.id} className="inline-block px-2.5 py-1 bg-[#e8f1e6] border border-[#c3d4c3] rounded-lg text-xs font-bold text-[#1b3d27]">
                        {t(loc.name)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
              <h4 className="text-xs font-extrabold text-[#829277] uppercase tracking-widest mb-1.5">{t('Medication History')}</h4>
              <div className="font-bold text-[#1c241e] text-sm">{history.medicationTaken || t('None')}</div>
            </div>
            <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
              <h4 className="text-xs font-extrabold text-[#829277] uppercase tracking-widest mb-1.5">{t('Allergy History')}</h4>
              <div className="font-bold text-[#1c241e] text-sm">{history.allergies || t('No known allergy')}</div>
            </div>
            <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
              <h4 className="text-xs font-extrabold text-[#829277] uppercase tracking-widest mb-1.5">{t('Past Medical History')}</h4>
              <div className="font-bold text-[#1c241e] text-sm">{history.pastMedicalHistory || t('No major history')}</div>
            </div>
          </div>
          
          <div className={`mt-6 rounded-2xl border p-5 ${
            redFlags.length > 0 
              ? 'bg-[#fff5f5] border-[#b83b3b]/30' 
              : 'bg-[#f8f5ee] border-[#ded5c2]'
          }`}>
            <h4 className={`font-bold mb-2 text-sm uppercase tracking-wide ${redFlags.length > 0 ? 'text-[#8a1f1f]' : 'text-[#234e32]'}`}>
              {t('Potential Red Flags')}
            </h4>
            {redFlags.length > 0 ? (
              <ul className="text-sm text-[#771d1d] list-disc pl-5 space-y-1">
                {redFlags.map(rf => (
                  <li key={rf.id} className="font-semibold">{rf.type}: {rf.description}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-[#4a5749]">{t('None detected for this case.')}</div>
            )}
          </div>
          
          {isGeneratingAyurveda && (
            <div className="mt-6 rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5 text-center flex items-center justify-center gap-3">
              <div className="animate-spin w-5 h-5 border-2 border-[#234e32] border-t-transparent rounded-full" />
              <span className="text-sm font-bold text-[#1b3d27]">{t('Analyzing clinical reference points...')}</span>
            </div>
          )}

          {!isGeneratingAyurveda && ayurvedaReferences && ayurvedaReferences.length > 0 && (
            <div className="mt-6 rounded-2xl bg-[#fbf9f4] border border-[#ded5c2] p-5">
              <h4 className="text-xs font-extrabold text-[#234e32] uppercase tracking-widest mb-3">{t('Ayurveda Clinical Reference')}</h4>
              {ayurvedaReferences.map((ref, i) => (
                <div key={i} className="mb-4 last:mb-0">
                  <div className="text-sm text-[#6b7c6e] mb-0.5">{t('Possible terminology:')}</div>
                  <div className="text-lg font-bold text-[#1b3d27]">
                    {ref.term} ({ref.termHindi})
                  </div>
                  <div className="text-sm text-[#4a5749] mt-1.5">
                    <strong className="text-[#1c241e]">{t('Based on:')}</strong> {ref.basis.join(' + ')}
                  </div>
                </div>
              ))}
              <div className="mt-4 pt-3 border-t border-[#ded5c2]/60 flex items-start gap-2 text-xs font-bold text-[#6f4827]">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{t('Clinical reference only. Final assessment by physician.')}</span>
              </div>
            </div>
          )}

          {(isGeneratingSafety || hasMedicationSafetyAlerts) && (
            <div className="mt-6 rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
              <h4 className="text-xs font-extrabold text-[#829277] uppercase tracking-widest mb-2">{t('Medication Safety')}</h4>
              <div className="flex items-center gap-2 text-sm font-bold text-[#1b3d27]">
                {isGeneratingSafety ? (
                  <><div className="animate-spin w-4 h-4 border-2 border-[#234e32] border-t-transparent rounded-full" /> {t('Analyzing medication history...')}</>
                ) : (
                  <><CheckCircle2 size={18} className="text-[#234e32]" /> {t('Your reported medicines will be reviewed by the healthcare professional.')}</>
                )}
              </div>
            </div>
          )}
          
          <div className="mt-6 rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
            <h4 className="text-xs font-extrabold text-[#829277] uppercase tracking-widest mb-3">{t('Patient Interview Transcript')}</h4>
            {history.answers && history.answers.length > 0 ? (
              <div className="space-y-3">
                {history.answers.map((ans, idx) => (
                  <div key={idx} className="border-b border-[#ded5c2]/60 pb-2.5 last:border-0 last:pb-0">
                    <div className="text-xs font-bold text-[#6b7c6e] mb-0.5">Q: {t(ans.questionText || '')}</div>
                    <div className="text-base font-bold text-[#1c241e]">A: {ans.answer}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-[#829277]">{t('No interview questions answered.')}</div>
            )}
          </div>
          
          <div className="mt-6 rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
            <h4 className="text-xs font-extrabold text-[#234e32] uppercase tracking-widest mb-1.5">{t('AI Notes')}</h4>
            <div className="text-sm text-[#4a5749] leading-relaxed">
              {t('Patient presented with')} {history.chiefComplaint}. 
              {redFlags.length > 0 ? ` ${t('Red flags detected requiring prompt attention.')}` : ` ${t('No red flags detected.')}`}
              {session.documents?.length ? ` ${t('Prior medical reports uploaded.')}` : ''}
              {session.extractedData?.tests && session.extractedData.tests.length > 0 ? ` ${t('Extracted')} ${session.extractedData.tests.length} ${t('tests from report.')}` : ''}
            </div>
          </div>
        </div>

        <div className="flex justify-end w-full">
          <button 
            onClick={handleSendToDoctor} 
            className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-10 py-4 text-lg shadow-xl shadow-[#234e32]/25 transition"
          >
            <span>{t('Send to Doctor')}</span>
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </AyurvedaBackground>
  );
}

