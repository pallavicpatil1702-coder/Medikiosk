"use client";

import Header from '@/components/Header';
import ProgressBar from '@/components/ProgressBar';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { User, Phone, CalendarDays, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, updateSession } from '@/lib/store/store';
import { Patient } from '@/lib/types';
import { useTranslation } from '@/lib/i18n';
import { useSync } from '@/hooks/useSync';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function ProfilePage() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [contact, setContact] = useState('');
  const router = useRouter();
  const { t } = useTranslation();
  const { sync } = useSync();

  const { currentUser } = useAuth();

  useEffect(() => {
    async function loadPatientData() {
      const session = getSession();
      // Start by checking if session has data
      if (session?.patient?.name) {
        setName(session.patient.name);
        setAge(session.patient.age?.toString() || '');
        setGender(session.patient.gender || 'Male');
        setContact(session.patient.contact || '');
      } else if (currentUser && !currentUser.isAnonymous) {
        // If not in session but user is logged in, fetch from Firestore
        try {
          const profileRef = doc(db, 'patients', currentUser.uid);
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            const data = profileSnap.data();
            setName(data.name || '');
            setAge(data.age?.toString() || '');
            setGender(data.gender || 'Male');
            setContact(data.contact || '');
            
            // Also update the local session so it's ready
            updateSession({ 
              patient: {
                id: currentUser.uid,
                name: data.name || '',
                age: parseInt(data.age, 10) || 0,
                gender: data.gender || 'Male',
                contact: data.contact || '',
                createdAt: data.createdAt
              }
            });
          } else {
            // Fallback for Demo accounts or users without a profile
            if (currentUser.email === 'patient@medi-kiosk.demo') {
              setName('Rahul Sharma');
              setAge('35');
              setGender('Male');
              setContact('9876543210');
            }
          }
        } catch (err) {
          console.error("Failed to load patient profile:", err);
        }
      }
    }
    
    loadPatientData();
  }, [currentUser]);

  const handleContinue = () => {
    const session = getSession();
    const updatedPatient: Patient = {
      ...session.patient,
      id: session.patient?.id || crypto.randomUUID(),
      name,
      age: parseInt(age, 10) || 0,
      gender,
      contact,
      createdAt: session.patient?.createdAt || new Date().toISOString(),
    };
    updateSession({ patient: updatedPatient });
    sync();
    router.push('/patient/complaint');
  };

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title="Patient Profile" backHref="/patient/consent" />
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-16">
        <ProgressBar current={5} total={13} />
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1b3d27] mb-2">{t('Patient Information')}</h2>
          <p className="text-[#556358] text-sm">{t('Your details help us prepare a structured clinical summary.')}</p>
        </div>
        <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] shadow-xl p-6 md:p-12">
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
        </div>
      </div>
    </AyurvedaBackground>
  );
}

