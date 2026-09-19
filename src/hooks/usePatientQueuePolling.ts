import { useState, useEffect } from 'react';
import { QueuePatient } from './useSmartQueue';

export function usePatientQueuePolling(sessionId?: string, patientId?: string) {
  const [patientQueueInfo, setPatientQueueInfo] = useState<QueuePatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId && !patientId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const fetchQueueStatus = async () => {
      try {
        const res = await fetch('/api/patient/queue-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, patientId })
        });

        if (!res.ok) {
          if (res.status === 404) {
            setPatientQueueInfo(null);
          } else {
            throw new Error(`Failed to fetch queue status: ${res.statusText}`);
          }
        } else {
          const data = await res.json();
          if (isMounted) {
            setPatientQueueInfo(data as QueuePatient);
            setError(null);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }

      if (isMounted) {
        // Poll every 10 seconds
        timeoutId = setTimeout(fetchQueueStatus, 10000);
      }
    };

    fetchQueueStatus();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [sessionId, patientId]);

  return { patientQueueInfo, loading, error };
}
