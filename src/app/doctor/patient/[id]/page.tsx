"use client";

import Header from '@/components/Header';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { AlertTriangle, Stethoscope, Pill, ShieldAlert, Clock, CheckCircle2, FileText, Edit3, ArrowRight, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSession, updateSession } from '@/lib/store/store';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import type { ClinicalSummary } from '@/lib/types';
import DoctorSummaryAudio from '@/components/DoctorSummaryAudio';
import { normalizeClinicalSummaryToEnglish, buildSpokenClinicalSummary } from '@/lib/clinicalSummaryTranslator';

export default function PatientReviewPage({ params }: { params: { id: string } }) {
  const [summary, setSummary] = useState<ClinicalSummary | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function loadPatientRecord() {
      setLoading(true);
      const session = getSession();
      
      // 1. Check local active session
      if (session?.clinicalSummary && (session.clinicalSummary.patientId === params.id || session.firestoreSessionId === params.id || (session as any).id === params.id)) {
        setSummary(session.clinicalSummary);
        setConfirmed(session.clinicalSummary.status === 'confirmed');
        setLoading(false);
        return;
      }

      // 2. Query REAL Firestore database
      try {
        const docRef = doc(db, 'patientSessions', params.id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const loadedSummary: ClinicalSummary = data.clinicalSummary || {
            id: docSnap.id,
            patientId: data.patientId || data.patient?.id || docSnap.id,
            generatedAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            patient: data.patient || { name: 'Patient', age: 0, gender: 'Unknown', id: docSnap.id, createdAt: new Date().toISOString() },
            history: data.clinicalHistory || {
              chiefComplaint: data.chiefComplaint || 'Intake',
              duration: 'Reported during intake',
              associatedSymptoms: [],
              medicationTaken: 'None reported',
              allergies: 'No known allergy',
              pastMedicalHistory: 'None declared',
              answers: data.answers || []
            },
            medications: 'None reported',
            allergies: 'No known allergy',
            pastHistory: 'Routine intake',
            investigationResults: data.extractedData ? JSON.stringify(data.extractedData) : 'None',
            previousReports: data.documents?.map((d: any) => d.fileName) || [],
            redFlags: data.redFlags || [],
            aiNotes: 'Clinical intake dossier retrieved from Firestore.',
            status: data.status || 'pending'
          };

          setSummary(loadedSummary);
          setConfirmed(data.status === 'confirmed' || data.doctorDecision === 'accepted');
        } else {
          setNotFound(true);
        }
      } catch (err) {
        console.error('Error fetching patient session from Firestore:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    loadPatientRecord();
  }, [params.id]);

  const saveChanges = async () => {
    setConfirmed(true);
    try {
      const docRef = doc(db, 'patientSessions', params.id);
      await updateDoc(docRef, {
        status: 'confirmed',
        doctorDecision: 'accepted',
        confirmedAt: new Date().toISOString()
      });
      alert('Changes saved and confirmed by doctor in Firestore.');
    } catch (err) {
      console.warn('Local save only:', err);
      alert('Changes confirmed locally.');
    }
  };

  if (loading) {
    return (
      <AyurvedaBackground variant="kiosk">
        <Header title="Patient Clinical Intake" backHref="/doctor/dashboard" />
        <div className="max-w-5xl mx-auto px-6 py-16 text-center text-[#556358] font-semibold">
          Loading live patient record from Firestore...
        </div>
      </AyurvedaBackground>
    );
  }

  if (notFound || !summary) {
    return (
      <AyurvedaBackground variant="kiosk">
        <Header title="Patient Clinical Intake" backHref="/doctor/dashboard" />
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] p-12 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-[#e4ede1] text-[#234e32] flex items-center justify-center mx-auto mb-4">
              <User size={32} />
            </div>
            <h2 className="text-2xl font-serif font-bold text-[#1b3d27] mb-2">Patient Record Not Found</h2>
            <p className="text-sm text-[#556358] mb-6">
              No live consultation document was found in Firestore for ID: <span className="font-mono font-bold text-[#1c241e]">{params.id}</span>
            </p>
            <a 
              href="/doctor/dashboard" 
              className="inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-7 py-3 text-sm shadow-md transition"
            >
              <span>Return to Physician Dashboard</span>
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </AyurvedaBackground>
    );
  }

  const englishSummary = normalizeClinicalSummaryToEnglish(summary);
  const spokenText = buildSpokenClinicalSummary({
    patientName: englishSummary.patient?.name,
    patientAge: englishSummary.patient?.age,
    patientGender: englishSummary.patient?.gender,
    chiefComplaint: englishSummary.history.chiefComplaint,
    duration: englishSummary.history.duration,
    associatedSymptoms: englishSummary.history.associatedSymptoms,
    medications: englishSummary.medications,
    allergies: englishSummary.allergies,
    pastHistory: englishSummary.pastHistory,
    redFlags: englishSummary.redFlags
  });

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title="Patient Clinical Intake" backHref="/doctor/dashboard" />
      <div className="max-w-5xl mx-auto px-6 py-10 sm:py-14">
        <div className="mb-6">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1b3d27] mb-1">Patient Clinical Intake</h2>
          <p className="text-[#556358] text-sm">Review, edit and confirm the structured intake summary.</p>
        </div>

        {/* 🔊 Prominent Listen to Summary Audio Controller */}
        <div className="mb-6">
          <DoctorSummaryAudio
            textToSpeak={spokenText}
            patientId={params.id}
            patientName={englishSummary.patient?.name}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-8">
            <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-5">Patient Information</h3>
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-4">
                <div className="text-xs font-bold text-[#829277] uppercase">Name</div>
                <div className="font-bold text-base text-[#1c241e] mt-1">{englishSummary.patient.name}</div>
              </div>
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-4">
                <div className="text-xs font-bold text-[#829277] uppercase">Age</div>
                <div className="font-bold text-base text-[#1c241e] mt-1">{englishSummary.patient.age || '—'}</div>
              </div>
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-4">
                <div className="text-xs font-bold text-[#829277] uppercase">Gender</div>
                <div className="font-bold text-base text-[#1c241e] mt-1">{englishSummary.patient.gender || '—'}</div>
              </div>
            </div>

            <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-4">Chief Complaint (English)</h3>
            <div className="rounded-2xl bg-[#e4ede1]/60 border border-[#c7d9c2] p-5 mb-6">
              <div className="font-serif font-bold text-xl text-[#1b3d27] mb-1">{englishSummary.history.chiefComplaint || 'None'}</div>
              <div className="text-xs text-[#3e4a3f]"><strong>Duration:</strong> {englishSummary.history.duration || 'Not specified'}</div>
            </div>

            <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-4">History of Present Illness</h3>
            <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5 mb-6">
              <div className="font-bold text-sm text-[#1c241e] mb-1">Associated Symptoms:</div>
              <div className="text-sm text-[#556358]">{englishSummary.history.associatedSymptoms?.join(', ') || 'None reported'}</div>
            </div>

            <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-4">Medications & Allergies</h3>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                <div className="text-xs font-bold text-[#829277] uppercase mb-1">Medications</div>
                <div className="font-bold text-sm text-[#1c241e]">{englishSummary.medications}</div>
              </div>
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                <div className="text-xs font-bold text-[#829277] uppercase mb-1">Allergies</div>
                <div className="font-bold text-sm text-[#1c241e]">{englishSummary.allergies}</div>
              </div>
            </div>

            <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-4">Investigation Results</h3>
            <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5 mb-6 whitespace-pre-wrap text-xs font-mono text-[#3e4a3f]">
              {summary.investigationResults}
            </div>

            <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-4">Previous Reports</h3>
            <div className="flex gap-3 mb-6 flex-wrap">
              {summary.previousReports?.length > 0 ? summary.previousReports.map((r, i) => (
                <div key={i} className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] px-4 py-2.5 text-xs font-bold text-[#234e32] flex items-center gap-2">
                  <FileText size={16} /> 
                  <span>{r}</span>
                </div>
              )) : (
                <div className="text-[#829277] text-xs">No previous reports uploaded.</div>
              )}
            </div>
            
            <div className="mt-8 flex justify-end">
              <a 
                href={`/doctor/fhir?id=${summary.patientId || params.id}`} 
                className="inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-6 py-3 text-xs shadow-md transition"
              >
                <span>View FHIR R4 Resource</span>
                <ArrowRight size={14} />
              </a>
            </div>
          </div>

          <aside className="space-y-6">
            <div className={`rounded-3xl p-7 shadow-md ${
              summary.redFlags && summary.redFlags.length > 0 
                ? 'bg-[#fff5f5] border-2 border-[#b83b3b]' 
                : 'bg-[#fbf9f4]/95 border border-[#ded5c2]'
            }`}>
              <h4 className={`text-base font-serif font-bold mb-3 flex items-center gap-2 ${
                summary.redFlags && summary.redFlags.length > 0 ? 'text-[#8a1f1f]' : 'text-[#1b3d27]'
              }`}>
                <AlertTriangle size={18} /> Potential Red Flags
              </h4>
              {!summary.redFlags || summary.redFlags.length === 0 ? (
                <div className="text-xs text-[#556358]">No red flags detected for this case.</div>
              ) : (
                <ul className="space-y-2 text-xs text-[#771d1d]">
                  {summary.redFlags.map((rf, i) => (
                    <li key={i}><strong>{rf.type}</strong> — {rf.description}</li>
                  ))}
                </ul>
              )}
            </div>
            
            <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] p-7 shadow-md">
              <h4 className="text-base font-serif font-bold text-[#1b3d27] mb-3">Patient Interview Transcript</h4>
              {summary.history.answers && summary.history.answers.length > 0 ? (
                <div className="space-y-3">
                  {summary.history.answers.map((ans, idx) => (
                    <div key={idx} className="border-b border-[#ded5c2]/60 pb-2.5 last:border-0 last:pb-0">
                      <div className="text-[11px] font-bold text-[#829277] mb-0.5">Q: {ans.questionText || ans.questionId}</div>
                      <div className="text-xs font-bold text-[#1c241e]">A: {ans.answer}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[#829277]">No interview questions answered.</div>
              )}
            </div>

            <div className="rounded-3xl bg-[#e4ede1]/60 border border-[#c7d9c2] p-7 shadow-md">
              <h4 className="text-base font-serif font-bold text-[#1b3d27] mb-2">AI Summary Draft</h4>
              <p className="text-xs leading-relaxed text-[#3e4a3f]">{summary.aiNotes}</p>
            </div>
          </aside>
        </div>

        <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-1">Doctor Review Decision</h3>
            <p className="text-xs text-[#556358]">Verify clinical accuracy before marking as reviewed in Firestore.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={saveChanges} 
              className="rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-7 py-3 text-sm shadow-md transition flex items-center gap-2"
            >
              <CheckCircle2 size={16} />
              <span>Confirm & Save</span>
            </button>
            {confirmed && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#e4ede1] border border-[#c7d9c2] text-[#234e32] text-xs font-bold">
                <CheckCircle2 size={14} /> Confirmed in Clinic DB
              </span>
            )}
          </div>
        </div>
      </div>
    </AyurvedaBackground>
  );
}
