import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SyncService } from '../services/sync/SyncService';
import { StorageService } from '../services/storage/StorageService';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  lastSyncTime: Date | null;
  error: string | null;
  syncData: () => Promise<void>;
  forceSync: () => Promise<void>;
  isSyncEnabled: boolean;
  setSyncEnabled: (enabled: boolean) => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const useSync = () => {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

interface SyncProviderProps {
  children: ReactNode;
}

export const SyncProvider: React.FC<SyncProviderProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSyncEnabled, setSyncEnabled] = useState(true);

  useEffect(() => {
    initializeSync();
  }, []);

  const initializeSync = async () => {
    try {
      // Check network status
      const online = await checkNetworkStatus();
      setIsOnline(online);

      // Load sync preferences
      const syncSettings = await StorageService.getSyncSettings();
      setSyncEnabled(syncSettings.enabled);

      // Set up network status monitoring
      setupNetworkListener();

      // Perform initial sync if enabled and online
      if (syncSettings.enabled && online) {
        await syncData();
      }
    } catch (err) {
      console.error('Sync initialization error:', err);
    }
  };

  const checkNetworkStatus = async (): Promise<boolean> => {
    try {
      // Simple check by attempting to reach a known endpoint
      const response = await fetch('https://www.google.com', {
        method: 'HEAD',
        timeout: 5000,
      });
      return response.ok || response.status === 200;
    } catch {
      return false;
    }
  };

  const setupNetworkListener = () => {
    // Listen for network changes
    const handleOnline = () => {
      setIsOnline(true);
      if (isSyncEnabled) {
        syncData();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  };

  const syncData = async (): Promise<void> => {
    if (!isOnline || !isSyncEnabled) {
      return;
    }

    try {
      setIsSyncing(true);
      setSyncStatus('syncing');
      setError(null);

      await SyncService.syncAll();

      setLastSyncTime(new Date());
      setSyncStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  const forceSync = async (): Promise<void> => {
    await syncData();
  };

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && isSyncEnabled && syncStatus === 'error') {
      // Retry sync on error when connection is restored
      syncData();
    }
  }, [isOnline, isSyncEnabled, syncStatus]);

  // Periodic sync (every 5 minutes)
  useEffect(() => {
    if (!isSyncEnabled) return;

    const interval = setInterval(() => {
      if (isOnline && !isSyncing) {
        syncData();
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [isOnline, isSyncEnabled, isSyncing]);

  const value: SyncContextType = {
    isOnline,
    isSyncing,
    syncStatus,
    lastSyncTime,
    error,
    syncData,
    forceSync,
    isSyncEnabled,
    setSyncEnabled,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};
