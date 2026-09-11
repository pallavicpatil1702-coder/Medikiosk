const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// To run this script:
// 1. Download your serviceAccountKey.json from Firebase Console -> Project Settings -> Service Accounts
// 2. Place it in the root of your project
// 3. Run: node scripts/setAdminRole.js <user-email> <role>

const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error("ERROR: serviceAccountKey.json not found in the root directory.");
  console.error("Please download it from Firebase Console -> Project Settings -> Service Accounts.");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const args = process.argv.slice(2);
const email = args[0];
const role = args[1] || 'nurse'; // Default to nurse

if (!email) {
  console.error("Please provide an email address. Usage: node scripts/setAdminRole.js <email> [role]");
  process.exit(1);
}

async function setRole() {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { role: role });
    console.log(`Successfully set role '${role}' for user ${email}`);
    process.exit(0);
  } catch (error) {
    console.error('Error setting role:', error);
    process.exit(1);
  }
}

setRole();
