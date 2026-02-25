import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import {
  MobilePerformanceMonitor,
  useOptimizedNavigation,
  useBatteryAwarePerformance,
  useMemoryCleanup,
} from '../src/utils/mobilePerformance';
import { AuthProvider, WalletProvider, SyncProvider, AgentProvider } from '../src/context';

export default function RootLayout() {
  const monitorRef = useRef(MobilePerformanceMonitor.getInstance());
  const { preloadRoute } = useOptimizedNavigation();
  const { performanceMode, shouldReduceMotion } = useBatteryAwarePerformance();
  const { registerCleanup } = useMemoryCleanup();

  useEffect(() => {
    monitorRef.current.trackAppState();
    monitorRef.current.trackMemoryUsage();
    preloadRoute('index');
    preloadRoute('lockscreen');
    registerCleanup(() => { monitorRef.current.destroy(); });
    monitorRef.current.recordEvent('app_start', 0);
    return () => { monitorRef.current.recordEvent('app_end', 0); };
  }, [preloadRoute, registerCleanup]);

  const screenOptions = {
    headerShown: false,
    animation: shouldReduceMotion || performanceMode === 'low' ? 'none' as const : 'default' as const,
  };

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <WalletProvider>
          <SyncProvider>
            <AgentProvider>
              <Stack screenOptions={screenOptions} initialRouteName="index">
                <Stack.Screen name="index" />
                <Stack.Screen name="lockscreen" />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="settings" />
              </Stack>
            </AgentProvider>
          </SyncProvider>
        </WalletProvider>
      </AuthProvider>
      <StatusBar style="light" backgroundColor="transparent" translucent />
    </SafeAreaProvider>
  );
}
