import { storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { generateUUID } from './uuid';

/**
 * Uploads a medical report to Firebase Storage.
 * Path pattern matches storage.rules:
 * match /patients/{patientId}/sessions/{sessionId}/reports/{fileName}
 * 
 * @param patientId The UID of the authenticated patient
 * @param sessionId The active consultation session ID (Firestore ID)
 * @param file The File object from the file input
 * @param onProgress Optional callback for tracking upload progress (0-100)
 * @param timeoutMs Maximum milliseconds before aborting (default 30,000ms)
 * @returns An object containing the storagePath and downloadUrl
 */
export async function uploadMedicalReport(
  patientId: string,
  sessionId: string,
  file: File,
  onProgress?: (progress: number) => void,
  timeoutMs: number = 30000
): Promise<{ storagePath: string; downloadUrl: string }> {
  if (!patientId || !sessionId) {
    throw new Error('Patient ID and Session ID are required for authenticated upload.');
  }

  // Generate a unique path strictly aligned with storage.rules:
  // match /patients/{patientId}/sessions/{sessionId}/reports/{fileName}
  const uuid = generateUUID();
  const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const storagePath = `patients/${patientId}/sessions/${sessionId}/reports/${uuid}_${safeFileName}`;
  
  const storageRef = ref(storage, storagePath);

  return new Promise<{ storagePath: string; downloadUrl: string }>((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'application/octet-stream',
    });

    let isSettled = false;

    // Timeout guard to prevent indefinite hanging
    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        try {
          uploadTask.cancel();
        } catch (_) {}
        reject(new Error(`Upload timed out after ${timeoutMs / 1000}s. Please check your connection and try again.`));
      }
    }, timeoutMs);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0 && onProgress) {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(Math.min(100, Math.max(0, progress)));
        }
      },
      (error) => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          reject(error);
        }
      },
      async () => {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timer);
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            if (onProgress) onProgress(100);
            resolve({ storagePath, downloadUrl });
          } catch (urlErr) {
            reject(urlErr);
          }
        }
      }
    );
  });
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

