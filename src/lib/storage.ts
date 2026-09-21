import { storage } from './firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { generateUUID } from './uuid';

/**
 * Uploads a medical report to Firebase Storage.
 * @param patientId The UID of the authenticated patient
 * @param sessionId The active consultation session ID (Firestore ID)
 * @param file The File object from the file input
 * @returns An object containing the storagePath and downloadUrl
 */
export async function uploadMedicalReport(patientId: string, sessionId: string, file: File) {
  if (!patientId || !sessionId) {
    throw new Error('Patient ID and Session ID are required for authenticated upload.');
  }

  // Generate a unique path: patients/{patientId}/reports/{sessionId}/{uuid}_{filename}
  const uuid = generateUUID();
  // Sanitize filename to avoid weird characters in path
  const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const storagePath = `patients/${patientId}/reports/${sessionId}/${uuid}_${safeFileName}`;
  
  const storageRef = ref(storage, storagePath);

  // Upload the file
  const snapshot = await uploadBytes(storageRef, file);
  
  // Get the download URL
  const downloadUrl = await getDownloadURL(snapshot.ref);

  return { storagePath, downloadUrl };
}

/**
 * Deletes a medical report from Firebase Storage.
 * @param storagePath The exact storage path of the file to delete
 */
export async function deleteMedicalReport(storagePath: string) {
  if (!storagePath) return;
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);
}
