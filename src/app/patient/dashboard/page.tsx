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
  Users,
  Languages,
  ChevronRight,
  HeartPulse,
  Download,
  ExternalLink,
  Edit3,
  Save,
  Phone,
  Mail,
  CalendarDays,
  FileImage,
  Loader2,
  Stethoscope,
  Pill,
  ShieldAlert
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
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

  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    age: '',
    gender: 'Male',
    contact: '',
    abhaId: ''
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');

  // Selected session for clinical summary tab
  const [selectedSummarySessionId, setSelectedSummarySessionId] = useState<string>('');

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

  // Real-time synchronization of patient's sessions and profile
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Subscribe to patient's consultation sessions
    const q = query(
      collection(db, 'patientSessions'),
      where('patientId', '==', currentUser.uid)
    );
    const unsubSessions = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => {
        const tA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
        const tB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
        return tB - tA;
      });
      setSessions(list);
      if (list.length > 0 && !selectedSummarySessionId) {
        setSelectedSummarySessionId(list[0].id);
      }
      setLoading(false);
    }, (err) => {
      console.error('Failed to listen to patient sessions:', err);
      setLoading(false);
    });

    // 2. Subscribe to patient profile document
    const profileRef = doc(db, 'patients', currentUser.uid);
    const unsubProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPatientProfile(data);
        setProfileForm({
          name: data.name || '',
          age: data.age?.toString() || '',
          gender: data.gender || 'Male',
          contact: data.contact || '',
          abhaId: data.abhaId || ''
        });
      }
    }, (err) => {
      console.error('Failed to listen to patient profile:', err);
    });

    return () => {
      unsubSessions();
      unsubProfile();
    };
  }, [currentUser]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSavingProfile(true);
    setProfileSuccessMsg('');
    try {
      const updatedData = {
        id: currentUser.uid,
        name: profileForm.name.trim(),
        age: parseInt(profileForm.age, 10) || 0,
        gender: profileForm.gender,
        contact: profileForm.contact.trim(),
        abhaId: profileForm.abhaId.trim() || '',
        email: currentUser.email || '',
        updatedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'patients', currentUser.uid), updatedData, { merge: true });
      setEditingProfile(false);
      setProfileSuccessMsg(t('Profile updated successfully!'));
      setTimeout(() => setProfileSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Failed to save profile:', err);
    } finally {
      setSavingProfile(false);
    }
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

        {/* Start Intake Hero - Only show if not currently in queue */}
        {!patientQueueInfo || patientQueueInfo.queueStatus === 'completed' ? (
          <div className="mt-8 grid lg:grid-cols-2 gap-10 items-center">
            {/* Left Column */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#e4ede1] border border-[#c7d9c2] px-4 py-1.5 text-xs font-bold text-[#234e32] mb-6 shadow-xs">
                <Languages size={15} /> {t('Multilingual • Touch Friendly • Voice Intake')}
              </div>

              <h2 className="text-4xl sm:text-5xl font-serif font-bold text-[#1b3d27] tracking-tight leading-[1.15] mb-5">
                {t('Smart AI-Assisted')} <br />
                <span className="text-[#6f4827]">{t('Healthcare Intake')}</span>
              </h2>

              <p className="text-base text-[#4a5749] leading-relaxed mb-8 max-w-xl">
                {t('Helping healthcare professionals spend less time collecting routine history and more time caring for patients, grounded in holistic clinical wellness.')}
              </p>

              <div className="flex flex-wrap gap-4">
                <a
                  href="/patient/language"
                  className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-4 text-base shadow-lg shadow-[#234e32]/25 transition"
                >
                  {t('Start Consultation')} <ChevronRight size={20} />
                </a>
              </div>

              <div className="mt-8 flex items-center gap-6 text-xs text-[#556358] font-semibold">
                <span className="flex items-center gap-1.5"><Activity size={16} className="text-[#234e32]" /> {t('Touch Screen')}</span>
                <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-[#234e32]" /> {t('Secure Session')}</span>
                <span className="flex items-center gap-1.5"><Languages size={16} className="text-[#234e32]" /> {t('9 Languages')}</span>
              </div>
            </div>

            {/* Right Column */}
            <div className="rounded-3xl bg-[#fbf9f4]/95 backdrop-blur-xl border border-[#ded5c2] p-8 shadow-[0_15px_40px_-10px_rgba(45,35,20,0.12)]">
              <div className="flex items-center gap-3.5 mb-6 pb-5 border-b border-[#ded5c2]/70">
                <div className="w-12 h-12 rounded-2xl bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] flex items-center justify-center shadow-xs">
                  <HeartPulse size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-[#1b3d27] text-lg">{t('Holistic Intake Flow')}</h3>
                  <p className="text-xs font-semibold text-[#556358]">{t('Review by attending doctor required')}</p>
                </div>
              </div>

              <ul className="space-y-4 text-sm text-[#4a5749] font-medium">
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#234e32] shrink-0" />
                  {t('Patient Identification & Consent Logging')}
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#234e32] shrink-0" />
                  {t('Chief Complaint Logging in 9 Languages')}
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#234e32] shrink-0" />
                  {t('Speak naturally using Voice Microphone')}
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#234e32] shrink-0" />
                  {t('Listen to questions using Speech Audio')}
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#234e32] shrink-0" />
                  {t('Medical Report & Document OCR Upload')}
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#234e32] shrink-0" />
                  {t('Definitive Clinical Red-Flag Triage')}
                </li>
                <li className="flex items-start gap-3">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-[#234e32] shrink-0" />
                  {t('Final decision by Attending Doctor')}
                </li>
              </ul>
              <div className="mt-8 bg-[#e4ede1] rounded-2xl p-4 flex items-start gap-3 border border-[#c7d9c2]">
                <ShieldCheck size={20} className="text-[#234e32] shrink-0 mt-0.5" />
                <p className="text-xs text-[#234e32] font-semibold leading-relaxed">
                  {t('Your privacy is protected. MediKiosk complies with healthcare data security standards.')}
                </p>
              </div>
            </div>
          </div>
            ) : null}
          </>
        )}


        
        {/* Previous Consultation Records / History */}
        {activeTab === 'history' && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-serif font-bold text-[#1b3d27]">{t('Your Intake & Consultation History')}</h3>
                <p className="text-xs text-[#556358]">{t('All intake consultations recorded under your verified account')}</p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-3xl border border-[#ded5c2] bg-[#fbf9f4]/90 p-12 text-center text-[#556358] text-xs font-bold">
                {t('Loading your clinical intake records...')}
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#ded5c2] bg-[#fbf9f4]/70 p-12 text-center">
                <FileText size={32} className="mx-auto mb-3 text-[#829277]" />
                <h4 className="text-sm font-bold text-[#1c241e] mb-1">{t('No Intake Records Found')}</h4>
                <p className="text-xs text-[#556358] max-w-md mx-auto mb-4">
                  {t('You haven\'t completed any intake sessions yet. Start a consultation to begin.')}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {sessions.map((s) => {
                  const isCurrentQueue = s.id === patientQueueInfo?.firestoreSessionId;
                  return (
                    <div 
                      key={s.id} 
                      className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#234e32]/50 transition shadow-sm"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                          {s.queueTokenNumber && (
                            <span className="font-mono text-sm font-bold text-[#1b3d27] px-2.5 py-0.5 rounded-full bg-[#f8f5ee] border border-[#ded5c2]">
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
                              : isCurrentQueue
                              ? 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]'
                              : 'bg-[#f6ebd0] text-[#7a5524] border border-[#e5d4a4]'
                          }`}>
                            {isCurrentQueue ? t('Live Queue') : (s.queueStatus?.replace(/_/g, ' ') || 'Archived')}
                          </span>
                        </div>
                        <div className="text-base font-bold text-[#1c241e]">
                          {t('Chief Complaint:')} <span className="text-[#234e32]">{s.chiefComplaint || t('Routine Intake')}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end md:self-auto">
                        <a
                          href={`/patient/summary?sessionId=${s.id}`}
                          className="px-4 py-2 rounded-xl bg-[#f8f5ee] hover:bg-[#ede5d6] text-[#234e32] text-xs font-bold transition flex items-center gap-1.5 border border-[#ded5c2]"
                        >
                          <FileText size={14} />
                          <span>{t('View Intake Summary')}</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-serif font-bold text-[#1b3d27]">{t('My Medical Documents')}</h3>
                <p className="text-xs text-[#556358]">{t('Lab reports, imaging scans, and prescriptions from your visits')}</p>
              </div>
            </div>

            {(() => {
              const allDocs = sessions.flatMap((s: any) => 
                (s.documents || []).map((docItem: any, idx: number) => ({
                  ...docItem,
                  uniqueKey: `${s.id}-${docItem.id || idx}`,
                  sessionId: s.id,
                  sessionDate: s.createdAt?.toMillis ? new Date(s.createdAt.toMillis()).toLocaleDateString() : 'N/A',
                  complaint: s.chiefComplaint || 'Consultation Record',
                  token: s.queueTokenNumber
                }))
              );

              if (loading) {
                return (
                  <div className="rounded-3xl border border-[#ded5c2] bg-[#fbf9f4]/90 p-12 text-center text-[#556358] text-xs font-bold">
                    {t('Loading your documents...')}
                  </div>
                );
              }

              if (allDocs.length === 0) {
                return (
                  <div className="rounded-3xl border border-dashed border-[#ded5c2] bg-[#fbf9f4]/70 p-12 text-center">
                    <Folder size={36} className="mx-auto mb-3 text-[#829277]" />
                    <h4 className="text-sm font-bold text-[#1c241e] mb-1">{t('No Medical Documents Found')}</h4>
                    <p className="text-xs text-[#556358] max-w-md mx-auto mb-4">
                      {t('You haven\'t uploaded any medical documents or reports yet. Reports uploaded during your clinical intakes will be saved here.')}
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid sm:grid-cols-2 gap-4">
                  {allDocs.map((docItem: any) => (
                    <div 
                      key={docItem.uniqueKey} 
                      className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] p-5 shadow-sm hover:border-[#234e32]/40 transition flex flex-col justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] flex items-center justify-center shrink-0">
                          {docItem.fileType?.includes('image') ? <FileImage size={20} /> : <FileText size={20} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-[#1c241e] truncate" title={docItem.fileName}>
                            {docItem.fileName || 'Medical_Report'}
                          </h4>
                          <div className="text-xs text-[#556358] mt-0.5 flex flex-wrap gap-2">
                            <span>{docItem.size || 'PDF/Image'}</span>
                            <span>•</span>
                            <span>{docItem.sessionDate}</span>
                          </div>
                          <div className="mt-2 text-[11px] font-semibold text-[#234e32] bg-[#e4ede1]/70 px-2.5 py-0.5 rounded-full inline-block">
                            {docItem.complaint} {docItem.token ? `(#${docItem.token})` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#ded5c2]/60">
                        {docItem.downloadUrl || docItem.dataUrl ? (
                          <a
                            href={docItem.downloadUrl || docItem.dataUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#234e32] hover:bg-[#1a3b26] text-white text-xs font-bold transition shadow-xs"
                          >
                            <Download size={13} />
                            <span>{t('View / Download')}</span>
                          </a>
                        ) : (
                          <span className="text-xs text-[#829277] italic">{t('Archived in intake record')}</span>
                        )}
                        <a
                          href={`/patient/summary?sessionId=${docItem.sessionId}`}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#f8f5ee] hover:bg-[#ede5d6] text-[#4d2f19] text-xs font-bold border border-[#ded5c2] transition"
                        >
                          <ExternalLink size={13} />
                          <span>{t('Intake')}</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'timeline' && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-serif font-bold text-[#1b3d27]">{t('Medical Timeline')}</h3>
                <p className="text-xs text-[#556358]">{t('Chronological view of your consultations, symptoms, and clinical visits')}</p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-3xl border border-[#ded5c2] bg-[#fbf9f4]/90 p-12 text-center text-[#556358] text-xs font-bold">
                {t('Loading your medical timeline...')}
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#ded5c2] bg-[#fbf9f4]/70 p-12 text-center">
                <Clock size={36} className="mx-auto mb-3 text-[#829277]" />
                <h4 className="text-sm font-bold text-[#1c241e] mb-1">{t('No Timeline Events Yet')}</h4>
                <p className="text-xs text-[#556358] max-w-md mx-auto">
                  {t('Your medical history will appear chronologically here once you complete consultation intakes.')}
                </p>
              </div>
            ) : (
              <div className="relative pl-6 sm:pl-8 border-l-2 border-[#c7d9c2] space-y-8 ml-3 sm:ml-4">
                {sessions.map((s: any) => {
                  const dateStr = s.createdAt?.toMillis 
                    ? new Date(s.createdAt.toMillis()).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : 'Consultation';
                  const hasRedFlags = s.redFlags && s.redFlags.length > 0;
                  const answersCount = s.answers?.length || 0;

                  return (
                    <div key={s.id} className="relative group">
                      {/* Timeline Dot */}
                      <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-5 h-5 rounded-full border-4 border-[#fbf9f4] bg-[#234e32] group-hover:scale-125 transition-transform" />

                      <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] p-6 shadow-sm hover:border-[#234e32]/40 transition">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#829277] flex items-center gap-1">
                              <Calendar size={13} />
                              {dateStr}
                            </span>
                            {s.queueTokenNumber && (
                              <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#f8f5ee] border border-[#ded5c2] text-[#1b3d27]">
                                #{s.queueTokenNumber}
                              </span>
                            )}
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            s.queueStatus === 'completed'
                              ? 'bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2]'
                              : 'bg-[#f6ebd0] text-[#7a5524] border border-[#e5d4a4]'
                          }`}>
                            {s.queueStatus?.replace(/_/g, ' ') || 'Archived'}
                          </span>
                        </div>

                        <h4 className="text-lg font-bold text-[#1c241e] mb-1.5 flex items-center gap-2">
                          <Stethoscope size={18} className="text-[#234e32]" />
                          <span>{s.chiefComplaint || t('Routine Medical Consultation')}</span>
                        </h4>

                        {hasRedFlags && (
                          <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#fff5f5] border border-[#b83b3b]/30 text-[#8a1f1f] text-xs font-bold">
                            <ShieldAlert size={14} />
                            <span>{s.redFlags.length} {t('Red Flag Alert(s) Detected')}</span>
                          </div>
                        )}

                        <div className="grid sm:grid-cols-2 gap-3 text-xs text-[#556358] mb-4">
                          <div className="bg-[#f8f5ee] p-3 rounded-xl border border-[#ded5c2]">
                            <span className="font-bold text-[#1c241e] block mb-0.5">{t('Intake Details')}</span>
                            <span>{answersCount} questions recorded • {s.language?.toUpperCase() || 'EN'}</span>
                          </div>
                          <div className="bg-[#f8f5ee] p-3 rounded-xl border border-[#ded5c2]">
                            <span className="font-bold text-[#1c241e] block mb-0.5">{t('Uploaded Reports')}</span>
                            <span>{s.documents?.length || 0} document(s) attached</span>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <a
                            href={`/patient/summary?sessionId=${s.id}`}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#234e32] hover:text-[#1a3b26] bg-[#e4ede1] hover:bg-[#c7d9c2] px-4 py-2 rounded-xl transition"
                          >
                            <span>{t('View Full Summary')}</span>
                            <ArrowRight size={14} />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Clinical Summary Tab */}
        {activeTab === 'summary' && (
          <div className="mt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-serif font-bold text-[#1b3d27]">{t('Clinical Summaries')}</h3>
                <p className="text-xs text-[#556358]">{t('Review structured summaries and intake notes from your consultations')}</p>
              </div>

              {sessions.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#556358]">{t('Select Session:')}</span>
                  <select
                    value={selectedSummarySessionId || (sessions[0]?.id || '')}
                    onChange={(e) => setSelectedSummarySessionId(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-[#ded5c2] bg-[#f8f5ee] text-xs font-bold text-[#1b3d27] focus:outline-none focus:ring-2 focus:ring-[#234e32]"
                  >
                    {sessions.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.chiefComplaint || 'Intake'} - #{s.queueTokenNumber || s.id.slice(0, 6)} ({s.createdAt?.toMillis ? new Date(s.createdAt.toMillis()).toLocaleDateString() : 'N/A'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {(() => {
              if (loading) {
                return (
                  <div className="rounded-3xl border border-[#ded5c2] bg-[#fbf9f4]/90 p-12 text-center text-[#556358] text-xs font-bold">
                    {t('Loading clinical summary...')}
                  </div>
                );
              }

              if (sessions.length === 0) {
                return (
                  <div className="rounded-3xl border border-dashed border-[#ded5c2] bg-[#fbf9f4]/70 p-12 text-center">
                    <FileCheck size={36} className="mx-auto mb-3 text-[#829277]" />
                    <h4 className="text-sm font-bold text-[#1c241e] mb-1">{t('No Clinical Summaries on Record')}</h4>
                    <p className="text-xs text-[#556358] max-w-md mx-auto">
                      {t('You do not have any saved consultation summaries yet. Complete an intake consultation to generate your structured clinical summary.')}
                    </p>
                  </div>
                );
              }

              const targetSession = sessions.find((s: any) => s.id === selectedSummarySessionId) || sessions[0];
              const summaryData = targetSession?.summary || targetSession?.clinicalSummary;
              const hasRedFlags = targetSession?.redFlags && targetSession.redFlags.length > 0;

              return (
                <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] p-6 sm:p-8 shadow-md space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#ded5c2]">
                    <div>
                      <div className="text-xs font-bold text-[#829277] mb-1 flex items-center gap-1.5">
                        <Calendar size={13} />
                        {targetSession.createdAt?.toMillis ? new Date(targetSession.createdAt.toMillis()).toLocaleString() : 'N/A'}
                        {targetSession.queueTokenNumber && (
                          <span className="font-mono ml-2 font-bold text-[#1b3d27]">Token #{targetSession.queueTokenNumber}</span>
                        )}
                      </div>
                      <h4 className="text-2xl font-serif font-bold text-[#1b3d27]">
                        {targetSession.chiefComplaint || 'Clinical Intake'}
                      </h4>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      targetSession.queueStatus === 'completed'
                        ? 'bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2]'
                        : 'bg-[#f6ebd0] text-[#7a5524] border border-[#e5d4a4]'
                    }`}>
                      {targetSession.queueStatus?.replace(/_/g, ' ') || 'Archived'}
                    </span>
                  </div>

                  {/* Summary Grid */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-4">
                      <div className="text-xs font-extrabold text-[#829277] uppercase tracking-wider mb-1">{t('Reported Complaint')}</div>
                      <div className="text-base font-bold text-[#1c241e]">{targetSession.chiefComplaint || t('Routine intake')}</div>
                    </div>
                    <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-4">
                      <div className="text-xs font-extrabold text-[#829277] uppercase tracking-wider mb-1">{t('Language / Mode')}</div>
                      <div className="text-base font-bold text-[#1c241e] capitalize">{targetSession.language || 'English'} • Touch/Voice Kiosk</div>
                    </div>
                  </div>

                  {/* Medications & Allergies */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-4">
                      <div className="text-xs font-extrabold text-[#829277] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <Pill size={14} />
                        <span>{t('Medications Reported')}</span>
                      </div>
                      <div className="text-sm font-semibold text-[#1c241e]">
                        {summaryData?.medications || summaryData?.history?.medicationTaken || t('No medications reported')}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-[#f8f5ee] border border-[#ded5c2] p-4">
                      <div className="text-xs font-extrabold text-[#829277] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <AlertTriangle size={14} />
                        <span>{t('Known Allergies')}</span>
                      </div>
                      <div className="text-sm font-semibold text-[#1c241e]">
                        {summaryData?.allergies || summaryData?.history?.allergies || t('No known drug allergies reported')}
                      </div>
                    </div>
                  </div>

                  {/* Red Flags Card */}
                  {hasRedFlags && (
                    <div className="rounded-2xl bg-[#fff5f5] border border-[#b83b3b]/40 p-4">
                      <div className="text-sm font-bold text-[#8a1f1f] flex items-center gap-2 mb-2">
                        <ShieldAlert size={18} />
                        <span>{t('Clinical Red Flags Noted During Intake')}</span>
                      </div>
                      <ul className="list-disc list-inside text-xs text-[#771d1d] space-y-1">
                        {targetSession.redFlags.map((rf: any, idx: number) => (
                          <li key={idx}>
                            <span className="font-semibold">{rf.title || rf.symptom || 'Flag'}:</span> {rf.description || rf.reason || 'Flagged for doctor review'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* AI & Clinical Notes */}
                  {summaryData?.aiNotes && (
                    <div className="rounded-2xl bg-[#e4ede1]/50 border border-[#c7d9c2] p-4">
                      <div className="text-xs font-extrabold text-[#234e32] uppercase tracking-wider mb-1">{t('Clinical Intake Assessment')}</div>
                      <p className="text-sm text-[#3b593e] leading-relaxed">{summaryData.aiNotes}</p>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <a
                      href={`/patient/summary?sessionId=${targetSession.id}`}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white text-sm font-bold transition shadow-md"
                    >
                      <FileText size={16} />
                      <span>{t('Open Full Interactive Summary')}</span>
                      <ArrowRight size={16} />
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-xl font-serif font-bold text-[#1b3d27]">{t('Patient Profile')}</h3>
                <p className="text-xs text-[#556358]">{t('Manage your personal information and verified medical records identity')}</p>
              </div>
              {!editingProfile && (
                <button
                  onClick={() => setEditingProfile(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white text-xs font-bold transition shadow-xs"
                >
                  <Edit3 size={14} />
                  <span>{t('Edit Details')}</span>
                </button>
              )}
            </div>

            {profileSuccessMsg && (
              <div className="mb-6 p-4 rounded-2xl bg-[#e4ede1] border border-[#c7d9c2] text-[#234e32] text-xs font-bold flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            {editingProfile ? (
              <form onSubmit={handleSaveProfile} className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] p-6 sm:p-8 shadow-md">
                <h4 className="text-lg font-bold text-[#1c241e] mb-5">{t('Update Your Details')}</h4>
                <div className="grid sm:grid-cols-2 gap-5 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-[#1c241e] mb-1.5">{t('Full Name')}</label>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-4 py-3 rounded-2xl border border-[#ded5c2] bg-white text-sm font-semibold text-[#1c241e] focus:outline-none focus:ring-2 focus:ring-[#234e32]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1c241e] mb-1.5">{t('Age')}</label>
                    <input
                      type="number"
                      value={profileForm.age}
                      onChange={(e) => setProfileForm({ ...profileForm, age: e.target.value })}
                      placeholder="e.g. 35"
                      className="w-full px-4 py-3 rounded-2xl border border-[#ded5c2] bg-white text-sm font-semibold text-[#1c241e] focus:outline-none focus:ring-2 focus:ring-[#234e32]"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1c241e] mb-1.5">{t('Gender')}</label>
                    <select
                      value={profileForm.gender}
                      onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl border border-[#ded5c2] bg-white text-sm font-semibold text-[#1c241e] focus:outline-none focus:ring-2 focus:ring-[#234e32]"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#1c241e] mb-1.5">{t('Contact Phone')}</label>
                    <input
                      type="tel"
                      value={profileForm.contact}
                      onChange={(e) => setProfileForm({ ...profileForm, contact: e.target.value })}
                      placeholder="e.g. 9876543210"
                      className="w-full px-4 py-3 rounded-2xl border border-[#ded5c2] bg-white text-sm font-semibold text-[#1c241e] focus:outline-none focus:ring-2 focus:ring-[#234e32]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[#1c241e] mb-1.5">{t('ABHA ID (14 Digits or @abdm)')}</label>
                    <input
                      type="text"
                      value={profileForm.abhaId}
                      onChange={(e) => setProfileForm({ ...profileForm, abhaId: e.target.value })}
                      placeholder="e.g. 14-1234-5678-9012"
                      className="w-full px-4 py-3 rounded-2xl border border-[#ded5c2] bg-white text-sm font-mono text-[#1c241e] focus:outline-none focus:ring-2 focus:ring-[#234e32]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#ded5c2]">
                  <button
                    type="button"
                    onClick={() => setEditingProfile(false)}
                    className="px-5 py-2.5 rounded-2xl bg-[#f8f5ee] hover:bg-[#ede5d6] text-[#4d2f19] text-xs font-bold border border-[#ded5c2] transition"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white text-xs font-bold transition disabled:opacity-50 shadow-sm"
                  >
                    {savingProfile ? (
                      <><Loader2 size={14} className="animate-spin" /> {t('Saving...')}</>
                    ) : (
                      <><Save size={14} /> {t('Save Profile Changes')}</>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid md:grid-cols-3 gap-6">
                {/* Profile Identity Card */}
                <div className="md:col-span-1 rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] p-6 shadow-sm flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-3xl bg-[#e4ede1] text-[#234e32] border border-[#c7d9c2] flex items-center justify-center font-black text-3xl shadow-xs mb-4">
                    <User size={38} />
                  </div>
                  <h4 className="text-xl font-serif font-bold text-[#1b3d27]">
                    {patientProfile?.name || currentUser?.displayName || 'Patient'}
                  </h4>
                  <span className="mt-1 px-3 py-0.5 rounded-full bg-[#e4ede1] border border-[#c7d9c2] text-[#234e32] text-xs font-bold uppercase tracking-wider">
                    {t('Verified Patient')}
                  </span>
                  <div className="mt-4 pt-4 border-t border-[#ded5c2] w-full text-xs text-[#556358] space-y-2">
                    <div className="flex justify-between">
                      <span className="font-semibold">{t('Status')}:</span>
                      <span className="text-[#234e32] font-bold">{t('Active')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">{t('Consultations')}:</span>
                      <span className="font-bold text-[#1c241e]">{sessions.length}</span>
                    </div>
                  </div>
                </div>

                {/* Profile Details Grid */}
                <div className="md:col-span-2 rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] p-6 sm:p-8 shadow-sm space-y-5">
                  <h4 className="text-sm font-bold text-[#829277] uppercase tracking-wider mb-2">
                    {t('Account & Medical Identification')}
                  </h4>

                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div className="bg-[#f8f5ee] p-4 rounded-2xl border border-[#ded5c2]">
                      <span className="text-xs font-semibold text-[#829277] block mb-1">{t('Full Name')}</span>
                      <span className="font-bold text-[#1c241e]">{patientProfile?.name || 'Not provided'}</span>
                    </div>

                    <div className="bg-[#f8f5ee] p-4 rounded-2xl border border-[#ded5c2]">
                      <span className="text-xs font-semibold text-[#829277] block mb-1">{t('Age & Gender')}</span>
                      <span className="font-bold text-[#1c241e]">
                        {patientProfile?.age ? `${patientProfile.age} yrs` : 'N/A'} • {patientProfile?.gender || 'N/A'}
                      </span>
                    </div>

                    <div className="bg-[#f8f5ee] p-4 rounded-2xl border border-[#ded5c2]">
                      <span className="text-xs font-semibold text-[#829277] block mb-1 flex items-center gap-1">
                        <Phone size={13} /> {t('Contact Number')}
                      </span>
                      <span className="font-bold text-[#1c241e]">{patientProfile?.contact || 'Not provided'}</span>
                    </div>

                    <div className="bg-[#f8f5ee] p-4 rounded-2xl border border-[#ded5c2]">
                      <span className="text-xs font-semibold text-[#829277] block mb-1 flex items-center gap-1">
                        <Mail size={13} /> {t('Email Address')}
                      </span>
                      <span className="font-bold text-[#1c241e] truncate block">{currentUser?.email || patientProfile?.email || 'N/A'}</span>
                    </div>

                    <div className="sm:col-span-2 bg-[#f8f5ee] p-4 rounded-2xl border border-[#ded5c2]">
                      <span className="text-xs font-semibold text-[#829277] block mb-1">{t('ABHA ID (Ayushman Bharat)')}</span>
                      <span className="font-mono font-bold text-[#234e32]">
                        {patientProfile?.abhaId || t('Not linked — click Edit Details to link your ABHA number')}
                      </span>
                    </div>

                    <div className="sm:col-span-2 bg-[#f8f5ee] p-4 rounded-2xl border border-[#ded5c2]">
                      <span className="text-xs font-semibold text-[#829277] block mb-1">{t('Canonical Patient UID')}</span>
                      <span className="font-mono text-xs text-[#556358] select-all break-all">{currentUser?.uid}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
