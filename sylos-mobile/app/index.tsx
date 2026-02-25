import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    // Brief splash then go straight to tabs.
    // In production, check auth state and route to lockscreen if needed.
    const timer = setTimeout(() => {
      router.replace('/(tabs)');
    }, 1500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={s.container}>
      <Text style={s.logo}>SylOS</Text>
      <Text style={s.tagline}>Agent Command Center</Text>
      <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" style={{ marginTop: 24 }} />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a', justifyContent: 'center', alignItems: 'center' },
  logo: { fontSize: 42, fontWeight: '800', color: '#fff', letterSpacing: -1 },
  tagline: { fontSize: 14, color: 'rgba(255,255,255,0.35)', marginTop: 6, fontWeight: '500' },
});
