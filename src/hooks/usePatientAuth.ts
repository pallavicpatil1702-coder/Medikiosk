import { useEffect, useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export function usePatientAuth() {
  const { currentUser, loading } = useAuth();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Wait until AuthContext has finished its initial load
    if (loading) return;

    async function ensureAuth() {
      console.log('[Firebase] initializing patient auth');
      console.log(`[Firebase] current user before auth = ${currentUser ? 'present' : 'absent'}`);
      if (!currentUser) {
        try {
          console.log('[Firebase] anonymous auth started');
          const cred = await signInAnonymously(auth);
          console.log(`[Firebase] anonymous auth success = true, UID: ${cred.user.uid}`);
        } catch (error: any) {
          console.error('[Firebase] anonymous auth success = false');
          console.error('[Firebase] Auth Error:', error?.code, error?.message, error);
        }
      }
      setIsReady(true);
    }
    
    ensureAuth();
  }, [currentUser, loading]);

  return { isReady, uid: currentUser?.uid };
}
