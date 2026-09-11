"use client";

import Header from '@/components/Header';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Search, 
  User, 
  Send, 
  FileText, 
  ShieldAlert, 
  ChevronRight, 
  X, 
  RefreshCw, 
  Stethoscope, 
  Check, 
  AlertOctagon, 
  Sparkles, 
  Info,
  Calendar,
  LogIn,
  LogOut,
  FileCode,
  Edit3,
  XCircle,
  ClipboardList,
  CheckCheck,
  Copy,
  Layers,
  ArrowRight,
  HelpCircle,
  FileCheck2,
  FileBadge
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import type { PatientSession, RedFlag, MedicalDocument, Answer, FHIRResource } from '@/lib/types';
import { calculatePriority, formatWaitingTime, formatSubmitTime, TriagePriority } from '@/lib/triage';
import { generateRealFHIRResources } from '@/lib/fhirConverter';

interface EnrichedPatientSession extends PatientSession {
  id: string;
  patientId: string;
  status: string;
  calculatedPriority: TriagePriority;
  priorityReason: string;
  waitingTimeStr: string;
  submitTimeStr: string;
  rawTime: any;
  doctorDecision?: 'accepted' | 'edited' | 'rejected';
  doctorNote?: string;
  doctorReviewedAt?: string;
  doctorUid?: string;
  doctorEmail?: string;
}

type TabType = 'summary' | 'answers' | 'reports' | 'redflags' | 'timeline' | 'fhir';

function DoctorDashboardContent() {
  const { currentUser, logout } = useAuth();
  const [sessions, setSessions] = useState<EnrichedPatientSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Filters & Search
  const [activeFilter, setActiveFilter] = useState<'all' | 'forwarded' | 'emergency' | 'high' | 'pending' | 'completed'>('forwarded');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Patient for Review
  const [selectedPatient, setSelectedPatient] = useState<EnrichedPatientSession | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('summary');

  // Physician Actions State
  const [physicianNote, setPhysicianNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    chiefComplaint: '',
    duration: '',
    symptoms: '',
    pastHistory: '',
    medications: '',
    allergies: ''
  });

  // Reject Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // FHIR Tab State
  const [fhirIndex, setFhirIndex] = useState(0);
  const [copiedFhir, setCopiedFhir] = useState(false);

  // Real-time Firestore Subscription
  useEffect(() => {
    setLoading(true);
    setPermissionError(null);

    const sessionsRef = collection(db, 'patientSessions');
    const unsubscribe = onSnapshot(
      sessionsRef,
      (snapshot) => {
        const list: EnrichedPatientSession[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const redFlags: RedFlag[] = data.redFlags || [];
          const { priority, reason } = calculatePriority(redFlags);
          const rawTime = data.createdAt || data.updatedAt;

          list.push({
            id: docSnap.id,
            patientId: data.patientId || docSnap.id,
            patient: data.patient,
            chiefComplaint: data.chiefComplaint || '',
            answers: data.answers || [],
            documents: data.documents || [],
            redFlags: redFlags,
            clinicalSummary: data.clinicalSummary || data.summary || null,
            consent: data.consent || null,
            status: data.status || 'pending_review',
            triageStatus: data.triageStatus || 'pending_review',
            triageNote: data.triageNote || '',
            triageTimestamp: data.triageTimestamp,
            triageNurseId: data.triageNurseId,
            doctorDecision: data.doctorDecision,
            doctorNote: data.doctorNote,
            doctorReviewedAt: data.doctorReviewedAt,
            doctorUid: data.doctorUid,
            doctorEmail: data.doctorEmail,
            calculatedPriority: priority,
            priorityReason: reason,
            waitingTimeStr: formatWaitingTime(rawTime),
            submitTimeStr: formatSubmitTime(rawTime),
            rawTime,
          });
        });

        // Sort descending: Emergency first, then by submission time
        list.sort((a, b) => {
          const priorityScore = { EMERGENCY: 3, HIGH: 2, NORMAL: 1 };
          const diff = priorityScore[b.calculatedPriority] - priorityScore[a.calculatedPriority];
          if (diff !== 0) return diff;
          const timeA = a.rawTime?.seconds ? a.rawTime.seconds * 1000 : new Date(a.rawTime || 0).getTime();
          const timeB = b.rawTime?.seconds ? b.rawTime.seconds * 1000 : new Date(b.rawTime || 0).getTime();
          return timeB - timeA;
        });

        setSessions(list);
        setLoading(false);

        // Keep active selection in sync
        setSelectedPatient((prev) => {
          if (!prev) return list[0] || null;
          const updated = list.find((s) => s.id === prev.id);
          return updated || list[0] || null;
        });
      },
      (err) => {
        console.error('Firestore subscription error in Physician Dashboard:', err);
        setPermissionError(err.message || 'Permission denied reading patientSessions');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Sync physician note when active patient changes
  useEffect(() => {
    if (selectedPatient) {
      setPhysicianNote(selectedPatient.doctorNote || '');
      setFhirIndex(0);
    }
  }, [selectedPatient?.id]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (activeFilter === 'forwarded' && s.triageStatus !== 'forwarded_to_physician') return false;
      if (activeFilter === 'emergency' && s.calculatedPriority !== 'EMERGENCY') return false;
      if (activeFilter === 'high' && s.calculatedPriority !== 'HIGH') return false;
      if (activeFilter === 'pending' && s.status === 'confirmed') return false;
      if (activeFilter === 'completed' && s.status !== 'confirmed') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = s.patient?.name?.toLowerCase() || '';
        const complaint = s.chiefComplaint?.toLowerCase() || '';
        const id = s.patientId?.toLowerCase() || s.id.toLowerCase();
        return name.includes(q) || complaint.includes(q) || id.includes(q);
      }

      return true;
    });
  }, [sessions, activeFilter, searchQuery]);

  // Statistics Counts
  const stats = useMemo(() => {
    const total = sessions.length;
    const forwarded = sessions.filter((s) => s.triageStatus === 'forwarded_to_physician').length;
    const emergency = sessions.filter((s) => s.calculatedPriority === 'EMERGENCY').length;
    const high = sessions.filter((s) => s.calculatedPriority === 'HIGH').length;
    const pending = sessions.filter((s) => s.status !== 'confirmed' && s.status !== 'rejected').length;
    const completed = sessions.filter((s) => s.status === 'confirmed').length;
    return { total, forwarded, emergency, high, pending, completed };
  }, [sessions]);

  // Real FHIR Bundle for selected patient
  const fhirResources = useMemo(() => {
    if (!selectedPatient) return [];
    return generateRealFHIRResources(selectedPatient);
  }, [selectedPatient]);

  // Handle Doctor Decision: Accept / Edit / Reject / Complete
  const handleDoctorDecision = async (
    decision: 'accepted' | 'edited' | 'rejected',
    customNote?: string,
    updatedSummaryData?: any
  ) => {
    if (!selectedPatient) return;
    setActionLoading(true);

    try {
      const sessionRef = doc(db, 'patientSessions', selectedPatient.id);
      const noteToSave = customNote !== undefined ? customNote : physicianNote;

      const payload: any = {
        status: decision === 'rejected' ? 'rejected' : 'confirmed',
        doctorDecision: decision,
        doctorNote: noteToSave,
        doctorReviewedAt: new Date().toISOString(),
        doctorUid: currentUser?.uid || 'physician-station-1',
        doctorEmail: currentUser?.email || 'physician@medi-kiosk.demo',
        updatedAt: serverTimestamp()
      };

      if (updatedSummaryData) {
        payload.summary = updatedSummaryData;
        if (updatedSummaryData.history?.chiefComplaint) {
          payload.chiefComplaint = updatedSummaryData.history.chiefComplaint;
        }
      }

      await updateDoc(sessionRef, payload);

      setSuccessToast(
        decision === 'accepted'
          ? 'Intake accepted and consultation marked as confirmed!'
          : decision === 'edited'
          ? 'Clinical summary updated and confirmed by physician!'
          : 'Patient intake rejected with documentation saved.'
      );

      setIsEditModalOpen(false);
      setIsRejectModalOpen(false);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      console.error('Failed to commit physician decision:', err);
      alert(`Decision update failed: ${err?.message || 'Permission denied'}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Open Edit Modal with current values
  const handleOpenEditModal = () => {
    if (!selectedPatient) return;
    const summary = selectedPatient.clinicalSummary;
    setEditFormData({
      chiefComplaint: summary?.history?.chiefComplaint || selectedPatient.chiefComplaint || '',
      duration: summary?.history?.duration || '',
      symptoms: (summary?.history?.associatedSymptoms || []).join(', '),
      pastHistory: summary?.pastHistory || '',
      medications: summary?.medications || '',
      allergies: summary?.allergies || ''
    });
    setIsEditModalOpen(true);
  };

  // Save Edits
  const handleSaveEdits = async () => {
    if (!selectedPatient) return;
    const currentSummary = selectedPatient.clinicalSummary || ({} as any);

    const updatedSummary = {
      ...currentSummary,
      history: {
        ...(currentSummary.history || {}),
        chiefComplaint: editFormData.chiefComplaint,
        duration: editFormData.duration,
        associatedSymptoms: editFormData.symptoms.split(',').map((s) => s.trim()).filter(Boolean)
      },
      pastHistory: editFormData.pastHistory,
      medications: editFormData.medications,
      allergies: editFormData.allergies,
      status: 'confirmed'
    };

    await handleDoctorDecision('edited', physicianNote, updatedSummary);
  };

  // Copy FHIR JSON
  const handleCopyFhir = () => {
    if (fhirResources.length === 0) return;
    navigator.clipboard.writeText(JSON.stringify(fhirResources[fhirIndex] || fhirResources, null, 2));
    setCopiedFhir(true);
    setTimeout(() => setCopiedFhir(false), 2000);
  };

  return (
    <AyurvedaBackground variant="clinical" className="selection:bg-[#234e32] selection:text-white pb-16">
      <Header title="Physician Dashboard" backHref="/" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {/* Top Physician Workstation Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#344d3c]">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#234e32] text-white flex items-center justify-center shadow-lg shadow-[#234e32]/30 font-black border border-[#447a57]/40">
              <Stethoscope size={26} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-white flex items-center gap-2.5">
                Physician Clinical Workstation
                <span className="text-xs px-3 py-0.5 rounded-full bg-[#162e1e] text-[#a3e0b8] border border-[#385540] font-sans font-semibold tracking-normal">
                  Attending MD
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#a1b8a5]">
                Review triaged intakes, verify AI-assisted clinical drafts, inspect OCR reports, and confirm consultations.
              </p>
            </div>
          </div>

          {/* Doctor Station Badge & Sign Out */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#132018]/90 border border-[#344d3c] text-[#a3e0b8] text-xs font-semibold shadow-inner">
              <div className="w-2.5 h-2.5 rounded-full bg-[#447a57] animate-pulse" />
              <span>Portal: <strong className="text-white">Attending Physician</strong></span>
              <span className="text-[#556358]">•</span>
              <span className="font-mono text-[#a3e0b8]">{currentUser?.email || 'doctor@medi-kiosk.demo'}</span>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#17251c] hover:bg-[#b83b3b]/30 hover:border-[#b83b3b]/50 border border-[#344d3c] text-[#d8c5af] hover:text-white text-xs font-semibold transition shadow-sm"
              title="Sign out of Physician Workstation"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Error / Permission Alert */}
        {permissionError && (
          <div className="mt-6 rounded-2xl bg-[#fff5f5]/10 border border-[#b83b3b]/40 p-4 text-[#fca5a5] text-sm font-semibold flex items-center gap-3">
            <ShieldAlert size={20} className="shrink-0 text-[#fca5a5]" />
            <span>{permissionError}</span>
          </div>
        )}

        {/* Toast Alert */}
        {successToast && (
          <div className="mt-6 rounded-2xl bg-[#162e1e] border border-[#385540] p-4 text-[#a3e0b8] text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle2 size={20} className="text-[#447a57] shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* KPI Counter Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mt-8">
          {[
            {
              label: 'Forwarded to MD',
              value: stats.forwarded,
              color: 'border-[#3a6073]/60 bg-[#152a36]/85 text-[#93c5fd]',
              badge: 'Nurse Triaged',
              icon: Send,
              pulse: stats.forwarded > 0
            },
            {
              label: 'Emergency Cases',
              value: stats.emergency,
              color: 'border-[#b83b3b] bg-[#421414]/85 text-[#fca5a5]',
              badge: 'Immediate',
              icon: AlertOctagon,
              pulse: stats.emergency > 0
            },
            {
              label: 'High Priority',
              value: stats.high,
              color: 'border-[#c59b27]/60 bg-[#3a2d10]/85 text-[#fde047]',
              badge: 'Urgent',
              icon: AlertTriangle
            },
            {
              label: 'Awaiting Review',
              value: stats.pending,
              color: 'border-[#6f4827]/60 bg-[#2d1e12]/85 text-[#fdba74]',
              badge: 'Active Queue',
              icon: Clock
            },
            {
              label: 'Confirmed',
              value: stats.completed,
              color: 'border-[#234e32]/60 bg-[#162e1e]/85 text-[#86efac]',
              badge: 'Completed',
              icon: CheckCheck
            },
            {
              label: 'Total Intakes',
              value: stats.total,
              color: 'border-[#344d3c] bg-[#142319]/85 text-[#e8f1e6]',
              badge: 'All Time',
              icon: Layers
            }
          ].map((kpi) => (
            <div
              key={kpi.label}
              className={`rounded-2xl border p-4 flex flex-col justify-between shadow-md transition-all ${kpi.color}`}
            >
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider opacity-80 truncate">
                  {kpi.label}
                </span>
                <kpi.icon size={16} className={kpi.pulse ? 'animate-bounce text-rose-400' : 'opacity-70'} />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black">{kpi.value}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900/60 border border-slate-700/50">
                  {kpi.badge}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Main Workstation: Split-View (Queue on Left, Active Case on Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
          {/* Left Column: Patient Queue (5 cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            {/* Filter Pills & Search */}
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-4 shadow-xl space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search patient, complaint, or ID..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-teal-500 transition shadow-inner"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { id: 'forwarded', label: `Forwarded (${stats.forwarded})` },
                  { id: 'emergency', label: `Emergency (${stats.emergency})` },
                  { id: 'high', label: `High (${stats.high})` },
                  { id: 'pending', label: `Pending (${stats.pending})` },
                  { id: 'completed', label: `Completed (${stats.completed})` },
                  { id: 'all', label: `All (${stats.total})` }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                      activeFilter === f.id
                        ? 'bg-gradient-to-r from-teal-500 to-indigo-500 text-slate-950 shadow-md'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Queue List */}
            <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
              {loading ? (
                <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw size={16} className="animate-spin text-teal-400" />
                  <span>Loading live patient queue from Firestore...</span>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-2">
                  <ClipboardList size={32} className="mx-auto text-slate-600" />
                  <div className="font-extrabold text-sm text-slate-300">No Patient Intakes Found</div>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    No records match the selected filter. As kiosk patients submit or triage nurses forward cases, they will appear here in real-time.
                  </p>
                </div>
              ) : (
                filteredSessions.map((s) => {
                  const isSelected = selectedPatient?.id === s.id;
                  const isEmergency = s.calculatedPriority === 'EMERGENCY';
                  const isHigh = s.calculatedPriority === 'HIGH';
                  const isForwarded = s.triageStatus === 'forwarded_to_physician';

                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedPatient(s)}
                      className={`p-4 rounded-3xl border transition-all cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? 'bg-slate-900 border-teal-500 shadow-xl shadow-teal-500/10 ring-1 ring-teal-500/40'
                          : 'bg-slate-900/70 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700'
                      }`}
                    >
                      {/* Left accent bar for emergency/high */}
                      {isEmergency && (
                        <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-rose-500 animate-pulse" />
                      )}
                      {isHigh && !isEmergency && (
                        <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-amber-500" />
                      )}

                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-extrabold text-white truncate">
                              {s.patient?.name || 'Walk-in Patient'}
                            </h3>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {s.patient?.age ? `${s.patient.age}y` : ''} • {s.patient?.gender || 'Unknown'}
                            </span>
                          </div>
                          <div className="text-[11px] text-teal-400 font-mono mt-0.5">
                            ID: {s.patientId.slice(0, 10)}...
                          </div>
                        </div>

                        {/* Priority Badge */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                              isEmergency
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                                : isHigh
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}
                          >
                            {s.calculatedPriority}
                          </span>

                          <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                            <Clock size={10} /> {s.waitingTimeStr}
                          </span>
                        </div>
                      </div>

                      {/* Chief Complaint */}
                      <div className="mt-2.5 text-xs text-slate-300 font-medium line-clamp-1">
                        <strong className="text-slate-400">Complaint:</strong> {s.chiefComplaint || 'Not reported'}
                      </div>

                      {/* Red Flags count & Nurse status */}
                      <div className="flex flex-wrap items-center gap-2 mt-3 pt-2.5 border-t border-slate-800/80 text-[11px]">
                        {s.redFlags.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-950/60 border border-rose-800/40 text-rose-300 font-bold">
                            <AlertTriangle size={11} /> {s.redFlags.length} Flag{s.redFlags.length > 1 ? 's' : ''}
                          </span>
                        )}

                        {isForwarded ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/70 border border-indigo-700/50 text-indigo-300 font-bold">
                            <Send size={11} /> Triaged & Forwarded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/70 border border-slate-700 text-slate-400">
                            Awaiting Nurse Triage
                          </span>
                        )}

                        {s.doctorDecision && (
                          <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-700/50 text-emerald-300 font-bold capitalize">
                            <Check size={11} /> {s.doctorDecision}
                          </span>
                        )}
                      </div>

                      {/* Nurse Note Snippet if present */}
                      {s.triageNote && (
                        <div className="mt-2 text-[11px] text-indigo-200/90 bg-indigo-950/30 border border-indigo-900/40 rounded-xl p-2 line-clamp-2 italic">
                          "{s.triageNote}"
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed Patient Review Workspace (7 cols) */}
          <div className="lg:col-span-7">
            {!selectedPatient ? (
              <div className="h-[600px] rounded-3xl bg-slate-900/60 border border-slate-800 p-12 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-slate-800 flex items-center justify-center text-slate-500">
                  <Stethoscope size={32} />
                </div>
                <div className="text-base font-extrabold text-slate-300">Select a Patient to Review</div>
                <p className="text-xs text-slate-500 max-w-sm">
                  Click on any intake record in the queue on the left to inspect clinical answers, deterministic red flags, uploaded reports, and FHIR preview.
                </p>
              </div>
            ) : (
              <div className="rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col">
                {/* Case Header Card */}
                <div className="p-6 bg-slate-950/70 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-black text-white">
                        {selectedPatient.patient?.name || 'Walk-in Patient'}
                      </h2>
                      <span
                        className={`text-[11px] font-black px-3 py-0.5 rounded-full uppercase tracking-wider ${
                          selectedPatient.calculatedPriority === 'EMERGENCY'
                            ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/30 animate-pulse'
                            : selectedPatient.calculatedPriority === 'HIGH'
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-emerald-500 text-slate-950'
                        }`}
                      >
                        {selectedPatient.calculatedPriority}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1 font-mono">
                      <span>Age: {selectedPatient.patient?.age || 'Unknown'}</span>
                      <span>•</span>
                      <span>Gender: {selectedPatient.patient?.gender || 'Unknown'}</span>
                      <span>•</span>
                      <span>Lang: {selectedPatient.patient?.language || 'en'}</span>
                      <span>•</span>
                      <span>Submitted: {selectedPatient.submitTimeStr} ({selectedPatient.waitingTimeStr})</span>
                    </div>
                  </div>

                  {/* Decision Status Pill if already taken */}
                  {selectedPatient.doctorDecision && (
                    <div className="self-start sm:self-auto px-3.5 py-1.5 rounded-2xl bg-emerald-950 border border-emerald-700/60 text-emerald-300 text-xs font-extrabold flex items-center gap-2">
                      <CheckCircle2 size={15} />
                      <span>MD Decision: {selectedPatient.doctorDecision.toUpperCase()}</span>
                    </div>
                  )}
                </div>

                {/* Navigation Tabs */}
                <div className="flex border-b border-slate-800 bg-slate-900/90 overflow-x-auto px-4 gap-2 pt-2 text-xs">
                  {[
                    { id: 'summary', label: 'Clinical Summary', icon: FileText },
                    { id: 'answers', label: `Answers (${selectedPatient.answers?.length || 0})`, icon: ClipboardList },
                    { id: 'reports', label: `Reports (${selectedPatient.documents?.length || 0})`, icon: FileBadge },
                    { id: 'redflags', label: `Red Flags (${selectedPatient.redFlags?.length || 0})`, icon: AlertTriangle },
                    { id: 'timeline', label: 'Timeline', icon: Clock },
                    { id: 'fhir', label: 'FHIR R4', icon: FileCode }
                  ].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-3 font-bold border-b-2 transition whitespace-nowrap ${
                          activeTab === tab.id
                            ? 'border-teal-400 text-teal-300 bg-slate-800/40'
                            : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Icon size={14} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Tab Content Area */}
                <div className="p-6 overflow-y-auto max-h-[580px] space-y-6">
                  {/* TAB 1: Clinical Summary & Notes */}
                  {activeTab === 'summary' && (
                    <div className="space-y-6">
                      {/* AI Draft Badge & Safety Banner */}
                      <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3">
                        <Sparkles size={20} className="text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                              AI Draft — Requires Physician Verification
                            </span>
                          </div>
                          <p className="text-xs text-amber-200/80 mt-1 leading-relaxed">
                            No diagnosis or prescription is generated by this interface. This draft organizes patient-reported symptoms for attending clinician confirmation.
                          </p>
                        </div>
                      </div>

                      {/* Nurse Triage Handoff Note */}
                      {selectedPatient.triageNote && (
                        <div className="rounded-2xl bg-indigo-950/40 border border-indigo-800/40 p-4">
                          <div className="flex items-center justify-between gap-2 mb-1 text-[11px] font-extrabold uppercase tracking-wider text-indigo-300">
                            <span className="flex items-center gap-1.5">
                              <Send size={13} /> Triage Nurse Handoff Note
                            </span>
                            <span className="text-indigo-400 font-mono">
                              By {selectedPatient.triageNurseId || 'Nurse Desk'}
                            </span>
                          </div>
                          <p className="text-xs text-indigo-100 italic leading-relaxed">
                            "{selectedPatient.triageNote}"
                          </p>
                        </div>
                      )}

                      {/* Chief Complaint & Duration */}
                      <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800 space-y-1">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-teal-400">
                          Chief Complaint
                        </div>
                        <div className="text-base font-extrabold text-white">
                          {selectedPatient.clinicalSummary?.history?.chiefComplaint ||
                            selectedPatient.chiefComplaint ||
                            'None recorded'}
                        </div>
                        {selectedPatient.clinicalSummary?.history?.duration && (
                          <div className="text-xs text-slate-400 font-mono">
                            Duration: {selectedPatient.clinicalSummary.history.duration}
                          </div>
                        )}
                      </div>

                      {/* Symptoms & Medical History Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                            Associated Symptoms
                          </div>
                          <div className="text-xs text-slate-200">
                            {selectedPatient.clinicalSummary?.history?.associatedSymptoms?.length
                              ? selectedPatient.clinicalSummary.history.associatedSymptoms.join(', ')
                              : 'None reported'}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                            Medications Taken
                          </div>
                          <div className="text-xs text-slate-200">
                            {selectedPatient.clinicalSummary?.medications || 'None recorded'}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                            Known Allergies
                          </div>
                          <div className="text-xs text-rose-300 font-bold">
                            {selectedPatient.clinicalSummary?.allergies || 'No known allergies reported'}
                          </div>
                        </div>

                        <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                            Past Medical History
                          </div>
                          <div className="text-xs text-slate-200">
                            {selectedPatient.clinicalSummary?.pastHistory || 'None declared'}
                          </div>
                        </div>
                      </div>

                      {/* Attending Physician Clinical Impression Note */}
                      <div className="rounded-2xl bg-slate-950 p-4 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                            <Edit3 size={14} /> Attending Physician Clinical Note / Orders
                          </label>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Logged with your credentials
                          </span>
                        </div>
                        <textarea
                          rows={3}
                          value={physicianNote}
                          onChange={(e) => setPhysicianNote(e.target.value)}
                          placeholder="Add your clinical impression, examination notes, differential considerations, or further workup orders..."
                          className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-teal-500 transition"
                        />
                      </div>
                    </div>
                  )}

                  {/* TAB 2: Patient Answers (Raw Kiosk Telemetry) */}
                  {activeTab === 'answers' && (
                    <div className="space-y-4">
                      <div className="text-xs text-slate-400">
                        Verbatim telemetry answers captured directly from the patient at the intake kiosk.
                      </div>

                      {(!selectedPatient.answers || selectedPatient.answers.length === 0) ? (
                        <div className="p-8 rounded-2xl bg-slate-950 text-center text-xs text-slate-500">
                          No questionnaire answers recorded for this session.
                        </div>
                      ) : (
                        selectedPatient.answers.map((ans: Answer, i: number) => (
                          <div key={i} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                              <span>Question {i + 1}</span>
                              <span className="capitalize">{ans.inputMethod || 'kiosk'}</span>
                            </div>
                            <div className="text-xs font-bold text-teal-200">
                              {ans.questionText || ans.questionId}
                            </div>
                            <div className="text-xs text-white bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                              {ans.answer}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 3: Reports & OCR Extracted Data */}
                  {activeTab === 'reports' && (
                    <div className="space-y-6">
                      <div className="text-xs text-slate-400">
                        Uploaded clinical documents and automated OCR extracted lab telemetry.
                      </div>

                      {(!selectedPatient.documents || selectedPatient.documents.length === 0) ? (
                        <div className="p-8 rounded-2xl bg-slate-950 text-center text-xs text-slate-500">
                          No previous medical records or lab files uploaded.
                        </div>
                      ) : (
                        selectedPatient.documents.map((doc: MedicalDocument, idx: number) => (
                          <div key={idx} className="rounded-2xl bg-slate-950 border border-slate-800 p-5 space-y-4">
                            {/* Document Header */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-teal-950 border border-teal-800/60 flex items-center justify-center text-teal-400">
                                  <FileText size={20} />
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-white">{doc.fileName}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {doc.fileType} • {doc.size || 'Unknown size'}
                                  </div>
                                </div>
                              </div>

                              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                                Attached
                              </span>
                            </div>

                            {/* Extracted Lab Tests Table (only if present) */}
                            {doc.extractedData?.tests && doc.extractedData.tests.length > 0 ? (
                              <div className="space-y-2 pt-2 border-t border-slate-800">
                                <div className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                                  <Sparkles size={13} /> Extracted Clinical Findings (OCR)
                                </div>
                                <div className="rounded-xl border border-slate-800 overflow-hidden">
                                  <table className="w-full text-left text-[11px]">
                                    <thead className="bg-slate-900 text-slate-400 font-mono">
                                      <tr>
                                        <th className="p-2.5">Test Name</th>
                                        <th className="p-2.5">Result</th>
                                        <th className="p-2.5">Unit</th>
                                        <th className="p-2.5">Ref Range</th>
                                        <th className="p-2.5">Flag</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                      {doc.extractedData.tests.map((t, tIdx) => (
                                        <tr key={tIdx} className="hover:bg-slate-900/40">
                                          <td className="p-2.5 font-semibold text-white">{t.name}</td>
                                          <td className="p-2.5 font-mono text-teal-300 font-bold">{t.value}</td>
                                          <td className="p-2.5 text-slate-400">{t.unit}</td>
                                          <td className="p-2.5 font-mono text-slate-400">{t.referenceRange}</td>
                                          <td className="p-2.5">
                                            {t.flag ? (
                                              <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 font-bold text-[9px] border border-rose-800">
                                                {t.flag}
                                              </span>
                                            ) : (
                                              <span className="text-slate-500">—</span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-500 italic pt-1">
                                No automated laboratory values extracted from this attachment.
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 4: Deterministic Red Flags */}
                  {activeTab === 'redflags' && (
                    <div className="space-y-4">
                      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 text-xs text-slate-300">
                        <strong className="text-white">Deterministic Clinical Safety Engine:</strong> These alerts are triggered by hardcoded clinical rules and critical physiological keywords. AI cannot override or suppress these flags.
                      </div>

                      {(!selectedPatient.redFlags || selectedPatient.redFlags.length === 0) ? (
                        <div className="p-8 rounded-2xl bg-slate-950 text-center text-xs text-emerald-400 flex items-center justify-center gap-2">
                          <CheckCircle2 size={18} />
                          <span>No clinical red flags detected for this patient intake.</span>
                        </div>
                      ) : (
                        selectedPatient.redFlags.map((rf: RedFlag, i: number) => (
                          <div
                            key={i}
                            className={`p-4 rounded-2xl border flex items-start gap-3 ${
                              rf.severity === 'high'
                                ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                                : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                            }`}
                          >
                            <AlertTriangle size={20} className={rf.severity === 'high' ? 'text-rose-400 shrink-0 mt-0.5' : 'text-amber-400 shrink-0 mt-0.5'} />
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-xs uppercase tracking-wider text-white">
                                  {rf.type}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-950/80">
                                  {rf.severity.toUpperCase()}
                                </span>
                              </div>
                              <p className="text-xs leading-relaxed">{rf.description}</p>
                              {rf.detectedAt && (
                                <div className="text-[10px] text-slate-400 font-mono pt-1">
                                  Detected at: {new Date(rf.detectedAt).toLocaleTimeString()}
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 5: Chronological Timeline */}
                  {activeTab === 'timeline' && (
                    <div className="space-y-6">
                      <div className="text-xs text-slate-400">
                        Chronological progression of the patient through the MediKiosk care continuum.
                      </div>

                      <div className="relative pl-6 space-y-6 border-l-2 border-slate-800 ml-2">
                        {/* 1. Intake Started */}
                        <div className="relative">
                          <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-teal-500 ring-4 ring-slate-950" />
                          <div className="text-xs font-bold text-white">Intake Session Started</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {selectedPatient.submitTimeStr} (Kiosk OPD)
                          </div>
                          <p className="text-xs text-slate-300 mt-1">
                            Patient initiated consultation, verified language ({selectedPatient.patient?.language || 'en'}), and completed consent.
                          </p>
                        </div>

                        {/* 2. Answers Submitted */}
                        <div className="relative">
                          <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-teal-500 ring-4 ring-slate-950" />
                          <div className="text-xs font-bold text-white">Questionnaire Completed</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {selectedPatient.answers?.length || 0} answers recorded
                          </div>
                          <p className="text-xs text-slate-300 mt-1">
                            Chief complaint: "{selectedPatient.chiefComplaint || 'Not reported'}".
                          </p>
                        </div>

                        {/* 3. Reports Uploaded */}
                        {selectedPatient.documents && selectedPatient.documents.length > 0 && (
                          <div className="relative">
                            <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-teal-500 ring-4 ring-slate-950" />
                            <div className="text-xs font-bold text-white">Medical Reports Attached</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {selectedPatient.documents.length} document(s)
                            </div>
                          </div>
                        )}

                        {/* 4. Red Flags Evaluated */}
                        <div className="relative">
                          <div
                            className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full ring-4 ring-slate-950 ${
                              selectedPatient.calculatedPriority === 'EMERGENCY'
                                ? 'bg-rose-500'
                                : selectedPatient.calculatedPriority === 'HIGH'
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                          />
                          <div className="text-xs font-bold text-white">
                            Deterministic Priority: {selectedPatient.calculatedPriority}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {selectedPatient.priorityReason}
                          </div>
                        </div>

                        {/* 5. Nurse Triage Review */}
                        {selectedPatient.triageStatus === 'forwarded_to_physician' && (
                          <div className="relative">
                            <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-indigo-500 ring-4 ring-slate-950" />
                            <div className="text-xs font-bold text-indigo-300">
                              Nurse Triaged & Forwarded to Physician
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              Station: {selectedPatient.triageNurseId || 'Nurse Station 1'}
                              {selectedPatient.triageTimestamp && ` • ${new Date(selectedPatient.triageTimestamp).toLocaleTimeString()}`}
                            </div>
                            {selectedPatient.triageNote && (
                              <div className="mt-1 text-xs text-indigo-200 bg-indigo-950/40 p-2.5 rounded-xl border border-indigo-800/40 italic">
                                "{selectedPatient.triageNote}"
                              </div>
                            )}
                          </div>
                        )}

                        {/* 6. Physician Review */}
                        {selectedPatient.doctorDecision ? (
                          <div className="relative">
                            <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-400 ring-4 ring-slate-950" />
                            <div className="text-xs font-bold text-emerald-300">
                              Physician Review: {selectedPatient.doctorDecision.toUpperCase()}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              By {selectedPatient.doctorEmail || selectedPatient.doctorUid || 'Attending Physician'}
                              {selectedPatient.doctorReviewedAt && ` • ${new Date(selectedPatient.doctorReviewedAt).toLocaleTimeString()}`}
                            </div>
                            {selectedPatient.doctorNote && (
                              <div className="mt-1 text-xs text-emerald-200 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-800/40">
                                "{selectedPatient.doctorNote}"
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-slate-600 ring-4 ring-slate-950 animate-ping" />
                            <div className="text-xs font-bold text-amber-300">Awaiting Physician Confirmation</div>
                            <div className="text-[11px] text-slate-400">In review right now</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 6: Real FHIR R4 Preview */}
                  {activeTab === 'fhir' && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="text-xs text-slate-400">
                          Real-time FHIR R4 Bundle generated from this patient's actual Firestore document.
                        </div>
                        <button
                          onClick={handleCopyFhir}
                          className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 font-bold text-xs transition flex items-center gap-1.5 border border-slate-700"
                        >
                          {copiedFhir ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedFhir ? 'Copied!' : 'Copy JSON'}</span>
                        </button>
                      </div>

                      {/* Resource Selector Buttons */}
                      <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
                        {fhirResources.map((res: FHIRResource, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => setFhirIndex(idx)}
                            className={`px-3 py-1 rounded-lg font-mono font-bold transition whitespace-nowrap ${
                              idx === fhirIndex
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                            }`}
                          >
                            {res.resourceType}
                          </button>
                        ))}
                      </div>

                      {/* JSON Code Viewer */}
                      <div className="rounded-2xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs text-teal-300 overflow-x-auto max-h-[380px] shadow-inner">
                        <pre>{JSON.stringify(fhirResources[fhirIndex] || {}, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Action Bar: Accept / Edit / Reject / Complete */}
                <div className="p-4 sm:p-5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-400 font-mono">
                    Security: Authenticated Attending Physician
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Reject Button */}
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => setIsRejectModalOpen(true)}
                      className="px-4 py-2.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 font-bold text-xs transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                    >
                      <XCircle size={15} />
                      <span>Reject Intake</span>
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleOpenEditModal}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                    >
                      <Edit3 size={15} />
                      <span>Edit Summary</span>
                    </button>

                    {/* Accept / Complete Button */}
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleDoctorDecision('accepted')}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 hover:from-teal-400 hover:to-emerald-300 text-slate-950 font-black text-xs transition disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-teal-500/25"
                    >
                      <CheckCheck size={16} />
                      <span>{actionLoading ? 'Saving Decision...' : 'Accept & Complete Consultation'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Clinical Summary Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                <Edit3 size={18} className="text-teal-400" />
                <span>Edit Clinical Summary — {selectedPatient?.patient?.name}</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-300 block mb-1">Chief Complaint</label>
                <input
                  type="text"
                  value={editFormData.chiefComplaint}
                  onChange={(e) => setEditFormData({ ...editFormData, chiefComplaint: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Duration</label>
                <input
                  type="text"
                  value={editFormData.duration}
                  onChange={(e) => setEditFormData({ ...editFormData, duration: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Associated Symptoms (comma separated)</label>
                <input
                  type="text"
                  value={editFormData.symptoms}
                  onChange={(e) => setEditFormData({ ...editFormData, symptoms: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Past Medical History</label>
                <textarea
                  rows={2}
                  value={editFormData.pastHistory}
                  onChange={(e) => setEditFormData({ ...editFormData, pastHistory: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Medications</label>
                <input
                  type="text"
                  value={editFormData.medications}
                  onChange={(e) => setEditFormData({ ...editFormData, medications: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-300 block mb-1">Allergies</label>
                <input
                  type="text"
                  value={editFormData.allergies}
                  onChange={(e) => setEditFormData({ ...editFormData, allergies: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleSaveEdits}
                className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-xs shadow-md"
              >
                {actionLoading ? 'Saving...' : 'Save & Confirm Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-rose-300 flex items-center gap-2">
                <XCircle size={18} />
                <span>Reject Patient Intake</span>
              </h3>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Please enter the clinical reason for rejecting this intake record. The reason will be stored in the patient audit record.
            </p>

            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Incomplete questionnaire, referred to acute trauma bay, duplicate entry..."
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-rose-500"
            />

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold text-xs"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading || !rejectionReason.trim()}
                onClick={() => handleDoctorDecision('rejected', rejectionReason)}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-md disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AyurvedaBackground>
  );
}

export default function DoctorDashboard() {
  return (
    <ProtectedRoute allowedRoles={['doctor']}>
      <DoctorDashboardContent />
    </ProtectedRoute>
  );
}
