import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { AuthProvider, WalletProvider, SyncProvider } from './src/context';
import StorageService from './src/services/storage/StorageService';
import SecurityService from './src/services/security/SecurityService';
import BlockchainService from './src/services/blockchain/BlockchainService';
import SyncService from './src/services/sync/SyncService';
import { theme } from './src/theme';
import { strings } from './src/constants/strings';
import ErrorBoundary from './src/components/ErrorBoundary';

export default function App() {
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('Initializing SylOS Mobile App...');

      // Initialize services in the correct order
      await StorageService.initialize();
      console.log('Storage service initialized');

      await SecurityService.initialize();
      console.log('Security service initialized');

      await BlockchainService.initialize();
      console.log('Blockchain service initialized');

      await SyncService.initialize();
      console.log('Sync service initialized');

      console.log('SylOS Mobile App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SylOS Mobile App:', error);
      // App should still continue to load even if some services fail
    }
  };

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('App-level error caught:', error, errorInfo);
        // Log to external service in production
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.primary }}>
        <AuthProvider>
          <WalletProvider>
            <SyncProvider>
              <ErrorBoundary>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="lockscreen" />
                  <Stack.Screen name="desktop" />
                  <Stack.Screen name="wallet" />
                  <Stack.Screen name="pop-tracker" />
                  <Stack.Screen name="file-manager" />
                  <Stack.Screen name="token-dashboard" />
                  <Stack.Screen name="settings" />
                </Stack>
                <StatusBar style="light" backgroundColor={theme.colors.primary} />
              </ErrorBoundary>
            </SyncProvider>
          </WalletProvider>
        </AuthProvider>
      </SafeAreaView>
    </ErrorBoundary>
  );
}
