"use client";

import ProtectedRoute from '@/components/ProtectedRoute';
import Header from '@/components/Header';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { useAuth } from '@/context/AuthContext';
import { 
  MoreVertical,

  Home,
  ClipboardList,
  Folder,
  UserCircle,
  FileCheck,
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
  AlertTriangle,
  Users
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { usePatientQueuePolling } from '@/hooks/usePatientQueuePolling';
import { useTranslation } from '@/lib/i18n';

function PatientDashboardContent() {
  const { currentUser, logout } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<any[]>([]);
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  
  const [activeTab, setActiveTab] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);


  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'history', label: 'My History', icon: ClipboardList },
    { id: 'documents', label: 'Documents', icon: Folder },
    { id: 'timeline', label: 'Medical Timeline', icon: Clock },
    { id: 'summary', label: 'Clinical Summary', icon: FileCheck },
    { id: 'profile', label: 'Profile', icon: UserCircle },
  ];

  
  // Poll queue status for this specific patient
  const { patientQueueInfo } = usePatientQueuePolling(undefined, currentUser?.uid);

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
        // Sort by updatedAt or createdAt descending
        list.sort((a: any, b: any) => {
          const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
          const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
          return tB - tA;
        });
        setSessions(list);

        // Fetch patient profile if exists
        const profileRef = doc(db, 'patients', currentUser.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setPatientProfile(profileSnap.data());
        }
      } catch (err) {
        console.error('Failed to fetch patient sessions or profile:', err);
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

  const customMenu = (
    <div className="relative">
      <button 
        onClick={() => setMenuOpen(!menuOpen)}
        className="w-10 h-10 rounded-xl bg-[#234e32]/10 text-[#234e32] hover:bg-[#234e32]/20 border border-[#234e32]/20 flex items-center justify-center transition shrink-0 focus:outline-none"
      >
        <MoreVertical size={20} />
      </button>
      
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)}></div>
          <div className="absolute left-0 top-12 mt-1 w-56 rounded-3xl bg-[#fbf9f4] border border-[#ded5c2] shadow-xl p-2 z-50 flex flex-col">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition ${
                    isActive 
                      ? 'bg-[#234e32] text-white' 
                      : 'text-[#4d2f19] hover:bg-[#ede5d6]'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  return (
    <AyurvedaBackground variant="kiosk">
      <Header
        title="Patient Health Portal"
        customLeftMenu={customMenu}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-16 relative">
        
        {/* Welcome Header */}
        <div className="flex items-start gap-4 pb-6 border-b border-[#ded5c2]">
          <div className="w-14 h-14 rounded-3xl bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] flex items-center justify-center font-extrabold text-xl shadow-md shrink-0">
            <User size={28} />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[#1b3d27]">
                Welcome back, {patientProfile?.name || currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Patient')}
              </h1>
              <span className="px-3 py-0.5 rounded-full bg-[#e4ede1] border border-[#c7d9c2] text-[#234e32] text-xs font-bold uppercase tracking-wider">
                Verified Patient
              </span>
            </div>
            <p className="text-xs text-[#556358] mt-1.5 leading-relaxed max-w-xl">
              {patientProfile && (
                <span className="mr-3 block mb-1">
                  <span className="font-semibold">Age:</span> {patientProfile.age} | <span className="font-semibold">Gender:</span> {patientProfile.gender} | <span className="font-semibold">Contact:</span> {patientProfile.contact}
                </span>
              )}
              UID: <span className="font-mono text-[#1c241e] font-semibold">{currentUser?.uid}</span> • {currentUser?.email}
            </p>
          </div>
        </div>

        {/* Active Consultation Queue Info */}
        {activeTab === 'home' && (
          <>
            {patientQueueInfo && patientQueueInfo.queueStatus !== 'completed' && (

          <div className="mt-8 rounded-3xl bg-white border border-[#234e32]/20 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-[#234e32]" />
            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 border-b border-slate-100 pb-6">
                <div>
                  <h2 className="text-2xl font-black text-[#1b3d27] tracking-tight">{t('Current Consultation')}</h2>
                  <p className="text-[#556358] text-sm mt-1">{t('Your live queue status and estimated wait time')}</p>
                </div>
                
                {/* Fixed Queue Token Number */}
                <div className="flex flex-col items-center bg-[#f8f5ee] px-8 py-4 rounded-2xl border border-[#ded5c2] shadow-sm">
                  <span className="text-xs font-bold text-[#6b7c6e] uppercase tracking-wider mb-1">{t('Your Token')}</span>
                  <div className="text-4xl font-black text-[#1b3d27]">
                    #{patientQueueInfo.queueTokenNumber || '--'}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#fbf9f4] p-5 rounded-2xl border border-[#ded5c2] flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2 text-[#556358]">
                    <Users size={18} />
                    <span className="font-bold text-sm">{t('Patients Ahead')}</span>
                  </div>
                  <div className="text-3xl font-black text-[#1b3d27]">
                    {patientQueueInfo.queuePosition > 1 ? patientQueueInfo.queuePosition - 1 : 0}
                  </div>
                </div>

                <div className="bg-[#fbf9f4] p-5 rounded-2xl border border-[#ded5c2] flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-2 text-[#556358]">
                    <Clock size={18} />
                    <span className="font-bold text-sm">{t('Estimated Wait')}</span>
                  </div>
                  <div className="flex items-end gap-1.5">
                    <div className="text-3xl font-black text-[#1b3d27]">
                      {patientQueueInfo.estimatedWaitMinutes}
                    </div>
                    <span className="text-[#556358] font-bold text-sm mb-1">{t('mins')}</span>
                  </div>
                </div>

                <div className="bg-[#f8f5ee] p-5 rounded-2xl border border-[#ded5c2] flex flex-col justify-center">
                  <div className="flex items-center gap-2 mb-3 text-[#556358]">
                    <Activity size={18} />
                    <span className="font-bold text-sm">{t('Current Status')}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#16a34a] animate-pulse" />
                    <span className="font-bold text-[#1b3d27] capitalize">
                      {patientQueueInfo.queueStatus?.replace('_', ' ') || t('Waiting')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Start Intake Banner Card - Only show if not currently in queue */}
        {!patientQueueInfo || patientQueueInfo.queueStatus === 'completed' ? (
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
        
            ) : null}
          </>
        )}


        
        {/* Previous Consultation Records */}
        {activeTab === 'history' && (
          <div className="mt-2">

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
          ) : sessions.filter(s => s.id !== patientQueueInfo?.firestoreSessionId).length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#ded5c2] bg-[#fbf9f4]/70 p-12 text-center">
              <FileText size={32} className="mx-auto mb-3 text-[#829277]" />
              <h4 className="text-sm font-bold text-[#1c241e] mb-1">No Intake Records Found</h4>
              <p className="text-xs text-[#556358] max-w-md mx-auto mb-4">
                You haven&apos;t completed any previous intake sessions yet.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {sessions
                .filter(s => s.id !== patientQueueInfo?.firestoreSessionId)
                .map((s) => (
                <div 
                  key={s.id} 
                  className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#234e32]/50 transition shadow-sm"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 mb-1">
                      {s.queueTokenNumber && (
                        <span className="font-mono text-sm font-bold text-[#1b3d27]">
                          #{s.queueTokenNumber}
                        </span>
                      )}
                      <span className="text-xs font-bold text-[#829277] flex items-center gap-1">
                        <Calendar size={12} />
                        {s.createdAt?.toMillis ? new Date(s.createdAt.toMillis()).toLocaleDateString() : 'N/A'}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        s.queueStatus === 'completed'
                          ? 'bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2]'
                          : 'bg-[#f6ebd0] text-[#7a5524] border border-[#e5d4a4]'
                      }`}>
                        {s.queueStatus?.replace(/_/g, ' ') || 'Archived'}
                      </span>
                    </div>
                    <div className="text-base font-bold text-[#1c241e]">
                      Chief Complaint: <span className="text-[#234e32]">{s.chiefComplaint || 'Routine Intake'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-auto">
                    <a
                      href={`/patient/summary?sessionId=${s.id}`}
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
        )}
          
        {/* Placeholder Tabs */}
        {['documents', 'timeline', 'summary', 'profile'].includes(activeTab) && (
          <div className="mt-8 rounded-3xl border border-dashed border-[#ded5c2] bg-[#fbf9f4]/70 p-12 text-center">
            <h4 className="text-xl font-bold text-[#1c241e] mb-2">{navItems.find(n => n.id === activeTab)?.label}</h4>
            <p className="text-sm text-[#556358] max-w-md mx-auto">
              This section is currently under development. You will soon be able to view your {navItems.find(n => n.id === activeTab)?.label.toLowerCase()} here.
            </p>
          </div>
        )}

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
