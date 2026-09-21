import type { PatientSession } from '../types';

export const STORAGE_KEYS = {
  language: 'medi_kiosk_lang',
  patientSession: 'medi_kiosk_session',
  // legacy keys kept for compatibility with existing code during refactor
  consent: 'medi_kiosk_consent',
  answers: 'medi_kiosk_answers',
  uploadedDoc: 'medi_kiosk_doc',
  summary: 'medi_kiosk_summary',
  doctorReview: 'medi_kiosk_review',
};

export function saveToStore(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function loadFromStore<T>(key: string, defaultValue?: T): T | undefined {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function clearStore(key: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function getSession(): PatientSession {
  return loadFromStore<PatientSession>(STORAGE_KEYS.patientSession, { answers: [], knownFacts: [], documents: [], redFlags: [], bodyLocations: [] }) || { answers: [], knownFacts: [], documents: [], redFlags: [], bodyLocations: [] };
}

export function updateSession(updates: Partial<PatientSession>) {
  const current = getSession();
  const savedLang = loadFromStore<string>(STORAGE_KEYS.language) || 'en';
  const nextLang = updates.language || updates.patient?.language || current.language || current.patient?.language || savedLang;

  const nextPatient = updates.patient
    ? { ...current.patient, ...updates.patient, language: updates.patient.language || current.patient?.language || nextLang }
    : current.patient
    ? { ...current.patient, language: current.patient.language || nextLang }
    : undefined;

  const next: PatientSession = {
    ...current,
    ...updates,
    language: nextLang,
    ...(nextPatient ? { patient: nextPatient } : {})
  };
  saveToStore(STORAGE_KEYS.patientSession, next);
  return next;
}

export function clearSession() {
  clearStore(STORAGE_KEYS.patientSession);
}
