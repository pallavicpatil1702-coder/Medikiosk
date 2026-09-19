import { NextResponse } from 'next/server';
import { generateAyurvedaReferences } from '@/lib/clinical/ayurvedaReferenceEngine';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { sessionId, session } = await req.json();

    if (!sessionId && !session) {
      return NextResponse.json({ error: 'Missing sessionId or session payload' }, { status: 400 });
    }

    let patientSession = session;

    // If we only have sessionId, fetch the session from Firestore
    if (!patientSession && sessionId) {
      const docRef = doc(db, 'patientSessions', sessionId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        patientSession = docSnap.data();
      } else {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }
    }

    // Generate Ayurveda references
    const references = await generateAyurvedaReferences(patientSession);

    // Save back to Firestore if sessionId is provided
    if (sessionId) {
      const docRef = doc(db, 'patientSessions', sessionId);
      await updateDoc(docRef, {
        ayurvedaReferences: references
      });
    }

    return NextResponse.json({ references });

  } catch (error: any) {
    console.error('Ayurveda Reference API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
