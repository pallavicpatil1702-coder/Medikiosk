import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { PatientSession } from '@/lib/types';

export const DEFAULT_CONSULTATION_MINUTES = 15;

export interface QueuePatient extends PatientSession {
  queuePosition: number;
  estimatedWaitMinutes: number;
}

export function useSmartQueue() {
  const [queue, setQueue] = useState<QueuePatient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We fetch all non-completed sessions that are in the queue.
    const q = query(
      collection(db, 'patientSessions'),
      where('queueStatus', 'in', ['waiting', 'triage', 'doctor_review'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions: PatientSession[] = [];
      snapshot.forEach((doc) => {
        sessions.push({ ...doc.data(), firestoreSessionId: doc.id } as PatientSession);
      });

      // Sort the queue on the client to avoid complex Firestore composite indexes
      // Sort logic:
      // 1. Status: doctor_review > triage > waiting
      // 2. Priority: emergency (100) > high (50) > normal (0)
      // 3. FIFO: queueJoinedAt ascending
      
      const statusWeight = {
        doctor_review: 3,
        triage: 2,
        waiting: 1,
        completed: 0
      };

      sessions.sort((a, b) => {
        // 1. Status
        const weightA = statusWeight[a.queueStatus || 'waiting'] || 0;
        const weightB = statusWeight[b.queueStatus || 'waiting'] || 0;
        if (weightA !== weightB) return weightB - weightA; // Higher weight first

        // 2. Priority Score
        const scoreA = a.queuePriorityScore || 0;
        const scoreB = b.queuePriorityScore || 0;
        if (scoreA !== scoreB) return scoreB - scoreA; // Higher score first

        // 3. FIFO (queueJoinedAt)
        // Handle potential null/pending timestamps from Firestore
        let timeA = Date.now();
        let timeB = Date.now();
        if (a.queueJoinedAt) {
          timeA = typeof a.queueJoinedAt.toMillis === 'function' ? a.queueJoinedAt.toMillis() : Date.now();
        }
        if (b.queueJoinedAt) {
          timeB = typeof b.queueJoinedAt.toMillis === 'function' ? b.queueJoinedAt.toMillis() : Date.now();
        }
        
        return timeA - timeB; // Earlier time first
      });

      // Now assign position and ETA
      // Only people in 'waiting' or 'triage' count towards waiting time for others.
      // People in 'doctor_review' are already with the doctor.
      let positionCounter = 1;
      
      const processedQueue = sessions.map((session, index) => {
        const position = positionCounter++;
        // ETA = (position - 1) * 15
        const estimatedWaitMinutes = Math.max(0, (position - 1) * DEFAULT_CONSULTATION_MINUTES);
        
        return {
          ...session,
          queuePosition: position,
          estimatedWaitMinutes
        } as QueuePatient;
      });

      setQueue(processedQueue);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching queue:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Helper to get specific patient's info
  const getPatientQueueInfo = (sessionId: string | undefined) => {
    if (!sessionId) return null;
    return queue.find(p => p.firestoreSessionId === sessionId) || null;
  };

  return { queue, loading, getPatientQueueInfo };
}
