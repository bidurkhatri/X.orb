import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Wallet, Network, TokenHolding } from '../types';
import { BlockchainService } from '../services/blockchain/BlockchainService';
import { StorageService } from '../services/storage/StorageService';
import { validators } from '../utils/validation';

interface WalletContextType {
  wallets: Wallet[];
  activeWallet: Wallet | null;
  network: Network;
  isLoading: boolean;
  error: string | null;
  createWallet: (name: string, password: string) => Promise<Wallet | null>;
  importWallet: (mnemonic: string, name: string, password: string) => Promise<Wallet | null>;
  setActiveWallet: (wallet: Wallet) => Promise<void>;
  switchNetwork: (network: Network) => Promise<void>;
  refreshBalances: () => Promise<void>;
  getTokenHoldings: (address: string) => Promise<TokenHolding[]>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [activeWallet, setActiveWalletState] = useState<Wallet | null>(null);
  const [network, setNetwork] = useState<Network>('polygon-pos');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Load wallets from storage
      const storedWallets = await StorageService.getWallets();
      setWallets(storedWallets);

      if (storedWallets.length > 0) {
        // Set the first wallet as active if none is set
        const activeWalletId = await StorageService.getActiveWalletId();
        const walletToActivate = storedWallets.find(w => w.id === activeWalletId) || storedWallets[0];
        setActiveWalletState(walletToActivate);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize wallet');
    } finally {
      setIsLoading(false);
    }
  };

  const createWallet = async (name: string, password: string): Promise<Wallet | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Validate inputs
      const nameValidation = validators.walletName(name);
      const passwordValidation = validators.password(password);
      
      if (!nameValidation.success) {
        setError(`Invalid wallet name: ${nameValidation.errors.join(', ')}`);
        return null;
      }
      
      if (!passwordValidation.success) {
        setError(`Invalid password: ${passwordValidation.errors.join(', ')}`);
        return null;
      }
      
      const newWallet = await BlockchainService.createWallet(nameValidation.data, passwordValidation.data);
      if (newWallet) {
        // Save to storage
        await StorageService.saveWallet(newWallet);
        
        // Update state
        const updatedWallets = await StorageService.getWallets();
        setWallets(updatedWallets);
        
        // Set as active if it's the first wallet
        if (updatedWallets.length === 1) {
          setActiveWalletState(newWallet);
        }
        
        return newWallet;
      }
      setError('Failed to create wallet');
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create wallet';
      setError(errorMessage);
      console.error('Wallet creation error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const importWallet = async (mnemonic: string, name: string, password: string): Promise<Wallet | null> => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Validate inputs
      const mnemonicValidation = validators.mnemonic(mnemonic);
      const nameValidation = validators.walletName(name);
      const passwordValidation = validators.password(password);
      
      if (!mnemonicValidation.success) {
        setError(`Invalid mnemonic: ${mnemonicValidation.errors.join(', ')}`);
        return null;
      }
      
      if (!nameValidation.success) {
        setError(`Invalid wallet name: ${nameValidation.errors.join(', ')}`);
        return null;
      }
      
      if (!passwordValidation.success) {
        setError(`Invalid password: ${passwordValidation.errors.join(', ')}`);
        return null;
      }
      
      const importedWallet = await BlockchainService.importWallet(
        mnemonicValidation.data, 
        nameValidation.data, 
        passwordValidation.data
      );
      
      if (importedWallet) {
        // Save to storage
        await StorageService.saveWallet(importedWallet);
        
        // Update state
        const updatedWallets = await StorageService.getWallets();
        setWallets(updatedWallets);
        
        // Set as active if it's the first wallet
        if (updatedWallets.length === 1) {
          setActiveWalletState(importedWallet);
        }
        
        return importedWallet;
      }
      setError('Failed to import wallet');
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import wallet';
      setError(errorMessage);
      console.error('Wallet import error:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const setActiveWallet = async (wallet: Wallet): Promise<void> => {
    try {
      await StorageService.setActiveWalletId(wallet.id);
      setActiveWalletState(wallet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set active wallet');
    }
  };

  const switchNetwork = async (newNetwork: Network): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      
      await BlockchainService.switchNetwork(newNetwork);
      setNetwork(newNetwork);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to switch network');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshBalances = async (): Promise<void> => {
    try {
      if (!activeWallet) return;
      
      setIsLoading(true);
      setError(null);
      
      const updatedWallet = await BlockchainService.refreshWalletBalance(activeWallet);
      if (updatedWallet) {
        // Update storage
        await StorageService.saveWallet(updatedWallet);
        
        // Update state
        setActiveWalletState(updatedWallet);
        const updatedWallets = await StorageService.getWallets();
        setWallets(updatedWallets);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh balances');
    } finally {
      setIsLoading(false);
    }
  };

  const getTokenHoldings = async (address: string): Promise<TokenHolding[]> => {
    try {
      return await BlockchainService.getTokenHoldings(address);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get token holdings');
      return [];
    }
  };

  const value: WalletContextType = {
    wallets,
    activeWallet,
    network,
    isLoading,
    error,
    createWallet,
    importWallet,
    setActiveWallet,
    switchNetwork,
    refreshBalances,
    getTokenHoldings,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};
