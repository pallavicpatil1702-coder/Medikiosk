import { NextResponse } from 'next/server';
import { getApps, initializeApp, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { PatientSession } from '@/lib/types';
import { generateMedicationSafetyAlerts } from '@/lib/clinical/herbDrugSafetyEngine';

function getAdminFirestore() {
  if (getApps().length > 0) {
    return getFirestore(getApps()[0]);
  }
  const app = initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'medikiosk-df39e',
  });
  return getFirestore(app);
}

export async function POST(req: Request) {
  let sessionId: string | null = null;
  
  try {
    const body = await req.json();
    sessionId = body.sessionId;

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const sessionRef = db.collection('patientSessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionData = sessionDoc.data() as PatientSession;

    // Skip if already generated to prevent duplication
    if (sessionData.medicationSafetyAlerts && sessionData.medicationSafetyAlerts.length > 0) {
      return NextResponse.json({ alerts: sessionData.medicationSafetyAlerts });
    }

    console.log(`[API/MedicationSafety] Running safety engine for session ${sessionId}...`);

    const alerts = await generateMedicationSafetyAlerts(sessionData);

    // Save to Firestore
    if (alerts.length > 0) {
      await sessionRef.update({
        medicationSafetyAlerts: alerts,
        updatedAt: new Date().toISOString()
      });
    }

    return NextResponse.json({ alerts });

  } catch (error) {
    console.error('[API/MedicationSafety] Error:', error);
    return NextResponse.json({ error: 'Failed to generate medication safety alerts' }, { status: 500 });
  }
}
