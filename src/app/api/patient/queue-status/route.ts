import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { sessionId, patientId } = await req.json();

    if (!sessionId && !patientId) {
      return NextResponse.json({ error: 'Missing sessionId or patientId' }, { status: 400 });
    }

    // Query all waiting/triage/doctor_review sessions
    const sessionsQuery = query(
      collection(db, 'patientSessions'),
      where('queueStatus', 'in', ['waiting', 'triage', 'doctor_review'])
    );
    const snapshot = await getDocs(sessionsQuery);

    const sessions: any[] = [];
    snapshot.forEach(docSnap => {
      sessions.push({ ...docSnap.data(), firestoreSessionId: docSnap.id });
    });

    const statusWeight: Record<string, number> = {
      doctor_review: 3,
      triage: 2,
      waiting: 1,
      completed: 0
    };

    sessions.sort((a, b) => {
      const weightA = statusWeight[a.queueStatus || 'waiting'] || 0;
      const weightB = statusWeight[b.queueStatus || 'waiting'] || 0;
      if (weightA !== weightB) return weightB - weightA;

      const scoreA = a.queuePriorityScore || 0;
      const scoreB = b.queuePriorityScore || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;

      let timeA = Date.now();
      let timeB = Date.now();
      
      if (a.queueJoinedAt) {
        timeA = a.queueJoinedAt.seconds ? a.queueJoinedAt.seconds * 1000 : (a.queueJoinedAt._seconds ? a.queueJoinedAt._seconds * 1000 : Date.now());
      }
      if (b.queueJoinedAt) {
        timeB = b.queueJoinedAt.seconds ? b.queueJoinedAt.seconds * 1000 : (b.queueJoinedAt._seconds ? b.queueJoinedAt._seconds * 1000 : Date.now());
      }
      
      return timeA - timeB;
    });

    let positionCounter = 1;
    let targetSession = null;

    for (const session of sessions) {
      const position = positionCounter++;
      const estimatedWaitMinutes = Math.max(0, (position - 1) * 15); // Fallback to 15 if import fails

      if ((sessionId && session.firestoreSessionId === sessionId) || (patientId && session.patientId === patientId)) {
        targetSession = {
          ...session,
          queuePosition: position,
          estimatedWaitMinutes
        };
        break; // Found it
      }
    }

    if (!targetSession) {
      // Check if it's completed
      if (sessionId) {
        const docRef = doc(db, 'patientSessions', sessionId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data?.queueStatus === 'completed') {
            return NextResponse.json({
              queueStatus: 'completed'
            });
          }
        }
      }

      return NextResponse.json({ error: 'Session not found in queue' }, { status: 404 });
    }

    // Only return the necessary public info, absolutely NO PHI
    return NextResponse.json({
      queueStatus: targetSession.queueStatus,
      queuePriority: targetSession.queuePriority,
      queuePosition: targetSession.queuePosition,
      estimatedWaitMinutes: targetSession.estimatedWaitMinutes,
      queueTokenNumber: targetSession.queueTokenNumber,
      firestoreSessionId: targetSession.firestoreSessionId,
    });
  } catch (error: any) {
    console.error('Queue status error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
