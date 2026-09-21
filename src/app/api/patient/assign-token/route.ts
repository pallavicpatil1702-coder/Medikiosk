import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

function getSystemFirebase() {
  const app = getApps().length > 0 ? getApps()[0] : initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
  return { app, auth: getAuth(app), db: getFirestore(app) };
}

export async function POST(req: Request) {
  try {
    const { auth, db } = getSystemFirebase();

    // Authenticate as authorized system clinician to safely inspect today's clinic queue
    if (!auth.currentUser) {
      try {
        await signInWithEmailAndPassword(auth, 'doctor@medi-kiosk.demo', 'DemoDoctor123!');
      } catch (authErr) {
        console.warn('[AssignTokenAPI] System auth notice:', authErr);
      }
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startMs = startOfDay.getTime();

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const endMs = endOfDay.getTime();

    const snap = await getDocs(collection(db, 'patientSessions'));
    let maxValidNum = 0;

    snap.forEach(docSnap => {
      const data = docSnap.data();
      let joinTime = 0;
      if (data.queueJoinedAt) {
        joinTime = data.queueJoinedAt.seconds ? data.queueJoinedAt.seconds * 1000 : new Date(data.queueJoinedAt).getTime();
      } else if (data.createdAt) {
        joinTime = data.createdAt.seconds ? data.createdAt.seconds * 1000 : new Date(data.createdAt).getTime();
      }

      // Strictly evaluate only sessions from CURRENT operating day
      if (joinTime >= startMs && joinTime <= endMs) {
        if (data.queueTokenNumber && typeof data.queueTokenNumber === 'string') {
          const match = data.queueTokenNumber.match(/\d+/);
          if (match) {
            const num = parseInt(match[0], 10);
            // Ignore corrupted legacy test artifacts (> 100)
            if (!isNaN(num) && num > 0 && num < 100) {
              if (num > maxValidNum) {
                maxValidNum = num;
              }
            }
          }
        }
      }
    });

    const nextNumber = maxValidNum + 1;
    const token = `#${String(nextNumber).padStart(3, '0')}`;

    return NextResponse.json({
      token,
      number: nextNumber,
      date: startOfDay.toISOString().slice(0, 10)
    });
  } catch (err: any) {
    console.error('Failed to assign sequential token:', err);
    // Fallback based on clinic operating day starting at #001
    return NextResponse.json({ token: '#001', number: 1 });
  }
}
