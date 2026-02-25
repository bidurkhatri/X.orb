/**
 * Approvals — review and approve/reject agent transaction proposals.
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAgents } from '../../src/context';
import type { TransactionProposal } from '../../src/types/agent';

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  transfer: 'arrow-forward-circle',
  swap: 'swap-horizontal',
  stake: 'lock-closed',
  vote: 'hand-left',
  contract_call: 'code-slash',
};

const TYPE_COLORS: Record<string, string> = {
  transfer: '#3b82f6',
  swap: '#8b5cf6',
  stake: '#06b6d4',
  vote: '#ec4899',
  contract_call: '#f59e0b',
};

type Tab = 'pending' | 'history';

function ProposalCard({ proposal, showActions }: { proposal: TransactionProposal; showActions: boolean }) {
  const { approveProposal, rejectProposal } = useAgents();
  const icon = TYPE_ICONS[proposal.type] || 'document-text';
  const color = TYPE_COLORS[proposal.type] || '#6b7280';
  const valueEth = Number(proposal.value) / 1e18;

  const handleApprove = () => {
    Alert.alert('Approve Transaction', `Approve "${proposal.description}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: () => approveProposal(proposal.id) },
    ]);
  };

  const handleReject = () => {
    Alert.alert('Reject Transaction', `Reject "${proposal.description}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: () => rejectProposal(proposal.id) },
    ]);
  };

  const statusColor = proposal.status === 'approved' ? '#22c55e'
    : proposal.status === 'rejected' ? '#ef4444'
    : proposal.status === 'executed' ? '#3b82f6'
    : '#f59e0b';

  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={[s.typeIcon, { backgroundColor: color + '15' }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.cardTitleRow}>
            <Text style={s.agentName}>{proposal.agentName}</Text>
            <View style={[s.typeBadge, { backgroundColor: color + '15' }]}>
              <Text style={[s.typeText, { color }]}>{proposal.type.replace('_', ' ')}</Text>
            </View>
          </View>
          <Text style={s.desc} numberOfLines={2}>{proposal.description}</Text>
        </View>
      </View>

      {/* Details */}
      <View style={s.details}>
        {valueEth > 0 && (
          <View style={s.detailRow}>
            <Ionicons name="cash" size={12} color="rgba(255,255,255,0.3)" />
            <Text style={s.detailText}>{valueEth.toFixed(4)} tokens</Text>
          </View>
        )}
        <View style={s.detailRow}>
          <Ionicons name="location" size={12} color="rgba(255,255,255,0.3)" />
          <Text style={s.detailText} numberOfLines={1}>To: {proposal.to.slice(0, 10)}...{proposal.to.slice(-4)}</Text>
        </View>
        <Text style={s.time}>{timeAgo(proposal.createdAt)}</Text>
      </View>

      {/* Actions or Status */}
      {showActions && proposal.status === 'pending' ? (
        <View style={s.actions}>
          <TouchableOpacity onPress={handleReject} style={s.rejectBtn}>
            <Ionicons name="close" size={16} color="#ef4444" />
            <Text style={[s.actionText, { color: '#ef4444' }]}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleApprove} style={s.approveBtn}>
            <Ionicons name="checkmark" size={16} color="#22c55e" />
            <Text style={[s.actionText, { color: '#22c55e' }]}>Approve</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[s.statusRow, { borderColor: statusColor + '20' }]}>
          <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[s.statusText, { color: statusColor }]}>
            {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function ApprovalsScreen() {
  const { proposals, pendingProposals, isLoading, refresh } = useAgents();
  const [tab, setTab] = useState<Tab>('pending');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const historyProposals = proposals.filter(p => p.status !== 'pending');
  const displayed = tab === 'pending' ? pendingProposals : historyProposals;

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />

      <View style={s.header}>
        <Text style={s.headerTitle}>Approvals</Text>
        <Text style={s.headerSub}>
          {pendingProposals.length} pending · {historyProposals.length} resolved
        </Text>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        <TouchableOpacity
          style={[s.tab, tab === 'pending' && s.tabActive]}
          onPress={() => setTab('pending')}
        >
          <Text style={[s.tabText, tab === 'pending' && s.tabTextActive]}>
            Pending ({pendingProposals.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, tab === 'history' && s.tabActive]}
          onPress={() => setTab('history')}
        >
          <Text style={[s.tabText, tab === 'history' && s.tabTextActive]}>
            History ({historyProposals.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#818cf8" />}
      >
        {displayed.length === 0 ? (
          <View style={s.empty}>
            <Ionicons
              name={tab === 'pending' ? 'shield-checkmark' : 'time'}
              size={48}
              color="rgba(255,255,255,0.12)"
            />
            <Text style={s.emptyTitle}>
              {tab === 'pending' ? 'No Pending Approvals' : 'No History'}
            </Text>
            <Text style={s.emptyText}>
              {tab === 'pending'
                ? 'When agents propose transactions, they\'ll appear here for your review.'
                : 'Approved and rejected transactions will appear here.'}
            </Text>
          </View>
        ) : (
          displayed.map(p => (
            <ProposalCard key={p.id} proposal={p} showActions={tab === 'pending'} />
          ))
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

  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  tabActive: { backgroundColor: 'rgba(129,140,248,0.1)', borderColor: 'rgba(129,140,248,0.3)' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  tabTextActive: { color: '#818cf8' },

  scroll: { flex: 1, paddingHorizontal: 16 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  cardTop: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  typeIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  agentName: { fontSize: 14, fontWeight: '600', color: '#fff' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  typeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  desc: { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 3, lineHeight: 18 },

  details: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  time: { fontSize: 10, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' },

  actions: { flexDirection: 'row', gap: 8 },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.18)',
  },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10,
    backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.18)',
  },
  actionText: { fontSize: 13, fontWeight: '600' },

  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
    borderWidth: 1, alignSelf: 'flex-start',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.4)', marginTop: 12, marginBottom: 6 },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
});
