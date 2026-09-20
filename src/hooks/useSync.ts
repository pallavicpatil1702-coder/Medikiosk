import { useAuth } from '@/context/AuthContext';
import { getSession, updateSession } from '@/lib/store/store';
import { syncSessionToFirestore } from '@/lib/firestore';
import { syncManager } from '@/lib/offline/syncManager';

let activeSyncPromise: Promise<{ success: boolean; error?: string; networkError?: boolean }> | null = null;

export function useSync() {
  const { currentUser } = useAuth();
  
  return {
    sync: async (status: 'active' | 'completed' | 'submitted' | 'pending_review' = 'active') => {
      // If there is already a sync happening, wait for it to finish first
      if (activeSyncPromise) {
        console.log('[Session Sync] Queuing behind active sync...');
        await activeSyncPromise;
      }

      // Define the actual sync operation
      const performSync = async () => {
        // ALWAYS get fresh session data right before writing!
        const session = getSession();
        
        // 1. Immediately save to our local IndexedDB queue
        // We set syncStatus='pending' to start. If it succeeds online, we'll mark it synced.
        const uid = currentUser?.uid || 'anonymous';
        await syncManager.saveSessionLocally(session, status, uid, 'pending');

        // 2. Trigger the sync queue which handles uploading to Firestore and retry logic
        // This won't block if it's already syncing
        await syncManager.syncQueue(currentUser, updateSession);
        
        return { success: true };
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
