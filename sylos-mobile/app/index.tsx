import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { theme } from '../src/theme';
import { strings } from '../src/constants/strings';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        return; // Still loading
      }

      if (isAuthenticated) {
        router.replace('/desktop');
      } else {
        router.replace('/lockscreen');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.primary,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.white} />
      </View>
    );
  }

  // This will be immediately replaced by the useEffect
  return null;
}
