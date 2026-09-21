"use client";

import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { User, Phone, CalendarDays, ArrowRight, Mail } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, updateSession } from '@/lib/store/store';
import { Patient } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';
import { useSync } from '@/hooks/useSync';
import { useAuth } from '@/context/AuthContext';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { generateUUID } from '@/lib/uuid';

export default function ProfilePage() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  const router = useRouter();
  const { t } = useTranslation();
  const { sync } = useSync();

  const { currentUser, loading: authLoading } = useAuth();

  useEffect(() => {
    let isMounted = true;

    async function loadPatientData() {
      // If auth is still resolving on mobile network, wait unless auth.currentUser is already present
      if (authLoading && !auth.currentUser) {
        return;
      }

      try {
        const activeUser = currentUser || auth.currentUser;
        const session = getSession();

        let resolvedName = '';
        let resolvedAge = '';
        let resolvedGender = 'Male';
        let resolvedContact = '';
        let resolvedEmail = '';
        let resolvedAbhaId: string | undefined = session?.patient?.abhaId;
        let resolvedCreatedAt = session?.patient?.createdAt || new Date().toISOString();

        if (activeUser && !activeUser.isAnonymous) {
          // 1. Primary Source of Truth: Authenticated patient document in Firestore
          try {
            const profileRef = doc(db, 'patients', activeUser.uid);
            const profileSnap = await getDoc(profileRef);

            if (profileSnap.exists()) {
              const data = profileSnap.data();
              resolvedName = data.name || data.fullName || activeUser.displayName || '';
              if (data.age !== undefined && data.age !== null && data.age !== '') {
                resolvedAge = String(data.age);
              } else if (data.dob) {
                resolvedAge = String(data.dob);
              }
              if (data.gender) resolvedGender = data.gender;
              resolvedContact = data.contact || data.phone || data.mobile || activeUser.phoneNumber || '';
              resolvedEmail = data.email || activeUser.email || '';
              if (data.abhaId) resolvedAbhaId = data.abhaId;
              if (data.createdAt) resolvedCreatedAt = data.createdAt;
            } else if (activeUser.email === 'patient@medi-kiosk.demo') {
              // Demo patient fallback if Firestore document is not yet provisioned
              resolvedName = 'Rahul Sharma';
              resolvedAge = '35';
              resolvedGender = 'Male';
              resolvedContact = '9876543210';
              resolvedEmail = 'patient@medi-kiosk.demo';
            }
          } catch (err) {
            console.warn("Could not fetch Firestore profile for authenticated patient:", err);
          }

          // 2. If some fields were missing in Firestore, check local session IF it belongs to the same user
          if (session?.patient && session.patient.id === activeUser.uid) {
            if (!resolvedName && session.patient.name) resolvedName = session.patient.name;
            if (!resolvedAge && session.patient.age) resolvedAge = String(session.patient.age);
            if (resolvedGender === 'Male' && session.patient.gender) resolvedGender = session.patient.gender;
            if (!resolvedContact && session.patient.contact) resolvedContact = session.patient.contact;
            if (!resolvedEmail && session.patient.email) resolvedEmail = session.patient.email;
          }

          // 3. Fallbacks from Auth user object
          if (!resolvedName && activeUser.displayName) resolvedName = activeUser.displayName;
          if (!resolvedEmail && activeUser.email) resolvedEmail = activeUser.email;
          if (!resolvedContact && activeUser.phoneNumber) resolvedContact = activeUser.phoneNumber;

          // Sync local session with the verified logged-in patient data
          updateSession({
            patient: {
              id: activeUser.uid,
              name: resolvedName,
              age: parseInt(resolvedAge, 10) || 0,
              gender: resolvedGender,
              contact: resolvedContact,
              email: resolvedEmail || undefined,
              abhaId: resolvedAbhaId,
              language: session.patient?.language || session.language,
              createdAt: resolvedCreatedAt
            }
          });
        } else {
          // Unauthenticated / New / Anonymous patient: use session patient data if available
          if (session?.patient) {
            resolvedName = session.patient.name || '';
            resolvedAge = session.patient.age ? String(session.patient.age) : '';
            resolvedGender = session.patient.gender || 'Male';
            resolvedContact = session.patient.contact || '';
            resolvedEmail = session.patient.email || '';
          }
        }

        if (isMounted) {
          if (resolvedName) setName(resolvedName);
          if (resolvedAge) setAge(resolvedAge);
          if (resolvedGender) setGender(resolvedGender);
          if (resolvedContact) setContact(resolvedContact);
          if (resolvedEmail) setEmail(resolvedEmail);
          setLoadingProfile(false);
        }
      } catch (err) {
        console.error("Error during profile loading:", err);
        if (isMounted) setLoadingProfile(false);
      }
    }

    loadPatientData();

    return () => {
      isMounted = false;
    };
  }, [currentUser, authLoading]);

  const handleContinue = async () => {
    const session = getSession();
    const activeUser = currentUser || auth.currentUser;
    const patientId = (activeUser && !activeUser.isAnonymous) ? activeUser.uid : (session.patient?.id || generateUUID());
    const updatedPatient: Patient = {
      ...session.patient,
      id: patientId,
      name: name.trim(),
      age: parseInt(age, 10) || 0,
      gender,
      contact: contact.trim(),
      email: email.trim() || session.patient?.email || activeUser?.email || undefined,
      language: session.patient?.language || session.language,
      createdAt: session.patient?.createdAt || new Date().toISOString(),
    };
    updateSession({ patient: updatedPatient });

    // If authenticated, persist updated profile data to the canonical patient document in Firestore
    if (activeUser && !activeUser.isAnonymous) {
      try {
        await setDoc(doc(db, 'patients', activeUser.uid), {
          id: activeUser.uid,
          name: name.trim(),
          age: parseInt(age, 10) || 0,
          gender,
          contact: contact.trim(),
          email: email.trim() || activeUser.email || '',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn('Could not save patient profile update to Firestore:', e);
      }
    }

    router.push('/patient/complaint');
  };

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title={t('Patient Profile')} backHref="/patient/consent" />
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        <ProgressBar current={5} total={13} />
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1b3d27] mb-2">{t('Patient Information')}</h2>
          <p className="text-[#556358] text-sm">{t('Your details help us prepare a structured clinical summary.')}</p>
        </div>
        <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-6 md:p-12">
          {loadingProfile ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <div className="w-9 h-9 border-3 border-[#234e32] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-semibold text-[#556358]">{t('Loading your profile details...')}</span>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="p-name" className="block text-sm font-bold text-[#1c241e] mb-2">{t('Name')}</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 text-[#829277]" size={18} />
                    <input 
                      id="p-name" 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-[#ded5c2] bg-[#f8f5ee] text-[#1c241e] text-base font-semibold focus:outline-none focus:ring-3 focus:ring-[#234e32]/25 focus:border-[#234e32] transition" 
                      placeholder={t('e.g. Rahul Sharma')} 
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="p-age" className="block text-sm font-bold text-[#1c241e] mb-2">{t('Age')}</label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3.5 top-3.5 text-[#829277]" size={18} />
                    <input 
                      id="p-age" 
                      type="number" 
                      value={age} 
                      onChange={e => setAge(e.target.value)} 
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-[#ded5c2] bg-[#f8f5ee] text-[#1c241e] text-base font-semibold focus:outline-none focus:ring-3 focus:ring-[#234e32]/25 focus:border-[#234e32] transition" 
                      placeholder={t('e.g. 25')} 
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="p-gender" className="block text-sm font-bold text-[#1c241e] mb-2">{t('Gender')}</label>
                  <select 
                    id="p-gender" 
                    value={gender} 
                    onChange={e => setGender(e.target.value)} 
                    className="w-full px-4 py-3.5 rounded-2xl border border-[#ded5c2] bg-[#f8f5ee] text-[#1c241e] text-base font-semibold focus:outline-none focus:ring-3 focus:ring-[#234e32]/25 focus:border-[#234e32] transition"
                  >
                    <option value="Male">{t('Male')}</option>
                    <option value="Female">{t('Female')}</option>
                    <option value="Other">{t('Other')}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="p-contact" className="block text-sm font-bold text-[#1c241e] mb-2">{t('Contact')}</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-3.5 text-[#829277]" size={18} />
                    <input 
                      id="p-contact" 
                      value={contact} 
                      onChange={e => setContact(e.target.value)} 
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-[#ded5c2] bg-[#f8f5ee] text-[#1c241e] text-base font-semibold focus:outline-none focus:ring-3 focus:ring-[#234e32]/25 focus:border-[#234e32] transition" 
                      placeholder={t('e.g. 9876543210')} 
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="p-email" className="block text-sm font-bold text-[#1c241e] mb-2">{t('Email Address')}</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 text-[#829277]" size={18} />
                    <input 
                      id="p-email" 
                      type="email"
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-[#ded5c2] bg-[#f8f5ee] text-[#1c241e] text-base font-semibold focus:outline-none focus:ring-3 focus:ring-[#234e32]/25 focus:border-[#234e32] transition" 
                      placeholder={t('e.g. patient@example.com')} 
                    />
                  </div>
                </div>
              </div>
              <div className="mt-10 flex justify-end">
                <button 
                  onClick={handleContinue} 
                  className="w-full sm:w-auto justify-center inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-8 py-3.5 text-base shadow-lg shadow-[#234e32]/25 transition"
                >
                  <span>{t('Continue')}</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </AyurvedaBackground>
  );
}

