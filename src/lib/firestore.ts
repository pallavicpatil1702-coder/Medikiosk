import { db, auth } from '@/lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where, 
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { PatientSession, MedicalDocument } from '@/lib/types';

// ==========================================
// Types
// ==========================================

export interface UserProfile {
  uid: string;
  email: string;
  role: 'patient' | 'doctor';
  createdAt?: any;
  updatedAt?: any;
}

export interface ReportMetadata {
  id?: string;
  patientId: string;
  sessionId: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  storagePath?: string;
  uploadedAt: any;
  extractionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  extractedData?: any;
}

// ==========================================
// User Profiles (Users Collection)
// ==========================================

export const createUserProfile = async (uid: string, data: Partial<UserProfile>) => {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    ...data,
    uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return snap.data() as UserProfile;
  }
  return null;
};

// ==========================================
// Patient Sessions
// ==========================================

/**
 * Ensures the patient is anonymously authenticated.
 */
export const ensurePatientAuth = async () => {
  if (auth.currentUser) {
    return auth.currentUser;
  }
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (error) {
    console.error('Failed to authenticate patient anonymously:', error);
    return null;
  }
};

/**
 * Safely synchronizes the current local PatientSession to Firestore if the user is authenticated.
 * This is designed to be non-blocking and safe for the existing demo flow.
 */
export const syncSessionToFirestore = async (
  currentUser: any,
  session: PatientSession,
  updateLocalSession: (updates: Partial<PatientSession>) => void,
  status: 'active' | 'completed' | 'submitted' | 'pending_review' = 'active'
): Promise<{ success: boolean; error?: string; networkError?: boolean }> => {
  console.log('[Session Sync] called = true');
  // Ensure we have a user (anonymously signed in if needed)
  const user = currentUser || await ensurePatientAuth();
  console.log(`[Session Sync] uid = ${user && user.uid ? user.uid : 'missing'}`);
  console.log(`[Session Sync] sessionId = ${session.firestoreSessionId || 'new'}`);
  console.log(`[Session Sync] status = ${status}`);
  console.log(`[Session Sync] collection = patientSessions`);
  
  if (!user || !user.uid) {
    console.warn('[Session Sync] write error = No authenticated user');
    return { success: false, error: 'No authenticated user' };
  }

  // Pre-check browser online status
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.warn('[Session Sync] write error = Browser reports offline');
    updateLocalSession({ syncStatus: 'pending' });
    return { success: false, networkError: true, error: 'Browser is offline' };
  }

  try {
    console.log('[Session Sync] write started = true');
    
    // We only use the authenticated UID as the true patient ID for security
    const patientId = user.uid;

    // Strip dataUrl from documents to prevent Firestore document size limit errors (1 MiB max)
    // We only keep the metadata and storage references
    const sanitizedDocuments = (session.documents || []).map(doc => {
      const { dataUrl, ...safeDoc } = doc;
      return safeDoc;
    });

    // Helper to sanitize any undefined values to avoid Firestore serialization crash
    const safeData = (data: any) => {
      if (data === undefined || data === null) return null;
      return JSON.parse(JSON.stringify(data, (key, value) => {
        return value === undefined ? null : value;
      }));
    };

    let queueFields: any = {};
    if (status === 'completed' || status === 'submitted') {
      const hasEmergency = session.redFlags?.some(r => r.severity === 'high');
      const hasHigh = session.redFlags?.some(r => r.severity === 'medium');
      const queuePriority = hasEmergency ? 'emergency' : (hasHigh ? 'high' : 'normal');
      const queuePriorityScore = hasEmergency ? 100 : (hasHigh ? 50 : 0);
      
      queueFields = {
        queueStatus: session.queueStatus || 'waiting',
        queuePriority,
        queuePriorityScore,
        nurseStatus: session.nurseStatus || 'pending',
        doctorStatus: session.doctorStatus || 'pending',
      };
      
      // Only set queueJoinedAt and queueTokenNumber if not already assigned
      if (!session.queueJoinedAt) {
        queueFields.queueJoinedAt = serverTimestamp();
      } else {
        queueFields.queueJoinedAt = session.queueJoinedAt;
      }

      if (session.queueTokenNumber) {
        queueFields.queueTokenNumber = session.queueTokenNumber;
      } else {
        try {
          // Fetch sequential token from secure server API respecting current clinic operating day
          if (typeof window !== 'undefined') {
            const res = await fetch('/api/patient/assign-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                patientId,
                sessionId: session.firestoreSessionId
              })
            });
            if (res.ok) {
              const data = await res.json();
              if (data?.token) {
                queueFields.queueTokenNumber = data.token;
                session.queueTokenNumber = data.token;
                updateLocalSession({ queueTokenNumber: data.token });
              }
            }
          }
        } catch (apiErr) {
          console.warn("API sequential token fetch error:", apiErr);
        }

        if (!queueFields.queueTokenNumber) {
          // Fallback start of day token
          queueFields.queueTokenNumber = '#001';
          session.queueTokenNumber = '#001';
          updateLocalSession({ queueTokenNumber: '#001' });
        }
      }
    }

    if (session.firestoreSessionId) {
      try {
        // Update existing session document
        const sessionRef = doc(db, 'patientSessions', session.firestoreSessionId);
        const sessionLanguage = session.language || session.patient?.language || 'en';
        await updateDoc(sessionRef, {
          patientId,
          patient: safeData(session.patient),
          language: sessionLanguage,
          chiefComplaint: session.chiefComplaint || '',
          originalChiefComplaint: session.originalChiefComplaint || '',
          answers: safeData(session.answers || []),
          documents: safeData(sanitizedDocuments),
          extractedData: safeData(session.extractedData),
          redFlags: safeData(session.redFlags || []),
          summary: safeData(session.clinicalSummary),
          patientSummary: session.patientSummary || null,
          informationSentToDoctor: session.informationSentToDoctor || null,
          consent: safeData(session.consent),
          status: status === 'completed' ? 'pending_review' : status,
          updatedAt: serverTimestamp(),
          ...queueFields
        });
        updateLocalSession({ syncStatus: 'synced', ...queueFields });
        console.log('[Session Sync] write success = true (Updated session: ' + session.firestoreSessionId + ')');
        return { success: true };
      } catch (updateErr: any) {
        console.warn('[Session Sync] Could not update existing session (' + session.firestoreSessionId + '), will create a new session document for this user:', updateErr?.message);
        // Fall through to create a new session document
        
        // If it's a network error during update, we should catch it here instead of falling through to addDoc
        if (updateErr?.code === 'unavailable' || updateErr?.message?.toLowerCase().includes('network') || updateErr?.message?.toLowerCase().includes('offline')) {
          updateLocalSession({ syncStatus: 'pending' });
          return { success: false, networkError: true, error: updateErr?.message || 'Network error' };
        }
      }
    }

    // Create new session document
    const sessionsRef = collection(db, 'patientSessions');
    const sessionLanguage = session.language || session.patient?.language || 'en';
    const docRef = await addDoc(sessionsRef, {
      patientId,
      patient: safeData(session.patient),
      language: sessionLanguage,
      chiefComplaint: session.chiefComplaint || '',
      originalChiefComplaint: session.originalChiefComplaint || '',
      answers: safeData(session.answers || []),
      documents: safeData(sanitizedDocuments),
      extractedData: safeData(session.extractedData),
      redFlags: safeData(session.redFlags || []),
      summary: safeData(session.clinicalSummary),
      patientSummary: session.patientSummary || null,
      informationSentToDoctor: session.informationSentToDoctor || null,
      consent: safeData(session.consent),
      status: status === 'completed' ? 'pending_review' : status,
      triageStatus: 'pending_review',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...queueFields
    });
    
    // Save the generated ID back to local storage
    updateLocalSession({ firestoreSessionId: docRef.id, syncStatus: 'synced', triageStatus: 'pending_review', ...queueFields });
    console.log('[Session Sync] write success = true (Created new session: ' + docRef.id + ')');
    return { success: true };
  } catch (error: any) {
    console.error('[Session Sync] write error =', error?.code, error?.message, error);
    
    // Check if it's a network error
    const isNetworkError = 
      error?.code === 'unavailable' || 
      error?.message?.toLowerCase().includes('offline') ||
      error?.message?.toLowerCase().includes('network');

    if (isNetworkError) {
      updateLocalSession({ syncStatus: 'pending' });
      return { success: false, networkError: true, error: error?.message || 'Network error' };
    }

    updateLocalSession({ syncStatus: 'error' });
    return { success: false, error: error?.message || 'Unknown error' };
  }
};

// ==========================================
// Reports Metadata
// ==========================================

export const createReportMetadata = async (
  patientId: string, 
  sessionId: string, 
  reportData: Partial<ReportMetadata>
) => {
  const reportsRef = collection(db, 'reports');
  const docRef = await addDoc(reportsRef, {
    patientId,
    sessionId,
    fileName: reportData.fileName || 'Unknown',
    fileType: reportData.fileType || 'application/pdf',
    fileSize: reportData.fileSize || '0',
    storagePath: reportData.storagePath || '',
    uploadedAt: serverTimestamp(),
    extractionStatus: reportData.extractionStatus || 'pending',
    extractedData: reportData.extractedData || null,
  });
  return docRef.id;
};

export const getPatientReports = async (patientId: string): Promise<ReportMetadata[]> => {
  const reportsRef = collection(db, 'reports');
  const q = query(reportsRef, where('patientId', '==', patientId));
  const snap = await getDocs(q);
  
  const reports: ReportMetadata[] = [];
  snap.forEach((docSnap) => {
    reports.push({ id: docSnap.id, ...docSnap.data() } as ReportMetadata);
  });
  
  return reports;
};

// ==========================================
// Triage Nurse Actions (Strict RBAC-compliant)
// ==========================================

export const updateSessionTriage = async (
  sessionId: string,
  updates: {
    triageStatus: 'pending_review' | 'reviewed' | 'forwarded_to_physician';
    triageNote?: string;
    triageNurseId?: string;
  }
) => {
  const sessionRef = doc(db, 'patientSessions', sessionId);
  const payload: {
    triageStatus: 'pending_review' | 'reviewed' | 'forwarded_to_physician';
    triageNote: string;
    triageTimestamp: string;
    triageNurseId: string;
  } = {
    triageStatus: updates.triageStatus,
    triageNote: updates.triageNote || '',
    triageTimestamp: new Date().toISOString(),
    triageNurseId: updates.triageNurseId || 'nurse-1',
  };

  await updateDoc(sessionRef, payload);
  return payload;
};

