import { NextResponse } from 'next/server';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { parseTokenNumber, formatTokenNumber } from '@/lib/queueMetrics';

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

// Global mutex to serialize concurrent token assignments and prevent race conditions
let assignmentLock: Promise<any> = Promise.resolve();
function runWithLock<T>(task: () => Promise<T>): Promise<T> {
  const result = assignmentLock.then(task, task);
  assignmentLock = result.then(() => {}, () => {});
  return result;
}

// In-memory cache for tokens assigned today to guarantee idempotency and immediate concurrency awareness
const assignedTodayBySession = new Map<string, { token: string; number: number; timestamp: number }>();

export async function POST(req: Request) {
  return runWithLock(async () => {
    try {
      const body = await req.json().catch(() => ({}));
      const { patientId, sessionId } = body || {};

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

      // 1. IDEMPOTENCY CHECK: If this sessionId already has a token assigned today, reuse it
      if (sessionId && typeof sessionId === 'string') {
        const cached = assignedTodayBySession.get(sessionId);
        if (cached && cached.timestamp >= startMs && cached.timestamp <= endMs) {
          return NextResponse.json({
            token: cached.token,
            number: cached.number,
            date: startOfDay.toISOString().slice(0, 10),
            reused: true
          });
        }

        try {
          const existingDoc = await getDoc(doc(db, 'patientSessions', sessionId));
          if (existingDoc.exists()) {
            const data = existingDoc.data();
            let joinTime = 0;
            if (data.queueJoinedAt) {
              joinTime = data.queueJoinedAt.seconds ? data.queueJoinedAt.seconds * 1000 : new Date(data.queueJoinedAt).getTime();
            } else if (data.createdAt) {
              joinTime = data.createdAt.seconds ? data.createdAt.seconds * 1000 : new Date(data.createdAt).getTime();
            }

            if (data.queueTokenNumber && joinTime >= startMs && joinTime <= endMs) {
              const num = parseTokenNumber(data.queueTokenNumber);
              if (num) {
                const token = formatTokenNumber(num);
                assignedTodayBySession.set(sessionId, { token, number: num, timestamp: joinTime });
                return NextResponse.json({
                  token,
                  number: num,
                  date: startOfDay.toISOString().slice(0, 10),
                  reused: true
                });
              }
            }
          }
        } catch (readErr) {
          console.warn('[AssignTokenAPI] Session lookup notice:', readErr);
        }
      }

      // 2. Query today's active sessions to find the HIGHEST valid token assigned for current clinic day
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
          if (data.queueTokenNumber) {
            const num = parseTokenNumber(data.queueTokenNumber);
            // Ignore corrupted legacy test artifacts (> 100)
            if (num && num > 0 && num < 100) {
              if (num > maxValidNum) {
                maxValidNum = num;
              }
            }
          }
        }
      });

      // Also compare against tokens assigned during this process run today
      for (const [sId, record] of assignedTodayBySession.entries()) {
        if (record.timestamp >= startMs && record.timestamp <= endMs) {
          if (record.number > maxValidNum && record.number < 100) {
            maxValidNum = record.number;
          }
        } else {
          assignedTodayBySession.delete(sId);
        }
      }

      // 3. Sequential +1 assignment rule:
      // nextToken = highest valid token number already assigned for CURRENT clinic day + 1
      // If no valid token exists for today, start from configured first-token rule (#001)
      const nextNumber = maxValidNum > 0 ? maxValidNum + 1 : 1;
      const token = formatTokenNumber(nextNumber);

      // Cache assigned token for this session
      if (sessionId) {
        assignedTodayBySession.set(sessionId, {
          token,
          number: nextNumber,
          timestamp: Date.now()
        });

        // Optionally persist queueTokenNumber to the session doc if it already exists
        try {
          const sessionRef = doc(db, 'patientSessions', sessionId);
          await updateDoc(sessionRef, { queueTokenNumber: token });
        } catch (e) {
          // Document may not be created yet; caller will persist it
        }
      }

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
  });
}
