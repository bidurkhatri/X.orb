/**
 * Dashboard — the home tab.
 * Shows agent summary, pending approvals, recent activity, and quick stats.
 */
import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAgents } from '../../src/context';
import { ROLE_META, TIER_COLORS, STATUS_COLORS } from '../../src/types/agent';
import type { ActivityEvent } from '../../src/types/agent';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function eventIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type.startsWith('agent:spawned')) return 'add-circle';
  if (type.startsWith('agent:paused')) return 'pause-circle';
  if (type.startsWith('agent:resumed')) return 'play-circle';
  if (type.startsWith('agent:revoked')) return 'close-circle';
  if (type.startsWith('agent:reputation')) return 'trending-up';
  if (type.startsWith('agent:thought')) return 'bulb';
  if (type.startsWith('agent:task_completed')) return 'checkmark-circle';
  if (type.startsWith('agent:task_failed')) return 'alert-circle';
  if (type.startsWith('community:')) return 'chatbubble';
  if (type.startsWith('tx:proposal')) return 'document-text';
  if (type.startsWith('tx:approved')) return 'checkmark-done';
  if (type.startsWith('tx:rejected')) return 'close';
  if (type.startsWith('jobs:')) return 'briefcase';
  if (type.startsWith('marketplace:')) return 'storefront';
  return 'radio-button-on';
}

function eventColor(type: string): string {
  if (type.includes('completed') || type.includes('approved') || type.includes('spawned')) return '#22c55e';
  if (type.includes('failed') || type.includes('rejected') || type.includes('revoked')) return '#ef4444';
  if (type.includes('paused') || type.includes('reputation')) return '#f59e0b';
  if (type.includes('thought') || type.includes('tool')) return '#818cf8';
  if (type.includes('community') || type.includes('post')) return '#3b82f6';
  if (type.includes('tx:proposal')) return '#f59e0b';
  return '#6b7280';
}

function eventLabel(e: ActivityEvent): string {
  const p = e.payload || {};
  switch (e.type) {
    case 'agent:spawned': return `${e.sourceName} spawned (${p.role || 'agent'})`;
    case 'agent:paused': return `${e.sourceName} paused`;
    case 'agent:resumed': return `${e.sourceName} resumed`;
    case 'agent:revoked': return `${e.sourceName} revoked`;
    case 'agent:reputation_changed': return `${e.sourceName} rep ${p.delta > 0 ? '+' : ''}${p.delta} → ${p.newScore}`;
    case 'agent:thought': return `${e.sourceName}: "${(p.thought || '').slice(0, 60)}${(p.thought || '').length > 60 ? '...' : ''}"`;
    case 'agent:task_completed': return `${e.sourceName} completed: ${p.task || 'task'}`;
    case 'agent:task_failed': return `${e.sourceName} failed: ${p.task || 'task'}`;
    case 'community:post_created': return `${e.sourceName} posted: "${p.title || ''}"`;
    case 'community:reply_created': return `${e.sourceName} replied`;
    case 'tx:proposal_created': return `${e.sourceName} proposed: ${p.description || ''}`;
    case 'tx:approved': return `Approved: ${p.description || 'transaction'}`;
    case 'tx:rejected': return `Rejected: ${p.description || 'transaction'}`;
    default: return `${e.sourceName}: ${e.type.split(':')[1] || e.type}`;
  }
}

export default function DashboardScreen() {
  const router = useRouter();
  const {
    agents, activeAgents, pendingProposals,
    events, isLoading, refresh,
  } = useAgents();
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const totalRep = agents.reduce((s, a) => s + a.reputation, 0);
  const avgRep = agents.length > 0 ? Math.round(totalRep / agents.length) : 0;
  const totalActions = agents.reduce((s, a) => s + a.totalActionsExecuted, 0);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.logo}>SylOS</Text>
        <Text style={s.subtitle}>Agent Command Center</Text>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#818cf8" />}
      >
        {/* Quick Stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: '#818cf8' }]}>{agents.length}</Text>
            <Text style={s.statLabel}>Agents</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: '#22c55e' }]}>{activeAgents.length}</Text>
            <Text style={s.statLabel}>Active</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: '#f59e0b' }]}>{pendingProposals.length}</Text>
            <Text style={s.statLabel}>Pending TX</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: '#3b82f6' }]}>{avgRep}</Text>
            <Text style={s.statLabel}>Avg Rep</Text>
          </View>
        </View>

        {/* Agent Overview Cards */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Your Agents</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/agents')}>
              <Text style={s.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>
          {agents.slice(0, 4).map(agent => {
            const meta = ROLE_META[agent.role];
            return (
              <View key={agent.agentId} style={s.agentRow}>
                <View style={[s.agentDot, { backgroundColor: STATUS_COLORS[agent.status] }]} />
                <View style={[s.agentIconBox, { backgroundColor: meta.color + '18' }]}>
                  <Ionicons name={meta.icon as any} size={16} color={meta.color} />
                </View>
                <View style={s.agentRowInfo}>
                  <Text style={s.agentRowName}>{agent.name}</Text>
                  <Text style={[s.agentRowRole, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <View style={s.agentRowRight}>
                  <Text style={[s.agentRowRep, { color: TIER_COLORS[agent.reputationTier] }]}>{agent.reputation}</Text>
                  <Text style={s.agentRowActions}>{agent.totalActionsExecuted} acts</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Pending Approvals */}
        {pendingProposals.length > 0 && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>Pending Approvals</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/approvals')}>
                <Text style={s.seeAll}>Review →</Text>
              </TouchableOpacity>
            </View>
            {pendingProposals.slice(0, 3).map(p => (
              <View key={p.id} style={s.proposalRow}>
                <View style={s.proposalIcon}>
                  <Ionicons name="document-text" size={16} color="#f59e0b" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.proposalAgent}>{p.agentName}</Text>
                  <Text style={s.proposalDesc} numberOfLines={1}>{p.description}</Text>
                </View>
                <Text style={s.proposalTime}>{timeAgo(p.createdAt)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Activity Feed */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Recent Activity</Text>
          {events.slice(0, 10).map(e => (
            <View key={e.id} style={s.eventRow}>
              <View style={[s.eventIconBox, { backgroundColor: eventColor(e.type) + '15' }]}>
                <Ionicons name={eventIcon(e.type)} size={14} color={eventColor(e.type)} />
              </View>
              <Text style={s.eventText} numberOfLines={2}>{eventLabel(e)}</Text>
              <Text style={s.eventTime}>{timeAgo(e.timestamp)}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  header: { paddingTop: 55, paddingHorizontal: 20, paddingBottom: 16 },
  logo: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontWeight: '500' },
  scroll: { flex: 1, paddingHorizontal: 16 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 },
  seeAll: { fontSize: 12, color: '#818cf8', fontWeight: '600' },

  agentRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  agentDot: { width: 8, height: 8, borderRadius: 4 },
  agentIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  agentRowInfo: { flex: 1 },
  agentRowName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  agentRowRole: { fontSize: 11, fontWeight: '500', marginTop: 1 },
  agentRowRight: { alignItems: 'flex-end' },
  agentRowRep: { fontSize: 16, fontWeight: '700' },
  agentRowActions: { fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 },

  proposalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(245,158,11,0.06)', borderRadius: 12,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.12)',
  },
  proposalIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(245,158,11,0.1)' },
  proposalAgent: { fontSize: 12, fontWeight: '600', color: '#f59e0b' },
  proposalDesc: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  proposalTime: { fontSize: 10, color: 'rgba(255,255,255,0.3)' },

  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  eventIconBox: { width: 28, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  eventText: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 17 },
  eventTime: { fontSize: 10, color: 'rgba(255,255,255,0.25)' },
});
