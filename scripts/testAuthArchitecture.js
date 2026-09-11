const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signInAnonymously, signOut } = require('firebase/auth');
const { getFirestore, collection, addDoc, doc, getDoc } = require('firebase/firestore');
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

const testUsers = [
  { email: 'nurse@medi-kiosk.demo', pass: 'DemoNurse123!', expectedRole: 'nurse', allowed: ['/nurse/dashboard'] },
  { email: 'doctor@medi-kiosk.demo', pass: 'DemoDoctor123!', expectedRole: 'doctor', allowed: ['/doctor/dashboard'] },
  { email: 'admin@medi-kiosk.demo', pass: 'DemoAdmin123!', expectedRole: 'admin', allowed: ['/admin/dashboard'] },
  { email: 'patient@medi-kiosk.demo', pass: 'DemoPatient123!', expectedRole: 'patient', allowed: ['/patient/dashboard'] }
];

async function verifyAuthArchitecture() {
  console.log('================================================================');
  console.log('  STARTING MEDIKIOSK AUTHENTICATION ARCHITECTURE VERIFICATION');
  console.log('================================================================\n');

  let allPassed = true;

  // 1. Verify Custom Claims for all 4 roles
  console.log('👉 [CHECK 1] Testing Email/Password Login & Custom Claims for All Roles...');
  for (const u of testUsers) {
    try {
      const cred = await signInWithEmailAndPassword(auth, u.email, u.pass);
      const tokenResult = await cred.user.getIdTokenResult(true);
      const actualRole = tokenResult.claims.role;

      if (actualRole === u.expectedRole) {
        console.log(`   ✅ PASS: ${u.email} -> Claim Role: "${actualRole}" (Expected: "${u.expectedRole}")`);
      } else {
        console.error(`   ❌ FAIL: ${u.email} -> Got Role "${actualRole}", Expected "${u.expectedRole}"`);
        allPassed = false;
      }

      // Check simulated route guard:
      const allProtectedRoutes = [
        { path: '/patient/dashboard', allowedRoles: ['patient'] },
        { path: '/nurse/dashboard', allowedRoles: ['nurse'] },
        { path: '/doctor/dashboard', allowedRoles: ['doctor'] },
        { path: '/admin/dashboard', allowedRoles: ['admin'] }
      ];

      for (const route of allProtectedRoutes) {
        const canAccess = route.allowedRoles.includes(actualRole);
        const shouldAccess = u.allowed.includes(route.path);
        if (canAccess === shouldAccess) {
          // As expected
        } else {
          console.error(`   ❌ FAIL: Route permission mismatch for ${u.email} on ${route.path}!`);
          allPassed = false;
        }
      }

      await signOut(auth);
    } catch (err) {
      console.error(`   ❌ ERROR testing ${u.email}:`, err.message);
      allPassed = false;
    }
  }

  // 2. Verify Anonymous Kiosk Flow is Unbroken
  console.log('\n👉 [CHECK 2] Testing Anonymous Patient Kiosk Flow (Zero Login Needed)...');
  try {
    const anonCred = await signInAnonymously(auth);
    const anonUser = anonCred.user;
    const anonTokenResult = await anonUser.getIdTokenResult(true);
    const anonRole = anonTokenResult.claims.role;

    console.log(`   Anonymous User UID: ${anonUser.uid}, isAnonymous: ${anonUser.isAnonymous}`);
    if (anonUser.isAnonymous === true && anonRole === undefined) {
      console.log('   ✅ PASS: Anonymous user has isAnonymous=true and has NO privileged claims.');
    } else {
      console.error('   ❌ FAIL: Anonymous user has unexpected role claim:', anonRole);
      allPassed = false;
    }

    // Test creating patientSession in Firestore as anonymous patient
    console.log('   Submitting test intake session to Firestore under anonymous UID...');
    const testDoc = {
      patientId: anonUser.uid,
      patient: {
        id: anonUser.uid,
        name: 'Anonymous Kiosk Patient',
        age: 35,
        gender: 'Other',
        language: 'en'
      },
      language: 'en',
      chiefComplaint: 'Mild headache and sore throat',
      answers: [],
      documents: [],
      redFlags: [],
      status: 'pending_review',
      triageStatus: 'pending_review',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(collection(db, 'patientSessions'), testDoc);
    console.log(`   ✅ PASS: Successfully created patient session with ID: ${docRef.id}`);

    // Verify read
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().patientId === anonUser.uid) {
      console.log('   ✅ PASS: Document exists and patientId matches authenticated anonymous UID.');
    } else {
      console.error('   ❌ FAIL: Could not retrieve created document or UID mismatch.');
      allPassed = false;
    }

    await signOut(auth);
  } catch (err) {
    console.error('   ❌ Anonymous kiosk test failed:', err);
    allPassed = false;
  }

  console.log('\n================================================================');
  if (allPassed) {
    console.log('🎉 ALL AUTHENTICATION & ROLE-BASED ACCESS CHECKS PASSED!');
  } else {
    console.log('⚠️ SOME CHECKS FAILED. REVIEW LOGS ABOVE.');
  }
  console.log('================================================================\n');

  process.exit(allPassed ? 0 : 1);
}

verifyAuthArchitecture();
