import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useSync } from '../../src/context';
import { theme } from '../../src/theme';
import { strings } from '../../src/constants/strings';
import { Card } from '../../src/components/ui';

export default function Settings() {
  const { biometricEnabled, hasHardware, setupBiometric, logout } = useAuth();
  const { isSyncEnabled, setSyncEnabled, forceSync } = useSync();
  const [notifications, setNotifications] = useState(true);
  const [biometric, setBiometric] = useState(biometricEnabled);

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      const success = await setupBiometric();
      if (success) {
        setBiometric(true);
      } else {
        Alert.alert(
          strings.common.error,
          strings.auth.biometricSetupFailed,
          [{ text: strings.common.ok }]
        );
      }
    } else {
      setBiometric(false);
    }
  };

  const handleSyncToggle = (value: boolean) => {
    setSyncEnabled(value);
  };

  const handleLogout = () => {
    Alert.alert(
      strings.settings.logout,
      strings.settings.logoutMessage,
      [
        { text: strings.common.cancel, style: 'cancel' },
        { 
          text: strings.settings.logoutConfirm, 
          style: 'destructive',
          onPress: logout
        }
      ]
    );
  };

  const handleAbout = () => {
    Alert.alert(
      'SylOS',
      `${strings.settings.version}: 1.0.0\n${strings.settings.build}: 1\n\n${strings.settings.about}`,
      [{ text: strings.common.ok }]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{strings.apps.settings}</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Security Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>
              {strings.settings.security}
            </Text>
          </View>
          
          {hasHardware && (
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>
                  {strings.settings.biometricAuth}
                </Text>
                <Text style={styles.settingDescription}>
                  {strings.settings.biometricDescription}
                </Text>
              </View>
              <Switch
                value={biometric}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={biometric ? theme.colors.white : theme.colors.surface}
              />
            </View>
          )}
        </Card>

        {/* Sync Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="cloud-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>
              {strings.settings.sync}
            </Text>
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>
                {strings.settings.enableSync}
              </Text>
              <Text style={styles.settingDescription}>
                {strings.settings.syncDescription}
              </Text>
            </View>
            <Switch
              value={isSyncEnabled}
              onValueChange={handleSyncToggle}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={isSyncEnabled ? theme.colors.white : theme.colors.surface}
            />
          </View>

          <TouchableOpacity 
            style={styles.settingItem}
            onPress={forceSync}
          >
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>
                {strings.settings.syncNow}
              </Text>
              <Text style={styles.settingDescription}>
                {strings.settings.syncNowDescription}
              </Text>
            </View>
            <Ionicons name="refresh" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </Card>

        {/* Notifications Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>
              {strings.settings.notifications}
            </Text>
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>
                {strings.settings.enableNotifications}
              </Text>
              <Text style={styles.settingDescription}>
                {strings.settings.notificationDescription}
              </Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={notifications ? theme.colors.white : theme.colors.surface}
            />
          </View>
        </Card>

        {/* Information Section */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.sectionTitle}>
              {strings.settings.information}
            </Text>
          </View>
          
          <TouchableOpacity style={styles.settingItem} onPress={handleAbout}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>
                {strings.settings.about}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </Card>

        {/* Danger Zone */}
        <Card style={[styles.section, styles.dangerSection]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning-outline" size={20} color={theme.colors.error} />
            <Text style={[styles.sectionTitle, { color: theme.colors.error }]}>
              {strings.settings.dangerZone}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.dangerButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={20} color={theme.colors.error} />
            <Text style={styles.dangerButtonText}>
              {strings.settings.logout}
            </Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.primary,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: theme.spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  settingInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  settingLabel: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  settingDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  dangerSection: {
    borderColor: theme.colors.error,
    borderWidth: 1,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  dangerButtonText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.error,
    marginLeft: theme.spacing.md,
  },
});
