import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context';
import { theme } from '../src/theme';
import { strings } from '../src/constants/strings';
import { Button } from '../src/components/ui';

const { width, height } = Dimensions.get('window');

export default function LockScreen() {
  const router = useRouter();
  const { authenticate, hasHardware, biometricEnabled } = useAuth();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleAuthenticate = async () => {
    setIsAuthenticating(true);
    
    try {
      const success = await authenticate();
      
      if (success) {
        router.replace('/(tabs)');
      } else {
        Alert.alert(
          strings.auth.failed,
          strings.auth.authenticationFailed,
          [{ text: strings.common.retry }]
        );
      }
    } catch (error) {
      Alert.alert(
        strings.auth.error,
        strings.auth.authenticationError,
        [{ text: strings.common.ok }]
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleEmergency = () => {
    Alert.alert(
      strings.auth.emergency,
      strings.auth.emergencyMessage,
      [
        { text: strings.common.cancel, style: 'cancel' },
        { 
          text: strings.auth.emergencyConfirm, 
          style: 'destructive',
          onPress: () => router.push('/settings')
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <Animated.View 
        style={[
          styles.background,
          { opacity: fadeAnim }
        ]} 
      />
      
      {/* Logo and Branding */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Ionicons 
            name="shield-checkmark" 
            size={80} 
            color={theme.colors.white} 
          />
        </View>
        <Text style={styles.title}>SylOS</Text>
        <Text style={styles.subtitle}>{strings.auth.welcomeBack}</Text>
      </View>

      {/* Authentication Section */}
      <View style={styles.authSection}>
        {hasHardware && biometricEnabled ? (
          <Button
            title={isAuthenticating ? strings.auth.authenticating : strings.auth.touchId}
            onPress={handleAuthenticate}
            disabled={isAuthenticating}
            loading={isAuthenticating}
            icon="finger-print"
            variant="secondary"
            size="large"
            style={styles.authButton}
          />
        ) : (
          <View style={styles.noBiometricContainer}>
            <Text style={styles.noBiometricText}>
              {strings.auth.noBiometricAvailable}
            </Text>
            <Button
              title={strings.auth.continue}
              onPress={handleAuthenticate}
              disabled={isAuthenticating}
              loading={isAuthenticating}
              variant="primary"
              size="large"
              style={styles.authButton}
            />
          </View>
        )}

        {/* Security Status */}
        <View style={styles.securityStatus}>
          <Ionicons 
            name="security" 
            size={16} 
            color={theme.colors.success} 
          />
          <Text style={styles.securityText}>
            {strings.auth.secureConnection}
          </Text>
        </View>
      </View>

      {/* Emergency Options */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.emergencyButton}
          onPress={handleEmergency}
        >
          <Text style={styles.emergencyText}>
            {strings.auth.emergency}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primary,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primary,
  },
  header: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  logoContainer: {
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: theme.typography.fontSize.xxxl,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.lg,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  authSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  authButton: {
    width: '100%',
    marginBottom: theme.spacing.lg,
  },
  noBiometricContainer: {
    alignItems: 'center',
    width: '100%',
  },
  noBiometricText: {
    fontSize: theme.typography.fontSize.base,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  securityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  securityText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.success,
    marginLeft: theme.spacing.sm,
  },
  footer: {
    paddingBottom: theme.spacing.xl,
    alignItems: 'center',
  },
  emergencyButton: {
    padding: theme.spacing.md,
  },
  emergencyText: {
    fontSize: theme.typography.fontSize.base,
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
