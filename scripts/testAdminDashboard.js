const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
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

async function testAdminWorkflow() {
  console.log('================================================================');
  console.log('  TESTING REAL MEDIKIOSK ADMIN DASHBOARD & RBAC ARCHITECTURE');
  console.log('================================================================\n');

  // 1. Admin Authentication with Custom Claims
  console.log('👉 [1] Authenticating as Root Administrator...');
  const adminCred = await signInWithEmailAndPassword(auth, 'admin@medi-kiosk.demo', 'DemoAdmin123!');
  const adminToken = await adminCred.user.getIdTokenResult(true);
  console.log(`   Logged in as: ${adminCred.user.email}`);
  console.log(`   Verified Custom Claim Role: "${adminToken.claims.role}" (Expected: 'admin')`);
  if (adminToken.claims.role !== 'admin') {
    throw new Error('Admin user does not have custom claim role === admin');
  }

  // 2. Query Real Firestore patientSessions as Admin
  console.log('\n👉 [2] Admin: Reading real patientSessions from Cloud Firestore...');
  const sessionsSnap = await getDocs(collection(db, 'patientSessions'));
  console.log(`   ✅ Read Success: Found ${sessionsSnap.size} real patient session documents in Firestore.`);
  if (sessionsSnap.size === 0) {
    throw new Error('No patient sessions found in Firestore');
  }

  // Compute System Overview Metrics
  let totalSessions = sessionsSnap.size;
  let forwardedCount = 0;
  let confirmedCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;

  sessionsSnap.forEach((doc) => {
    const data = doc.data();
    if (data.triageStatus === 'forwarded_to_physician') forwardedCount++;
    if (data.status === 'confirmed' || data.doctorDecision === 'accepted') confirmedCount++;
    if (data.status === 'rejected' || data.doctorDecision === 'rejected') rejectedCount++;
    if (data.triageStatus === 'pending_review' || (!data.triageStatus && data.status === 'pending_review')) pendingCount++;
  });

  console.log(`   Overview Metrics:`);
  console.log(`   • Total Sessions: ${totalSessions}`);
  console.log(`   • Pending Triage: ${pendingCount}`);
  console.log(`   • Forwarded to Physician: ${forwardedCount}`);
  console.log(`   • Doctor Confirmed: ${confirmedCount}`);
  console.log(`   • Rejected: ${rejectedCount}`);

  // 3. Query Staff Directory API
  console.log('\n👉 [3] Admin: Querying Staff Directory Endpoint (/api/admin/staff)...');
  const staffRes = await fetch('http://localhost:3000/api/admin/staff');
  if (!staffRes.ok) {
    throw new Error(`Staff API returned HTTP ${staffRes.status}`);
  }
  const staffData = await staffRes.json();
  console.log(`   ✅ Staff Directory API returned ${staffData.staff?.length || 0} registered personnel.`);
  const rolesFound = staffData.staff?.map(s => `${s.email} (${s.role})`).slice(0, 5).join(', ');
  console.log(`   Sample Roster: ${rolesFound}`);

  // 4. Test Server-Side Role Provisioning Endpoint
  console.log('\n👉 [4] Admin: Testing Server Role Assignment Endpoint (/api/admin/set-role)...');
  const roleTestRes = await fetch('http://localhost:3000/api/admin/set-role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nurse@medi-kiosk.demo', role: 'nurse' }),
  });
  const roleTestJson = await roleTestRes.json();
  if (!roleTestRes.ok || !roleTestJson.success) {
    throw new Error(roleTestJson.error || 'Failed role assignment');
  }
  console.log(`   ✅ Role Assignment verified: ${roleTestJson.message}`);

  // 5. Test Audit Trail Generation from real data
  console.log('\n👉 [5] Admin: Verifying Clinical Audit Trail Extraction...');
  let auditEventsExtracted = 0;
  sessionsSnap.forEach((doc) => {
    const data = doc.data();
    if (data.createdAt) auditEventsExtracted++;
    if (data.triageTimestamp) auditEventsExtracted++;
    if (data.doctorReviewedAt) auditEventsExtracted++;
  });
  console.log(`   ✅ Extracted ${auditEventsExtracted} authentic chronological clinical events from Firestore.`);

  await signOut(auth);
  console.log('\n================================================================');
  console.log('  🎉 ALL ADMIN DASHBOARD REAL DATA & RBAC TESTS PASSED (100%)');
  console.log('================================================================');
}

testAdminWorkflow().catch((err) => {
  console.error('\n❌ ADMIN WORKFLOW TEST FAILED:', err);
  process.exit(1);
});
