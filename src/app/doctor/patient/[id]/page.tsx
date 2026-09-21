"use client";

import Header from '@/components/Header';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { AlertTriangle, Stethoscope, ShieldAlert, User, Clock, Activity, FileText, CheckCircle2, FileSignature, Loader2, Pill, ArrowRight, Edit3, Download, ExternalLink, FileImage, Sparkles, Folder } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSession, updateSession } from '@/lib/store/store';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { ClinicalSummary, AyurvedaReference, MedicationSafetyAlert, MedicalDocument, ExtractedClinicalData } from '@/lib/types';
import DoctorSummaryAudio from '@/components/DoctorSummaryAudio';
import { normalizeClinicalSummaryToEnglish, buildSpokenClinicalSummary } from '@/lib/clinicalSummaryTranslator';

export default function PatientReviewPage({ params }: { params: { id: string } }) {
  const [summary, setSummary] = useState<ClinicalSummary | null>(null);
  const [structuredSummary, setStructuredSummary] = useState<any>(null);
  const [ayurvedaReferences, setAyurvedaReferences] = useState<AyurvedaReference[] | null>(null);
  const [medicationSafetyAlerts, setMedicationSafetyAlerts] = useState<MedicationSafetyAlert[] | null>(null);
  const [summaryStatus, setSummaryStatus] = useState<string>('pending');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [patientDocuments, setPatientDocuments] = useState<MedicalDocument[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractedClinicalData | null>(null);

  useEffect(() => {
    async function loadPatientRecord() {
      setLoading(true);
      const session = getSession();
      
      // 1. Check local active session
      if (session?.clinicalSummary && (session.clinicalSummary.patientId === params.id || session.firestoreSessionId === params.id || (session as any).id === params.id)) {
        setSummary(normalizeClinicalSummaryToEnglish(session.clinicalSummary));
        setStructuredSummary(session.structuredPhysicianSummary || null);
        setAyurvedaReferences(session.ayurvedaReferences || null);
        setMedicationSafetyAlerts((session as any).medicationSafetyAlerts || null);
        setSummaryStatus(session.physicianSummaryStatus || 'pending');
        setConfirmed(session.clinicalSummary.status === 'confirmed');
        setPatientDocuments(session.documents || []);
        setExtractedData(session.extractedData || null);
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

          setSummary(normalizeClinicalSummaryToEnglish(loadedSummary));
          setStructuredSummary(data.structuredPhysicianSummary || null);
          setAyurvedaReferences(data.ayurvedaReferences || null);
          setSummaryStatus(data.physicianSummaryStatus || 'pending');
          setConfirmed(data.status === 'confirmed' || data.doctorDecision === 'accepted');
          setExtractedData(data.extractedData || null);

          // Collect complete patient report history across all sessions of this patient
          const currentDocs: MedicalDocument[] = data.documents || [];
          const patientUid = data.patientId;

          if (patientUid) {
            try {
              const q = query(collection(db, 'patientSessions'), where('patientId', '==', patientUid));
              const allSessionsSnap = await getDocs(q);
              const docsMap = new Map<string, MedicalDocument>();

              // Add current session documents first
              currentDocs.forEach((d) => {
                const key = d.id || `${d.fileName}-${d.size}`;
                docsMap.set(key, d);
              });

              // Add documents from any other past sessions
              allSessionsSnap.forEach((sSnap) => {
                const sData = sSnap.data();
                (sData.documents || []).forEach((d: MedicalDocument) => {
                  const key = d.id || `${d.fileName}-${d.size}`;
                  if (!docsMap.has(key)) {
                    docsMap.set(key, d);
                  }
                });
              });

              setPatientDocuments(Array.from(docsMap.values()));
            } catch (queryErr) {
              console.warn('Could not query all patient sessions:', queryErr);
              setPatientDocuments(currentDocs);
            }
          } else {
            setPatientDocuments(currentDocs);
          }
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

  const handleAyurvedaAction = async (idx: number, action: 'accepted' | 'rejected' | 'edited') => {
    if (!ayurvedaReferences) return;
    const newRefs = [...ayurvedaReferences];
    newRefs[idx].status = action;
    setAyurvedaReferences(newRefs);

    try {
      const docRef = doc(db, 'patientSessions', params.id);
      await updateDoc(docRef, {
        ayurvedaReferences: newRefs
      });
    } catch (err) {
      console.error('Failed to save ayurveda reference action:', err);
    }
  };

  const handleSafetyAction = async (idx: number, action: 'acknowledged' | 'dismissed') => {
    if (!medicationSafetyAlerts) return;
    const newAlerts = [...medicationSafetyAlerts];
    newAlerts[idx].status = action;
    newAlerts[idx].clinicianAction = action;
    newAlerts[idx].reviewedAt = new Date().toISOString();
    setMedicationSafetyAlerts(newAlerts);

    try {
      const id = Array.isArray(params.id) ? params.id[0] : params.id;
      const docRef = doc(db, 'patientSessions', id);
      await updateDoc(docRef, {
        medicationSafetyAlerts: newAlerts
      });
    } catch (err) {
      console.error('Failed to save medication safety action:', err);
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

  const s = structuredSummary || {};
  
  const spokenText = s.clinicalHandoff 
    ? s.clinicalHandoff 
    : buildSpokenClinicalSummary({
        patientName: summary.patient?.name,
        patientAge: summary.patient?.age,
        patientGender: summary.patient?.gender,
        chiefComplaint: s.chiefComplaint || summary.history.chiefComplaint,
        duration: s.durationOnset || summary.history.duration,
        associatedSymptoms: s.associatedSymptoms || summary.history.associatedSymptoms,
        medications: s.medicines || summary.medications,
        allergies: summary.allergies, // UI allergies fallback
        pastHistory: s.relevantHistory || summary.pastHistory,
        redFlags: summary.redFlags
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
            patientName={summary.patient?.name}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-8">
            <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-5">Patient Information</h3>
            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-4">
                <div className="text-xs font-bold text-[#829277] uppercase">Name</div>
                <div className="font-bold text-base text-[#1c241e] mt-1">{summary.patient.name}</div>
              </div>
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-4">
                <div className="text-xs font-bold text-[#829277] uppercase">Age</div>
                <div className="font-bold text-base text-[#1c241e] mt-1">{summary.patient.age || '—'}</div>
              </div>
              <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-4">
                <div className="text-xs font-bold text-[#829277] uppercase">Gender</div>
                <div className="font-bold text-base text-[#1c241e] mt-1">{summary.patient.gender || '—'}</div>
              </div>
            </div>

            {s.clinicalHandoff ? (
              <>
                <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-4">Physician Clinical Handoff</h3>
                <div className="rounded-2xl bg-[#e4ede1]/60 border border-[#c7d9c2] p-5 mb-6 text-base text-[#1c241e] leading-relaxed whitespace-pre-wrap">
                  {s.clinicalHandoff}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-4">Chief Complaint (English)</h3>
                <div className="rounded-2xl bg-[#e4ede1]/60 border border-[#c7d9c2] p-5 mb-6">
                  <div className="font-serif font-bold text-xl text-[#1b3d27] mb-1">{s.chiefComplaint || summary.history.chiefComplaint || 'None'}</div>
                  <div className="text-xs text-[#3e4a3f]"><strong>Duration:</strong> {s.durationOnset || summary.history.duration || 'Not specified'}</div>
                  <div className="text-xs text-[#3e4a3f] mt-1"><strong>Affected Area:</strong> {s.affectedArea || 'Not specified'}</div>
                </div>

                <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-4">History of Present Illness</h3>
                <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5 mb-6">
                  <div className="font-bold text-sm text-[#1c241e] mb-1">Associated Symptoms:</div>
                  <div className="text-sm text-[#556358]">{s.associatedSymptoms?.join(', ') || summary.history.associatedSymptoms?.join(', ') || 'None reported'}</div>
                </div>

                <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-4">Medications & Allergies</h3>
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                    <div className="text-xs font-bold text-[#829277] uppercase mb-1">Medications</div>
                    <div className="font-bold text-sm text-[#1c241e]">{s.medicines || summary.medications}</div>
                  </div>
                  <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5">
                    <div className="text-xs font-bold text-[#829277] uppercase mb-1">Allergies</div>
                    <div className="font-bold text-sm text-[#1c241e]">{summary.allergies}</div>
                  </div>
                </div>
              </>
            )}

            {ayurvedaReferences && ayurvedaReferences.length > 0 && (
              <>
                <h3 className="text-xl font-serif font-bold text-[#1b3d27] mb-4">Ayurveda Clinical Reference</h3>
                <div className="rounded-2xl bg-[#fbf9f4] border border-[#ded5c2] p-5 mb-6">
                  {ayurvedaReferences.map((ref, i) => (
                    <div key={i} className="mb-5 last:mb-0 pb-5 last:pb-0 border-b border-[#ded5c2]/60 last:border-0">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-lg font-bold text-[#1b3d27]">
                            {ref.term} ({ref.termHindi})
                          </div>
                          <div className="text-[10px] text-[#6f4827] mt-0.5 font-bold flex items-center gap-1.5 uppercase">
                            <AlertTriangle size={12} />
                            AI Reference Suggestion
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAyurvedaAction(i, 'accepted')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                              ref.status === 'accepted' ? 'bg-[#234e32] text-white' : 'bg-white border border-[#ded5c2] text-[#234e32] hover:bg-[#e8f1e6]'
                            }`}
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleAyurvedaAction(i, 'rejected')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                              ref.status === 'rejected' ? 'bg-[#b83b3b] text-white' : 'bg-white border border-[#ded5c2] text-[#b83b3b] hover:bg-[#fff5f5]'
                            }`}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                      <div className="text-sm text-[#4a5749]">
                        <strong className="text-[#1c241e]">Basis:</strong> {ref.basis.join(' + ')}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {medicationSafetyAlerts && medicationSafetyAlerts.length > 0 && (
              <>
                <h3 className="text-xl font-serif font-bold text-[#92400e] mb-4 flex items-center gap-2">
                  <ShieldAlert size={20} />
                  Medication & Herb Safety Review
                </h3>
                <div className="rounded-2xl bg-[#fffbeb] border border-[#fcd34d] p-5 mb-6">
                  {medicationSafetyAlerts.map((alert, i) => (
                    <div key={i} className="mb-5 last:mb-0 pb-5 last:pb-0 border-b border-[#fcd34d]/60 last:border-0">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-lg font-bold text-[#92400e]">
                            {alert.itemA} + {alert.itemB}
                          </div>
                          <div className="text-[10px] text-[#b45309] mt-0.5 font-bold uppercase tracking-wider">
                            Potential {alert.interactionType.replace('-', ' ')}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSafetyAction(i, 'acknowledged')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                              alert.status === 'acknowledged' ? 'bg-[#92400e] text-white' : 'bg-white border border-[#fcd34d] text-[#92400e] hover:bg-[#fef3c7]'
                            }`}
                          >
                            Acknowledge
                          </button>
                          <button
                            onClick={() => handleSafetyAction(i, 'dismissed')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                              alert.status === 'dismissed' ? 'bg-[#9ca3af] text-white' : 'bg-white border border-[#d1d5db] text-[#4b5563] hover:bg-[#f3f4f6]'
                            }`}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                      <div className="text-sm text-[#78350f] mb-1">
                        <strong>Concern:</strong> {alert.concern}
                      </div>
                      <div className="text-xs text-[#92400e]">
                        <strong>Evidence:</strong> {alert.evidenceNote} <br/>
                        <span className="opacity-75">Source: {alert.source}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Comprehensive Medical Report History & Telemetry */}
            <div className="mb-8">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xl font-serif font-bold text-[#1b3d27] flex items-center gap-2">
                    <Folder size={20} className="text-[#234e32]" />
                    Complete Medical Report History
                  </h3>
                  <p className="text-xs text-[#556358] mt-0.5">
                    Historical patient reports, automated OCR extraction, and AI clinical summaries.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2]">
                    Total Reports: {patientDocuments.length}
                  </span>
                </div>
              </div>

              {/* Overall AI Summary of Findings if available */}
              {(extractedData?.summary || patientDocuments.some(d => d.summary || d.extractedData?.summary)) && (
                <div className="rounded-2xl bg-[#e4ede1]/60 border border-[#c7d9c2] p-4 mb-4">
                  <div className="text-xs font-bold text-[#234e32] flex items-center gap-1.5 mb-1.5">
                    <Sparkles size={15} /> AI Synthesis of Uploaded Medical Documents
                  </div>
                  <p className="text-xs text-[#1c241e] leading-relaxed whitespace-pre-wrap">
                    {extractedData?.summary || patientDocuments.map(d => d.summary || d.extractedData?.summary).filter(Boolean).join('\n')}
                  </p>
                </div>
              )}

              {patientDocuments.length === 0 ? (
                <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-6 text-center text-xs text-[#829277]">
                  No previous medical reports or documents uploaded for this patient.
                </div>
              ) : (
                <div className="space-y-4">
                  {patientDocuments.map((doc, idx) => {
                    const docDate = doc.extractedData?.reportDate || (doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'Recorded in intake');
                    const docSummary = doc.summary || doc.extractedData?.summary;
                    const tests = doc.extractedData?.tests || [];
                    const medicines = doc.extractedData?.medicines || [];

                    return (
                      <div key={doc.id || idx} className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-5 shadow-xs space-y-4">
                        {/* Report Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#ded5c2]/60">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#e4ede1] border border-[#c7d9c2] flex items-center justify-center text-[#234e32] shrink-0 mt-0.5">
                              {doc.fileType?.includes('image') ? <FileImage size={20} /> : <FileText size={20} />}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-[#1c241e] flex items-center gap-2 flex-wrap">
                                <span>{doc.fileName || `Report_${idx + 1}`}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-[#ded5c2] text-[#556358]">
                                  {doc.fileType || 'Document'}
                                </span>
                              </div>
                              <div className="text-xs text-[#556358] mt-0.5 flex items-center gap-2">
                                <span>Report Date: <strong>{docDate}</strong></span>
                                <span>•</span>
                                <span>Size: {doc.size || 'Attached'}</span>
                              </div>
                            </div>
                          </div>

                          {/* View / Download Button */}
                          <div className="flex items-center gap-2 self-start sm:self-center">
                            {doc.downloadUrl || doc.dataUrl ? (
                              <a
                                href={doc.downloadUrl || doc.dataUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#234e32] hover:bg-[#1a3b26] text-white text-xs font-bold transition shadow-xs"
                              >
                                <Download size={13} />
                                <span>View / Download</span>
                              </a>
                            ) : (
                              <span className="text-[11px] text-[#829277] italic">Archived in Clinic Store</span>
                            )}
                          </div>
                        </div>

                        {/* Report AI Summary */}
                        {docSummary && (
                          <div className="rounded-xl bg-white p-3 border border-[#ded5c2]/80 text-xs text-[#3e4a3f] leading-relaxed">
                            <strong className="text-[#234e32] font-semibold">AI Summary: </strong>
                            {docSummary}
                          </div>
                        )}

                        {/* Extracted Lab Tests Telemetry Table */}
                        {tests.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-xs font-bold text-[#234e32] flex items-center gap-1.5">
                              <Sparkles size={13} /> Extracted Clinical Lab Telemetry ({tests.length} parameters)
                            </div>
                            <div className="rounded-xl border border-[#ded5c2] overflow-hidden overflow-x-auto bg-white">
                              <table className="w-full text-left text-xs whitespace-nowrap sm:whitespace-normal">
                                <thead className="bg-[#f5efe4] text-[#556358] font-mono uppercase text-[10px]">
                                  <tr>
                                    <th className="p-2.5">Test Name</th>
                                    <th className="p-2.5">Result</th>
                                    <th className="p-2.5">Unit</th>
                                    <th className="p-2.5">Reference Range</th>
                                    <th className="p-2.5">Flag</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#ded5c2]/60">
                                  {tests.map((t, tIdx) => (
                                    <tr key={tIdx} className="hover:bg-[#fbf9f4]">
                                      <td className="p-2.5 font-semibold text-[#1c241e]">{t.name}</td>
                                      <td className="p-2.5 font-mono text-[#234e32] font-bold">{t.value}</td>
                                      <td className="p-2.5 text-[#556358]">{t.unit || '—'}</td>
                                      <td className="p-2.5 font-mono text-[#829277]">{t.referenceRange || '—'}</td>
                                      <td className="p-2.5">
                                        {t.flag ? (
                                          <span className="px-2 py-0.5 rounded bg-[#fff5f5] text-[#b83b3b] font-bold text-[10px] border border-[#b83b3b]/30">
                                            {t.flag}
                                          </span>
                                        ) : (
                                          <span className="text-[#829277]">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Extracted Medicines if prescription */}
                        {medicines.length > 0 && (
                          <div className="text-xs text-[#1c241e] bg-white p-3 rounded-xl border border-[#ded5c2]">
                            <strong className="text-[#234e32]">Identified Medications: </strong>
                            {medicines.join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
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
