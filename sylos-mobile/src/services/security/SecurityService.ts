// Real Security Service for SylOS Mobile
import { AppError, BiometricData, SecureData } from '../../types';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { ethers } from 'ethers';

class SecurityService {
  private static instance: SecurityService;
  private biometricCache: BiometricData | null = null;
  private isDeviceSecure = false;
  private encryptionKey: string | null = null;
  private isInitialized = false;

  private constructor() { }

  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  public static async initialize(): Promise<void> {
    const instance = this.getInstance();
    await instance.initialize();
  }

  public async initialize(): Promise<void> {
    try {
      console.log('Initializing security service...');

      // Check if device has biometric hardware
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      console.log('Biometric hardware available:', hasHardware);

      // Check if biometric is enrolled
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      console.log('Biometric enrolled:', isEnrolled);

      this.biometricCache = {
        availableHardware: hasHardware ? ['fingerprint', 'face'] : [],
        isEnrolled,
        authenticationType: hasHardware ? 'biometric' : 'none',
      };

      this.isDeviceSecure = hasHardware && isEnrolled;
      this.isInitialized = true;

      console.log('Security service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize security service:', error);
      this.isInitialized = true; // Continue without security
    }
  }

  public async isBiometricEnabled(): Promise<boolean> {
    return this.biometricCache?.isEnrolled || false;
  }

  public async hasValidSession(): Promise<boolean> {
    try {
      const sessionData = await this.getSecureData('session');
      if (!sessionData) return false;

      const session = JSON.parse(sessionData);
      const now = Date.now();
      const sessionExpiry = new Date(session.expiry).getTime();

      return now < sessionExpiry;
    } catch (error) {
      console.error('Failed to check session:', error);
      return false;
    }
  }

  public async authenticateWithBiometric(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.biometricCache?.isEnrolled) {
        return { success: false, error: 'Biometric authentication not available' };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access SylOS',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use password instead',
      });

      if (result.success) {
        // Create a new session
        await this.createSession();
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error || 'Authentication failed'
        };
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  public async generateSIWESession(): Promise<{ success: boolean; address?: string; token?: string; error?: string }> {
    try {
      console.log('Initiating SIWE authentication...');

      // Generate a session wallet for signing the SIWE message
      const wallet = ethers.Wallet.createRandom();
      const nonce = Math.floor(Math.random() * 1000000).toString();
      const issuedAt = new Date().toISOString();
      const domain = 'sylos-mobile';
      const uri = 'https://sylos.app';

      // Build an EIP-4361 compliant SIWE message
      const message = [
        `${domain} wants you to sign in with your Ethereum account:`,
        wallet.address,
        '',
        'Sign in to SylOS Mobile.',
        '',
        `URI: ${uri}`,
        `Version: 1`,
        `Chain ID: 137`,
        `Nonce: ${nonce}`,
        `Issued At: ${issuedAt}`,
      ].join('\n');

      const signature = await wallet.signMessage(message);
      if (!signature) {
        return { success: false, error: 'User rejected signature' };
      }

      // Verify via Supabase verify-siwe edge function
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return { success: false, error: 'Supabase not configured' };
      }

      const verifyRes = await fetch(`${supabaseUrl}/functions/v1/verify-siwe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
        },
        body: JSON.stringify({ message, signature }),
      });

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        return { success: false, error: errData.error || `Verification failed (${verifyRes.status})` };
      }

      const result = await verifyRes.json();

      if (!result.success) {
        return { success: false, error: result.error || 'SIWE verification failed' };
      }

      // Store the verified session data securely
      const sessionToken = JSON.stringify({
        user_id: result.user_id,
        wallet_address: result.wallet_address,
        authenticated_at: issuedAt,
      });

      await this.storeSecureData('supabase_jwt', sessionToken);
      await this.storeSecureData('wallet_address', result.wallet_address);

      console.log(`Successfully authenticated wallet: ${result.wallet_address}`);
      return { success: true, address: result.wallet_address, token: sessionToken };
    } catch (error) {
      console.error('SIWE authentication error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'SIWE authentication failed' };
    }
  }

  public async lockSession(): Promise<void> {
    try {
      console.log('Locking session...');
      await this.deleteSecureData('session');
      this.biometricCache = null;
      this.encryptionKey = null;
    } catch (error) {
      console.error('Failed to lock session:', error);
    }
  }

  public async enableBiometric(): Promise<{ success: boolean; error?: string }> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware) {
        return { success: false, error: 'Biometric hardware not available' };
      }

      if (!isEnrolled) {
        return { success: false, error: 'Biometric authentication not set up' };
      }

      // Test the biometric authentication
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Set up biometric authentication for SylOS',
        cancelLabel: 'Cancel',
        disableDeviceFallback: true,
      });

      if (result.success) {
        this.biometricCache = {
          availableHardware: ['fingerprint', 'face'],
          isEnrolled: true,
          authenticationType: 'biometric',
        };
        return { success: true };
      } else {
        return {
          success: false,
          error: result.error || 'Biometric setup failed'
        };
      }
    } catch (error) {
      console.error('Failed to enable biometric:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable biometric'
      };
    }
  }

  public isSessionExpired(): boolean {
    // This would check the session in a real implementation
    return false;
  }

  public getIsDeviceSecure(): boolean {
    return this.isDeviceSecure;
  }

  public async storeSecureData(key: string, data: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, data, {
        keychainService: 'sylos-mobile',
        authenticationPrompt: 'Authenticate to access secure data',
      });
      console.log('Secure data stored:', key);
    } catch (error) {
      console.error('Failed to store secure data:', error);
      throw error;
    }
  }

  public async getSecureData(key: string): Promise<string | null> {
    try {
      const data = await SecureStore.getItemAsync(key, {
        keychainService: 'sylos-mobile',
      });
      return data;
    } catch (error) {
      console.error('Failed to get secure data:', error);
      return null;
    }
  }

  public async deleteSecureData(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key, {
        keychainService: 'sylos-mobile',
      });
      console.log('Secure data deleted:', key);
    } catch (error) {
      console.error('Failed to delete secure data:', error);
    }
  }

  public async validateSession(): Promise<{ valid: boolean; error?: string }> {
    try {
      const isValidSession = await this.hasValidSession();
      return { valid: isValidSession };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Session validation failed'
      };
    }
  }

  public async generateSecureKey(): Promise<string> {
    const Crypto = require('expo-crypto');
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    return Array.from(randomBytes, (byte: number) => byte.toString(16).padStart(2, '0')).join('');
  }

  public async getBiometricHardwareInfo(): Promise<{ hasHardware: boolean; isEnrolled: boolean }> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      return { hasHardware, isEnrolled };
    } catch (error) {
      console.error('Failed to get biometric hardware info:', error);
      return { hasHardware: false, isEnrolled: false };
    }
  }

  private async createSession(): Promise<void> {
    const session = {
      id: this.generateSessionId(),
      createdAt: new Date().toISOString(),
      expiry: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
    };

    await this.storeSecureData('session', JSON.stringify(session));
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.floor(Math.random() * 1e9).toString(36)}`;
  }

  private initializeSecurity() {
    this.isDeviceSecure = false;
  }
}

export const securityService = SecurityService.getInstance();
export default SecurityService;
