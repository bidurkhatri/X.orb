/**
 * Agent Monitor — full agent list with controls.
 * Tap to expand and see details. Pause, resume, revoke from here.
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAgents } from '../../src/context';
import { ROLE_META, TIER_COLORS, STATUS_COLORS } from '../../src/types/agent';
import type { RegisteredAgent, AgentStatus } from '../../src/types/agent';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function daysLeft(ts: number): string {
  if (ts === 0) return 'No expiry';
  const days = Math.ceil((ts - Date.now()) / 86400000);
  if (days < 0) return 'Expired';
  if (days === 0) return 'Today';
  return `${days}d left`;
}

type FilterType = 'all' | AgentStatus;

function AgentCard({ agent }: { agent: RegisteredAgent }) {
  const [expanded, setExpanded] = useState(false);
  const { pauseAgent, resumeAgent, revokeAgent } = useAgents();
  const meta = ROLE_META[agent.role];
  const tierColor = TIER_COLORS[agent.reputationTier];
  const statusColor = STATUS_COLORS[agent.status];
  const repPct = Math.min(100, agent.reputation / 100);

  const handlePause = () => {
    Alert.alert('Pause Agent', `Pause "${agent.name}"? It will stop executing tasks but retain state.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Pause', style: 'destructive', onPress: () => pauseAgent(agent.agentId) },
    ]);
  };

  const handleResume = () => {
    Alert.alert('Resume Agent', `Resume "${agent.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resume', onPress: () => resumeAgent(agent.agentId) },
    ]);
  };

  const handleRevoke = () => {
    Alert.alert(
      'Revoke Agent',
      `Permanently revoke "${agent.name}"?\n\nThis slashes its stake bond to zero and cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke Forever', style: 'destructive', onPress: () => revokeAgent(agent.agentId) },
      ]
    );
  };

  return (
    <TouchableOpacity onPress={() => setExpanded(!expanded)} style={s.card} activeOpacity={0.7}>
      {/* Top Row */}
      <View style={s.cardTop}>
        <View style={[s.iconBox, { backgroundColor: meta.color + '18' }]}>
          <Ionicons name={meta.icon as any} size={20} color={meta.color} />
        </View>
        <View style={s.cardInfo}>
          <View style={s.nameRow}>
            <Text style={s.name}>{agent.name}</Text>
            <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          </View>
          <Text style={[s.role, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <View style={s.repCol}>
          <Text style={[s.repScore, { color: tierColor }]}>{agent.reputation}</Text>
          <View style={[s.tierBadge, { backgroundColor: tierColor + '18' }]}>
            <Text style={[s.tierText, { color: tierColor }]}>{agent.reputationTier}</Text>
          </View>
        </View>
      </View>

      {/* Rep Bar */}
      <View style={s.repBar}>
        <View style={[s.repFill, { width: `${repPct}%`, backgroundColor: tierColor }]} />
      </View>

      {/* Expanded */}
      {expanded && (
        <View style={s.expanded}>
          {/* Stats Grid */}
          <View style={s.statsGrid}>
            <View style={s.stat}>
              <Text style={s.statLabel}>Status</Text>
              <Text style={[s.statVal, { color: statusColor }]}>
                {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
              </Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statLabel}>Stake</Text>
              <Text style={s.statVal}>{(Number(agent.stakeBond) / 1e18).toFixed(0)} wSYLOS</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statLabel}>Actions</Text>
              <Text style={s.statVal}>{agent.totalActionsExecuted}</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statLabel}>Slashes</Text>
              <Text style={[s.statVal, agent.slashEvents > 0 ? { color: '#ef4444' } : {}]}>
                {agent.slashEvents}
              </Text>
            </View>
          </View>

          {/* Info rows */}
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>LLM</Text>
            <Text style={s.infoVal}>{agent.llmProvider.name} / {agent.llmProvider.model}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Last Active</Text>
            <Text style={s.infoVal}>{timeAgo(agent.lastActiveAt)}</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Visa</Text>
            <Text style={s.infoVal}>{daysLeft(agent.expiresAt)}</Text>
          </View>
          <Text style={s.desc} numberOfLines={2}>{agent.description}</Text>

          {/* Actions */}
          <View style={s.actions}>
            {agent.status === 'active' && (
              <TouchableOpacity onPress={handlePause} style={[s.actionBtn, s.pauseBtn]}>
                <Ionicons name="pause" size={14} color="#f59e0b" />
                <Text style={[s.actionText, { color: '#f59e0b' }]}>Pause</Text>
              </TouchableOpacity>
            )}
            {agent.status === 'paused' && (
              <TouchableOpacity onPress={handleResume} style={[s.actionBtn, s.resumeBtn]}>
                <Ionicons name="play" size={14} color="#22c55e" />
                <Text style={[s.actionText, { color: '#22c55e' }]}>Resume</Text>
              </TouchableOpacity>
            )}
            {agent.status !== 'revoked' && (
              <TouchableOpacity onPress={handleRevoke} style={[s.actionBtn, s.revokeBtn]}>
                <Ionicons name="skull" size={14} color="#ef4444" />
                <Text style={[s.actionText, { color: '#ef4444' }]}>Revoke</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function AgentsScreen() {
  const { agents, isLoading, refresh } = useAgents();
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const filtered = filter === 'all' ? agents : agents.filter(a => a.status === filter);
  const activeCount = agents.filter(a => a.status === 'active').length;
  const pausedCount = agents.filter(a => a.status === 'paused').length;

  const filters: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: agents.length },
    { key: 'active', label: 'Active', count: activeCount },
    { key: 'paused', label: 'Paused', count: pausedCount },
    { key: 'revoked', label: 'Revoked', count: agents.filter(a => a.status === 'revoked').length },
  ];

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />

      <View style={s.header}>
        <Text style={s.headerTitle}>Agent Civilization</Text>
        <Text style={s.headerSub}>{activeCount} active · {agents.length} total</Text>
      </View>

      {/* Filters */}
      <View style={s.filterRow}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterChip, filter === f.key && s.filterActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>
              {f.label} ({f.count})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#818cf8" />}
      >
        {isLoading ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>Loading agents...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="people" size={48} color="rgba(255,255,255,0.12)" />
            <Text style={s.emptyTitle}>No Agents</Text>
            <Text style={s.emptyText}>
              {filter === 'all'
                ? 'Spawn agents from the SylOS desktop to monitor them here.'
                : `No ${filter} agents.`}
            </Text>
          </View>
        ) : (
          filtered.map(agent => <AgentCard key={agent.agentId} agent={agent} />)
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  header: { paddingTop: 55, paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  filterActive: { backgroundColor: 'rgba(129,140,248,0.12)', borderColor: 'rgba(129,140,248,0.3)' },
  filterText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  filterTextActive: { color: '#818cf8' },

  scroll: { flex: 1, paddingHorizontal: 16 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 15, fontWeight: '600', color: '#fff' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  role: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  repCol: { alignItems: 'flex-end' },
  repScore: { fontSize: 18, fontWeight: '700' },
  tierBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, marginTop: 2 },
  tierText: { fontSize: 8, fontWeight: '700' },

  repBar: { height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  repFill: { height: '100%', borderRadius: 2 },

  expanded: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  stat: { alignItems: 'center' },
  statLabel: { fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 },
  statVal: { fontSize: 13, fontWeight: '600', color: '#e2e8f0' },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  infoLabel: { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '600' },
  infoVal: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  desc: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 8, fontStyle: 'italic', lineHeight: 16 },

  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    flex: 1, justifyContent: 'center',
  },
  pauseBtn: { backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.18)' },
  resumeBtn: { backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.18)' },
  revokeBtn: { backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)' },
  actionText: { fontSize: 12, fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.4)', marginTop: 12, marginBottom: 6 },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
});
