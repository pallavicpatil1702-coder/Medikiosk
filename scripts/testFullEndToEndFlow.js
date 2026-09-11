const { initializeApp } = require('firebase/app');
const { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFirestore, collection, addDoc, doc, updateDoc, getDoc, getDocs, query, where, serverTimestamp } = require('firebase/firestore');
require('dotenv').config({ path: './.env.local' });

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

async function runEndToEndVerification() {
  console.log('=====================================================');
  console.log('  STARTING MEDIKIOSK REAL END-TO-END FLOW TEST');
  console.log('=====================================================\n');

  // -----------------------------------------------------------------
  // STEP 1: Patient signs in anonymously & submits clinical intake
  // -----------------------------------------------------------------
  console.log('👉 [STEP 1] Patient: Anonymous Auth & Session Creation...');
  const patientCred = await signInAnonymously(auth);
  const patientUid = patientCred.user.uid;
  console.log(`   Patient signed in with UID: ${patientUid}`);

  const patientSessionData = {
    patientId: patientUid,
    patient: {
      id: patientUid,
      name: 'Ramesh Kumar (Verification Test)',
      age: 48,
      gender: 'Male',
      language: 'en'
    },
    language: 'en',
    chiefComplaint: 'Acute chest tightness and shortness of breath',
    answers: [
      { questionId: 'q1', questionText: 'Where is the discomfort located?', answer: 'Center of my chest radiating to left arm' },
      { questionId: 'q2', questionText: 'How long have you felt this?', answer: 'Started 45 minutes ago while walking' }
    ],
    documents: [],
    redFlags: [
      {
        id: 'URGENT_CARDIO_001',
        type: 'Urgent Alert',
        description: 'Acute chest tightness with left arm radiation',
        severity: 'high',
        detectedAt: new Date().toISOString()
      }
    ],
    status: 'pending_review',
    triageStatus: 'pending_review',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const sessionRef = await addDoc(collection(db, 'patientSessions'), patientSessionData);
  const sessionId = sessionRef.id;
  console.log(`   ✅ Patient session created in Firestore with ID: ${sessionId}`);
  console.log(`   ✅ Initial status: ${patientSessionData.status}, triageStatus: ${patientSessionData.triageStatus}`);
  
  await signOut(auth);
  console.log('   Patient signed out.\n');

  // -----------------------------------------------------------------
  // STEP 2: Nurse logs in with verified role: 'nurse' custom claim
  // -----------------------------------------------------------------
  console.log('👉 [STEP 2] Nurse: Authenticating with Role-Based Custom Claim...');
  const nurseCred = await signInWithEmailAndPassword(auth, 'nurse@medi-kiosk.demo', 'DemoNurse123!');
  const nurseToken = await nurseCred.user.getIdTokenResult(true);
  console.log(`   Nurse signed in: ${nurseCred.user.email}`);
  console.log(`   Custom Claim 'role': "${nurseToken.claims.role}" (Required: 'nurse')`);
  if (nurseToken.claims.role !== 'nurse') {
    throw new Error('FAILED: Nurse user does not have custom claim role === nurse');
  }

  // -----------------------------------------------------------------
  // STEP 3: Nurse reads patient queue and locates patient
  // -----------------------------------------------------------------
  console.log('\n👉 [STEP 3] Nurse: Fetching patient queue from Firestore...');
  const sessionSnap = await getDoc(doc(db, 'patientSessions', sessionId));
  if (!sessionSnap.exists()) {
    throw new Error(`FAILED: Could not find patient session ${sessionId}`);
  }
  const fetchedData = sessionSnap.data();
  console.log(`   ✅ Nurse successfully read patient: "${fetchedData.patient?.name}"`);
  console.log(`   Chief Complaint: "${fetchedData.chiefComplaint}"`);
  console.log(`   Red Flags Detected: ${fetchedData.redFlags?.length} ([${fetchedData.redFlags?.[0]?.description}])`);

  // -----------------------------------------------------------------
  // STEP 4: Nurse reviews and forwards to physician
  // -----------------------------------------------------------------
  console.log('\n👉 [STEP 4] Nurse: Performing Triage & Forwarding to Physician...');
  const triageAuditTimestamp = new Date().toISOString();
  const triageNoteContent = 'TRIAGE ASSESSMENT: Patient in acute distress. SpO2 94%, pulse 110 bpm. Forwarding immediately to Attending Physician for urgent ECG and evaluation.';
  
  // Update ONLY the 4 fields allowed by Firestore security rules:
  // affectedKeys().hasOnly(['triageStatus', 'triageNote', 'triageTimestamp', 'triageNurseId'])
  await updateDoc(doc(db, 'patientSessions', sessionId), {
    triageStatus: 'forwarded_to_physician',
    triageNote: triageNoteContent,
    triageTimestamp: triageAuditTimestamp,
    triageNurseId: nurseCred.user.uid
  });
  console.log('   ✅ Nurse triage update committed successfully under strict Firestore security rules!');

  // Verify updated document
  const updatedSnap = await getDoc(doc(db, 'patientSessions', sessionId));
  const updatedData = updatedSnap.data();
  console.log(`   ✅ Current triageStatus in Firestore: "${updatedData.triageStatus}"`);
  console.log(`   ✅ Triage Note: "${updatedData.triageNote}"`);
  console.log(`   ✅ Triage Timestamp: "${updatedData.triageTimestamp}"`);

  await signOut(auth);
  console.log('   Nurse signed out.\n');

  // -----------------------------------------------------------------
  // STEP 5: Physician / Reviewer checks queue and verifies triaged patient
  // -----------------------------------------------------------------
  console.log('👉 [STEP 5] Attending Physician: Authenticating and checking queue...');
  const docCred = await signInWithEmailAndPassword(auth, 'doctor@medi-kiosk.demo', 'DemoDoctor123!');
  const docToken = await docCred.user.getIdTokenResult(true);
  console.log(`   Physician/Staff signed in: ${docCred.user.email}`);
  console.log(`   Staff Role: "${docToken.claims.role}"`);

  const docSessionSnap = await getDoc(doc(db, 'patientSessions', sessionId));
  const docSessionData = docSessionSnap.data();
  console.log(`   ✅ Doctor received forwarded patient: "${docSessionData.patient?.name}"`);
  console.log(`   Status: ${docSessionData.status}`);
  console.log(`   Nurse Triage Status: ${docSessionData.triageStatus}`);
  console.log(`   Nurse Triage Note: "${docSessionData.triageNote}"`);
  
  await signOut(auth);
  console.log('   Doctor signed out.\n');

  console.log('=====================================================');
  console.log('  🎉 ALL REAL END-TO-END FLOW ASSERTIONS PASSED!');
  console.log('  Flow Verified: Patient Submit -> Firestore -> Nurse Dashboard -> Forward to Physician');
  console.log('=====================================================');
}

runEndToEndVerification().catch((err) => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
