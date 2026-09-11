"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import Header from '@/components/Header';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { useAuth } from '@/context/AuthContext';
import { 
  User, 
  Clock, 
  Calendar, 
  ArrowRight, 
  FileText, 
  CheckCircle2, 
  Activity, 
  ShieldCheck, 
  LogOut,
  PlusCircle,
  AlertTriangle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

function PatientDashboardContent() {
  const { currentUser, logout } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMySessions() {
      if (!currentUser) return;
      try {
        const q = query(
          collection(db, 'patientSessions'),
          where('patientId', '==', currentUser.uid)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setSessions(list);
      } catch (err) {
        console.error('Failed to fetch patient sessions:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchMySessions();
  }, [currentUser]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title="Patient Health Portal" backHref="/" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-16">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#ded5c2]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-3xl bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] flex items-center justify-center font-extrabold text-xl shadow-md">
              <User size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1b3d27]">
                  Welcome, {currentUser?.displayName || 'Patient'}
                </h1>
                <span className="px-3 py-0.5 rounded-full bg-[#e4ede1] border border-[#c7d9c2] text-[#234e32] text-xs font-bold uppercase tracking-wider">
                  Verified Patient
                </span>
              </div>
              <p className="text-xs text-[#556358] mt-0.5">
                UID: <span className="font-mono text-[#1c241e] font-semibold">{currentUser?.uid}</span> • {currentUser?.email}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#fbf9f4] hover:bg-[#ede5d6] text-[#4d2f19] text-xs font-bold transition border border-[#ded5c2] shadow-xs self-start sm:self-auto"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Start Intake Banner Card */}
        <div className="mt-8 rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] p-6 sm:p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e4ede1] border border-[#c7d9c2] text-[#234e32] text-xs font-bold uppercase tracking-wider">
              <Activity size={14} /> Clinical Intake Station
            </div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#1b3d27]">
              Need to complete your intake before seeing the doctor?
            </h2>
            <p className="text-xs sm:text-sm text-[#556358] leading-relaxed">
              Answer quick symptom questions in your preferred language using voice or touchscreen. Your clinical summary is automatically generated for doctor review.
            </p>
          </div>

          <a
            href="/patient/language"
            className="px-7 py-4 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold text-sm shadow-lg shadow-[#234e32]/25 transition flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <PlusCircle size={18} />
            <span>Start Intake Consultation</span>
            <ArrowRight size={16} />
          </a>
        </div>

        {/* Previous Consultation Records */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-xl font-serif font-bold text-[#1b3d27]">Your Intake & Consultation History</h3>
              <p className="text-xs text-[#556358]">Records submitted under your authenticated profile</p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-[#ded5c2] bg-[#fbf9f4]/90 p-12 text-center text-[#556358] text-xs font-bold">
              Loading your clinical intake records...
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#ded5c2] bg-[#fbf9f4]/70 p-12 text-center">
              <FileText size={32} className="mx-auto mb-3 text-[#829277]" />
              <h4 className="text-sm font-bold text-[#1c241e] mb-1">No Intake Records Found</h4>
              <p className="text-xs text-[#556358] max-w-md mx-auto mb-4">
                You haven&apos;t completed an intake session yet. Tap the button above to begin your intake consultation.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {sessions.map((s) => (
                <div 
                  key={s.id} 
                  className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#234e32]/50 transition shadow-sm"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs text-[#829277]">ID: {s.id.slice(0, 10)}...</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                        s.triageStatus === 'forwarded_to_physician'
                          ? 'bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2]'
                          : s.triageStatus === 'reviewed'
                          ? 'bg-[#f4ece1] text-[#6f4827] border border-[#d8c5af]'
                          : 'bg-[#f6ebd0] text-[#7a5524] border border-[#e5d4a4]'
                      }`}>
                        {s.triageStatus?.replace(/_/g, ' ') || 'Pending Review'}
                      </span>
                    </div>
                    <div className="text-base font-bold text-[#1c241e]">
                      Chief Complaint: <span className="text-[#234e32]">{s.chiefComplaint || 'Routine Intake'}</span>
                    </div>
                    <div className="text-xs text-[#556358]">
                      Questions answered: <strong className="text-[#1c241e]">{s.answers?.length || 0}</strong> • Language: <strong className="text-[#1c241e]">{s.language || 'English'}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-auto">
                    <a
                      href={`/patient/summary`}
                      className="px-4 py-2 rounded-xl bg-[#f8f5ee] hover:bg-[#ede5d6] text-[#234e32] text-xs font-bold transition flex items-center gap-1.5 border border-[#ded5c2]"
                    >
                      <FileText size={14} />
                      <span>View Intake Summary</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AyurvedaBackground>
  );
}

export default function PatientDashboard() {
  return (
    <ProtectedRoute allowedRoles={['patient']}>
      <PatientDashboardContent />
    </ProtectedRoute>
  );
}
