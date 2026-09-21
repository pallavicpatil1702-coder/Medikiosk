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
 * Parses numeric value from token string or number.
 * e.g. '#012' -> 12, '12' -> 12, '#001' -> 1
 */
export function parseTokenNumber(rawToken?: string | number | null): number | null {
  if (!rawToken) return null;
  const str = String(rawToken).trim();
  const match = str.match(/\d+/);
  if (!match) return null;
  const num = parseInt(match[0], 10);
  return isNaN(num) || num <= 0 ? null : num;
}

/**
 * Normalizes any token string/number into the standardized clinic format: #001, #002, #005
 */
export function formatTokenNumber(rawToken?: string | number | null): string {
  if (!rawToken) return '--';
  const num = parseTokenNumber(rawToken);
  if (!num) {
    const str = String(rawToken).trim();
    return str.startsWith('#') ? str : `#${str}`;
  }
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
 * - Identifies "Now Serving" strictly from the ACTUAL in-progress consultation (doctorStatus === 'in_progress')
 * - If no consultation is in-progress, returns '--' instead of inventing a token
 * - Calculates patientsAhead dynamically:
 *     When servingToken active: max(0, patientToken - currentServingToken - 1)
 *     When no consultation active: count of active sessions waiting ahead
 * - Calculates estimatedWaitMinutes dynamically using actual consultation elapsed time + queue position
 */
export function calculateQueueMetrics(
  sessions: PatientSession[],
  avgMinutes = DEFAULT_CONSULTATION_MINUTES
): QueueMetrics {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfDayMs = startOfDay.getTime();

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);
  const endOfDayMs = endOfDay.getTime();

  // Filter out completed/inactive sessions, and strictly include valid sequential sessions from CURRENT day
  const activeSessions = sessions.filter(s => {
    if (
      s.queueStatus === 'completed' || 
      s.doctorStatus === 'completed' ||
      s.status === 'confirmed' ||
      s.status === 'rejected'
    ) {
      return false;
    }

    // Token must be a valid sequential token for clinic day (< 100 to filter legacy test artifacts)
    const tokenNum = parseTokenNumber(s.queueTokenNumber);
    if (!tokenNum || tokenNum > 100) {
      return false;
    }

    // Verify session belongs to today
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

    return sessionTime >= startOfDayMs && sessionTime <= endOfDayMs;
  });

  // Sort queue: in-progress first, then clinical priority, then sequential token number FIFO
  activeSessions.sort((a, b) => {
    // 1. Actively in-progress with doctor takes top spot
    const inProgA = a.doctorStatus === 'in_progress' ? 1 : 0;
    const inProgB = b.doctorStatus === 'in_progress' ? 1 : 0;
    if (inProgA !== inProgB) return inProgB - inProgA;

    // 2. Clinical Priority Score (emergency: 100 > high: 50 > normal: 0)
    const scoreA = a.queuePriorityScore || 0;
    const scoreB = b.queuePriorityScore || 0;
    if (scoreA !== scoreB) return scoreB - scoreA;

    // 3. Sequential Token Number
    const numA = parseTokenNumber(a.queueTokenNumber) || 9999;
    const numB = parseTokenNumber(b.queueTokenNumber) || 9999;
    if (numA !== numB) return numA - numB;

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

  // 1. Identify "Now Serving" from actual currently active/in-progress consultation for current queue/day
  const inProgressSession = activeSessions.find(s => s.doctorStatus === 'in_progress');
  const currentServingToken = inProgressSession?.queueTokenNumber 
    ? formatTokenNumber(inProgressSession.queueTokenNumber) 
    : '--';
  const currentServingSessionId = inProgressSession?.firestoreSessionId;
  const currentServingStartedAt = inProgressSession?.consultationStartedAt;

  // 2. Calculate remaining consultation time for currently serving patient
  let remainingTimeForCurrent = avgMinutes;
  const consultationTimeRange = calculateConsultationTimeRange(currentServingStartedAt, avgMinutes);

  if (currentServingStartedAt) {
    const startMs = typeof currentServingStartedAt.toMillis === 'function'
      ? currentServingStartedAt.toMillis()
      : (currentServingStartedAt.seconds
        ? currentServingStartedAt.seconds * 1000
        : new Date(currentServingStartedAt).getTime());
    if (!isNaN(startMs) && startMs > 0) {
      const elapsedMinutes = Math.max(0, (Date.now() - startMs) / 60000);
      remainingTimeForCurrent = Math.max(0, Math.round(avgMinutes - elapsedMinutes));
    }
  }

  const servingNum = parseTokenNumber(currentServingToken);

  const activeQueue: QueuePatient[] = activeSessions.map((session, index) => {
    const normalizedToken = formatTokenNumber(session.queueTokenNumber);
    const patientNum = parseTokenNumber(session.queueTokenNumber);

    // 3. Calculate Patients Ahead dynamically
    let patientsAhead = 0;
    if (patientNum) {
      if (servingNum) {
        // Normal sequential FIFO queue formula: max(0, patientToken - currentServingToken - 1)
        if (patientNum === servingNum) {
          patientsAhead = 0;
        } else if (patientNum > servingNum) {
          patientsAhead = Math.max(0, patientNum - servingNum - 1);
        } else {
          patientsAhead = 0;
        }
      } else {
        // When no consultation is actively serving, count active waiting patients ahead in queue
        const waitingAhead = activeSessions.filter(s => {
          const otherNum = parseTokenNumber(s.queueTokenNumber);
          return otherNum && otherNum < patientNum;
        });
        patientsAhead = waitingAhead.length;
      }
    }

    // 4. Calculate Estimated Wait Minutes dynamically
    let estimatedWaitMinutes = 0;
    if (patientsAhead > 0) {
      if (servingNum) {
        estimatedWaitMinutes = remainingTimeForCurrent + (patientsAhead - 1) * avgMinutes;
      } else {
        estimatedWaitMinutes = patientsAhead * avgMinutes;
      }
    }

    // 5. Calculate Expected Turn Time dynamically
    const expectedTurnTimeStr = calculateExpectedTurnTime(estimatedWaitMinutes);
    const queuePosition = patientsAhead + 1;

    return {
      ...session,
      queueTokenNumber: normalizedToken,
      queuePosition,
      patientsAhead,
      estimatedWaitMinutes,
      currentServingToken,
      expectedTurnTimeStr,
      consultationStartedAtStr: inProgressSession?.firestoreSessionId === session.firestoreSessionId
        ? consultationTimeRange?.startedStr 
        : undefined,
      expectedFinishTimeStr: inProgressSession?.firestoreSessionId === session.firestoreSessionId
        ? consultationTimeRange?.expectedFinishStr 
        : undefined,
    };
  });

  return {
    currentServingToken,
    currentServingSessionId,
    currentServingStartedAt,
    activeQueue
  };
}
