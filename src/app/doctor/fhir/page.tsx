"use client";

import Header from '@/components/Header';
import AyurvedaBackground from '@/components/AyurvedaBackground';
import { generateRealFHIRResources } from '@/lib/fhirConverter';
import { useState, useEffect, Suspense } from 'react';
import { getSession } from '@/lib/store/store';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { FHIRResource } from '@/lib/types';
import { useSearchParams } from 'next/navigation';
import { FileCode, ArrowRight, User } from 'lucide-react';

function FHIRContent() {
  const [resourceIndex, setResourceIndex] = useState(0);
  const [resources, setResources] = useState<FHIRResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const searchParams = useSearchParams();
  const patientId = searchParams.get('id');

  useEffect(() => {
    async function loadResources() {
      setLoading(true);
      setNotFound(false);

      // 1. Check local session
      const session = getSession();
      if (session && ((session as any).id === patientId || session.firestoreSessionId === patientId || session.patient?.id === patientId || (!patientId && session.patient?.name))) {
        const generated = generateRealFHIRResources(session);
        setResources(generated);
        setLoading(false);
        return;
      }

      // 2. Query Firestore if patientId provided
      if (patientId) {
        try {
          const docRef = doc(db, 'patientSessions', patientId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const generated = generateRealFHIRResources({ id: docSnap.id, ...data });
            setResources(generated);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('Error loading patient from Firestore for FHIR preview:', err);
        }
      }

      setNotFound(true);
      setLoading(false);
    }

    loadResources();
  }, [patientId]);

  if (loading) {
    return (
      <AyurvedaBackground variant="kiosk">
        <Header title="FHIR Data Preview" backHref="/doctor/dashboard" />
        <div className="max-w-5xl mx-auto px-6 py-16 text-center text-[#556358] font-semibold">
          Generating HL7® FHIR® R4 bundle from real patient intake...
        </div>
      </AyurvedaBackground>
    );
  }

  if (notFound || resources.length === 0) {
    return (
      <AyurvedaBackground variant="kiosk">
        <Header title="FHIR Data Preview" backHref="/doctor/dashboard" />
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="rounded-3xl bg-[#fbf9f4]/95 border border-[#ded5c2] p-12 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-[#e4ede1] text-[#234e32] flex items-center justify-center mx-auto mb-4">
              <FileCode size={32} />
            </div>
            <h2 className="text-2xl font-serif font-bold text-[#1b3d27] mb-2">No Active Patient Case Selected</h2>
            <p className="text-sm text-[#556358] mb-6">
              Please open a patient from the Physician Dashboard to inspect and export their real FHIR R4 clinical resources.
            </p>
            <a 
              href="/doctor/dashboard" 
              className="inline-flex items-center gap-2 rounded-2xl bg-[#234e32] hover:bg-[#1a3b26] text-white font-bold px-7 py-3 text-sm shadow-md transition"
            >
              <span>Open Physician Dashboard</span>
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </AyurvedaBackground>
    );
  }

  const current = resources[resourceIndex] || resources[0];

  return (
    <AyurvedaBackground variant="kiosk">
      <Header title="FHIR Data Preview" backHref="/doctor/dashboard" />
      <div className="max-w-5xl mx-auto px-6 py-10 sm:py-14">
        <div className="mb-6">
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-[#1b3d27] mb-2">FHIR Data Preview</h2>
          <p className="text-[#556358] text-sm">
            Standardized HL7® FHIR® R4 clinical representation generated from live intake records.
          </p>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {resources.map((r, i) => (
            <button 
              key={r.id || i} 
              onClick={() => setResourceIndex(i)} 
              className={`rounded-2xl px-5 py-2.5 text-xs font-bold border transition whitespace-nowrap ${
                i === resourceIndex 
                  ? 'bg-[#234e32] text-white border-[#234e32] shadow-sm' 
                  : 'bg-[#fbf9f4] text-[#4d2f19] border-[#ded5c2] hover:bg-[#ede5d6]'
              }`}
            >
              {r.resourceType}
            </button>
          ))}
        </div>

        <div className="rounded-3xl bg-[#142219] text-[#e8f1e6] border border-[#344d3c] shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 bg-[#1b2c21] border-b border-[#344d3c]">
            <div className="font-bold text-base text-white flex items-center gap-2">
              <FileCode size={18} className="text-[#c59b27]" />
              <span>{current.resourceType}</span>
              <span className="ml-2 rounded-full bg-[#162e1e] text-[#a3e0b8] text-xs font-bold px-2.5 py-0.5 border border-[#385540]">
                Live Record
              </span>
            </div>
            <div className="text-xs text-[#829277] font-mono">Resource ID: {current.id}</div>
          </div>
          <div className="p-6 overflow-x-auto">
            <pre className="text-xs leading-relaxed font-mono text-[#a3e0b8]">{JSON.stringify(current, null, 2)}</pre>
          </div>
        </div>
      </div>
    </AyurvedaBackground>
  );
}

export default function FHIRPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[#556358] font-bold">Loading FHIR data...</div>}>
      <FHIRContent />
    </Suspense>
  );
}
