import type { RedFlag } from './types';

export type TriagePriority = 'EMERGENCY' | 'HIGH' | 'NORMAL';

export interface PriorityEvaluation {
  priority: TriagePriority;
  label: string;
  reason: string;
}

/**
 * Deterministic clinical priority evaluation engine.
 * Never guesses or diagnoses; strictly uses validated clinical red-flag triggers.
 */
export function calculatePriority(redFlags?: RedFlag[]): PriorityEvaluation {
  if (!redFlags || redFlags.length === 0) {
    return { 
      priority: 'NORMAL', 
      label: 'Normal Priority', 
      reason: 'No clinical red flags detected' 
    };
  }

  // Check for critical / urgent red flags
  const isEmergency = redFlags.some(rf => 
    rf.id?.toLowerCase().includes('urgent') || 
    rf.type?.toLowerCase().includes('urgent') || 
    rf.type?.toLowerCase().includes('emergency') || 
    rf.description?.toLowerCase().includes('emergency') ||
    rf.description?.toLowerCase().includes('immediate') ||
    rf.severity === 'high' && (
      rf.description?.toLowerCase().includes('chest pain') ||
      rf.description?.toLowerCase().includes('breath') ||
      rf.description?.toLowerCase().includes('unconscious') ||
      rf.description?.toLowerCase().includes('stroke') ||
      rf.description?.toLowerCase().includes('bleeding')
    )
  );

  if (isEmergency) {
    return { 
      priority: 'EMERGENCY', 
      label: 'Emergency (Immediate Attention)', 
      reason: redFlags[0]?.description || 'Urgent physiological distress alert' 
    };
  }

  // Check for high priority red flags
  const isHigh = redFlags.some(rf => rf.severity === 'high' || rf.severity === 'medium');
  if (isHigh) {
    return { 
      priority: 'HIGH', 
      label: 'High Priority (Expedite)', 
      reason: redFlags[0]?.description || 'Clinical warning flag detected' 
    };
  }

  return { 
    priority: 'NORMAL', 
    label: 'Normal Priority', 
    reason: 'Routine care intake' 
  };
}

/**
 * Helper to compute elapsed waiting duration.
 */
export function formatWaitingTime(dateInput?: any): string {
  if (!dateInput) return 'Just now';
  let date: Date;
  if (dateInput?.toDate && typeof dateInput.toDate === 'function') {
    date = dateInput.toDate();
  } else if (dateInput?.seconds) {
    date = new Date(dateInput.seconds * 1000);
  } else {
    date = new Date(dateInput);
  }

  if (isNaN(date.getTime())) return 'Just now';

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''}`;
  const hours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Helper to format submission clock time (e.g. "09:42 AM").
 */
export function formatSubmitTime(dateInput?: any): string {
  if (!dateInput) return 'Recent';
  let date: Date;
  if (dateInput?.toDate && typeof dateInput.toDate === 'function') {
    date = dateInput.toDate();
  } else if (dateInput?.seconds) {
    date = new Date(dateInput.seconds * 1000);
  } else {
    date = new Date(dateInput);
  }
  if (isNaN(date.getTime())) return 'Recent';

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
