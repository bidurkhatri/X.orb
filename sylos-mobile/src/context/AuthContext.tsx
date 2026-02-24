import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { SecurityService } from '../services/security/SecurityService';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;
  hasHardware: boolean;
  walletAddress: string | null;
  authenticate: () => Promise<boolean>;
  logout: () => Promise<void>;
  setupBiometric: () => Promise<boolean>;
  isSessionExpired: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [hasHardware, setHasHardware] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);

      // Check for hardware support
      const hasHardwareAuth = await LocalAuthentication.hasHardwareAsync();
      setHasHardware(hasHardwareAuth);

      // Check if biometric is enabled
      const isBiometricEnabled = await SecurityService.isBiometricEnabled();
      setBiometricEnabled(isBiometricEnabled);

      // Check if there's a valid session
      const hasValidSession = await SecurityService.hasValidSession();

      if (hasValidSession) {
        if (isBiometricEnabled && hasHardwareAuth) {
          // Try to authenticate with biometric
          const authResult = await SecurityService.authenticateWithBiometric();
          if (authResult.success) {
            const address = await SecurityService.getSecureData('wallet_address');
            setWalletAddress(address);
            setIsAuthenticated(true);
          }
        } else {
          // If no biometric, consider authenticated
          const address = await SecurityService.getSecureData('wallet_address');
          setWalletAddress(address);
          setIsAuthenticated(true);
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const authenticate = async (): Promise<boolean> => {
    try {
      let isBiometricPassed = false;

      if (biometricEnabled && hasHardware) {
        const result = await SecurityService.authenticateWithBiometric();
        isBiometricPassed = result.success;
      } else {
        isBiometricPassed = true;
      }

      if (isBiometricPassed) {
        // Proceed to WalletConnect SIWE phase
        const siweResult = await SecurityService.generateSIWESession();

        if (siweResult.success && siweResult.address) {
          setWalletAddress(siweResult.address);
          setIsAuthenticated(true);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await SecurityService.lockSession();
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const setupBiometric = async (): Promise<boolean> => {
    try {
      const result = await SecurityService.enableBiometric();
      if (result.success) {
        setBiometricEnabled(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Biometric setup error:', error);
      return false;
    }
  };

  const isSessionExpired = (): boolean => {
    return SecurityService.isSessionExpired();
  };

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    biometricEnabled,
    hasHardware,
    walletAddress,
    authenticate,
    logout,
    setupBiometric,
    isSessionExpired,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
