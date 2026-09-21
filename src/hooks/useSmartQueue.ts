"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { PatientSession } from '@/lib/types';
import {
  DEFAULT_CONSULTATION_MINUTES,
  QueuePatient,
  QueueMetrics,
  calculateQueueMetrics
} from '@/lib/queueMetrics';

export { DEFAULT_CONSULTATION_MINUTES, calculateQueueMetrics };
export type { QueuePatient, QueueMetrics };

/**
 * Recalculates and updates queue metadata across active sessions in Firestore.
 * Used by Doctor dashboard when starting or completing consultations.
 */
export async function syncQueueStateInFirestore(
  firestoreInstance = db,
  avgMinutes = DEFAULT_CONSULTATION_MINUTES
) {
  try {
    const q = query(
      collection(firestoreInstance, 'patientSessions'),
      where('queueStatus', 'in', ['waiting', 'triage', 'doctor_review'])
    );
    const snap = await getDocs(q);
    const sessions: PatientSession[] = [];
    snap.forEach(docSnap => {
      sessions.push({ ...docSnap.data(), firestoreSessionId: docSnap.id } as PatientSession);
    });

    const { activeQueue, currentServingToken } = calculateQueueMetrics(sessions, avgMinutes);

    const updatePromises = activeQueue.map(patient => {
      if (!patient.firestoreSessionId) return Promise.resolve();
      const docRef = doc(firestoreInstance, 'patientSessions', patient.firestoreSessionId);
      return updateDoc(docRef, {
        queuePosition: patient.queuePosition,
        patientsAhead: patient.patientsAhead,
        estimatedWaitMinutes: patient.estimatedWaitMinutes,
        currentServingToken,
        updatedAt: serverTimestamp()
      }).catch(err => {
        console.warn(`[SmartQueue] Failed updating queue metadata for doc ${patient.firestoreSessionId}:`, err);
      });
    });

    await Promise.all(updatePromises);
    return { success: true, count: activeQueue.length, currentServingToken };
  } catch (err) {
    console.error('[SmartQueue] Error syncing queue state to Firestore:', err);
    return { success: false, error: err };
  }
}

export function useSmartQueue() {
  const [queue, setQueue] = useState<QueuePatient[]>([]);
  const [currentServingToken, setCurrentServingToken] = useState<string>('--');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'patientSessions'),
      where('queueStatus', 'in', ['waiting', 'triage', 'doctor_review'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions: PatientSession[] = [];
      snapshot.forEach((docSnap) => {
        sessions.push({ ...docSnap.data(), firestoreSessionId: docSnap.id } as PatientSession);
      });

      const metrics = calculateQueueMetrics(sessions);
      setQueue(metrics.activeQueue);
      setCurrentServingToken(metrics.currentServingToken);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching smart queue:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getPatientQueueInfo = (sessionId?: string, patientId?: string) => {
    if (!sessionId && !patientId) return null;
    return queue.find(p => 
      (sessionId && p.firestoreSessionId === sessionId) ||
      (patientId && p.patient?.id === patientId) ||
      (patientId && (p as any).patientId === patientId)
    ) || null;
  };

  return { queue, currentServingToken, loading, getPatientQueueInfo };
}
