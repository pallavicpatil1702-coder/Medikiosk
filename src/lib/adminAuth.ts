import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App | null = null;

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Option 1: Check for serviceAccountKey.json in root
  const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    adminApp = initializeApp({
      projectId: serviceAccount.project_id || 'medikiosk-df39e',
      credential: {
        getAccessToken: () => Promise.resolve({
          access_token: '',
          expires_in: 0
        })
      }
    });
    return adminApp;
  }

  // Option 2: Use firebase-tools CLI config store token (local dev / demo)
  const appData = process.env.APPDATA || '';
  const userProfile = process.env.USERPROFILE || '';
  const candidatePaths = [
    path.join(userProfile, '.config', 'configstore', 'firebase-tools.json'),
    path.join(appData, 'configstore', 'firebase-tools.json')
  ];

  for (const configPath of candidatePaths) {
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (config.tokens?.access_token) {
          adminApp = initializeApp({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'medikiosk-df39e',
            credential: {
              getAccessToken: () => {
                for (const p of candidatePaths) {
                  if (fs.existsSync(p)) {
                    try {
                      const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
                      if (cfg.tokens?.access_token) {
                        return Promise.resolve({
                          access_token: cfg.tokens.access_token,
                          expires_in: 3600
                        });
                      }
                    } catch (e) {}
                  }
                }
                return Promise.resolve({
                  access_token: config.tokens.access_token,
                  expires_in: 3600
                });
              }
            }
          });
          return adminApp;
        }
      } catch (err) {
        console.warn('Could not read firebase-tools config:', err);
      }
    }
  }

  // Default fallback initialize
  adminApp = initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'medikiosk-df39e'
  });
  return adminApp;
}

export interface StaffUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'nurse' | 'doctor' | 'admin' | 'patient' | 'unassigned';
  disabled: boolean;
  createdAt?: string;
  lastSignIn?: string;
}

export async function getStaffDirectory(): Promise<StaffUser[]> {
  const app = getAdminApp();
  const auth = getAuth(app);

  try {
    const listResult = await auth.listUsers(100);
    const staffList: StaffUser[] = listResult.users
      .filter(u => u.email) // Filter out anonymous kiosk intake sessions
      .map(u => ({
        uid: u.uid,
        email: u.email || '',
        displayName: u.displayName || u.email?.split('@')[0] || 'Staff Member',
        role: (u.customClaims?.role as any) || 'unassigned',
        disabled: u.disabled || false,
        createdAt: u.metadata?.creationTime,
        lastSignIn: u.metadata?.lastSignInTime,
      }));
    return staffList;
  } catch (err) {
    console.warn('listUsers failed, falling back to registered staff query:', err);
    const knownEmails = [
      'nurse@medi-kiosk.demo',
      'doctor@medi-kiosk.demo',
      'staffdoctor@medi-kiosk.demo',
      'dr.sharma@medi-kiosk.demo',
      'admin@medi-kiosk.demo',
      'patient@medi-kiosk.demo'
    ];
    const fallbackList: StaffUser[] = [];
    for (const email of knownEmails) {
      try {
        const u = await auth.getUserByEmail(email);
        fallbackList.push({
          uid: u.uid,
          email: u.email || email,
          displayName: u.displayName || email.split('@')[0],
          role: (u.customClaims?.role as any) || 'unassigned',
          disabled: u.disabled || false,
          createdAt: u.metadata?.creationTime,
          lastSignIn: u.metadata?.lastSignInTime,
        });
      } catch (e) {
        // user not registered
      }
    }
    return fallbackList;
  }
}

export async function assignCustomRole(email: string, role: 'patient' | 'nurse' | 'doctor' | 'admin') {
  const app = getAdminApp();
  const auth = getAuth(app);

  const user = await auth.getUserByEmail(email);
  await auth.setCustomUserClaims(user.uid, { role });
  return { uid: user.uid, email: user.email, role };
}

