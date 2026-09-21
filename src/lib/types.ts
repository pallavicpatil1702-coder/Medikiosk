export interface Patient {
  id: string;
  abhaId?: string;
  name: string;
  age: number;
  gender: string;
  contact?: string;
  email?: string;
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
  selectedChoices?: string[];
  inputMethod?: 'text' | 'voice' | 'body_map';
  timestamp?: string;
  originalTranscript?: string;
  normalizedEnglishText?: string;
  transcriptionSource?: 'bhashini' | 'web-speech';
}

export interface Question {
  id: string;
  text: Record<string, string> | string; // Multilingual map { en: "...", hi: "..." } or string
  category?: string;
  dependsOn?: { qId: string; value: string };
  type: string;
  options?: any[];
  choices?: any[];
  answerOption?: any[];
  branch?: Record<string, string>;
  next?: string;
  red_flag?: boolean;
  example?: string;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  [key: string]: any;
}

export interface ClinicalHistory {
  chiefComplaint: string;
  duration: string;
  associatedSymptoms: string[];
  medicationTaken: string;
  allergies: string;
  pastMedicalHistory: string;
  otherInfo?: string;
  bodyLocations?: BodyLocation[];
  answers: Answer[];
}

export interface MedicalDocument {
  id: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  size: string;
  extractedData?: ExtractedClinicalData;
  summary?: string;
  dataUrl?: string; // Kept for demo/unauthenticated flow
  storagePath?: string;
  downloadUrl?: string;
}

export interface ExtractedClinicalData {
  reportDate?: string;
  summary?: string;
  rawText?: string;
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


export interface StructuredPhysicianSummary {
  clinicalHandoff: string;
  // Legacy fields for backward compatibility with old sessions
  chiefComplaint?: string;
  durationOnset?: string;
  affectedArea?: string;
  associatedSymptoms?: string[];
  relevantHistory?: string;
  patientReportedAnswers?: { question: string; answer: string }[];
  reportsInvestigations?: string;
  medicines?: string;
  redFlags?: string[];
  missingUnknownInformation?: string[];
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

export interface BodyLocation {
  id: string;
  name: string;
  view: 'front' | 'back';
  side?: 'left' | 'right' | 'midline' | 'bilateral';
  paintedPoints?: [number, number, number][];
}

export interface AyurvedaReference {
  term: string;        // e.g. "Amlapitta"
  termHindi: string;   // e.g. "अम्लपित्त"
  basis: string[];     // e.g. ["burning sensation", "acidic/regurgitation symptoms"]
  confidence: 'reference' | 'possible';
  status: 'unconfirmed' | 'accepted' | 'rejected' | 'edited';
}

export interface MedicationSafetyAlert {
  id: string;
  itemA: string;
  itemB: string;
  interactionType: 'herb-drug' | 'drug-drug' | 'duplicate';
  severity: 'informational' | 'caution' | 'high_attention';
  concern: string;
  evidenceNote: string;
  source: string;
  status: 'pending_review' | 'acknowledged' | 'dismissed';
  clinicianAction?: 'acknowledged' | 'dismissed';
  clinicianNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface PatientSession {
  patient?: Patient;
  consent?: Consent;
  chiefComplaint?: string;
  originalChiefComplaint?: string;
  bodyLocations?: BodyLocation[];
  activeModules?: string[];
  completedModules?: string[];
  answers: Answer[];
  knownFacts?: Answer[];
  clinicalHistory?: ClinicalHistory;
  documents: MedicalDocument[];
  extractedData?: ExtractedClinicalData;
  redFlags: RedFlag[];
  ayurvedaReferences?: AyurvedaReference[];
  medicationSafetyAlerts?: MedicationSafetyAlert[];
  clinicalSummary?: ClinicalSummary;
  structuredPhysicianSummary?: StructuredPhysicianSummary;
  physicianSummaryStatus?: 'pending' | 'generated' | 'failed';

  doctorReview?: DoctorReview;
  firestoreSessionId?: string;
  syncStatus?: 'error' | 'local' | 'syncing' | 'synced' | 'pending';
  status?: string;
  language?: string;
  createdAt?: any;
  updatedAt?: any;
  triageStatus?: 'pending_review' | 'reviewed' | 'forwarded_to_physician';
  triageNote?: string;
  triageTimestamp?: string;
  triageNurseId?: string;
  
  // Smart Queue Fields
  queueStatus?: 'waiting' | 'triage' | 'doctor_review' | 'completed';
  queueTokenNumber?: string;
  queuePriority?: 'emergency' | 'high' | 'normal';
  queuePriorityScore?: number;
  queueJoinedAt?: any;
  queuePosition?: number;
  estimatedWaitMinutes?: number;
  nurseStatus?: string;
  doctorStatus?: string;
  assignedDoctorId?: string;
  currentServingToken?: string;
  patientsAhead?: number;
  consultationStartedAt?: any;
}

