import { PatientSession } from '../types';
import { syncSessionToFirestore } from '../firestore';

const DB_NAME = 'MediKioskOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'patientSessions';

export interface OfflineSession {
  id: string; // Either firestoreSessionId or a local uuid
  session: PatientSession;
  syncStatus: 'pending' | 'synced';
  lastLocalUpdate: number;
  uid: string; // The patient's user id
  status: 'active' | 'completed' | 'submitted' | 'pending_review';
}

class SyncManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private isSyncing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initPromise = this.initDB();
    }
  }

  private initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('IndexedDB not supported, offline mode disabled');
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('Database error: ', (event.target as any).error);
        reject((event.target as any).error);
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
          store.createIndex('lastLocalUpdate', 'lastLocalUpdate', { unique: false });
        }
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.db) {
      if (this.initPromise) {
        await this.initPromise;
      } else {
        this.initPromise = this.initDB();
        await this.initPromise;
      }
    }
    if (!this.db) throw new Error('Database failed to initialize');
    return this.db;
  }

  async saveSessionLocally(
    session: PatientSession,
    status: 'active' | 'completed' | 'submitted' | 'pending_review',
    uid: string,
    syncStatus: 'pending' | 'synced' = 'pending'
  ): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // If firestoreSessionId doesn't exist, it means it's brand new and offline.
        // We shouldn't generate it here since Firebase addDoc generates it on the server.
        // But we need a local ID to save it. We'll use 'temp_local' if missing.
        const id = session.firestoreSessionId || 'temp_local';

        const offlineSession: OfflineSession = {
          id,
          session,
          syncStatus,
          lastLocalUpdate: Date.now(),
          uid,
          status,
        };

        const request = store.put(offlineSession);

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject((e.target as any).error);
      });
    } catch (error) {
      console.error('[SyncManager] Failed to save locally:', error);
    }
  }

  async getPendingSessions(): Promise<OfflineSession[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('syncStatus');
        const request = index.getAll('pending');

        request.onsuccess = (e) => resolve((e.target as any).result);
        request.onerror = (e) => reject((e.target as any).error);
      });
    } catch (error) {
      console.error('[SyncManager] Failed to get pending sessions:', error);
      return [];
    }
  }

  async deleteSession(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject((e.target as any).error);
      });
    } catch (error) {
      console.error('[SyncManager] Failed to delete session:', error);
    }
  }

  async syncQueue(currentUser: any, updateLocalSession: (updates: Partial<PatientSession>) => void): Promise<void> {
    if (this.isSyncing || typeof window === 'undefined') return;
    if (!navigator.onLine) {
      console.log('[SyncManager] Offline, skipping sync queue');
      return;
    }

    this.isSyncing = true;
    try {
      const pendingSessions = await this.getPendingSessions();
      if (pendingSessions.length === 0) {
        this.isSyncing = false;
        return;
      }

      console.log(`[SyncManager] Found ${pendingSessions.length} pending session(s) to sync`);

      for (const pending of pendingSessions) {
        // If we are back online, we will attempt to sync.
        // If it's a temp_local, we need to pass a session WITHOUT firestoreSessionId so firestore creates it
        const sessionToSync = { ...pending.session };
        if (pending.id === 'temp_local') {
           delete sessionToSync.firestoreSessionId;
        }

        const result = await syncSessionToFirestore(
          currentUser, 
          sessionToSync, 
          (updates) => {
             // Let the hook update its local storage as normal
             updateLocalSession(updates);
             // Also update our pending session object so we know the new ID
             Object.assign(sessionToSync, updates);
          }, 
          pending.status
        );

        if (result.success) {
          console.log(`[SyncManager] Successfully synced session ${pending.id}`);
          // If it was temp_local, we delete temp_local and save the new ID as synced
          if (pending.id === 'temp_local' && sessionToSync.firestoreSessionId) {
            await this.deleteSession('temp_local');
            await this.saveSessionLocally(sessionToSync, pending.status, pending.uid, 'synced');
          } else {
            await this.saveSessionLocally(sessionToSync, pending.status, pending.uid, 'synced');
          }
        } else if (result.networkError) {
          console.log(`[SyncManager] Network error during sync for ${pending.id}, keeping pending`);
          // Stop processing queue if network is down
          break;
        } else {
          console.error(`[SyncManager] Permanent error syncing session ${pending.id}:`, result.error);
          // Could flag it as failed instead of looping forever
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncManager = new SyncManager();
