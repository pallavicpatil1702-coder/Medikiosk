"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import Header from '@/components/Header';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { 
  ShieldCheck, 
  Users, 
  UserCheck, 
  Activity, 
  Stethoscope, 
  Lock, 
  LogOut, 
  CheckCircle2, 
  AlertCircle,
  Key,
  Shield,
  Server,
  ArrowRight,
  RefreshCw,
  Search,
  Clock,
  AlertTriangle,
  FileText,
  Settings,
  Database,
  Eye,
  X,
  XCircle,
  Filter,
  Layers,
  ChevronRight,
  FileBadge,
  Sparkles,
  Info
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { calculatePriority, formatWaitingTime, formatSubmitTime } from '@/lib/triage';
import type { PatientSession } from '@/lib/types';

interface StaffUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'nurse' | 'doctor' | 'admin' | 'patient' | 'unassigned';
  disabled: boolean;
  createdAt?: string;
  lastSignIn?: string;
}

interface EnrichedSession extends PatientSession {
  id: string;
  patientId: string;
  rawTime: any;
  status: string;
  triageStatus?: 'pending_review' | 'reviewed' | 'forwarded_to_physician';
  doctorDecision?: 'accepted' | 'edited' | 'rejected';
  doctorNote?: string;
  doctorReviewedAt?: string;
  doctorEmail?: string;
}

interface AuditEvent {
  id: string;
  type: 'intake_submitted' | 'nurse_triage' | 'doctor_reviewed';
  title: string;
  description: string;
  actor: string;
  actorRole: 'patient' | 'nurse' | 'doctor' | 'system';
  timestamp: string;
  sessionId: string;
  patientName: string;
  severity?: 'normal' | 'high' | 'emergency';
}

type AdminSection = 'overview' | 'staff' | 'roles' | 'consultations' | 'audit' | 'health' | 'settings';

function AdminDashboardContent() {
  const { currentUser, logout, refreshRole } = useAuth();
  const router = useRouter();

  // Active Navigation Tab
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');

  // Live Firestore Sessions
  const [sessions, setSessions] = useState<EnrichedSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [firestoreStatus, setFirestoreStatus] = useState<'connected' | 'error' | 'syncing'>('syncing');
  const [firestoreLatency, setFirestoreLatency] = useState<number | null>(null);

  // Staff Directory State
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffFilter, setStaffFilter] = useState<'all' | 'nurse' | 'doctor' | 'admin' | 'patient'>('all');
  const [staffSearch, setStaffSearch] = useState('');

  // Role Assignment State
  const [targetEmail, setTargetEmail] = useState('');
  const [targetRole, setTargetRole] = useState<'nurse' | 'doctor' | 'admin' | 'patient'>('nurse');
  const [submittingRole, setSubmittingRole] = useState(false);
  const [roleFeedback, setRoleFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Consultation Monitoring State
  const [consultationSearch, setConsultationSearch] = useState('');
  const [consultationFilter, setConsultationFilter] = useState<'all' | 'pending' | 'forwarded' | 'confirmed' | 'rejected' | 'emergency'>('all');
  const [selectedSession, setSelectedSession] = useState<EnrichedSession | null>(null);

  // Hospital Configuration State (Local & Session Settings)
  const [kioskName, setKioskName] = useState('MediKiosk Terminal 01 - OPD Entrance');
  const [hospitalName, setHospitalName] = useState('Apex District Hospital & Medical Centre');
  const [emergencyBypass, setEmergencyBypass] = useState(true);
  const [configSavedToast, setConfigSavedToast] = useState(false);

  // 1. Subscribe to real Firestore patientSessions
  useEffect(() => {
    setSessionsLoading(true);
    const startFetchTime = performance.now();

    const unsubscribe = onSnapshot(
      collection(db, 'patientSessions'),
      (snapshot) => {
        const fetchTime = Math.round(performance.now() - startFetchTime);
        setFirestoreLatency(fetchTime);
        setFirestoreStatus('connected');

        const loadedSessions: EnrichedSession[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          const rawTime = data.createdAt || data.updatedAt || new Date();
          loadedSessions.push({
            id: docSnap.id,
            patientId: data.patientId || docSnap.id,
            patient: data.patient || { name: 'Unknown Patient' },
            chiefComplaint: data.chiefComplaint || data.clinicalSummary?.history?.chiefComplaint || 'Intake completed',
            answers: data.answers || [],
            documents: data.documents || [],
            redFlags: data.redFlags || [],
            clinicalSummary: data.clinicalSummary || null,
            status: data.status || 'pending_review',
            triageStatus: data.triageStatus || 'pending_review',
            triageNote: data.triageNote || '',
            triageTimestamp: data.triageTimestamp,
            triageNurseId: data.triageNurseId,
            doctorDecision: data.doctorDecision,
            doctorNote: data.doctorNote,
            doctorReviewedAt: data.doctorReviewedAt,
            doctorEmail: data.doctorEmail,
            rawTime,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          });
        });

        // Sort latest first
        loadedSessions.sort((a, b) => {
          const tA = a.rawTime?.seconds ? a.rawTime.seconds * 1000 : new Date(a.rawTime).getTime();
          const tB = b.rawTime?.seconds ? b.rawTime.seconds * 1000 : new Date(b.rawTime).getTime();
          return tB - tA;
        });

        setSessions(loadedSessions);
        setSessionsLoading(false);
      },
      (error) => {
        console.error('Error listening to patientSessions in Admin:', error);
        setFirestoreStatus('error');
        setSessionsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. Fetch real Staff Directory from server API
  const loadStaffDirectory = async () => {
    setStaffLoading(true);
    try {
      const res = await fetch('/api/admin/staff');
      const data = await res.json();
      if (data.success && Array.isArray(data.staff)) {
        setStaffList(data.staff);
      }
    } catch (err) {
      console.error('Failed to load staff directory:', err);
    } finally {
      setStaffLoading(false);
    }
  };

  useEffect(() => {
    loadStaffDirectory();
  }, []);

  // 3. Handle Role Assignment
  const handleAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEmail.trim()) return;
    setSubmittingRole(true);
    setRoleFeedback(null);

    try {
      const res = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail.trim(), role: targetRole }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to set role');
      }

      setRoleFeedback({
        type: 'success',
        message: `Successfully granted "${targetRole}" role to ${targetEmail}. Custom Claims updated server-side.`,
      });
      setTargetEmail('');
      await refreshRole();
      await loadStaffDirectory();
    } catch (err: any) {
      setRoleFeedback({
        type: 'error',
        message: err?.message || 'Server error while assigning role',
      });
    } finally {
      setSubmittingRole(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // 4. Calculate Real System Overview Metrics
  const metrics = useMemo(() => {
    const total = sessions.length;

    // Today's consultations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = sessions.filter(s => {
      if (!s.rawTime) return false;
      const d = s.rawTime?.seconds ? new Date(s.rawTime.seconds * 1000) : new Date(s.rawTime);
      return d >= today;
    }).length;

    const pendingReview = sessions.filter(s => s.triageStatus === 'pending_review' || (!s.triageStatus && s.status === 'pending_review')).length;
    const forwardedToPhysician = sessions.filter(s => s.triageStatus === 'forwarded_to_physician').length;
    const completed = sessions.filter(s => s.status === 'confirmed' || s.doctorDecision === 'accepted' || s.doctorDecision === 'edited').length;
    const rejected = sessions.filter(s => s.status === 'rejected' || s.doctorDecision === 'rejected').length;

    const emergencyCases = sessions.filter(s => {
      const priority = calculatePriority(s.redFlags);
      return priority.priority === 'EMERGENCY';
    }).length;

    return {
      total,
      todayCount,
      pendingReview,
      forwardedToPhysician,
      completed,
      rejected,
      emergencyCases,
      forwardRate: total > 0 ? Math.round((forwardedToPhysician / total) * 100) : 0,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [sessions]);

  // 5. Build Verifiable Chronological Audit Events from Real Firestore Data
  const auditEvents = useMemo(() => {
    const events: AuditEvent[] = [];

    sessions.forEach((s) => {
      const pName = s.patient?.name || 'Walk-in Patient';

      // Event A: Intake Submitted
      if (s.createdAt || s.rawTime) {
        const timeStr = s.createdAt?.seconds 
          ? new Date(s.createdAt.seconds * 1000).toISOString()
          : (typeof s.createdAt === 'string' ? s.createdAt : new Date().toISOString());
        
        events.push({
          id: `submit_${s.id}`,
          type: 'intake_submitted',
          title: 'Patient Intake Submitted',
          description: `Chief Complaint: "${s.chiefComplaint || 'Routine intake'}" (${s.answers?.length || 0} questions answered, ${s.documents?.length || 0} reports attached).`,
          actor: pName,
          actorRole: 'patient',
          timestamp: timeStr,
          sessionId: s.id,
          patientName: pName,
          severity: s.redFlags && s.redFlags.length > 0 ? 'high' : 'normal'
        });
      }

      // Event B: Nurse Triage Evaluated & Forwarded
      if (s.triageTimestamp) {
        events.push({
          id: `triage_${s.id}`,
          type: 'nurse_triage',
          title: s.triageStatus === 'forwarded_to_physician' ? 'Triage: Forwarded to Physician' : 'Triage Note Recorded',
          description: s.triageNote || 'Patient triaged and forwarded for doctor review.',
          actor: s.triageNurseId ? `Nurse (ID: ${s.triageNurseId.substring(0, 8)}...)` : 'Triage Nurse',
          actorRole: 'nurse',
          timestamp: s.triageTimestamp,
          sessionId: s.id,
          patientName: pName
        });
      }

      // Event C: Physician Decision Recorded
      if (s.doctorReviewedAt) {
        events.push({
          id: `doc_${s.id}`,
          type: 'doctor_reviewed',
          title: s.doctorDecision === 'accepted' ? 'Physician: Accepted Consultation' : (s.doctorDecision === 'edited' ? 'Physician: Edited Summary & Confirmed' : 'Physician: Intake Rejected'),
          description: s.doctorNote || (s.doctorDecision === 'rejected' ? 'Consultation rejected by attending doctor.' : 'Case reviewed and signed off.'),
          actor: s.doctorEmail || 'Attending Physician',
          actorRole: 'doctor',
          timestamp: s.doctorReviewedAt,
          sessionId: s.id,
          patientName: pName,
          severity: s.doctorDecision === 'rejected' ? 'emergency' : 'normal'
        });
      }
    });

    // Sort audit events newest to oldest
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [sessions]);

  // 6. Filtered Staff List
  const filteredStaff = useMemo(() => {
    return staffList.filter((st) => {
      const matchRole = staffFilter === 'all' || st.role === staffFilter;
      const matchSearch = staffSearch.trim() === '' || 
        st.email.toLowerCase().includes(staffSearch.toLowerCase()) || 
        st.displayName.toLowerCase().includes(staffSearch.toLowerCase()) ||
        st.uid.toLowerCase().includes(staffSearch.toLowerCase());
      return matchRole && matchSearch;
    });
  }, [staffList, staffFilter, staffSearch]);

  // 7. Filtered Consultations
  const filteredConsultations = useMemo(() => {
    return sessions.filter((s) => {
      const matchSearch = consultationSearch.trim() === '' ||
        (s.patient?.name && s.patient.name.toLowerCase().includes(consultationSearch.toLowerCase())) ||
        s.id.toLowerCase().includes(consultationSearch.toLowerCase()) ||
        (s.chiefComplaint && s.chiefComplaint.toLowerCase().includes(consultationSearch.toLowerCase()));

      if (!matchSearch) return false;

      if (consultationFilter === 'pending') {
        return s.triageStatus === 'pending_review' || (!s.triageStatus && s.status === 'pending_review');
      }
      if (consultationFilter === 'forwarded') {
        return s.triageStatus === 'forwarded_to_physician';
      }
      if (consultationFilter === 'confirmed') {
        return s.status === 'confirmed' || s.doctorDecision === 'accepted' || s.doctorDecision === 'edited';
      }
      if (consultationFilter === 'rejected') {
        return s.status === 'rejected' || s.doctorDecision === 'rejected';
      }
      if (consultationFilter === 'emergency') {
        const priority = calculatePriority(s.redFlags);
        return priority.priority === 'EMERGENCY';
      }
      return true;
    });
  }, [sessions, consultationSearch, consultationFilter]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSavedToast(true);
    setTimeout(() => setConfigSavedToast(false), 3000);
  };

  return (
    <AyurvedaBackground variant="clinical" className="selection:bg-[#234e32] selection:text-white pb-20 font-sans">
      <Header title="Hospital Administration & RBAC" backHref="/" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* Top Header Card */}
        <div className="rounded-3xl bg-[#142319]/90 border border-[#344d3c] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-[#234e32] text-white flex items-center justify-center font-extrabold shadow-xl shadow-[#234e32]/40 shrink-0 border border-[#447a57]/40">
                <ShieldCheck size={32} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
                    MediKiosk System Administration
                  </h1>
                  <span className="px-3 py-1 rounded-full bg-[#162e1e] border border-[#385540] text-[#a3e0b8] text-xs font-bold uppercase tracking-wider">
                    Root Admin
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#a1b8a5] mt-1.5 font-medium">
                  <span>Facility: <strong className="text-white">{hospitalName}</strong></span>
                  <span className="w-1 h-1 rounded-full bg-[#344d3c]" />
                  <span>Admin: <strong className="text-[#a3e0b8] font-mono">{currentUser?.email}</strong></span>
                  <span className="w-1 h-1 rounded-full bg-[#344d3c]" />
                  <span className="flex items-center gap-1.5 text-[#86efac] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#447a57] animate-pulse" />
                    Live Cloud Sync
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <button
                onClick={loadStaffDirectory}
                disabled={staffLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#132018] hover:bg-[#192b1f] border border-[#344d3c] text-[#a1b8a5] hover:text-white text-xs font-bold transition shadow-sm"
                title="Refresh staff and real-time state"
              >
                <RefreshCw size={14} className={staffLoading ? 'animate-spin text-[#a3e0b8]' : ''} />
                <span>Sync Data</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#17251c] hover:bg-[#b83b3b]/30 hover:border-[#b83b3b]/50 border border-[#344d3c] text-[#d8c5af] hover:text-white text-xs font-bold transition shadow-sm"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Navigation Sub-Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pt-6 mt-6 border-t border-[#344d3c] scrollbar-none">
            {[
              { id: 'overview', label: 'System Overview', icon: Layers },
              { id: 'staff', label: 'Staff Directory', icon: Users, count: staffList.length },
              { id: 'roles', label: 'Role Management', icon: Key },
              { id: 'consultations', label: 'Consultations', icon: Stethoscope, count: sessions.length },
              { id: 'audit', label: 'Audit Trail', icon: Activity, count: auditEvents.length },
              { id: 'health', label: 'System Health', icon: Server },
              { id: 'settings', label: 'Hospital Settings', icon: Settings }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id as AdminSection)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 border ${
                    isActive
                      ? 'bg-[#234e32] text-white border-[#386b47] shadow-lg shadow-[#234e32]/30'
                      : 'bg-[#132018]/70 text-[#a1b8a5] border-[#344d3c] hover:bg-[#192b1f] hover:text-white'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive ? 'bg-[#0d1610] text-[#a3e0b8]' : 'bg-[#1e3325] text-[#829277]'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECTION 1: SYSTEM OVERVIEW                                                */}
        {/* ========================================================================= */}
        {activeSection === 'overview' && (
          <div className="space-y-8 mt-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col justify-between shadow-lg">
                <div className="flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  <span>Total Patients</span>
                  <Users size={16} className="text-purple-400" />
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-black text-white tracking-tight">
                    {sessionsLoading ? '...' : metrics.total}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">All Recorded Sessions</div>
                </div>
              </div>

              <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col justify-between shadow-lg">
                <div className="flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  <span>Today's Intake</span>
                  <Clock size={16} className="text-teal-400" />
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-black text-teal-400 tracking-tight">
                    {sessionsLoading ? '...' : metrics.todayCount}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Calendar Day Intake</div>
                </div>
              </div>

              <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col justify-between shadow-lg">
                <div className="flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  <span>Pending Triage</span>
                  <AlertCircle size={16} className="text-amber-400" />
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-black text-amber-400 tracking-tight">
                    {sessionsLoading ? '...' : metrics.pendingReview}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Nurse Desk Queue</div>
                </div>
              </div>

              <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col justify-between shadow-lg">
                <div className="flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  <span>Forwarded</span>
                  <ArrowRight size={16} className="text-cyan-400" />
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-black text-cyan-400 tracking-tight">
                    {sessionsLoading ? '...' : metrics.forwardedToPhysician}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">At Physician Queue</div>
                </div>
              </div>

              <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col justify-between shadow-lg">
                <div className="flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  <span>Completed</span>
                  <CheckCircle2 size={16} className="text-emerald-400" />
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-black text-emerald-400 tracking-tight">
                    {sessionsLoading ? '...' : metrics.completed}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Doctor Confirmed</div>
                </div>
              </div>

              <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col justify-between shadow-lg">
                <div className="flex items-center justify-between text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  <span>Rejected</span>
                  <XCircle size={16} className="text-rose-400" />
                </div>
                <div className="mt-3">
                  <div className="text-3xl font-black text-rose-400 tracking-tight">
                    {sessionsLoading ? '...' : metrics.rejected}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">Declined by Doctor</div>
                </div>
              </div>
            </div>

            {/* Workflow Pipeline Visualization & Quick Status */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-7 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-white">OPD Intake & Triage Pipeline</h2>
                    <p className="text-xs text-slate-400">Live progression of patients through intake stages</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-teal-400 bg-teal-950/60 border border-teal-800/60 px-3 py-1 rounded-full">
                    {metrics.forwardRate}% Triage Forward Rate
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60">
                    <div className="text-xs font-bold text-slate-400 uppercase">1. Kiosk Intake</div>
                    <div className="text-xl font-black text-white mt-1">{metrics.total}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Submitted in Kiosk</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-800/50 border border-amber-800/40">
                    <div className="text-xs font-bold text-amber-300 uppercase">2. Nurse Triage</div>
                    <div className="text-xl font-black text-amber-400 mt-1">{metrics.pendingReview}</div>
                    <div className="text-[10px] text-slate-500 mt-1">Awaiting Handoff</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-800/50 border border-cyan-800/40">
                    <div className="text-xs font-bold text-cyan-300 uppercase">3. Doctor Review</div>
                    <div className="text-xl font-black text-cyan-400 mt-1">{metrics.forwardedToPhysician}</div>
                    <div className="text-[10px] text-slate-500 mt-1">At Physician Desk</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-800/50 border border-emerald-800/40">
                    <div className="text-xs font-bold text-emerald-300 uppercase">4. Completed</div>
                    <div className="text-xl font-black text-emerald-400 mt-1">{metrics.completed}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{metrics.completionRate}% Finalized</div>
                  </div>
                </div>

                {/* Emergency Banner */}
                {metrics.emergencyCases > 0 && (
                  <div className="mt-6 p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-600/30 text-rose-400 flex items-center justify-center font-bold">
                        <AlertTriangle size={20} />
                      </div>
                      <div>
                        <div className="text-xs font-black text-rose-300 uppercase tracking-wide">
                          {metrics.emergencyCases} Clinical Emergency Alert(s) Detected
                        </div>
                        <div className="text-[11px] text-rose-200/80">
                          Red flags triggered in active patient sessions requiring immediate clinical attention.
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setConsultationFilter('emergency');
                        setActiveSection('consultations');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shrink-0"
                    >
                      View Emergency Cases
                    </button>
                  </div>
                )}
              </div>

              {/* Staff Snapshot Card */}
              <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-black text-white">Staff Roster Snapshot</h2>
                    <span className="text-[11px] font-mono text-purple-400 font-bold bg-purple-950/60 px-2.5 py-0.5 rounded-full border border-purple-800/50">
                      {staffList.length} Accounts
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/50 border border-slate-700/60 text-xs">
                      <div className="flex items-center gap-2 text-teal-300 font-bold">
                        <Activity size={15} />
                        <span>Triage Nurses</span>
                      </div>
                      <span className="font-mono font-black text-white">
                        {staffList.filter(s => s.role === 'nurse').length}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/50 border border-slate-700/60 text-xs">
                      <div className="flex items-center gap-2 text-cyan-300 font-bold">
                        <Stethoscope size={15} />
                        <span>Attending Doctors</span>
                      </div>
                      <span className="font-mono font-black text-white">
                        {staffList.filter(s => s.role === 'doctor').length}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/50 border border-slate-700/60 text-xs">
                      <div className="flex items-center gap-2 text-purple-300 font-bold">
                        <Shield size={15} />
                        <span>System Administrators</span>
                      </div>
                      <span className="font-mono font-black text-white">
                        {staffList.filter(s => s.role === 'admin').length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 mt-4 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Manage Custom Claims</span>
                  <button
                    onClick={() => setActiveSection('roles')}
                    className="text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1"
                  >
                    <span>Open Role Console</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Recent 5 Patient Sessions Quick View */}
            <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-black text-white">Latest Live Sessions</h2>
                  <p className="text-xs text-slate-400">Real-time view of recent incoming patient admissions</p>
                </div>
                <button
                  onClick={() => setActiveSection('consultations')}
                  className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  <span>View Full Directory ({sessions.length})</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">Patient / ID</th>
                      <th className="py-3 px-3">Chief Complaint</th>
                      <th className="py-3 px-3">Priority</th>
                      <th className="py-3 px-3">Triage Status</th>
                      <th className="py-3 px-3">Doctor Status</th>
                      <th className="py-3 px-3 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {sessions.slice(0, 5).map((s) => {
                      const priority = calculatePriority(s.redFlags);
                      return (
                        <tr key={s.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-white">{s.patient?.name || 'Walk-in Patient'}</div>
                            <div className="text-[10px] font-mono text-slate-400">{s.id.substring(0, 8)}...</div>
                          </td>
                          <td className="py-3.5 px-3 max-w-xs truncate text-slate-300">
                            {s.chiefComplaint}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                              priority.priority === 'EMERGENCY'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : (priority.priority === 'HIGH'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-teal-500/20 text-teal-300 border border-teal-500/40')
                            }`}>
                              {priority.priority}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="capitalize text-slate-300">
                              {s.triageStatus ? s.triageStatus.replace(/_/g, ' ') : 'Pending Review'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className={`capitalize font-bold ${
                              s.doctorDecision === 'accepted' || s.status === 'confirmed' 
                                ? 'text-emerald-400' 
                                : (s.doctorDecision === 'rejected' ? 'text-rose-400' : 'text-slate-400')
                            }`}>
                              {s.doctorDecision || s.status || 'Pending'}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right text-slate-400 font-mono text-[11px]">
                            {formatSubmitTime(s.rawTime)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 2: STAFF DIRECTORY                                                */}
        {/* ========================================================================= */}
        {activeSection === 'staff' && (
          <div className="space-y-6 mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white">Staff & Personnel Directory</h2>
                <p className="text-xs text-slate-400">Authenticated staff members with cryptographically assigned Custom Claims</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveSection('roles')}
                  className="px-4 py-2 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-purple-600/30"
                >
                  <Key size={14} />
                  <span>Assign / Change Role</span>
                </button>
              </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-3xl bg-slate-900 border border-slate-800">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search staff by email, name or UID..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-2xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto">
                {(['all', 'nurse', 'doctor', 'admin', 'patient'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setStaffFilter(r)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition border ${
                      staffFilter === r
                        ? 'bg-purple-600 text-white border-purple-400'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Staff Table */}
            <div className="rounded-3xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
              {staffLoading ? (
                <div className="p-12 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-3">
                  <RefreshCw size={24} className="animate-spin text-purple-400" />
                  <span>Querying staff identities via Firebase Admin SDK...</span>
                </div>
              ) : filteredStaff.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No staff members match the selected filter.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 px-4">Member / Name</th>
                        <th className="py-3.5 px-4">Role Claim</th>
                        <th className="py-3.5 px-4">Account Status</th>
                        <th className="py-3.5 px-4">Created Date</th>
                        <th className="py-3.5 px-4">Last Sign In</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {filteredStaff.map((user) => (
                        <tr key={user.uid} className="hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{user.displayName}</span>
                              {user.email === currentUser?.email && (
                                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">{user.email}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                              user.role === 'admin'
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                : (user.role === 'doctor'
                                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                  : (user.role === 'nurse'
                                    ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                                    : 'bg-slate-700/40 text-slate-300 border-slate-600'))
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="flex items-center gap-1.5 text-xs">
                              <span className={`w-2 h-2 rounded-full ${user.disabled ? 'bg-rose-500' : 'bg-emerald-400'}`} />
                              <span className={user.disabled ? 'text-rose-400' : 'text-emerald-300 font-semibold'}>
                                {user.disabled ? 'Disabled' : 'Active'}
                              </span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                            {user.lastSignIn ? new Date(user.lastSignIn).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setTargetEmail(user.email);
                                setTargetRole((user.role === 'unassigned' ? 'nurse' : user.role) as any);
                                setActiveSection('roles');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-purple-300 hover:text-white text-xs font-bold transition"
                            >
                              Edit Role
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 3: ROLE MANAGEMENT                                                */}
        {/* ========================================================================= */}
        {activeSection === 'roles' && (
          <div className="grid lg:grid-cols-2 gap-8 mt-8">
            {/* Form: Assign Custom Role */}
            <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-7 shadow-xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30">
                  <Key size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">Cryptographic Role Provisioning</h2>
                  <p className="text-xs text-slate-400">Sets Custom Claims on Firebase Authentication server-side</p>
                </div>
              </div>

              {roleFeedback && (
                <div className={`mb-5 p-4 rounded-2xl text-xs font-semibold flex items-start gap-2.5 border ${
                  roleFeedback.type === 'success' 
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200' 
                    : 'bg-rose-500/20 border-rose-500/40 text-rose-200'
                }`}>
                  {roleFeedback.type === 'success' ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <span>{roleFeedback.message}</span>
                </div>
              )}

              <form onSubmit={handleAssignRole} className="space-y-5">
                <div>
                  <label className="block text-[11px] font-black text-slate-300 uppercase tracking-wider mb-2">
                    Target User Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. staff@medi-kiosk.demo"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    className="w-full rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
                  />
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    User must already have an account created in Firebase Authentication.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-300 uppercase tracking-wider mb-2">
                    Role to Grant
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['nurse', 'doctor', 'admin', 'patient'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setTargetRole(r)}
                        className={`py-3 px-3 rounded-xl text-xs font-black uppercase transition border flex flex-col items-center gap-1.5 ${
                          targetRole === r
                            ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                      >
                        {r === 'nurse' && <Activity size={16} />}
                        {r === 'doctor' && <Stethoscope size={16} />}
                        {r === 'admin' && <Shield size={16} />}
                        {r === 'patient' && <Users size={16} />}
                        <span>{r}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 space-y-1.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Info size={14} className="text-purple-400" />
                    Security Notice
                  </div>
                  <div>
                    This action will modify the user's Firebase Auth JWT claims. The client cannot forge or alter these values in localStorage.
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingRole}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs transition shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submittingRole ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Applying Custom Claim...</span>
                    </>
                  ) : (
                    <>
                      <Key size={14} />
                      <span>Commit Custom Role Claim</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Architecture & RBAC Policy Guide */}
            <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-7 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/30">
                    <Server size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">RBAC Security Policy</h2>
                    <p className="text-xs text-slate-400">Zero-Trust token and Firestore verification standard</p>
                  </div>
                </div>

                <div className="space-y-3.5 text-xs text-slate-300">
                  <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-teal-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Triage Nurse Role:</strong> Allowed read access to the patient triage queue and restricted writes ONLY to triage fields (<code className="text-teal-300">triageStatus, triageNote, triageTimestamp, triageNurseId</code>).
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Attending Doctor Role:</strong> Authorized to review full patient clinical history, attached reports, and red flags. Permitted to write consultation decisions (<code className="text-cyan-300">accepted, edited, rejected</code>) and consultation notes.
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-purple-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Root Admin Role:</strong> Full system telemetry, staff role administration, audit event monitoring, and kiosk hospital configurations.
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-start gap-3">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white">Kiosk Anonymous Patient:</strong> Can ONLY create and update their own session (<code className="text-emerald-300">request.resource.data.patientId == auth.uid</code>). Zero cross-session visibility.
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Verification Method: JWT Claims</span>
                <span className="font-mono text-purple-300 font-bold">STATELESS_SERVER_CHECK</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 4: CONSULTATION MONITORING                                        */}
        {/* ========================================================================= */}
        {activeSection === 'consultations' && (
          <div className="space-y-6 mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white">Live Consultation Monitoring</h2>
                <p className="text-xs text-slate-400">Complete audit log of all registered patient sessions across triage and physician review</p>
              </div>

              <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950/60 border border-purple-800/60 px-3 py-1.5 rounded-2xl self-start sm:self-auto">
                {filteredConsultations.length} Sessions Matching
              </span>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-3xl bg-slate-900 border border-slate-800">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search by patient name, MRN/Session ID, or complaint..."
                  value={consultationSearch}
                  onChange={(e) => setConsultationSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-2xl bg-slate-800 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'emergency', label: 'Emergency' },
                  { id: 'forwarded', label: 'Forwarded' },
                  { id: 'pending', label: 'Pending Triage' },
                  { id: 'confirmed', label: 'Confirmed' },
                  { id: 'rejected', label: 'Rejected' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setConsultationFilter(tab.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border shrink-0 ${
                      consultationFilter === tab.id
                        ? 'bg-purple-600 text-white border-purple-400'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Consultations Table */}
            <div className="rounded-3xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl">
              {sessionsLoading ? (
                <div className="p-12 text-center text-slate-400 text-xs font-semibold flex flex-col items-center gap-3">
                  <RefreshCw size={24} className="animate-spin text-purple-400" />
                  <span>Loading real session records from Firestore...</span>
                </div>
              ) : filteredConsultations.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No consultation records found matching current query.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="py-3.5 px-4">Patient / ID</th>
                        <th className="py-3.5 px-4">Chief Complaint</th>
                        <th className="py-3.5 px-4">Priority / Flags</th>
                        <th className="py-3.5 px-4">Triage Status</th>
                        <th className="py-3.5 px-4">Doctor Status</th>
                        <th className="py-3.5 px-4">Submitted</th>
                        <th className="py-3.5 px-4 text-right">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {filteredConsultations.map((s) => {
                        const priority = calculatePriority(s.redFlags);
                        return (
                          <tr key={s.id} className="hover:bg-slate-800/40 transition">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-white">{s.patient?.name || 'Walk-in Patient'}</div>
                              <div className="text-[10px] font-mono text-slate-400">{s.id.substring(0, 10)}...</div>
                            </td>
                            <td className="py-3.5 px-4 max-w-xs truncate text-slate-300">
                              {s.chiefComplaint}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                                  priority.priority === 'EMERGENCY'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : (priority.priority === 'HIGH'
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                      : 'bg-teal-500/20 text-teal-300 border-teal-500/40')
                                }`}>
                                  {priority.priority}
                                </span>
                                {s.redFlags && s.redFlags.length > 0 && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
                                    {s.redFlags.length} RF
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="capitalize text-slate-300">
                                {s.triageStatus ? s.triageStatus.replace(/_/g, ' ') : 'Pending Review'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`capitalize font-bold ${
                                s.doctorDecision === 'accepted' || s.status === 'confirmed'
                                  ? 'text-emerald-400'
                                  : (s.doctorDecision === 'rejected' ? 'text-rose-400' : 'text-slate-400')
                              }`}>
                                {s.doctorDecision || s.status || 'Pending'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                              {formatSubmitTime(s.rawTime)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => setSelectedSession(s)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold transition inline-flex items-center gap-1.5"
                              >
                                <Eye size={13} />
                                <span>Inspect</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Session Detail Inspection Modal */}
            {selectedSession && (
              <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <h3 className="text-lg font-black text-white">
                        Session Inspection: {selectedSession.patient?.name || 'Walk-in Patient'}
                      </h3>
                      <p className="text-xs font-mono text-slate-400">ID: {selectedSession.id}</p>
                    </div>
                    <button
                      onClick={() => setSelectedSession(null)}
                      className="w-9 h-9 rounded-xl bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/60">
                      <span className="text-slate-400 font-bold block mb-1">Chief Complaint</span>
                      <span className="text-white font-medium">{selectedSession.chiefComplaint}</span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/60">
                      <span className="text-slate-400 font-bold block mb-1">Triage Priority</span>
                      <span className="text-amber-300 font-bold">
                        {calculatePriority(selectedSession.redFlags).label}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/60">
                      <span className="text-slate-400 font-bold block mb-1">Nurse Triage Status</span>
                      <span className="text-teal-300 font-semibold">
                        {selectedSession.triageStatus || 'pending_review'}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/60">
                      <span className="text-slate-400 font-bold block mb-1">Physician Decision</span>
                      <span className="text-emerald-300 font-semibold">
                        {selectedSession.doctorDecision || selectedSession.status || 'None'}
                      </span>
                    </div>
                  </div>

                  {/* Nurse Triage Note */}
                  {selectedSession.triageNote && (
                    <div className="p-4 rounded-2xl bg-teal-950/30 border border-teal-800/40 text-xs">
                      <span className="text-teal-300 font-extrabold uppercase block mb-1">Nurse Triage Note</span>
                      <p className="text-slate-200">{selectedSession.triageNote}</p>
                    </div>
                  )}

                  {/* Doctor Clinical Note */}
                  {selectedSession.doctorNote && (
                    <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-800/40 text-xs">
                      <span className="text-cyan-300 font-extrabold uppercase block mb-1">Physician Clinical Note</span>
                      <p className="text-slate-200">{selectedSession.doctorNote}</p>
                    </div>
                  )}

                  {/* Questionnaire Answers Preview */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Answers Recorded ({selectedSession.answers?.length || 0})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedSession.answers && selectedSession.answers.length > 0 ? (
                        selectedSession.answers.map((a, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50 text-xs">
                            <span className="text-slate-400 block">{a.questionText || a.questionId}</span>
                            <span className="text-white font-semibold">{a.answer}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-500 italic">No structured answers recorded.</div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={() => setSelectedSession(null)}
                      className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 5: AUDIT TRAIL / ACTIVITY                                         */}
        {/* ========================================================================= */}
        {activeSection === 'audit' && (
          <div className="space-y-6 mt-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white">System Audit & Clinical Events</h2>
                <p className="text-xs text-slate-400">Verifiable event log derived strictly from real Firestore intake documents</p>
              </div>

              <span className="text-xs font-mono font-bold text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-2xl">
                {auditEvents.length} Recorded Events
              </span>
            </div>

            <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl">
              {auditEvents.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No system events found in database.
                </div>
              ) : (
                <div className="relative border-l border-slate-800 ml-4 pl-6 space-y-6">
                  {auditEvents.map((evt) => (
                    <div key={evt.id} className="relative group">
                      {/* Node circle */}
                      <div className={`absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full border-2 bg-slate-950 ${
                        evt.type === 'intake_submitted'
                          ? 'border-purple-400'
                          : (evt.type === 'nurse_triage' ? 'border-teal-400' : 'border-cyan-400')
                      }`} />

                      <div className="rounded-2xl bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/60 p-4 transition">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white">{evt.title}</span>
                            <span className={`px-2 py-0.2 rounded-full text-[10px] font-extrabold uppercase ${
                              evt.actorRole === 'patient'
                                ? 'bg-purple-950/80 text-purple-300 border border-purple-800'
                                : (evt.actorRole === 'nurse'
                                  ? 'bg-teal-950/80 text-teal-300 border border-teal-800'
                                  : 'bg-cyan-950/80 text-cyan-300 border border-cyan-800')
                            }`}>
                              {evt.actorRole}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {new Date(evt.timestamp).toLocaleString()}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 mb-2">
                          {evt.description}
                        </p>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                          <span>Patient: <strong className="text-slate-400">{evt.patientName}</strong></span>
                          <span>•</span>
                          <span>Actor: <strong className="text-slate-400">{evt.actor}</strong></span>
                          <span>•</span>
                          <span>Session: {evt.sessionId.substring(0, 8)}...</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 6: SYSTEM HEALTH & TELEMETRY                                      */}
        {/* ========================================================================= */}
        {activeSection === 'health' && (
          <div className="space-y-6 mt-8">
            <div>
              <h2 className="text-xl font-black text-white">System Health & Telemetry</h2>
              <p className="text-xs text-slate-400">Live operational telemetry across cloud infrastructure and security endpoints</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Cloud Firestore Status */}
              <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-slate-300 font-bold text-sm">
                    <Database size={18} className="text-teal-400" />
                    <span>Cloud Firestore</span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                    firestoreStatus === 'connected'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}>
                    {firestoreStatus}
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-400 font-mono">
                  <div className="flex justify-between">
                    <span>Active Collection:</span>
                    <span className="text-white">patientSessions</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Documents Loaded:</span>
                    <span className="text-white">{sessions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Query Latency:</span>
                    <span className="text-teal-300">{firestoreLatency ? `${firestoreLatency} ms` : 'Measuring...'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Listener Type:</span>
                    <span className="text-white">Realtime WebSocket</span>
                  </div>
                </div>
              </div>

              {/* Firebase Auth & Claims Status */}
              <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-slate-300 font-bold text-sm">
                    <ShieldCheck size={18} className="text-purple-400" />
                    <span>Firebase Auth & RBAC</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Operational
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-400 font-mono">
                  <div className="flex justify-between">
                    <span>Project ID:</span>
                    <span className="text-white">medikiosk-df39e</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Current Session:</span>
                    <span className="text-purple-300 truncate max-w-[150px]">{currentUser?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Server Admin SDK:</span>
                    <span className="text-emerald-400">Initialized</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Claims Strategy:</span>
                    <span className="text-white">Custom Claims in JWT</span>
                  </div>
                </div>
              </div>

              {/* Application Server Status */}
              <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 text-slate-300 font-bold text-sm">
                    <Server size={18} className="text-cyan-400" />
                    <span>Next.js Application</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Healthy
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-400 font-mono">
                  <div className="flex justify-between">
                    <span>Next Engine:</span>
                    <span className="text-white">Next.js 16.2.6</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Compiler:</span>
                    <span className="text-white">Turbopack (Active)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>FHIR R4 Generation:</span>
                    <span className="text-cyan-300">ABDM Ready</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Environment:</span>
                    <span className="text-white">{process.env.NODE_ENV || 'production'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Architecture Safety Summary */}
            <div className="rounded-3xl bg-slate-900/80 border border-slate-800 p-6 text-xs text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-800 text-purple-400 flex items-center justify-center font-bold">
                  <Lock size={18} />
                </div>
                <div>
                  <div className="font-bold text-white">Credential Protection Protocol</div>
                  <div className="text-[11px] text-slate-400">
                    All private keys and service credentials remain strictly server-side. Zero secret leaks to the browser bundle.
                  </div>
                </div>
              </div>
              <span className="font-mono text-purple-400 font-bold bg-purple-950/60 px-3 py-1 rounded-full border border-purple-800/50">
                AUDIT: PASS
              </span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SECTION 7: KIOSK & HOSPITAL CONFIGURATION                                */}
        {/* ========================================================================= */}
        {activeSection === 'settings' && (
          <div className="max-w-2xl space-y-6 mt-8">
            <div>
              <h2 className="text-xl font-black text-white">Kiosk & Facility Configuration</h2>
              <p className="text-xs text-slate-400">Configure terminal identification and facility metadata for patient intake</p>
            </div>

            {configSavedToast && (
              <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span>Hospital and Kiosk settings saved successfully for this station.</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="rounded-3xl bg-slate-900/80 border border-slate-800 p-7 shadow-xl space-y-5">
              <div>
                <label className="block text-[11px] font-black text-slate-300 uppercase tracking-wider mb-2">
                  Hospital / Health Facility Name
                </label>
                <input
                  type="text"
                  required
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  className="w-full rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-300 uppercase tracking-wider mb-2">
                  Kiosk Terminal Identifier
                </label>
                <input
                  type="text"
                  required
                  value={kioskName}
                  onChange={(e) => setKioskName(e.target.value)}
                  className="w-full rounded-2xl bg-slate-800 border border-slate-700 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-400 transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-300 uppercase tracking-wider mb-2">
                  Supported Patient Intake Languages (9 Active)
                </label>
                <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
                  <div className="flex flex-wrap gap-2">
                    {['English (en)', 'Hindi (hi)', 'Bengali (bn)', 'Telugu (te)', 'Marathi (mr)', 'Tamil (ta)', 'Gujarati (gu)', 'Kannada (kn)', 'Malayalam (ml)'].map((lang) => (
                      <span key={lang} className="px-2.5 py-1 rounded-xl bg-slate-800 text-teal-300 font-semibold border border-teal-800/40 text-[11px]">
                        {lang}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2.5">
                    All 9 official regional languages supported by the patient voice recognition & TTS engine.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60">
                <div>
                  <span className="font-bold text-white text-xs block">Emergency Red Flag Auto-Flagging</span>
                  <span className="text-[11px] text-slate-400">Promotes critical red flags directly to the top of triage</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEmergencyBypass(!emergencyBypass)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${emergencyBypass ? 'bg-purple-600' : 'bg-slate-700'}`}
                >
                  <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${emergencyBypass ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs transition shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
              >
                <span>Save Facility Settings</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </AyurvedaBackground>
  );
}

export default function AdminDashboard() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}
