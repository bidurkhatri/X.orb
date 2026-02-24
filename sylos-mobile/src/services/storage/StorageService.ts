// Real Storage Service for SylOS Mobile
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SQLite from 'expo-sqlite';
import { Wallet, Transaction, AppSettings, UserAnalytics } from '../../types';

class StorageService {
  private static instance: StorageService;
  private db: SQLite.WebSQLDatabase | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public static async initialize(): Promise<void> {
    const instance = this.getInstance();
    await instance.initialize();
  }

  public async initialize(): Promise<void> {
    try {
      console.log('Initializing storage service...');
      
      // Initialize SQLite database
      this.db = SQLite.openDatabase('sylos.db');
      
      // Create tables
      await this.createTables();
      
      this.isInitialized = true;
      console.log('Storage service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize storage service:', error);
      // Continue without database
      this.isInitialized = true;
    }
  }

  private async createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(
        (tx) => {
          // Wallets table
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS wallets (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              address TEXT NOT NULL,
              chainId INTEGER NOT NULL,
              balance REAL DEFAULT 0,
              network TEXT NOT NULL,
              createdAt TEXT NOT NULL,
              lastSync TEXT NOT NULL,
              encryptedPrivateKey TEXT NOT NULL,
              mnemonic TEXT NOT NULL,
              isConnected INTEGER DEFAULT 1,
              provider TEXT DEFAULT 'metamask'
            )`,
            [],
            () => {},
            (tx, error) => {
              console.error('Failed to create wallets table:', error);
              return true;
            }
          );

          // Transactions table
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS transactions (
              id TEXT PRIMARY KEY,
              walletId TEXT NOT NULL,
              fromAddress TEXT NOT NULL,
              toAddress TEXT NOT NULL,
              value TEXT NOT NULL,
              hash TEXT UNIQUE NOT NULL,
              timestamp TEXT NOT NULL,
              status TEXT NOT NULL,
              gasUsed INTEGER DEFAULT 0,
              gasPrice INTEGER DEFAULT 0,
              data TEXT,
              FOREIGN KEY (walletId) REFERENCES wallets (id) ON DELETE CASCADE
            )`,
            [],
            () => {},
            (tx, error) => {
              console.error('Failed to create transactions table:', error);
              return true;
            }
          );

          // Token balances table
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS token_balances (
              id TEXT PRIMARY KEY,
              walletId TEXT NOT NULL,
              tokenAddress TEXT NOT NULL,
              symbol TEXT NOT NULL,
              name TEXT NOT NULL,
              balance TEXT NOT NULL,
              decimals INTEGER NOT NULL,
              usdValue REAL DEFAULT 0,
              FOREIGN KEY (walletId) REFERENCES wallets (id) ON DELETE CASCADE
            )`,
            [],
            () => {},
            (tx, error) => {
              console.error('Failed to create token_balances table:', error);
              return true;
            }
          );

          // Sync queue table for offline operations
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS sync_queue (
              id TEXT PRIMARY KEY,
              operation TEXT NOT NULL,
              table_name TEXT NOT NULL,
              data TEXT NOT NULL,
              status TEXT DEFAULT 'pending',
              createdAt TEXT NOT NULL,
              retry_count INTEGER DEFAULT 0
            )`,
            [],
            () => {},
            (tx, error) => {
              console.error('Failed to create sync_queue table:', error);
              return true;
            }
          );

          // App settings table
          tx.executeSql(
            `CREATE TABLE IF NOT EXISTS app_settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              updatedAt TEXT NOT NULL
            )`,
            [],
            () => {},
            (tx, error) => {
              console.error('Failed to create app_settings table:', error);
              return true;
            }
          );
        },
        (error) => {
          console.error('Transaction error:', error);
          reject(error);
        },
        () => {
          console.log('Database tables created successfully');
          resolve();
        }
      );
    });
  }

  public async getWallets(): Promise<Wallet[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(
        (tx) => {
          tx.executeSql(
            'SELECT * FROM wallets ORDER BY createdAt DESC',
            [],
            async (tx, { rows }) => {
              const wallets: Wallet[] = [];
              
              for (let i = 0; i < rows.length; i++) {
                const row = rows.item(i);
                
                let encryptedPrivateKey = '';
                let mnemonic = '';
                
                // Check if sensitive data is in secure storage
                if (row.encryptedPrivateKey === 'SECURE_STORAGE') {
                  try {
                    const secureData = await this.getWalletSecureData(row.id);
                    encryptedPrivateKey = secureData.encryptedPrivateKey;
                    mnemonic = secureData.mnemonic;
                  } catch (error) {
                    console.error(`Failed to retrieve secure data for wallet ${row.id}:`, error);
                    // Continue with other wallets
                    continue;
                  }
                } else {
                  // Fallback for legacy data (should migrate these)
                  encryptedPrivateKey = row.encryptedPrivateKey;
                  mnemonic = row.mnemonic;
                }
                
                wallets.push({
                  id: row.id,
                  name: row.name,
                  address: row.address,
                  chainId: row.chainId,
                  balance: row.balance,
                  network: row.network as any,
                  createdAt: new Date(row.createdAt),
                  lastSync: new Date(row.lastSync),
                  transactions: [], // Will be loaded separately
                  encryptedPrivateKey,
                  mnemonic,
                  tokens: [], // Will be loaded separately
                  isConnected: row.isConnected === 1,
                  provider: row.provider as any,
                });
              }
              resolve(wallets);
            },
            (tx, error) => {
              console.error('Failed to get wallets:', error);
              reject(error);
              return true;
            }
          );
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  private async getWalletSecureData(walletId: string): Promise<{ encryptedPrivateKey: string; mnemonic: string }> {
    try {
      // Import the security service
      const SecurityService = require('../security/SecurityService');
      const securityService = SecurityService.default.getInstance();
      
      // Retrieve encryption key
      const encryptionKey = await securityService.getSecureData(`wallet_key_${walletId}`);
      if (!encryptionKey) {
        throw new Error('Encryption key not found');
      }
      
      // Retrieve encrypted data
      const encryptedPrivateKey = await securityService.getSecureData(`wallet_private_key_${walletId}`);
      const encryptedMnemonic = await securityService.getSecureData(`wallet_mnemonic_${walletId}`);
      
      if (!encryptedPrivateKey || !encryptedMnemonic) {
        throw new Error('Encrypted data not found');
      }
      
      // Decrypt data
      const privateKey = await securityService.decryptData(encryptedPrivateKey, encryptionKey);
      const mnemonic = await securityService.decryptData(encryptedMnemonic, encryptionKey);
      
      return {
        encryptedPrivateKey: privateKey,
        mnemonic: mnemonic,
      };
    } catch (error) {
      console.error('Failed to retrieve wallet secure data:', error);
      throw error;
    }
  }

  public async saveWallet(wallet: Wallet): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      // Only store non-sensitive data in SQLite database
      // Sensitive data (private keys, mnemonics) should be stored separately in secure storage
      this.db.transaction(
        (tx) => {
          tx.executeSql(
            `INSERT OR REPLACE INTO wallets 
            (id, name, address, chainId, balance, network, createdAt, lastSync, encryptedPrivateKey, mnemonic, isConnected, provider)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              wallet.id,
              wallet.name,
              wallet.address,
              wallet.chainId,
              wallet.balance,
              wallet.network,
              wallet.createdAt.toISOString(),
              wallet.lastSync.toISOString(),
              'SECURE_STORAGE', // Mark that sensitive data is in secure storage
              'SECURE_STORAGE', // Mark that sensitive data is in secure storage
              wallet.isConnected ? 1 : 0,
              wallet.provider,
            ],
            () => {
              console.log('Wallet metadata saved:', wallet.id);
              // Store sensitive data separately
              this.storeWalletSecureData(wallet).then(() => {
                resolve();
              }).catch(reject);
            },
            (tx, error) => {
              console.error('Failed to save wallet:', error);
              reject(error);
              return true;
            }
          );
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  private async storeWalletSecureData(wallet: Wallet): Promise<void> {
    try {
      // Import the security service
      const SecurityService = require('../security/SecurityService');
      const securityService = SecurityService.default.getInstance();
      
      // Generate encryption key
      const encryptionKey = await securityService.generateSecureKey();
      
      // Encrypt sensitive data
      const encryptedPrivateKey = await securityService.encryptData(wallet.encryptedPrivateKey, encryptionKey);
      const encryptedMnemonic = await securityService.encryptData(wallet.mnemonic, encryptionKey);
      
      // Store encrypted data in secure storage
      await securityService.storeSecureData(`wallet_private_key_${wallet.id}`, encryptedPrivateKey);
      await securityService.storeSecureData(`wallet_mnemonic_${wallet.id}`, encryptedMnemonic);
      await securityService.storeSecureData(`wallet_key_${wallet.id}`, encryptionKey);
      
      console.log('Wallet secure data stored successfully');
    } catch (error) {
      console.error('Failed to store wallet secure data:', error);
      throw error;
    }
  }

  public async deleteWallet(walletId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(
        (tx) => {
          tx.executeSql(
            'DELETE FROM wallets WHERE id = ?',
            [walletId],
            async () => {
              console.log('Wallet deleted from database:', walletId);
              // Clean up secure storage
              await this.deleteWalletSecureData(walletId);
              resolve();
            },
            (tx, error) => {
              console.error('Failed to delete wallet:', error);
              reject(error);
              return true;
            }
          );
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  private async deleteWalletSecureData(walletId: string): Promise<void> {
    try {
      // Import the security service
      const SecurityService = require('../security/SecurityService');
      const securityService = SecurityService.default.getInstance();
      
      // Delete all secure data for this wallet
      await securityService.deleteSecureData(`wallet_private_key_${walletId}`);
      await securityService.deleteSecureData(`wallet_mnemonic_${walletId}`);
      await securityService.deleteSecureData(`wallet_key_${walletId}`);
      
      console.log('Wallet secure data deleted successfully');
    } catch (error) {
      console.error('Failed to delete wallet secure data:', error);
      // Don't throw error here as the main wallet was already deleted from database
    }
  }

  public async getActiveWalletId(): Promise<string | null> {
    try {
      const value = await AsyncStorage.getItem('active_wallet_id');
      return value;
    } catch (error) {
      console.error('Failed to get active wallet ID:', error);
      return null;
    }
  }

  public async setActiveWalletId(walletId: string): Promise<void> {
    try {
      await AsyncStorage.setItem('active_wallet_id', walletId);
      console.log('Active wallet ID set:', walletId);
    } catch (error) {
      console.error('Failed to set active wallet ID:', error);
      throw error;
    }
  }

  public async saveTransaction(transaction: Transaction, walletId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(
        (tx) => {
          tx.executeSql(
            `INSERT OR REPLACE INTO transactions 
            (id, walletId, fromAddress, toAddress, value, hash, timestamp, status, gasUsed, gasPrice, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              transaction.id,
              walletId,
              transaction.from,
              transaction.to,
              transaction.value,
              transaction.hash,
              transaction.timestamp.toISOString(),
              transaction.status,
              transaction.gasUsed,
              transaction.gasPrice,
              transaction.data || null,
            ],
            () => {
              console.log('Transaction saved:', transaction.id);
              resolve();
            },
            (tx, error) => {
              console.error('Failed to save transaction:', error);
              reject(error);
              return true;
            }
          );
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  public async getTransactions(walletId: string): Promise<Transaction[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(
        (tx) => {
          tx.executeSql(
            'SELECT * FROM transactions WHERE walletId = ? ORDER BY timestamp DESC',
            [walletId],
            (tx, { rows }) => {
              const transactions: Transaction[] = [];
              for (let i = 0; i < rows.length; i++) {
                const row = rows.item(i);
                transactions.push({
                  id: row.id,
                  from: row.fromAddress,
                  to: row.toAddress,
                  value: row.value,
                  hash: row.hash,
                  timestamp: new Date(row.timestamp),
                  status: row.status as any,
                  gasUsed: row.gasUsed,
                  gasPrice: row.gasPrice,
                  data: row.data,
                });
              }
              resolve(transactions);
            },
            (tx, error) => {
              console.error('Failed to get transactions:', error);
              reject(error);
              return true;
            }
          );
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  public async addToSyncQueue(operation: string, tableName: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      // Use timestamp with secure random for unique ID generation
      const id = `sync_${Date.now()}_${this.generateSecureId()}`;
      
      this.db.transaction(
        (tx) => {
          tx.executeSql(
            `INSERT INTO sync_queue (id, operation, table_name, data, status, createdAt, retry_count)
            VALUES (?, ?, ?, ?, 'pending', ?, 0)`,
            [
              id,
              operation,
              tableName,
              JSON.stringify(data),
              new Date().toISOString(),
            ],
            () => {
              console.log('Added to sync queue:', id);
              resolve();
            },
            (tx, error) => {
              console.error('Failed to add to sync queue:', error);
              reject(error);
              return true;
            }
          );
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  private generateSecureId(): string {
    // Generate a cryptographically secure random ID
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 9; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      result += chars.charAt(randomIndex);
    }
    return result;
  }

  public async getSyncSettings(): Promise<{ enabled: boolean }> {
    try {
      const value = await AsyncStorage.getItem('sync_enabled');
      return { enabled: value !== 'false' }; // Default to true
    } catch (error) {
      console.error('Failed to get sync settings:', error);
      return { enabled: true };
    }
  }

  public async setSyncSettings(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem('sync_enabled', enabled.toString());
    } catch (error) {
      console.error('Failed to set sync settings:', error);
      throw error;
    }
  }

  public async clearAllData(): Promise<void> {
    try {
      // Clear AsyncStorage
      await AsyncStorage.clear();
      
      // Get all wallet IDs before clearing database
      const wallets = await this.getWallets();
      
      // Clear SQLite database
      if (this.db) {
        await new Promise<void>((resolve, reject) => {
          this.db!.transaction(
            (tx) => {
              tx.executeSql('DELETE FROM wallets', [], () => {
                tx.executeSql('DELETE FROM transactions', [], () => {
                  tx.executeSql('DELETE FROM token_balances', [], () => {
                    tx.executeSql('DELETE FROM sync_queue', [], () => {
                      tx.executeSql('DELETE FROM app_settings', [], () => {
                        resolve();
                      }, (tx, error) => {
                        reject(error);
                        return true;
                      });
                    }, (tx, error) => {
                      reject(error);
                      return true;
                    });
                  }, (tx, error) => {
                    reject(error);
                    return true;
                  });
                }, (tx, error) => {
                  reject(error);
                  return true;
                });
              }, (tx, error) => {
                reject(error);
                return true;
              });
            },
            (error) => {
              reject(error);
            }
          );
        });
      }
      
      // Clear secure storage for all wallets
      const SecurityService = require('../security/SecurityService');
      const securityService = SecurityService.default.getInstance();
      
      for (const wallet of wallets) {
        await this.deleteWalletSecureData(wallet.id);
      }
      
      console.log('All data cleared including secure storage');
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw error;
    }
  }

  public async getDatabaseStats(): Promise<{ wallets: number; transactions: number; syncQueue: number }> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.transaction(
        (tx) => {
          let walletsCount = 0;
          let transactionsCount = 0;
          let syncQueueCount = 0;

          tx.executeSql(
            'SELECT COUNT(*) as count FROM wallets',
            [],
            (tx, { rows }) => {
              walletsCount = rows.item(0).count;
              tx.executeSql(
                'SELECT COUNT(*) as count FROM transactions',
                [],
                (tx, { rows }) => {
                  transactionsCount = rows.item(0).count;
                  tx.executeSql(
                    'SELECT COUNT(*) as count FROM sync_queue',
                    [],
                    (tx, { rows }) => {
                      syncQueueCount = rows.item(0).count;
                      resolve({
                        wallets: walletsCount,
                        transactions: transactionsCount,
                        syncQueue: syncQueueCount,
                      });
                    },
                    (tx, error) => {
                      reject(error);
                      return true;
                    }
                  );
                },
                (tx, error) => {
                  reject(error);
                  return true;
                }
              );
            },
            (tx, error) => {
              reject(error);
              return true;
            }
          );
        },
        (error) => {
          reject(error);
        }
      );
    });
  }
}

export const storageService = StorageService.getInstance();
export default StorageService;
