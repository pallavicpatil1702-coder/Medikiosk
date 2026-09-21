import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import {
  QueuePatient,
  formatTokenNumber,
  calculateExpectedTurnTime,
  calculateConsultationTimeRange
} from '@/lib/queueMetrics';

/**
 * Real-time Firestore queue hook for patient screens.
 * Listens via Firestore `onSnapshot` to the patient's session document,
 * delivering instantaneous live updates when the doctor changes:
 * current token / patient status / queue status / consultation start.
 * 
 * Supports both sessionId and patientId.
 * Strictly respects current clinic operating day and returns null if no active consultation exists.
 */
export function usePatientQueuePolling(sessionId?: string, patientId?: string) {
  const [patientQueueInfo, setPatientQueueInfo] = useState<QueuePatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId && !patientId) {
      setPatientQueueInfo(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    let unsubSnapshot: (() => void) | null = null;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfDayMs = startOfDay.getTime();

    // Initial server-side verification to ensure sequential token and queue fields are initialized
    const initQueueStatus = async () => {
      try {
        const res = await fetch('/api/patient/queue-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, patientId })
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted && data) {
            if (data.queueStatus === 'completed' || data.doctorStatus === 'completed') {
              setPatientQueueInfo(null);
            } else {
              const estWait = data.estimatedWaitMinutes ?? 0;
              const expectedTurn = calculateExpectedTurnTime(estWait);
              const consultationRange = calculateConsultationTimeRange(data.consultationStartedAt);

              setPatientQueueInfo(prev => ({
                ...prev,
                ...data,
                queueTokenNumber: formatTokenNumber(data.queueTokenNumber),
                currentServingToken: formatTokenNumber(data.currentServingToken),
                patientsAhead: data.patientsAhead ?? (data.queuePosition ? Math.max(0, data.queuePosition - 1) : 0),
                estimatedWaitMinutes: estWait,
                expectedTurnTimeStr: expectedTurn,
                consultationStartedAtStr: consultationRange?.startedStr,
                expectedFinishTimeStr: consultationRange?.expectedFinishStr,
              } as QueuePatient));
            }
            setLoading(false);
          }
        } else if (res.status === 404) {
          if (isMounted) {
            setPatientQueueInfo(null);
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.warn('Initial queue status fetch error (falling back to snapshot listener):', err);
      }
    };

    initQueueStatus();

    // Attach real-time Firestore onSnapshot listener
    if (sessionId) {
      const docRef = doc(db, 'patientSessions', sessionId);
      unsubSnapshot = onSnapshot(
        docRef,
        (docSnap) => {
          if (!isMounted) return;

          if (!docSnap.exists()) {
            setPatientQueueInfo(null);
            setLoading(false);
            return;
          }

          const data = docSnap.data();

          // If session is completed, patient has no active consultation
          if (data.queueStatus === 'completed' || data.doctorStatus === 'completed') {
            setPatientQueueInfo(null);
            setLoading(false);
            return;
          }

          // Verify session joined today
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

          if (sessionTime < startOfDayMs) {
            // Historical session from previous clinic day
            setPatientQueueInfo(null);
            setLoading(false);
            return;
          }

          const position = data.queuePosition ?? 1;
          const patientsAhead = data.patientsAhead !== undefined ? data.patientsAhead : Math.max(0, position - 1);
          const rawToken = data.queueTokenNumber || `#${docSnap.id.substring(0, 4).toUpperCase()}`;
          const normalizedToken = formatTokenNumber(rawToken);
          const currentServing = formatTokenNumber(data.currentServingToken || (patientsAhead === 0 ? normalizedToken : '--'));
          const estimatedWaitMinutes = data.estimatedWaitMinutes !== undefined ? data.estimatedWaitMinutes : Math.max(0, patientsAhead * 10);
          const expectedTurnTimeStr = calculateExpectedTurnTime(estimatedWaitMinutes);
          const consultationRange = calculateConsultationTimeRange(data.consultationStartedAt);

          const updatedInfo: QueuePatient = {
            ...data,
            firestoreSessionId: docSnap.id,
            queueStatus: data.queueStatus || 'waiting',
            queuePriority: data.queuePriority || 'normal',
            queuePosition: position,
            patientsAhead,
            estimatedWaitMinutes,
            queueTokenNumber: normalizedToken,
            currentServingToken: currentServing,
            doctorStatus: data.doctorStatus || 'pending',
            expectedTurnTimeStr,
            consultationStartedAtStr: consultationRange?.startedStr,
            expectedFinishTimeStr: consultationRange?.expectedFinishStr,
          } as QueuePatient;

          setPatientQueueInfo(updatedInfo);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('[LiveQueue] Firestore onSnapshot error on document:', err);
          if (isMounted) {
            setError(err.message);
            setLoading(false);
          }
        }
      );
    } else if (patientId) {
      // Query active queue sessions for this patient from TODAY
      const q = query(
        collection(db, 'patientSessions'),
        where('patientId', '==', patientId),
        where('queueStatus', 'in', ['waiting', 'triage', 'doctor_review'])
      );

      unsubSnapshot = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted) return;

          if (snapshot.empty) {
            setPatientQueueInfo(null);
            setLoading(false);
            return;
          }

          const docs: any[] = [];
          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            let joinTime = 0;
            if (data.queueJoinedAt) {
              joinTime = typeof data.queueJoinedAt.toMillis === 'function'
                ? data.queueJoinedAt.toMillis()
                : (data.queueJoinedAt.seconds ? data.queueJoinedAt.seconds * 1000 : new Date(data.queueJoinedAt).getTime());
            } else if (data.createdAt) {
              joinTime = typeof data.createdAt.toMillis === 'function'
                ? data.createdAt.toMillis()
                : (data.createdAt.seconds ? data.createdAt.seconds * 1000 : new Date(data.createdAt).getTime());
            }

            // Strictly filter for CURRENT operating day
            if (joinTime >= startOfDayMs) {
              docs.push({ ...data, firestoreSessionId: docSnap.id, joinTime });
            }
          });

          if (docs.length === 0) {
            setPatientQueueInfo(null);
            setLoading(false);
            return;
          }

          // Pick the most recent active session for today
          docs.sort((a, b) => b.joinTime - a.joinTime);

          const activeDoc = docs[0];
          const position = activeDoc.queuePosition ?? 1;
          const patientsAhead = activeDoc.patientsAhead !== undefined ? activeDoc.patientsAhead : Math.max(0, position - 1);
          const rawToken = activeDoc.queueTokenNumber || `#${activeDoc.firestoreSessionId.substring(0, 4).toUpperCase()}`;
          const normalizedToken = formatTokenNumber(rawToken);
          const currentServing = formatTokenNumber(activeDoc.currentServingToken || (patientsAhead === 0 ? normalizedToken : '--'));
          const estimatedWaitMinutes = activeDoc.estimatedWaitMinutes !== undefined ? activeDoc.estimatedWaitMinutes : Math.max(0, patientsAhead * 10);
          const expectedTurnTimeStr = calculateExpectedTurnTime(estimatedWaitMinutes);
          const consultationRange = calculateConsultationTimeRange(activeDoc.consultationStartedAt);

          const updatedInfo: QueuePatient = {
            ...activeDoc,
            queueStatus: activeDoc.queueStatus || 'waiting',
            queuePriority: activeDoc.queuePriority || 'normal',
            queuePosition: position,
            patientsAhead,
            estimatedWaitMinutes,
            queueTokenNumber: normalizedToken,
            currentServingToken: currentServing,
            doctorStatus: activeDoc.doctorStatus || 'pending',
            expectedTurnTimeStr,
            consultationStartedAtStr: consultationRange?.startedStr,
            expectedFinishTimeStr: consultationRange?.expectedFinishStr,
          } as QueuePatient;

          setPatientQueueInfo(updatedInfo);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('[LiveQueue] Firestore onSnapshot error on patientId query:', err);
          if (isMounted) {
            setError(err.message);
            setLoading(false);
          }
        }
      );
    }

    return () => {
      isMounted = false;
      if (unsubSnapshot) unsubSnapshot();
    };
  }, [sessionId, patientId]);

  return { patientQueueInfo, loading, error };
}

export const usePatientLiveQueue = usePatientQueuePolling;
