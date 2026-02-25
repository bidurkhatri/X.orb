import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../src/theme';

// Agent types matching the web app's AgentRoles.ts
type AgentRole = 'TRADER' | 'RESEARCHER' | 'MONITOR' | 'CODER' | 'GOVERNANCE_ASSISTANT' | 'FILE_INDEXER' | 'RISK_AUDITOR';
type AgentStatus = 'active' | 'paused' | 'revoked' | 'expired';
type ReputationTier = 'UNTRUSTED' | 'NOVICE' | 'RELIABLE' | 'TRUSTED' | 'ELITE';

interface Agent {
  agentId: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  reputation: number;
  reputationTier: ReputationTier;
  stakeBond: string;
  totalActions: number;
  lastActiveAt: number;
  slashEvents: number;
}

const ROLE_META: Record<AgentRole, { label: string; icon: string; color: string }> = {
  TRADER: { label: 'Trader', icon: 'trending-up', color: '#f59e0b' },
  RESEARCHER: { label: 'Researcher', icon: 'flask', color: '#3b82f6' },
  MONITOR: { label: 'Monitor', icon: 'eye', color: '#22c55e' },
  CODER: { label: 'Coder', icon: 'code-slash', color: '#8b5cf6' },
  GOVERNANCE_ASSISTANT: { label: 'Governance', icon: 'library', color: '#ec4899' },
  FILE_INDEXER: { label: 'File Indexer', icon: 'folder', color: '#06b6d4' },
  RISK_AUDITOR: { label: 'Risk Auditor', icon: 'shield-checkmark', color: '#ef4444' },
};

const TIER_COLORS: Record<ReputationTier, string> = {
  ELITE: '#f59e0b',
  TRUSTED: '#22c55e',
  RELIABLE: '#3b82f6',
  NOVICE: '#8b5cf6',
  UNTRUSTED: '#ef4444',
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  active: '#22c55e',
  paused: '#f59e0b',
  revoked: '#ef4444',
  expired: '#6b7280',
};

function getReputationTier(score: number): ReputationTier {
  if (score >= 8500) return 'ELITE';
  if (score >= 6000) return 'TRUSTED';
  if (score >= 3000) return 'RELIABLE';
  if (score >= 1000) return 'NOVICE';
  return 'UNTRUSTED';
}

// Load agents from localStorage-compatible async storage
function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // In production, this would fetch from Supabase or on-chain
      // For now, read from the same structure as the web app
      // The mobile app syncs with the web app's agent registry
      setAgents([]); // Start empty — agents are spawned from the web OS
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { agents, loading, refresh };
}

function RepBar({ score }: { score: number }) {
  const pct = Math.min(100, score / 100);
  const tier = getReputationTier(score);
  const color = TIER_COLORS[tier];
  return (
    <View style={styles.repBarBg}>
      <View style={[styles.repBarFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

function AgentCard({ agent, onPause, onResume, onRevoke }: {
  agent: Agent;
  onPause: () => void;
  onResume: () => void;
  onRevoke: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = ROLE_META[agent.role];
  const tierColor = TIER_COLORS[agent.reputationTier];
  const statusColor = STATUS_COLORS[agent.status];

  return (
    <TouchableOpacity
      onPress={() => setExpanded(!expanded)}
      style={styles.agentCard}
      activeOpacity={0.7}
    >
      <View style={styles.agentHeader}>
        <View style={[styles.agentIcon, { backgroundColor: meta.color + '20' }]}>
          <Ionicons name={meta.icon as any} size={20} color={meta.color} />
        </View>
        <View style={styles.agentInfo}>
          <View style={styles.agentNameRow}>
            <Text style={styles.agentName}>{agent.name}</Text>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          </View>
          <Text style={[styles.agentRole, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <View style={styles.repSection}>
          <Text style={[styles.repScore, { color: tierColor }]}>{agent.reputation}</Text>
          <View style={[styles.tierBadge, { backgroundColor: tierColor + '20' }]}>
            <Text style={[styles.tierText, { color: tierColor }]}>{agent.reputationTier}</Text>
          </View>
        </View>
      </View>

      <RepBar score={agent.reputation} />

      {expanded && (
        <View style={styles.expandedSection}>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Status</Text>
              <Text style={[styles.statValue, { color: statusColor }]}>
                {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Stake</Text>
              <Text style={styles.statValue}>
                {(Number(agent.stakeBond) / 1e18).toFixed(0)} wSYLOS
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Actions</Text>
              <Text style={styles.statValue}>{agent.totalActions}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Slashes</Text>
              <Text style={[styles.statValue, agent.slashEvents > 0 ? { color: '#ef4444' } : {}]}>
                {agent.slashEvents}
              </Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            {agent.status === 'active' && (
              <TouchableOpacity onPress={onPause} style={[styles.actionBtn, styles.pauseBtn]}>
                <Ionicons name="pause" size={14} color="#f59e0b" />
                <Text style={[styles.actionBtnText, { color: '#f59e0b' }]}>Pause</Text>
              </TouchableOpacity>
            )}
            {agent.status === 'paused' && (
              <TouchableOpacity onPress={onResume} style={[styles.actionBtn, styles.resumeBtn]}>
                <Ionicons name="play" size={14} color="#22c55e" />
                <Text style={[styles.actionBtnText, { color: '#22c55e' }]}>Resume</Text>
              </TouchableOpacity>
            )}
            {agent.status !== 'revoked' && (
              <TouchableOpacity onPress={onRevoke} style={[styles.actionBtn, styles.revokeBtn]}>
                <Ionicons name="skull" size={14} color="#ef4444" />
                <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Revoke</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function AgentsScreen() {
  const router = useRouter();
  const { agents, loading, refresh } = useAgents();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handlePause = (agent: Agent) => {
    Alert.alert('Pause Agent', `Pause "${agent.name}"? It will stop executing tasks.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Pause', style: 'destructive', onPress: () => refresh() },
    ]);
  };

  const handleResume = (agent: Agent) => {
    Alert.alert('Resume Agent', `Resume "${agent.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resume', onPress: () => refresh() },
    ]);
  };

  const handleRevoke = (agent: Agent) => {
    Alert.alert(
      'Revoke Agent',
      `Permanently revoke "${agent.name}"? This will slash its stake bond and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: () => refresh() },
      ]
    );
  };

  const activeCount = agents.filter(a => a.status === 'active').length;
  const pausedCount = agents.filter(a => a.status === 'paused').length;
  const revokedCount = agents.filter(a => a.status === 'revoked').length;
  const avgRep = agents.length > 0
    ? Math.round(agents.reduce((s, a) => s + a.reputation, 0) / agents.length)
    : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4F46E5" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Agent Civilization</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatValue}>{agents.length}</Text>
            <Text style={styles.headerStatLabel}>Total</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={[styles.headerStatValue, { color: '#34d399' }]}>{activeCount}</Text>
            <Text style={styles.headerStatLabel}>Active</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={[styles.headerStatValue, { color: '#fbbf24' }]}>{pausedCount}</Text>
            <Text style={styles.headerStatLabel}>Paused</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={[styles.headerStatValue, { color: '#f87171' }]}>{revokedCount}</Text>
            <Text style={styles.headerStatLabel}>Revoked</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={[styles.headerStatValue, { color: '#a78bfa' }]}>{avgRep || '—'}</Text>
            <Text style={styles.headerStatLabel}>Avg Rep</Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#818cf8" />
        }
      >
        {/* Reputation Tier Guide */}
        <View style={styles.tierGuide}>
          <Text style={styles.sectionTitle}>Reputation Tiers</Text>
          <View style={styles.tierRow}>
            {(['ELITE', 'TRUSTED', 'RELIABLE', 'NOVICE', 'UNTRUSTED'] as ReputationTier[]).map(tier => (
              <View key={tier} style={[styles.tierChip, { borderColor: TIER_COLORS[tier] + '30' }]}>
                <View style={[styles.tierDot, { backgroundColor: TIER_COLORS[tier] }]} />
                <Text style={[styles.tierChipText, { color: TIER_COLORS[tier] }]}>{tier}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Agent List */}
        <Text style={styles.sectionTitle}>Your Agents</Text>

        {loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading agents...</Text>
          </View>
        ) : agents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people" size={48} color="rgba(255,255,255,0.15)" />
            <Text style={styles.emptyTitle}>No Agents Spawned</Text>
            <Text style={styles.emptyText}>
              Spawn your first licensed AI worker from the SylOS desktop application. Agents can be monitored and controlled from this mobile app.
            </Text>
          </View>
        ) : (
          agents.map(agent => (
            <AgentCard
              key={agent.agentId}
              agent={agent}
              onPause={() => handlePause(agent)}
              onResume={() => handleResume(agent)}
              onRevoke={() => handleRevoke(agent)}
            />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  header: {
    backgroundColor: '#4F46E5',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerStat: {
    alignItems: 'center',
  },
  headerStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerStatLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'uppercase',
    marginTop: 2,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tierGuide: {
    marginBottom: 24,
  },
  tierRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  tierDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tierChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  agentCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  agentIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentInfo: {
    flex: 1,
  },
  agentNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  agentRole: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  repSection: {
    alignItems: 'flex-end',
  },
  repScore: {
    fontSize: 18,
    fontWeight: '700',
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  tierText: {
    fontSize: 8,
    fontWeight: '700',
  },
  repBarBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  repBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  expandedSection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
  },
  pauseBtn: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
  },
  resumeBtn: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  revokeBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
