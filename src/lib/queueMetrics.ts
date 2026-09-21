import { PatientSession } from '@/lib/types';

export const DEFAULT_CONSULTATION_MINUTES = 10;

export interface QueuePatient extends PatientSession {
  queuePosition: number;
  patientsAhead: number;
  estimatedWaitMinutes: number;
  currentServingToken?: string;
  expectedTurnTimeStr?: string;
  consultationStartedAtStr?: string;
  expectedFinishTimeStr?: string;
}

export interface QueueMetrics {
  currentServingToken: string;
  currentServingSessionId?: string;
  currentServingStartedAt?: any;
  activeQueue: QueuePatient[];
}

/**
 * Normalizes any token string/number into the standardized clinic format: #001, #002, #005
 */
export function formatTokenNumber(rawToken?: string | number | null): string {
  if (!rawToken) return '--';
  const str = String(rawToken).trim();
  const match = str.match(/\d+/);
  if (!match) return str.startsWith('#') ? str : `#${str}`;
  const num = parseInt(match[0], 10);
  return `#${String(num).padStart(3, '0')}`;
}

/**
 * Calculates Expected Turn Time based on:
 * current time + estimatedWaitMinutes in the patient's local timezone.
 * When wait is 0, returns "NOW".
 */
export function calculateExpectedTurnTime(estimatedWaitMinutes: number): string {
  if (estimatedWaitMinutes <= 0) {
    return 'NOW';
  }
  const turnTime = new Date(Date.now() + estimatedWaitMinutes * 60 * 1000);
  return turnTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

/**
 * Calculates Started and Expected Finish time strings for active consultation
 */
export function calculateConsultationTimeRange(
  startedAt: any,
  avgMinutes = DEFAULT_CONSULTATION_MINUTES
): { startedStr: string; expectedFinishStr: string } | null {
  if (!startedAt) return null;
  const startMs = typeof startedAt.toMillis === 'function'
    ? startedAt.toMillis()
    : (startedAt.seconds ? startedAt.seconds * 1000 : new Date(startedAt).getTime());

  if (isNaN(startMs) || startMs <= 0) return null;

  const startDate = new Date(startMs);
  const finishDate = new Date(startMs + avgMinutes * 60 * 1000);

  return {
    startedStr: startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
    expectedFinishStr: finishDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
  };
}

/**
 * Calculates accurate real-time queue metrics:
 * - Filters strictly by CURRENT operating day (resets daily)
 * - Sorts by: In-progress consultation > Doctor review / Triage > Priority score > FIFO queueJoinedAt
 * - Sets currentServingToken to the patient currently in consultation (or top waiting patient)
 * - Calculates patientsAhead as actual count of active patients ahead in the queue
 * - Calculates estimatedWaitMinutes using remaining consultation time + 10m per waiting patient ahead
 */
export function calculateQueueMetrics(
  sessions: PatientSession[],
  avgMinutes = DEFAULT_CONSULTATION_MINUTES
): QueueMetrics {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfDayMs = startOfDay.getTime();

  // Filter out any completed sessions, and only include sessions from CURRENT operating day
  const activeSessions = sessions.filter(s => {
    if (s.queueStatus === 'completed' || s.doctorStatus === 'completed') {
      return false;
    }
    // Check if session belongs to today
    let sessionTime = 0;
    if (s.queueJoinedAt) {
      sessionTime = typeof s.queueJoinedAt.toMillis === 'function'
        ? s.queueJoinedAt.toMillis()
        : (s.queueJoinedAt.seconds ? s.queueJoinedAt.seconds * 1000 : new Date(s.queueJoinedAt).getTime());
    } else if (s.createdAt) {
      sessionTime = typeof s.createdAt.toMillis === 'function'
        ? s.createdAt.toMillis()
        : (s.createdAt.seconds ? s.createdAt.seconds * 1000 : new Date(s.createdAt).getTime());
    }
    // Only active sessions from today's clinic day
    return sessionTime >= startOfDayMs;
  });

  const statusWeight: Record<string, number> = {
    doctor_review: 3,
    triage: 2,
    waiting: 1,
  };

  activeSessions.sort((a, b) => {
    // 1. Actively in-progress with doctor takes top spot
    const inProgA = a.doctorStatus === 'in_progress' ? 1 : 0;
    const inProgB = b.doctorStatus === 'in_progress' ? 1 : 0;
    if (inProgA !== inProgB) return inProgB - inProgA;

    // 2. Queue Status (doctor_review > triage > waiting)
    const weightA = statusWeight[a.queueStatus || 'waiting'] || 0;
    const weightB = statusWeight[b.queueStatus || 'waiting'] || 0;
    if (weightA !== weightB) return weightB - weightA;

    // 3. Clinical Priority Score (emergency: 100 > high: 50 > normal: 0)
    const scoreA = a.queuePriorityScore || 0;
    const scoreB = b.queuePriorityScore || 0;
    if (scoreA !== scoreB) return scoreB - scoreA;

    // 4. FIFO (queueJoinedAt)
    let timeA = Date.now();
    let timeB = Date.now();
    if (a.queueJoinedAt) {
      timeA = typeof a.queueJoinedAt.toMillis === 'function'
        ? a.queueJoinedAt.toMillis()
        : (a.queueJoinedAt.seconds ? a.queueJoinedAt.seconds * 1000 : new Date(a.queueJoinedAt).getTime());
    }
    if (b.queueJoinedAt) {
      timeB = typeof b.queueJoinedAt.toMillis === 'function'
        ? b.queueJoinedAt.toMillis()
        : (b.queueJoinedAt.seconds ? b.queueJoinedAt.seconds * 1000 : new Date(b.queueJoinedAt).getTime());
    }
    return timeA - timeB;
  });

  if (activeSessions.length === 0) {
    return {
      currentServingToken: '--',
      activeQueue: []
    };
  }

  const servingPatient = activeSessions[0];
  const currentServingToken = formatTokenNumber(servingPatient.queueTokenNumber);
  const currentServingSessionId = servingPatient.firestoreSessionId;
  const currentServingStartedAt = servingPatient.consultationStartedAt;

  // Calculate remaining consultation time for currently serving patient
  let remainingTimeForCurrent = avgMinutes;
  let consultationTimeRange = calculateConsultationTimeRange(servingPatient.consultationStartedAt, avgMinutes);

  if (servingPatient.consultationStartedAt) {
    const startMs = typeof servingPatient.consultationStartedAt.toMillis === 'function'
      ? servingPatient.consultationStartedAt.toMillis()
      : (servingPatient.consultationStartedAt.seconds
        ? servingPatient.consultationStartedAt.seconds * 1000
        : new Date(servingPatient.consultationStartedAt).getTime());
    const elapsedMinutes = Math.max(0, (Date.now() - startMs) / 60000);
    remainingTimeForCurrent = Math.max(0, Math.round(avgMinutes - elapsedMinutes));
  }

  const activeQueue: QueuePatient[] = activeSessions.map((session, index) => {
    const queuePosition = index + 1;
    const patientsAhead = index; // 0 for currently serving, 1 for next in line, etc.
    const normalizedToken = formatTokenNumber(session.queueTokenNumber);

    let estimatedWaitMinutes = 0;
    if (patientsAhead > 0) {
      // Remaining time for current consultation + 10m for each waiting patient ahead
      estimatedWaitMinutes = remainingTimeForCurrent + (patientsAhead - 1) * avgMinutes;
    }

    const expectedTurnTimeStr = calculateExpectedTurnTime(estimatedWaitMinutes);

    return {
      ...session,
      queueTokenNumber: normalizedToken,
      queuePosition,
      patientsAhead,
      estimatedWaitMinutes,
      currentServingToken,
      expectedTurnTimeStr,
      consultationStartedAtStr: consultationTimeRange?.startedStr,
      expectedFinishTimeStr: consultationTimeRange?.expectedFinishStr,
    };
  });

  return {
    currentServingToken,
    currentServingSessionId,
    currentServingStartedAt,
    activeQueue
  };
}
