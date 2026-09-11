const { initializeApp } = require('firebase/app');
const { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFirestore, collection, addDoc, doc, updateDoc, getDoc, serverTimestamp } = require('firebase/firestore');
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

async function testPhysicianCompleteWorkflow() {
  console.log('================================================================');
  console.log('  TESTING REAL PHYSICIAN DASHBOARD WORKFLOW (FIREBASE + RBAC)');
  console.log('================================================================\n');

  // 1. Patient creates intake session
  console.log('👉 [1] Patient: Submitting intake session to Firestore...');
  const patientCred = await signInAnonymously(auth);
  const patientUid = patientCred.user.uid;
  
  const initialSession = {
    patientId: patientUid,
    patient: {
      id: patientUid,
      name: 'Priya Sharma (Physician Verification)',
      age: 42,
      gender: 'Female',
      language: 'en'
    },
    language: 'en',
    chiefComplaint: 'Severe migraine with visual aura and persistent nausea',
    answers: [
      { questionId: 'q1', questionText: 'Describe head pain severity', answer: 'Pulsating 8/10 pain on right temple' },
      { questionId: 'q2', questionText: 'Any visual symptoms?', answer: 'Flickering zigzag lights before pain started' },
      { questionId: 'q3', questionText: 'Any current medications?', answer: 'Sumatriptan 50mg occasionally' }
    ],
    documents: [
      {
        id: 'doc_101',
        fileName: 'mri_brain_report.pdf',
        fileType: 'application/pdf',
        uploadedAt: new Date().toISOString(),
        size: '1.4 MB',
        extractedData: {
          reportDate: '2026-08-15',
          tests: [
            { name: 'Ventricles & Sulci', value: 'Normal', unit: '', referenceRange: 'Normal for age', flag: null },
            { name: 'Intracranial Pressure Sign', value: 'Negative', unit: '', referenceRange: 'Negative', flag: null }
          ],
          medicines: ['Sumatriptan 50mg'],
          confidence: 'high'
        }
      }
    ],
    redFlags: [
      {
        id: 'RF_NEURO_001',
        type: 'Neurological Red Flag',
        description: 'Acute onset severe unilateral headache with neurological aura',
        severity: 'high',
        detectedAt: new Date().toISOString()
      }
    ],
    clinicalSummary: {
      id: 'sum_101',
      patientId: patientUid,
      generatedAt: new Date().toISOString(),
      patient: { id: patientUid, name: 'Priya Sharma', age: 42, gender: 'Female' },
      history: {
        chiefComplaint: 'Severe migraine with visual aura',
        duration: '6 hours',
        associatedSymptoms: ['Nausea', 'Photophobia', 'Zigzag scotoma'],
        medicationTaken: 'Sumatriptan 50mg',
        allergies: 'Penicillin (rash)',
        pastMedicalHistory: 'Known migraine with aura for 5 years',
        answers: []
      },
      medications: 'Sumatriptan 50mg PRN',
      allergies: 'Penicillin',
      pastHistory: 'Migraine with aura',
      investigationResults: 'Prior MRI unremarkable',
      previousReports: ['mri_brain_report.pdf'],
      redFlags: [],
      aiNotes: 'Clinical impression suggests classic migraine episode. Rule out secondary causes.',
      status: 'pending'
    },
    status: 'pending_review',
    triageStatus: 'pending_review',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const sessionRef = await addDoc(collection(db, 'patientSessions'), initialSession);
  const sessionId = sessionRef.id;
  console.log(`   ✅ Patient session created in Firestore: ${sessionId}`);
  await signOut(auth);

  // 2. Nurse signs in and triages -> forwarded_to_physician
  console.log('\n👉 [2] Nurse: Triaging and forwarding to Physician...');
  const nurseCred = await signInWithEmailAndPassword(auth, 'nurse@medi-kiosk.demo', 'DemoNurse123!');
  const triageTime = new Date().toISOString();
  const nurseNote = 'TRIAGE EVAL: Vitals BP 130/84, HR 78, Temp 98.4F. Severe pain, photophobia. Dark room provided. Forwarded to Attending Physician for acute assessment.';
  
  await updateDoc(doc(db, 'patientSessions', sessionId), {
    triageStatus: 'forwarded_to_physician',
    triageNote: nurseNote,
    triageTimestamp: triageTime,
    triageNurseId: nurseCred.user.uid
  });
  console.log('   ✅ Case forwarded to physician by triage nurse.');
  await signOut(auth);

  // 3. Doctor signs in with custom claim role: 'doctor'
  console.log('\n👉 [3] Physician: Signing in with doctor credentials...');
  const docCred = await signInWithEmailAndPassword(auth, 'doctor@medi-kiosk.demo', 'DemoDoctor123!');
  const tokenResult = await docCred.user.getIdTokenResult(true);
  console.log(`   Logged in as: ${docCred.user.email}`);
  console.log(`   Verified Custom Claim Role: "${tokenResult.claims.role}"`);
  if (tokenResult.claims.role !== 'doctor') {
    throw new Error('Custom claim role is not doctor');
  }

  // 4. Doctor fetches forwarded session
  console.log('\n👉 [4] Physician: Reading forwarded patient session from Firestore...');
  const fetchedSnap = await getDoc(doc(db, 'patientSessions', sessionId));
  if (!fetchedSnap.exists()) {
    throw new Error('Could not find patient session');
  }
  const sessionData = fetchedSnap.data();
  console.log(`   Patient Name: ${sessionData.patient?.name}`);
  console.log(`   Chief Complaint: ${sessionData.chiefComplaint}`);
  console.log(`   Nurse Triage Note: ${sessionData.triageNote}`);
  console.log(`   Red Flags: ${sessionData.redFlags?.length}`);
  console.log(`   Attached Reports: ${sessionData.documents?.length}`);

  // 5. Doctor accepts and completes consultation with clinical note
  console.log('\n👉 [5] Physician: Accepting case & completing consultation...');
  const reviewTime = new Date().toISOString();
  const doctorClinicalNote = 'PHYSICIAN NOTE: Exam confirms acute migraine flare with typical aura. No focal neurological deficits. Administered anti-emetic. Prescribed rest in quiet darkened room. Patient advised to return if symptoms persist > 24 hours.';
  
  await updateDoc(doc(db, 'patientSessions', sessionId), {
    status: 'confirmed',
    doctorDecision: 'accepted',
    doctorNote: doctorClinicalNote,
    doctorReviewedAt: reviewTime,
    doctorUid: docCred.user.uid,
    doctorEmail: docCred.user.email || 'doctor@medi-kiosk.demo',
    updatedAt: serverTimestamp()
  });
  console.log('   ✅ Physician decision recorded in Firestore!');

  // 6. Verify final state in Firestore
  console.log('\n👉 [6] Physician: Verifying updated case state...');
  const finalSnap = await getDoc(doc(db, 'patientSessions', sessionId));
  const finalData = finalSnap.data();
  console.log(`   Final Status: "${finalData.status}" (Expected: confirmed)`);
  console.log(`   Doctor Decision: "${finalData.doctorDecision}" (Expected: accepted)`);
  console.log(`   Doctor Note: "${finalData.doctorNote}"`);
  console.log(`   Reviewed At: "${finalData.doctorReviewedAt}"`);
  console.log(`   Reviewing Doctor: "${finalData.doctorEmail}"`);

  if (finalData.status !== 'confirmed' || finalData.doctorDecision !== 'accepted') {
    throw new Error('Status or decision mismatch after physician review');
  }

  // 7. Test Physician Edit Summary on another case
  console.log('\n👉 [7] Testing Physician Summary Edit Flow...');
  await signOut(auth);
  const patientCred2 = await signInAnonymously(auth);
  const editSessionRef = await addDoc(collection(db, 'patientSessions'), {
    ...initialSession,
    patientId: patientCred2.user.uid,
    patient: { ...initialSession.patient, id: patientCred2.user.uid, name: 'Anil Mehta (Edit Test)' },
    chiefComplaint: 'Mild abdominal discomfort',
    triageStatus: 'forwarded_to_physician',
    triageNote: 'Vitals stable. Forwarded to physician.'
  });
  await signOut(auth);

  await signInWithEmailAndPassword(auth, 'doctor@medi-kiosk.demo', 'DemoDoctor123!');
  await updateDoc(doc(db, 'patientSessions', editSessionRef.id), {
    status: 'confirmed',
    doctorDecision: 'edited',
    doctorNote: 'Clinical summary adjusted following patient palpation.',
    summary: {
      ...initialSession.clinicalSummary,
      history: {
        ...initialSession.clinicalSummary.history,
        chiefComplaint: 'Epigastric tenderness relieved by antacids',
        duration: '3 days'
      }
    },
    doctorReviewedAt: new Date().toISOString(),
    doctorUid: docCred.user.uid,
    doctorEmail: docCred.user.email,
    updatedAt: serverTimestamp()
  });
  const editedSnap = await getDoc(doc(db, 'patientSessions', editSessionRef.id));
  console.log(`   ✅ Physician Edit recorded. Decision: ${editedSnap.data().doctorDecision}`);

  // 8. Test Physician Reject Flow
  console.log('\n👉 [8] Testing Physician Case Reject Flow...');
  await signOut(auth);
  const patientCred3 = await signInAnonymously(auth);
  const rejectSessionRef = await addDoc(collection(db, 'patientSessions'), {
    ...initialSession,
    patientId: patientCred3.user.uid,
    patient: { ...initialSession.patient, id: patientCred3.user.uid, name: 'Sanjay Verma (Reject Test)' },
    chiefComplaint: 'Accidental duplicate registration',
    triageStatus: 'forwarded_to_physician',
    triageNote: 'Duplicate check required.'
  });
  await signOut(auth);

  await signInWithEmailAndPassword(auth, 'doctor@medi-kiosk.demo', 'DemoDoctor123!');
  await updateDoc(doc(db, 'patientSessions', rejectSessionRef.id), {
    status: 'rejected',
    doctorDecision: 'rejected',
    doctorNote: 'REJECTED: Duplicate registration. Active consultation already in progress under MRN #4021.',
    doctorReviewedAt: new Date().toISOString(),
    doctorUid: docCred.user.uid,
    doctorEmail: docCred.user.email,
    updatedAt: serverTimestamp()
  });
  const rejectedSnap = await getDoc(doc(db, 'patientSessions', rejectSessionRef.id));
  console.log(`   ✅ Physician Reject recorded. Decision: ${rejectedSnap.data().doctorDecision}, Status: ${rejectedSnap.data().status}`);

  await signOut(auth);
  console.log('\n================================================================');
  console.log('  🎉 ALL PHYSICIAN WORKFLOWS (ACCEPT, EDIT, REJECT) PASSED!');
  console.log('================================================================');
}

testPhysicianCompleteWorkflow().catch((err) => {
  console.error('\n❌ PHYSICIAN WORKFLOW TEST FAILED:', err);
  process.exit(1);
});
