"use client";

import Header from '@/components/Header';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Filter, 
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
  UserCheck, 
  Sparkles, 
  Info,
  Calendar,
  LogIn,
  LogOut
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect, useMemo } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import type { PatientSession, RedFlag } from '@/lib/types';

// Priority Classification deterministic helper
export type TriagePriority = 'EMERGENCY' | 'HIGH' | 'NORMAL';

export function calculatePriority(redFlags?: RedFlag[]): { priority: TriagePriority; label: string; reason: string } {
  if (!redFlags || redFlags.length === 0) {
    return { priority: 'NORMAL', label: 'Normal Priority', reason: 'No clinical red flags detected' };
  }

  // Check for critical / urgent red flags
  const isEmergency = redFlags.some(rf => 
    rf.id?.toLowerCase().includes('urgent') || 
    rf.type?.toLowerCase().includes('urgent') || 
    rf.type?.toLowerCase().includes('emergency') || 
    rf.description?.toLowerCase().includes('emergency') ||
    rf.description?.toLowerCase().includes('immediate') ||
    rf.severity === 'high' && (
      rf.description?.toLowerCase().includes('chest pain') ||
      rf.description?.toLowerCase().includes('breath') ||
      rf.description?.toLowerCase().includes('unconscious')
    )
  );

  if (isEmergency) {
    return { 
      priority: 'EMERGENCY', 
      label: 'Emergency (Immediate Attention)', 
      reason: redFlags[0]?.description || 'Urgent physiological distress alert' 
    };
  }

  // Check for high priority red flags
  const isHigh = redFlags.some(rf => rf.severity === 'high' || rf.severity === 'medium');
  if (isHigh) {
    return { 
      priority: 'HIGH', 
      label: 'High Priority (Expedite)', 
      reason: redFlags[0]?.description || 'Clinical warning flag detected' 
    };
  }

  return { priority: 'NORMAL', label: 'Normal Priority', reason: 'Routine care intake' };
}

// Helper to format waiting time
function formatWaitingTime(dateInput?: any): string {
  if (!dateInput) return 'Just now';
  let date: Date;
  if (dateInput?.toDate && typeof dateInput.toDate === 'function') {
    date = dateInput.toDate();
  } else if (dateInput?.seconds) {
    date = new Date(dateInput.seconds * 1000);
  } else {
    date = new Date(dateInput);
  }

  if (isNaN(date.getTime())) return 'Just now';

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''}`;
  const hours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  return `${hours}h ${remainingMins}m`;
}

// Helper to format submission clock time
function formatSubmitTime(dateInput?: any): string {
  if (!dateInput) return 'Recent';
  let date: Date;
  if (dateInput?.toDate && typeof dateInput.toDate === 'function') {
    date = dateInput.toDate();
  } else if (dateInput?.seconds) {
    date = new Date(dateInput.seconds * 1000);
  } else {
    date = new Date(dateInput);
  }
  if (isNaN(date.getTime())) return 'Recent';

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface EnrichedSession extends PatientSession {
  id: string;
  patientId: string;
  language?: string;
  createdAt?: any;
  updatedAt?: any;
  calculatedPriority: TriagePriority;
  priorityReason: string;
  waitingTimeStr: string;
  submitTimeStr: string;
}

function NurseDashboardContent() {
  const { currentUser, role: userRole, logout } = useAuth();
  const [sessions, setSessions] = useState<EnrichedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  // Filters & Search
  const [activeFilter, setActiveFilter] = useState<'all' | 'emergency' | 'high' | 'normal' | 'pending' | 'forwarded'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Active selected patient for detailed triage review
  const [selectedPatient, setSelectedPatient] = useState<EnrichedSession | null>(null);
  const [triageNote, setTriageNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Real-time Firestore subscription to patientSessions
  useEffect(() => {
    setLoading(true);
    setPermissionError(null);

    const sessionsRef = collection(db, 'patientSessions');
    
    // Subscribe in real-time
    const unsubscribe = onSnapshot(
      sessionsRef,
      (snapshot) => {
        const list: EnrichedSession[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const redFlags: RedFlag[] = data.redFlags || [];
          const { priority, reason } = calculatePriority(redFlags);
          const rawTime = data.createdAt || data.updatedAt;

          list.push({
            id: docSnap.id,
            patientId: data.patientId || docSnap.id,
            patient: data.patient,
            language: data.language,
            chiefComplaint: data.chiefComplaint || 'Not reported',
            answers: data.answers || [],
            documents: data.documents || [],
            redFlags: redFlags,
            clinicalSummary: data.summary || data.clinicalSummary,
            triageStatus: data.triageStatus || 'pending_review',
            triageNote: data.triageNote || '',
            triageTimestamp: data.triageTimestamp,
            triageNurseId: data.triageNurseId,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            calculatedPriority: priority,
            priorityReason: reason,
            waitingTimeStr: formatWaitingTime(rawTime),
            submitTimeStr: formatSubmitTime(rawTime),
          });
        });

        // Priority ordering: EMERGENCY first, then HIGH, then NORMAL
        // Within same priority, oldest waiting time first (FIFO)
        const priorityScore: Record<TriagePriority, number> = {
          EMERGENCY: 3,
          HIGH: 2,
          NORMAL: 1
        };

        list.sort((a, b) => {
          // If different priorities, higher priority first
          if (priorityScore[b.calculatedPriority] !== priorityScore[a.calculatedPriority]) {
            return priorityScore[b.calculatedPriority] - priorityScore[a.calculatedPriority];
          }
          // Sort by creation time ascending (longest waiting first)
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeA - timeB;
        });

        setSessions(list);
        setLoading(false);
        setPermissionError(null);

        // Update selected patient if already open
        if (selectedPatient) {
          const updated = list.find(s => s.id === selectedPatient.id);
          if (updated) setSelectedPatient(updated);
        }
      },
      (error) => {
        console.error('Firestore onSnapshot error:', error);
        setLoading(false);
        if (error.code === 'permission-denied') {
          setPermissionError('Permission denied: You must be authenticated as a verified Triage Nurse to read the patient intake queue.');
        } else {
          setPermissionError(error.message);
        }
      }
    );

    return () => unsubscribe();
  }, [userRole]);

  // Sync selected patient note state when patient is selected
  useEffect(() => {
    if (selectedPatient) {
      setTriageNote(selectedPatient.triageNote || '');
    }
  }, [selectedPatient?.id]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Filter tab check
      if (activeFilter === 'emergency' && s.calculatedPriority !== 'EMERGENCY') return false;
      if (activeFilter === 'high' && s.calculatedPriority !== 'HIGH') return false;
      if (activeFilter === 'normal' && s.calculatedPriority !== 'NORMAL') return false;
      if (activeFilter === 'pending' && s.triageStatus === 'forwarded_to_physician') return false;
      if (activeFilter === 'forwarded' && s.triageStatus !== 'forwarded_to_physician') return false;

      // Search query check
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
    const emergency = sessions.filter(s => s.calculatedPriority === 'EMERGENCY').length;
    const high = sessions.filter(s => s.calculatedPriority === 'HIGH').length;
    const normal = sessions.filter(s => s.calculatedPriority === 'NORMAL').length;
    const pending = sessions.filter(s => s.triageStatus !== 'forwarded_to_physician').length;
    const forwarded = sessions.filter(s => s.triageStatus === 'forwarded_to_physician').length;
    return { total, emergency, high, normal, pending, forwarded };
  }, [sessions]);

  // Nurse Actions: Save note, Mark reviewed, Forward to Physician
  const handleUpdateTriage = async (
    newStatus: 'pending_review' | 'reviewed' | 'forwarded_to_physician',
    customNote?: string
  ) => {
    if (!selectedPatient) return;
    setActionLoading(true);

    try {
      const sessionRef = doc(db, 'patientSessions', selectedPatient.id);
      const noteToSave = customNote !== undefined ? customNote : triageNote;
      
      // Strict RBAC payload: affectedKeys().hasOnly(['triageStatus', 'triageNote', 'triageTimestamp', 'triageNurseId'])
      const payload = {
        triageStatus: newStatus,
        triageNote: noteToSave,
        triageTimestamp: new Date().toISOString(),
        triageNurseId: currentUser?.uid || 'nurse-station-1'
      };

      await updateDoc(sessionRef, payload);

      setSuccessToast(
        newStatus === 'forwarded_to_physician' 
          ? 'Patient intake successfully triaged & forwarded to attending physician!' 
          : newStatus === 'reviewed' 
          ? 'Triage review saved and patient marked as Reviewed.'
          : 'Triage note updated.'
      );

      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      console.error('Failed to update triage status:', err);
      alert(`Update failed: ${err?.message || 'Permission denied'}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <AyurvedaBackground variant="clinical" className="selection:bg-[#234e32] selection:text-white pb-16">
      <Header title="Triage Nurse Dashboard" backHref="/" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        {/* Top Station Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#344d3c]">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#234e32] text-white flex items-center justify-center shadow-lg shadow-[#234e32]/30 font-extrabold border border-[#447a57]/40">
                <Activity size={26} className="animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-white flex items-center gap-2.5">
                  Emergency & Intake Triage
                  <span className="text-xs px-3 py-0.5 rounded-full bg-[#162e1e] text-[#a3e0b8] border border-[#385540] font-sans font-semibold tracking-normal">
                    Live Queue
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-[#a1b8a5]">
                  Deterministic triage engine based on clinical red-flag detection & real-time intake telemetry.
                </p>
              </div>
            </div>
          </div>

          {/* Nurse Authentication Status Badge */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#132018]/90 border border-[#344d3c] text-[#a3e0b8] text-xs font-semibold shadow-inner">
              <div className="w-2.5 h-2.5 rounded-full bg-[#447a57] animate-ping" />
              <span>Station: <strong>Nurse Triage Desk</strong></span>
              <span className="text-[#556358]">•</span>
              <span className="font-mono text-white">{currentUser?.email || 'nurse@medi-kiosk.demo'}</span>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-[#17251c] hover:bg-[#b83b3b]/30 hover:border-[#b83b3b]/50 border border-[#344d3c] text-[#d8c5af] hover:text-white text-xs font-semibold transition shadow-sm"
              title="Sign out"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Permission / Auth Banner if not authenticated as nurse */}
        {permissionError && (
          <div className="mt-6 rounded-3xl bg-amber-500/10 border border-amber-500/30 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-amber-300">
              <ShieldAlert size={26} className="shrink-0" />
              <div>
                <div className="font-extrabold text-sm text-white">Staff Verification Required</div>
                <div className="text-xs text-amber-200/80">{permissionError}</div>
              </div>
            </div>
            <a
              href="/login"
              className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs transition shrink-0 shadow-md inline-flex items-center gap-2"
            >
              <LogIn size={15} />
              <span>Go to Staff Sign In</span>
            </a>
          </div>
        )}

        {/* Toast Alert */}
        {successToast && (
          <div className="mt-6 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 p-4 text-emerald-200 text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Priority & Queue Statistics KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mt-8">
          {[
            { 
              label: 'Total Queue', 
              value: stats.total, 
              color: 'border-[#344d3c] bg-[#142319]/85 text-[#e8f1e6]', 
              badge: 'Real-time',
              icon: User 
            },
            { 
              label: 'Emergency', 
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
              label: 'Normal', 
              value: stats.normal, 
              color: 'border-[#234e32]/60 bg-[#162e1e]/85 text-[#86efac]', 
              badge: 'Routine',
              icon: Check 
            },
            { 
              label: 'Awaiting Triage', 
              value: stats.pending, 
              color: 'border-[#6f4827]/60 bg-[#2d1e12]/85 text-[#fdba74]', 
              badge: 'Pending',
              icon: Clock 
            },
            { 
              label: 'Forwarded', 
              value: stats.forwarded, 
              color: 'border-[#3a6073]/60 bg-[#152a36]/85 text-[#93c5fd]', 
              badge: 'With MD',
              icon: UserCheck 
            },
          ].map((card) => (
            <div 
              key={card.label} 
              className={`rounded-3xl border p-4 sm:p-5 flex flex-col justify-between transition relative overflow-hidden backdrop-blur-sm ${card.color}`}
            >
              {card.pulse && (
                <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#b83b3b] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#b83b3b]"></span>
                </span>
              )}
              <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider opacity-75 mb-2">
                <span>{card.label}</span>
                <card.icon size={15} />
              </div>
              <div className="text-3xl sm:text-4xl font-black tracking-tight">{card.value}</div>
              <div className="text-[10px] font-bold mt-2 opacity-65 uppercase tracking-widest">{card.badge}</div>
            </div>
          ))}
        </div>

        {/* Filter Bar and Search */}
        <div className="mt-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            {[
              { id: 'all', label: 'All Patients', count: stats.total },
              { id: 'emergency', label: '🚨 Emergency', count: stats.emergency },
              { id: 'high', label: '⚠️ High', count: stats.high },
              { id: 'normal', label: 'Normal', count: stats.normal },
              { id: 'pending', label: 'Pending Review', count: stats.pending },
              { id: 'forwarded', label: 'Forwarded', count: stats.forwarded },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id as any)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 border ${
                  activeFilter === f.id
                    ? 'bg-[#234e32] text-white border-[#386b47] shadow-md shadow-[#234e32]/30'
                    : 'bg-[#132018]/85 hover:bg-[#192b1f] text-[#a1b8a5] border-[#344d3c]'
                }`}
              >
                <span>{f.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  activeFilter === f.id ? 'bg-[#0d1610] text-[#a3e0b8]' : 'bg-[#1e3325] text-[#829277]'
                }`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[260px] md:min-w-[320px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#829277]" />
            <input
              type="text"
              placeholder="Search by name, ID, or complaint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl bg-[#132018]/90 border border-[#344d3c] pl-11 pr-4 py-2.5 text-xs text-white placeholder:text-[#6b7c6e] focus:outline-none focus:ring-2 focus:ring-[#234e32] transition font-medium"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')} 
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#829277] hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Patient Queue List */}
        <div className="mt-6">
          {loading ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-800/30 p-16 text-center text-slate-400">
              <RefreshCw size={28} className="animate-spin mx-auto mb-3 text-teal-400" />
              <div className="text-sm font-semibold">Connecting to Firestore patientSessions...</div>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-800 bg-slate-800/20 p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-4">
                <User size={28} />
              </div>
              <h3 className="text-lg font-extrabold text-white mb-1">No Patients Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                {searchQuery || activeFilter !== 'all' 
                  ? 'No patient records match the currently selected filter criteria.' 
                  : 'The patient queue is currently empty. Patients who submit their intake from the kiosk will automatically appear here in real time.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setActiveFilter('all'); }}
                  className="px-4 py-2 rounded-xl bg-slate-700 text-xs font-bold hover:bg-slate-600 transition"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3.5">
              {filteredSessions.map((patient) => {
                const isEmergency = patient.calculatedPriority === 'EMERGENCY';
                const isHigh = patient.calculatedPriority === 'HIGH';
                const isForwarded = patient.triageStatus === 'forwarded_to_physician';
                const isReviewed = patient.triageStatus === 'reviewed';

                return (
                  <div
                    key={patient.id}
                    className={`rounded-3xl border p-5 sm:p-6 transition-all duration-200 bg-slate-800/50 hover:bg-slate-800 backdrop-blur-md flex flex-col lg:flex-row lg:items-center justify-between gap-5 ${
                      isEmergency 
                        ? 'border-rose-500/50 hover:border-rose-400 shadow-lg shadow-rose-950/20 bg-rose-950/10' 
                        : isHigh 
                        ? 'border-amber-500/40 hover:border-amber-400' 
                        : 'border-slate-700/70 hover:border-slate-600'
                    }`}
                  >
                    {/* Left: Priority Badge & Patient Demographic */}
                    <div className="flex items-start gap-4 min-w-0">
                      {/* Priority Indicator Pill */}
                      <div className="pt-0.5 shrink-0">
                        {isEmergency ? (
                          <div className="px-3 py-2 rounded-2xl bg-rose-600 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-rose-600/30 animate-pulse">
                            <AlertOctagon size={15} />
                            <span>Emergency</span>
                          </div>
                        ) : isHigh ? (
                          <div className="px-3 py-2 rounded-2xl bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-amber-500/20">
                            <AlertTriangle size={15} />
                            <span>High Priority</span>
                          </div>
                        ) : (
                          <div className="px-3 py-2 rounded-2xl bg-slate-700/80 text-emerald-300 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 border border-emerald-500/30">
                            <Check size={14} />
                            <span>Normal</span>
                          </div>
                        )}
                      </div>

                      {/* Patient Details */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h2 className="text-lg font-extrabold text-white truncate">
                            {patient.patient?.name || 'Anonymous Patient'}
                          </h2>
                          <span className="text-xs px-2.5 py-0.5 rounded-lg bg-slate-700/70 text-slate-300 font-medium">
                            {patient.patient?.age ? `${patient.patient.age} yrs` : 'Age: —'} • {patient.patient?.gender || '—'}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            ID: {patient.patientId ? patient.patientId.slice(0, 8) : patient.id.slice(0, 8)}...
                          </span>
                        </div>

                        {/* Chief Complaint */}
                        <div className="mt-2 text-sm">
                          <span className="text-slate-400 font-medium">Chief Complaint: </span>
                          <span className="text-teal-200 font-bold">{patient.chiefComplaint}</span>
                        </div>

                        {/* Red Flags preview tag */}
                        {patient.redFlags && patient.redFlags.length > 0 && (
                          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                            {patient.redFlags.map((rf, idx) => (
                              <span 
                                key={idx} 
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold"
                              >
                                <ShieldAlert size={13} />
                                <span>{rf.description}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Time, Status, & Triage Action */}
                    <div className="flex items-center justify-between lg:justify-end gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-700/60 shrink-0">
                      {/* Waiting Time & Submitted Timestamp */}
                      <div className="text-left lg:text-right">
                        <div className="flex items-center lg:justify-end gap-1.5 text-xs text-slate-400 font-medium">
                          <Clock size={13} />
                          <span>Waiting: <strong className="text-white">{patient.waitingTimeStr}</strong></span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Submitted at {patient.submitTimeStr}
                        </div>
                      </div>

                      {/* Triage Status Pill */}
                      <div>
                        {isForwarded ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-extrabold">
                            <Send size={13} /> Forwarded to Physician
                          </span>
                        ) : isReviewed ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-teal-500/20 border border-teal-500/40 text-teal-300 text-xs font-extrabold">
                            <CheckCircle2 size={13} /> Triage Reviewed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-extrabold">
                            <Clock size={13} /> Awaiting Triage
                          </span>
                        )}
                      </div>

                      {/* Open Triage Action Button */}
                      <button
                        onClick={() => setSelectedPatient(patient)}
                        className="px-4 py-2.5 rounded-2xl bg-slate-700 hover:bg-teal-500 hover:text-slate-950 text-white font-extrabold text-xs transition duration-150 flex items-center gap-1.5 shadow-md"
                      >
                        <span>Open Triage</span>
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Patient Triage Detail Modal / Drawer */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-800/40">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center font-extrabold">
                  <Stethoscope size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-black text-white">
                      {selectedPatient.patient?.name || 'Patient Intake Record'}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase ${
                      selectedPatient.calculatedPriority === 'EMERGENCY'
                        ? 'bg-rose-500 text-white'
                        : selectedPatient.calculatedPriority === 'HIGH'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {selectedPatient.calculatedPriority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ID: {selectedPatient.patientId} • Submitted: {selectedPatient.submitTimeStr} ({selectedPatient.waitingTimeStr} ago)
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedPatient(null)}
                className="w-10 h-10 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 overflow-y-auto space-y-6 scrollbar-thin">
              {/* Red Flags Alert Card if present */}
              {selectedPatient.redFlags && selectedPatient.redFlags.length > 0 && (
                <div className="rounded-2xl bg-rose-950/40 border border-rose-500/40 p-5 text-rose-200">
                  <div className="flex items-center gap-2 font-extrabold text-sm text-rose-300 mb-2">
                    <AlertOctagon size={18} />
                    <span>Deterministic Red Flag Engine Detections</span>
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {selectedPatient.redFlags.map((rf, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-rose-400 font-bold">•</span>
                        <span>
                          <strong>{rf.type || 'Alert'}:</strong> {rf.description} (Severity: {rf.severity})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Patient Basic Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl bg-slate-800/50 border border-slate-700/60 p-3.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Age / Gender</div>
                  <div className="text-sm font-extrabold text-white mt-1">
                    {selectedPatient.patient?.age || '—'} yrs • {selectedPatient.patient?.gender || '—'}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-800/50 border border-slate-700/60 p-3.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Language</div>
                  <div className="text-sm font-extrabold text-white mt-1 uppercase">
                    {selectedPatient.language || selectedPatient.patient?.language || 'English'}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-800/50 border border-slate-700/60 p-3.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Contact</div>
                  <div className="text-sm font-extrabold text-white mt-1">
                    {selectedPatient.patient?.contact || 'Not provided'}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-800/50 border border-slate-700/60 p-3.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Current Triage Status</div>
                  <div className="text-sm font-extrabold text-teal-300 mt-1 capitalize">
                    {selectedPatient.triageStatus?.replace(/_/g, ' ') || 'Pending'}
                  </div>
                </div>
              </div>

              {/* Chief Complaint & History of Present Illness */}
              <div className="rounded-2xl bg-slate-800/40 border border-slate-700/60 p-5">
                <div className="text-xs font-bold text-teal-400 uppercase tracking-wider mb-2">
                  Primary Chief Complaint
                </div>
                <div className="text-lg font-black text-white">
                  {selectedPatient.chiefComplaint}
                </div>
                {selectedPatient.clinicalSummary?.history?.duration && (
                  <div className="text-xs text-slate-400 mt-1">
                    <strong>Duration:</strong> {selectedPatient.clinicalSummary.history.duration}
                  </div>
                )}
              </div>

              {/* Clinical Interview Transcript / Adaptive Question Answers */}
              <div className="rounded-2xl bg-slate-800/40 border border-slate-700/60 p-5">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Patient Intake Answers ({selectedPatient.answers?.length || 0} Responses)
                </div>
                {selectedPatient.answers && selectedPatient.answers.length > 0 ? (
                  <div className="space-y-3">
                    {selectedPatient.answers.map((ans, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-xs">
                        <div className="text-slate-400 font-semibold mb-1">
                          Q{idx + 1}: {ans.questionText || ans.questionId}
                        </div>
                        <div className="text-white font-bold">
                          A: {ans.answer}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic">No structured question responses recorded.</div>
                )}
              </div>

              {/* Uploaded Documents & Medical History */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Medical History */}
                <div className="rounded-2xl bg-slate-800/40 border border-slate-700/60 p-4 space-y-2 text-xs">
                  <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                    Clinical Background
                  </div>
                  <div>
                    <span className="text-slate-400">Allergies: </span>
                    <span className="text-white font-semibold">
                      {selectedPatient.clinicalSummary?.allergies || 'None reported'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Medications: </span>
                    <span className="text-white font-semibold">
                      {selectedPatient.clinicalSummary?.medications || 'None reported'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Past History: </span>
                    <span className="text-white font-semibold">
                      {selectedPatient.clinicalSummary?.pastHistory || 'None reported'}
                    </span>
                  </div>
                </div>

                {/* Uploaded Documents */}
                <div className="rounded-2xl bg-slate-800/40 border border-slate-700/60 p-4 space-y-2 text-xs">
                  <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                    Uploaded Documents ({selectedPatient.documents?.length || 0})
                  </div>
                  {selectedPatient.documents && selectedPatient.documents.length > 0 ? (
                    <div className="space-y-1.5">
                      {selectedPatient.documents.map((doc, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-slate-200">
                          <FileText size={14} className="text-teal-400 shrink-0" />
                          <span className="truncate font-semibold">{doc.fileName}</span>
                          <span className="text-[10px] text-slate-400">({doc.size})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 italic">No previous lab documents attached.</div>
                  )}
                </div>
              </div>

              {/* Triage Nurse Action Workspace */}
              <div className="rounded-2xl bg-teal-950/30 border border-teal-500/30 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-2">
                    <Activity size={15} />
                    <span>Nurse Triage Assessment & Audit Note</span>
                  </div>
                  {selectedPatient.triageTimestamp && (
                    <span className="text-[10px] text-slate-400">
                      Last Action: {new Date(selectedPatient.triageTimestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {/* Quick note templates */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-slate-400 text-[11px]">Quick Templates:</span>
                  {[
                    'Vitals stable, routine evaluation.',
                    'Urgent: flagged for immediate doctor review.',
                    'Awaiting physician examination.',
                    'Patient placed in bed 4.'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTriageNote(prev => prev ? `${prev} ${preset}` : preset)}
                      className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-teal-300 text-[11px] font-semibold border border-teal-800/40 transition"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>

                {/* Triage Note Textarea */}
                <div>
                  <textarea
                    rows={3}
                    value={triageNote}
                    onChange={(e) => setTriageNote(e.target.value)}
                    placeholder="Enter triage observation, preliminary vitals, or notes for physician..."
                    className="w-full rounded-xl bg-slate-900 border border-teal-800/60 p-3.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 transition"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleUpdateTriage(selectedPatient.triageStatus || 'pending_review')}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition disabled:opacity-50"
                  >
                    Save Note Only
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleUpdateTriage('reviewed')}
                    className="px-4 py-2.5 rounded-xl bg-teal-600/30 hover:bg-teal-600/50 border border-teal-500/40 text-teal-200 text-xs font-bold transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={15} />
                    Mark Reviewed
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleUpdateTriage('forwarded_to_physician')}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-teal-500/25 hover:brightness-110 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Send size={15} />
                    {actionLoading ? 'Updating Firestore...' : 'Forward to Physician'}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-xs text-slate-400">
              <span className="font-mono">Security: Affected keys strictly restricted to triage fields</span>
              <button
                onClick={() => setSelectedPatient(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AyurvedaBackground>
  );
}

export default function NurseDashboard() {
  return (
    <ProtectedRoute allowedRoles={['nurse']}>
      <NurseDashboardContent />
    </ProtectedRoute>
  );
}
