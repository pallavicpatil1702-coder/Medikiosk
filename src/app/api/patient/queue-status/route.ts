import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import {
  calculateQueueMetrics,
  formatTokenNumber,
  DEFAULT_CONSULTATION_MINUTES
} from '@/lib/queueMetrics';
import { PatientSession } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const { sessionId, patientId } = await req.json();

    if (!sessionId && !patientId) {
      return NextResponse.json({ error: 'Missing sessionId or patientId' }, { status: 400 });
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayMs = startOfDay.getTime();

    // Query all active sessions: waiting, triage, doctor_review
    const sessionsQuery = query(
      collection(db, 'patientSessions'),
      where('queueStatus', 'in', ['waiting', 'triage', 'doctor_review'])
    );
    const snapshot = await getDocs(sessionsQuery);

    const sessions: PatientSession[] = [];
    snapshot.forEach(docSnap => {
      sessions.push({ ...docSnap.data(), firestoreSessionId: docSnap.id } as PatientSession);
    });

    // Check if target session is already completed or from past day
    let completedTarget: any = null;
    if (sessionId) {
      const docRef = doc(db, 'patientSessions', sessionId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        let sessionTime = 0;
        if (data.queueJoinedAt) {
          sessionTime = typeof data.queueJoinedAt.toMillis === 'function'
            ? data.queueJoinedAt.toMillis()
            : (data.queueJoinedAt.seconds ? data.queueJoinedAt.seconds * 1000 : new Date(data.queueJoinedAt).getTime());
        } else if (data.createdAt) {
          sessionTime = typeof data.createdAt.toMillis === 'function'
            ? data.createdAt.toMillis()
            : (data.createdAt.seconds ? data.createdAt.seconds * 1000 : new Date(data.createdAt).getTime());
        }

        if (data?.queueStatus === 'completed' || data?.doctorStatus === 'completed' || sessionTime < startOfDayMs) {
          completedTarget = {
            queueStatus: 'completed',
            doctorStatus: 'completed',
            queueTokenNumber: formatTokenNumber(data.queueTokenNumber),
            currentServingToken: '--',
            patientsAhead: 0,
            estimatedWaitMinutes: 0,
            expectedTurnTimeStr: 'NOW',
            firestoreSessionId: sessionId
          };
        }
      }
    }

    if (completedTarget) {
      return NextResponse.json(completedTarget);
    }

    // Recalculate queue metrics with 10-minute default consultation
    const { activeQueue, currentServingToken } = calculateQueueMetrics(sessions, DEFAULT_CONSULTATION_MINUTES);

    let target = activeQueue.find(p => 
      (sessionId && p.firestoreSessionId === sessionId) ||
      (patientId && (p.patient?.id === patientId || (p as any).patientId === patientId))
    );

    // If target not in active list yet (e.g. newly created), check direct document
    if (!target && sessionId) {
      const docRef = doc(db, 'patientSessions', sessionId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as PatientSession;
        if (data.queueStatus !== 'completed') {
          const freshSessions = [...sessions, { ...data, firestoreSessionId: sessionId }];
          const freshMetrics = calculateQueueMetrics(freshSessions, DEFAULT_CONSULTATION_MINUTES);
          target = freshMetrics.activeQueue.find(p => p.firestoreSessionId === sessionId);
        }
      }
    }

    if (!target) {
      return NextResponse.json({ error: 'Session not found in queue' }, { status: 404 });
    }

    // Persist calculated queue state to Firestore so onSnapshot listeners get it immediately
    if (target.firestoreSessionId) {
      try {
        const docRef = doc(db, 'patientSessions', target.firestoreSessionId);
        await updateDoc(docRef, {
          queueTokenNumber: target.queueTokenNumber,
          queuePosition: target.queuePosition,
          patientsAhead: target.patientsAhead,
          estimatedWaitMinutes: target.estimatedWaitMinutes,
          currentServingToken,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn('[QueueStatusAPI] Notice: could not persist queue metadata directly:', err);
      }
    }

    // Only return clean queue info, no PHI
    return NextResponse.json({
      queueStatus: target.queueStatus || 'waiting',
      doctorStatus: target.doctorStatus || 'pending',
      queuePriority: target.queuePriority || 'normal',
      queuePosition: target.queuePosition,
      patientsAhead: target.patientsAhead,
      estimatedWaitMinutes: target.estimatedWaitMinutes,
      queueTokenNumber: target.queueTokenNumber,
      currentServingToken: target.currentServingToken || currentServingToken,
      expectedTurnTimeStr: target.expectedTurnTimeStr,
      consultationStartedAtStr: target.consultationStartedAtStr,
      expectedFinishTimeStr: target.expectedFinishTimeStr,
      consultationStartedAt: target.consultationStartedAt,
      firestoreSessionId: target.firestoreSessionId,
    });
  } catch (error: any) {
    console.error('Queue status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
