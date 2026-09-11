import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, updateDoc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

// Load env vars (assuming .env.local is already loaded via vite/next)
import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function patientCreateSession() {
  await signInAnonymously(auth);
  const user = auth.currentUser;
  if (!user) throw new Error('Anonymous sign-in failed');
  const sessionRef = await addDoc(collection(db, 'patientSessions'), {
    patientId: user.uid,
    chiefComplaint: 'Test complaint',
    answers: [],
    documents: [],
    redFlags: [],
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log('Patient session created', sessionRef.id);
  await signOut(auth);
  return sessionRef.id;
}

async function patientAttemptCrossUpdate(otherSessionId) {
  await signInAnonymously(auth);
  const user = auth.currentUser;
  if (!user) throw new Error('Anonymous sign-in failed');
  const otherRef = doc(db, 'patientSessions', otherSessionId);
  try {
    await updateDoc(otherRef, { chiefComplaint: 'Hacked complaint' });
    console.log('Cross update succeeded (UNEXPECTED)');
  } catch (e) {
    console.log('Cross update error (expected):', e.message);
  }
  await signOut(auth);
}

async function nurseReadAndTriagedUpdate(sessionId) {
  // Sign in with test nurse email/password (ensure this user exists and has nurse claim)
  const nurseEmail = process.env.TEST_NURSE_EMAIL;
  const nursePass = process.env.TEST_NURSE_PASSWORD;
  if (!nurseEmail || !nursePass) {
    console.error('Set TEST_NURSE_EMAIL and TEST_NURSE_PASSWORD in .env.local to run nurse tests');
    return;
  }
  await signInWithEmailAndPassword(auth, nurseEmail, nursePass);
  const sessionRef = doc(db, 'patientSessions', sessionId);
  const snap = await getDoc(sessionRef);
  console.log('Nurse read session data:', snap.data());

  // Allowed triage update
  try {
    await updateDoc(sessionRef, {
      triageStatus: 'forwarded_to_physician',
      triageNote: 'Patient forwarded',
      triageTimestamp: new Date().toISOString(),
      triageNurseId: auth.currentUser?.uid,
    });
    console.log('Nurse triage update succeeded');
  } catch (e) {
    console.error('Nurse triage update FAILED:', e.message);
  }

  // Disallowed field update (e.g., chiefComplaint)
  try {
    await updateDoc(sessionRef, { chiefComplaint: 'Should not be allowed' });
    console.log('Nurse illegal field update succeeded (UNEXPECTED)');
  } catch (e) {
    console.log('Nurse illegal field update error (expected):', e.message);
  }
  await signOut(auth);
}

(async () => {
  console.log('--- Starting RBAC tests ---');
  // 1. Patient A creates a session
  const sessionId = await patientCreateSession();

  // 2. Patient B attempts to modify Patient A's session
  await patientAttemptCrossUpdate(sessionId);

  // 3. Nurse actions (requires env vars)
  await nurseReadAndTriagedUpdate(sessionId);

  console.log('--- RBAC tests completed ---');
})();
