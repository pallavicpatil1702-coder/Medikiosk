import { useAuth } from '@/context/AuthContext';
import { getSession, updateSession } from '@/lib/store/store';
import { syncSessionToFirestore } from '@/lib/firestore';

let activeSyncPromise: Promise<{ success: boolean; error?: string }> | null = null;

export function useSync() {
  const { currentUser } = useAuth();
  
  return {
    sync: async (status: 'active' | 'completed' = 'active') => {
      // If there is already a sync happening, wait for it to finish first
      if (activeSyncPromise) {
        console.log('[Session Sync] Queuing behind active sync...');
        await activeSyncPromise;
      }

      // Define the actual sync operation
      const performSync = async () => {
        // ALWAYS get fresh session data right before writing!
        // A queued sync might run after the first sync successfully created the session,
        // so it must use the newly generated firestoreSessionId instead of 'new'.
        const session = getSession();
        return await syncSessionToFirestore(currentUser, session, updateSession, status);
      };

      // Set the active lock
      activeSyncPromise = performSync();
      
      try {
        // Wait for it to complete
        return await activeSyncPromise;
      } finally {
        // Always release the lock, even if there was an error
        activeSyncPromise = null;
      }
    }
  };
}
