import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useWallet, useSync } from '../src/context';
import { theme } from '../src/theme';
import { strings } from '../src/constants/strings';
import { Button, Card } from '../src/components/ui';

interface AppIcon {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
  description: string;
}

const appIcons: AppIcon[] = [
  {
    id: 'wallet',
    name: strings.apps.wallet,
    icon: 'wallet',
    color: '#4F46E5',
    route: '/wallet',
    description: strings.apps.walletDesc,
  },
  {
    id: 'pop-tracker',
    name: strings.apps.popTracker,
    icon: 'analytics',
    color: '#059669',
    route: '/pop-tracker',
    description: strings.apps.popTrackerDesc,
  },
  {
    id: 'file-manager',
    name: strings.apps.fileManager,
    icon: 'folder',
    color: '#DC2626',
    route: '/file-manager',
    description: strings.apps.fileManagerDesc,
  },
  {
    id: 'agents',
    name: strings.apps.agents,
    icon: 'people',
    color: '#818CF8',
    route: '/agents',
    description: strings.apps.agentsDesc,
  },
  {
    id: 'token-dashboard',
    name: strings.apps.tokenDashboard,
    icon: 'trending-up',
    color: '#7C3AED',
    route: '/token-dashboard',
    description: strings.apps.tokenDashboardDesc,
  },
  {
    id: 'settings',
    name: strings.apps.settings,
    icon: 'settings',
    color: '#6B7280',
    route: '/settings',
    description: strings.apps.settingsDesc,
  },
];

export default function Desktop() {
  const router = useRouter();
  const { logout } = useAuth();
  const { activeWallet, network } = useWallet();
  const { isOnline, lastSyncTime } = useSync();

  const handleAppPress = (route: string) => {
    router.push(route as any);
  };

  const handleLogout = async () => {
    await logout();
  };

  const formatBalance = (balance: number) => {
    if (balance < 0.001) return '< 0.001';
    return balance.toFixed(4);
  };

  const getTimeSinceSync = () => {
    if (!lastSyncTime) return 'Never';
    const diff = Date.now() - lastSyncTime.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return lastSyncTime.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor={theme.colors.primary} 
      />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>
              {strings.desktop.welcomeBack}
            </Text>
            <Text style={styles.headerSubtitle}>
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={24} color={theme.colors.white} />
          </TouchableOpacity>
        </View>

        {/* Status Bar */}
        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <View style={[
              styles.statusIndicator,
              { backgroundColor: isOnline ? theme.colors.success : theme.colors.error }
            ]} />
            <Text style={styles.statusText}>
              {isOnline ? strings.status.online : strings.status.offline}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <Ionicons name="cloud" size={16} color={theme.colors.white} />
            <Text style={styles.statusText}>
              {getTimeSinceSync()}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Stats */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Wallet Summary Card */}
        {activeWallet && (
          <Card style={styles.walletCard}>
            <View style={styles.walletHeader}>
              <View style={styles.walletInfo}>
                <Ionicons name="wallet" size={20} color={theme.colors.primary} />
                <View style={styles.walletDetails}>
                  <Text style={styles.walletName}>
                    {activeWallet.name}
                  </Text>
                  <Text style={styles.walletAddress}>
                    {`${activeWallet.address.slice(0, 6)}...${activeWallet.address.slice(-4)}`}
                  </Text>
                </View>
              </View>
              <View style={[
                styles.networkBadge,
                { backgroundColor: network === 'polygon-pos' ? '#8247E5' : '#3B82F6' }
              ]}>
                <Text style={styles.networkText}>
                  {network === 'polygon-pos' ? 'POLYGON' : 'TESTNET'}
                </Text>
              </View>
            </View>
            <View style={styles.balanceSection}>
              <Text style={styles.balanceLabel}>
                {strings.wallet.totalBalance}
              </Text>
              <Text style={styles.balance}>
                {formatBalance(activeWallet.balance)} MATIC
              </Text>
            </View>
          </Card>
        )}

        {/* App Grid */}
        <View style={styles.appGrid}>
          {appIcons.map((app) => (
            <TouchableOpacity
              key={app.id}
              style={styles.appIcon}
              onPress={() => handleAppPress(app.route)}
            >
              <View style={[
                styles.iconContainer,
                { backgroundColor: app.color }
              ]}>
                <Ionicons 
                  name={app.icon} 
                  size={32} 
                  color={theme.colors.white} 
                />
              </View>
              <Text style={styles.appName}>
                {app.name}
              </Text>
              <Text style={styles.appDescription}>
                {app.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>
            {strings.desktop.quickActions}
          </Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="qr-code" size={20} color={theme.colors.primary} />
              <Text style={styles.actionButtonText}>
                {strings.desktop.scanQR}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="camera" size={20} color={theme.colors.primary} />
              <Text style={styles.actionButtonText}>
                {strings.desktop.photos}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="notifications" size={20} color={theme.colors.primary} />
              <Text style={styles.actionButtonText}>
                {strings.desktop.notifications}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primary,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  headerSubtitle: {
    fontSize: theme.typography.fontSize.base,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: theme.spacing.xs,
  },
  logoutButton: {
    padding: theme.spacing.sm,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.sm,
  },
  statusText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.white,
  },
  content: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  walletCard: {
    marginBottom: theme.spacing.lg,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletDetails: {
    marginLeft: theme.spacing.md,
  },
  walletName: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
  },
  walletAddress: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    fontFamily: 'monospace',
  },
  networkBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
  },
  networkText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.white,
  },
  balanceSection: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  balance: {
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  appGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
  },
  appIcon: {
    width: '48%',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
  },
  appName: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  appDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  quickActions: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  actionButtonText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
});
