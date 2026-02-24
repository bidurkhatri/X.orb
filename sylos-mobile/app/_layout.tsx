import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import {
  MobilePerformanceMonitor,
  useOptimizedNavigation,
  useBatteryAwarePerformance,
  useMemoryCleanup,
  useBackgroundSync
} from '../src/utils/mobilePerformance';

export default function RootLayout() {
  const monitorRef = useRef(MobilePerformanceMonitor.getInstance());
  const { preloadRoute, navigate } = useOptimizedNavigation();
  const { performanceMode, shouldReduceMotion } = useBatteryAwarePerformance();
  const { registerCleanup } = useMemoryCleanup();
  const { isOnline } = useBackgroundSync();

  // Initialize performance monitoring
  useEffect(() => {
    monitorRef.current.trackAppState();
    monitorRef.current.trackMemoryUsage();
    
    // Preload critical routes
    preloadRoute('index');
    preloadRoute('lockscreen');
    
    // Register cleanup
    registerCleanup(() => {
      monitorRef.current.destroy();
    });
    
    // Record app start
    monitorRef.current.recordEvent('app_start', 0);
    
    return () => {
      monitorRef.current.recordEvent('app_end', 0);
    };
  }, [preloadRoute, registerCleanup]);

  // Performance-based screen options
  const getScreenOptions = (routeName: string) => {
    const baseOptions = {
      headerShown: false,
      animation: shouldReduceMotion ? 'none' : 'default',
      animationDuration: shouldReduceMotion ? 0 : 300,
    };

    // Optimize for low performance mode
    if (performanceMode === 'low') {
      return {
        ...baseOptions,
        animation: 'none',
        cardStyle: { opacity: 1 },
        cardStyleInterpolator: undefined,
      };
    }

    return baseOptions;
  };

  return (
    <SafeAreaProvider>
      <Stack 
        screenOptions={({ route }) => getScreenOptions(route.name)}
        initialRouteName="index"
      >
        {/* Core routes - always loaded */}
        <Stack.Screen name="index" />
        <Stack.Screen name="lockscreen" />
        
        {/* Feature routes - lazy loaded */}
        <Stack.Screen 
          name="desktop" 
          options={{
            ...getScreenOptions('desktop'),
            // Preload when user navigates to index
            presentation: 'modal',
          }}
        />
        
        {/* Blockchain-related routes */}
        <Stack.Screen name="wallet" />
        <Stack.Screen name="token-dashboard" />
        <Stack.Screen name="pop-tracker" />
        
        {/* Utility routes */}
        <Stack.Screen name="file-manager" />
        <Stack.Screen name="settings" />
      </Stack>
      
      {/* Status bar with performance-aware styling */}
      <StatusBar 
        style={performanceMode === 'low' ? 'light' : 'dark'} 
        backgroundColor="transparent"
        translucent
      />
      
      {/* Development performance overlay */}
      {__DEV__ && (
        <PerformanceOverlay
          performanceMode={performanceMode}
          isOnline={isOnline}
          monitor={monitorRef.current}
        />
      )}
    </SafeAreaProvider>
  );
}

// Performance monitoring overlay for development
function PerformanceOverlay({ 
  performanceMode, 
  isOnline, 
  monitor 
}: { 
  performanceMode: string; 
  isOnline: boolean; 
  monitor: any; 
}) {
  const [metrics, setMetrics] = useState(monitor.getMetrics());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(monitor.getMetrics());
    }, 2000);
    
    return () => clearInterval(interval);
  }, [monitor]);

  if (!__DEV__) return null;

  return (
    <View style={{
      position: 'absolute',
      top: 50,
      right: 10,
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: 10,
      borderRadius: 5,
      zIndex: 1000,
    }}>
      <Text style={{ color: 'white', fontSize: 10 }}>
        Performance: {performanceMode}
      </Text>
      <Text style={{ color: 'white', fontSize: 10 }}>
        Network: {isOnline ? 'Online' : 'Offline'}
      </Text>
      <Text style={{ color: 'white', fontSize: 10 }}>
        App State: {metrics.appState || 'active'}
      </Text>
    </View>
  );
}
