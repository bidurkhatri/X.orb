import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../src/theme';
import { strings } from '../../src/constants/strings';
import { Card } from '../../src/components/ui';

export default function TokenDashboard() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="trending-up" size={24} color={theme.colors.white} />
          <Text style={styles.headerTitle}>{strings.apps.tokenDashboard}</Text>
        </View>
        <Text style={styles.headerSubtitle}>{strings.apps.tokenDashboardDesc}</Text>
      </View>

      <View style={styles.content}>
        <Card style={styles.featureCard}>
          <Ionicons 
            name="stats-chart-outline" 
            size={48} 
            color={theme.colors.primary} 
          />
          <Text style={styles.comingSoonTitle}>
            {strings.common.comingSoon}
          </Text>
          <Text style={styles.comingSoonText}>
            {strings.tokenDashboard.description}
          </Text>
        </Card>
      </View>
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
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.white,
    marginLeft: theme.spacing.md,
  },
  headerSubtitle: {
    fontSize: theme.typography.fontSize.base,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
    justifyContent: 'center',
  },
  featureCard: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  comingSoonTitle: {
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  comingSoonText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
