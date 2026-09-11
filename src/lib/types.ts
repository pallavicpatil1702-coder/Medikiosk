export interface Patient {
  id: string;
  abhaId?: string;
  name: string;
  age: number;
  gender: string;
  contact?: string;
  language?: string;
  consent?: boolean;
  createdAt: string;
}

export interface Consent {
  given: boolean;
  timestamp?: string;
  purpose: string;
}

export interface Answer {
  questionId: string;
  moduleId?: string;
  questionText?: string;
  language?: string;
  answer: string;
  inputMethod?: 'text' | 'voice';
  timestamp?: string;
}

export interface Question {
  id: string;
  text: Record<string, string> | string; // Multilingual map { en: "...", hi: "..." } or string
  category?: string;
  dependsOn?: { qId: string; value: string };
  type: string;
  options?: string[];
  choices?: string[];
  branch?: Record<string, string>;
  next?: string;
  red_flag?: boolean;
  example?: string;
}

export interface ClinicalHistory {
  chiefComplaint: string;
  duration: string;
  associatedSymptoms: string[];
  medicationTaken: string;
  allergies: string;
  pastMedicalHistory: string;
  otherInfo?: string;
  answers: Answer[];
}

export interface MedicalDocument {
  id: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  size: string;
  extractedData?: ExtractedClinicalData;
  dataUrl?: string; // Kept for demo/unauthenticated flow
  storagePath?: string;
  downloadUrl?: string;
}

export interface ExtractedClinicalData {
  reportDate?: string;
  tests: Array<{
    name: string;
    value: string;
    unit: string;
    referenceRange: string;
    flag: string | null;
  }>;
  medicines: string[];
  confidence?: 'high' | 'medium' | 'low';
  source?: string;
}

export interface RedFlag {
  id: string;
  type: string;
  description: string;
  severity: 'high' | 'medium';
  detectedAt: string;
}

export interface ClinicalSummary {
  id: string;
  patientId: string;
  generatedAt: string;
  patient: Patient;
  history: ClinicalHistory;
  medications: string;
  allergies: string;
  pastHistory: string;
  investigationResults: string;
  previousReports: string[];
  redFlags: RedFlag[];
  aiNotes: string;
  doctorReview?: DoctorReview;
  status: 'pending' | 'reviewed' | 'confirmed';
}

export interface DoctorReview {
  doctorName: string;
  doctorId: string;
  reviewedAt: string;
  edits?: Record<string, string>;
  confirmed: boolean;
  notes?: string;
}

export interface FHIRResource {
  resourceType: string;
  id: string;
  [key: string]: unknown;
}

export interface PatientSession {
  patient?: Patient;
  consent?: Consent;
  chiefComplaint?: string;
  activeModules?: string[];
  completedModules?: string[];
  answers: Answer[];
  knownFacts?: Answer[];
  clinicalHistory?: ClinicalHistory;
  documents: MedicalDocument[];
  extractedData?: ExtractedClinicalData;
  redFlags: RedFlag[];
  clinicalSummary?: ClinicalSummary;
  doctorReview?: DoctorReview;
  firestoreSessionId?: string;
  syncStatus?: 'local' | 'syncing' | 'synced' | 'error';
  status?: string;
  language?: string;
  createdAt?: any;
  updatedAt?: any;
  triageStatus?: 'pending_review' | 'reviewed' | 'forwarded_to_physician';
  triageNote?: string;
  triageTimestamp?: string;
  triageNurseId?: string;
}
