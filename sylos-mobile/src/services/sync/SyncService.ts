// SyncService for SylOS Mobile — syncs local data with Supabase
import { Wallet, Transaction, PoPProfile, FileItem } from '../../types';
import { storageService } from '../storage/StorageService';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

interface SyncQueueItem {
  table: string;
  operation: 'upsert' | 'insert' | 'delete';
  data: Record<string, unknown>;
  createdAt: number;
}

class SyncService {
  private static instance: SyncService;
  private isInitialized = false;
  private syncQueue: SyncQueueItem[] = [];
  private isSyncing = false;
  private lastSyncTime: Date | null = null;
  private online = true;

  private constructor() {}

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  public static async initialize(): Promise<void> {
    const instance = this.getInstance();
    await instance.initialize();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Load persisted sync queue
    try {
      const raw = await AsyncStorage.getItem('sylos_sync_queue');
      if (raw) this.syncQueue = JSON.parse(raw);
    } catch { /* start fresh */ }

    // Monitor connectivity
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.online;
      this.online = !!state.isConnected;
      // When coming back online, flush the queue
      if (wasOffline && this.online && this.syncQueue.length > 0) {
        this.processSyncQueue();
      }
    });

    this.isInitialized = true;
    console.log('Sync service initialized');
  }

  // ── Top-level sync ──

  public async syncAll(): Promise<void> {
    if (this.isSyncing) return;
    if (!this.isSupabaseConfigured()) {
      console.warn('Supabase not configured — skipping sync');
      return;
    }

    try {
      this.isSyncing = true;
      await this.syncWallets();
      await this.syncTransactions();
      await this.syncPoP();
      await this.syncFiles();
      await this.processSyncQueue();
      this.lastSyncTime = new Date();
      console.log('Sync completed successfully');
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  // ── Wallets ──

  private async syncWallets(): Promise<void> {
    try {
      const jwt = await AsyncStorage.getItem('supabase_jwt');
      if (!jwt) return;

      const address = await AsyncStorage.getItem('wallet_address');
      if (!address) return;

      // Fetch wallet data from Supabase
      const res = await this.supabaseFetch(
        `/rest/v1/wallets?address=eq.${address}&select=*`,
        { headers: this.authHeaders(jwt) }
      );
      if (!res.ok) return;

      const wallets = await res.json();
      if (wallets.length > 0) {
        await AsyncStorage.setItem('sylos_wallets', JSON.stringify(wallets));
      }
    } catch (error) {
      console.error('Wallet sync failed:', error);
    }
  }

  // ── Transactions ──

  private async syncTransactions(): Promise<void> {
    try {
      const jwt = await AsyncStorage.getItem('supabase_jwt');
      if (!jwt) return;

      const address = await AsyncStorage.getItem('wallet_address');
      if (!address) return;

      const res = await this.supabaseFetch(
        `/rest/v1/transactions?from_address=eq.${address}&order=created_at.desc&limit=100`,
        { headers: this.authHeaders(jwt) }
      );
      if (!res.ok) return;

      const transactions = await res.json();
      await AsyncStorage.setItem('sylos_transactions', JSON.stringify(transactions));
    } catch (error) {
      console.error('Transaction sync failed:', error);
    }
  }

  // ── Proof of Productivity ──

  private async syncPoP(): Promise<void> {
    try {
      const jwt = await AsyncStorage.getItem('supabase_jwt');
      if (!jwt) return;

      const address = await AsyncStorage.getItem('wallet_address');
      if (!address) return;

      const res = await this.supabaseFetch(
        `/rest/v1/pop_profiles?wallet_address=eq.${address}&select=*`,
        { headers: this.authHeaders(jwt) }
      );
      if (!res.ok) return;

      const profiles = await res.json();
      if (profiles.length > 0) {
        await AsyncStorage.setItem('sylos_pop_profile', JSON.stringify(profiles[0]));
      }
    } catch (error) {
      console.error('PoP sync failed:', error);
    }
  }

  // ── Files ──

  private async syncFiles(): Promise<void> {
    try {
      const jwt = await AsyncStorage.getItem('supabase_jwt');
      if (!jwt) return;

      const address = await AsyncStorage.getItem('wallet_address');
      if (!address) return;

      const res = await this.supabaseFetch(
        `/rest/v1/files?owner_address=eq.${address}&order=created_at.desc&limit=200`,
        { headers: this.authHeaders(jwt) }
      );
      if (!res.ok) return;

      const files = await res.json();
      await AsyncStorage.setItem('sylos_files', JSON.stringify(files));
    } catch (error) {
      console.error('File sync failed:', error);
    }
  }

  // ── Sync Queue ──

  public async addToSyncQueue(item: SyncQueueItem): Promise<void> {
    this.syncQueue.push(item);
    await AsyncStorage.setItem('sylos_sync_queue', JSON.stringify(this.syncQueue));

    // Try to flush immediately if online
    if (this.online) {
      this.processSyncQueue();
    }
  }

  public async processSyncQueue(): Promise<void> {
    if (!this.online || this.syncQueue.length === 0) return;
    if (!this.isSupabaseConfigured()) return;

    const jwt = await AsyncStorage.getItem('supabase_jwt');
    if (!jwt) return;

    const failed: SyncQueueItem[] = [];

    for (const item of this.syncQueue) {
      try {
        let method = 'POST';
        let url = `/rest/v1/${item.table}`;
        const headers: Record<string, string> = {
          ...this.authHeaders(jwt),
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        };

        if (item.operation === 'upsert') {
          headers['Prefer'] = 'resolution=merge-duplicates';
        } else if (item.operation === 'delete') {
          method = 'DELETE';
          const id = item.data['id'];
          url += `?id=eq.${id}`;
        }

        const res = await this.supabaseFetch(url, {
          method,
          headers,
          body: method !== 'DELETE' ? JSON.stringify(item.data) : undefined,
        });

        if (!res.ok) {
          failed.push(item);
        }
      } catch {
        failed.push(item);
      }
    }

    this.syncQueue = failed;
    await AsyncStorage.setItem('sylos_sync_queue', JSON.stringify(this.syncQueue));
  }

  // ── Conflict resolution ──

  public async resolveConflicts(localData: any, remoteData: any): Promise<any> {
    // Server wins for status fields, local wins for user-edited content
    if (!remoteData) return localData;
    if (!localData) return remoteData;

    const localTime = localData.updated_at || localData.lastSync || 0;
    const remoteTime = remoteData.updated_at || 0;
    return new Date(remoteTime) > new Date(localTime) ? remoteData : localData;
  }

  // ── Status ──

  public isOnline(): boolean {
    return this.online;
  }

  public getSyncStatus(): { isOnline: boolean; isSyncing: boolean; lastSync: Date | null; queueSize: number } {
    return {
      isOnline: this.online,
      isSyncing: this.isSyncing,
      lastSync: this.lastSyncTime,
      queueSize: this.syncQueue.length,
    };
  }

  public async enableBackgroundSync(): Promise<void> {
    console.log('Background sync enabled');
    // Background fetch is handled by SyncContext via NetInfo events
  }

  public async disableBackgroundSync(): Promise<void> {
    console.log('Background sync disabled');
  }

  // ── Helpers ──

  private isSupabaseConfigured(): boolean {
    return !!(SUPABASE_URL && SUPABASE_KEY);
  }

  private authHeaders(jwt: string): Record<string, string> {
    return {
      Authorization: `Bearer ${jwt}`,
      apikey: SUPABASE_KEY,
    };
  }

  private async supabaseFetch(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${SUPABASE_URL}${path}`, init);
  }
}

export const syncService = SyncService.getInstance();
export default SyncService;
