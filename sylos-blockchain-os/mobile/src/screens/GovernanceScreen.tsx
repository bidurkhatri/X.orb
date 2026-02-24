import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { 
  Text, 
  Button, 
  Card, 
  Input, 
  Select, 
  Badge,
  ListItem,
  Divider
} from '@rneui/themed';
import { useWallet } from '../../hooks/useWallet';
import { useGovernanceService } from '../../hooks/useGovernanceService';
import { theme } from '../../theme/theme';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

interface Proposal {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'succeeded' | 'defeated' | 'executed';
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  startTime: number;
  endTime: number;
}

interface GovernanceStats {
  totalProposals: number;
  activeProposals: number;
  userVotingPower: number;
  participationRate: number;
}

const GovernanceScreen: React.FC = () => {
  const { address } = useWallet();
  const { 
    getProposals, 
    createProposal, 
    castVote, 
    getUserVotingPower,
    getProposalById
  } = useGovernanceService();

  // State management
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('proposals');

  // Data state
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [governanceStats, setGovernanceStats] = useState<GovernanceStats>({
    totalProposals: 0,
    activeProposals: 0,
    userVotingPower: 0,
    participationRate: 0
  });
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  // Proposal creation state
  const [newProposal, setNewProposal] = useState({
    title: '',
    description: '',
  });

  // Voting state
  const [voteSupport, setVoteSupport] = useState<'for' | 'against' | 'abstain'>('for');
  const [votingAmount, setVotingAmount] = useState('');

  useEffect(() => {
    if (address) {
      loadGovernanceData();
    }
  }, [address]);

  const loadGovernanceData = async () => {
    try {
      setRefreshing(true);
      
      // Load proposals
      const proposalsData = await getProposals();
      setProposals(proposalsData);

      // Load governance statistics
      const stats = await getUserVotingPower(address!);
      setGovernanceStats(stats);

    } catch (err) {
      Alert.alert('Error', 'Failed to load governance data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreateProposal = async () => {
    if (!newProposal.title || !newProposal.description) {
      Alert.alert('Error', 'Title and description are required');
      return;
    }

    try {
      setLoading(true);
      await createProposal(
        newProposal.title,
        newProposal.description,
        [], // targets
        [], // values
        [], // calldatas
        0 // eta
      );
      
      setNewProposal({ title: '', description: '' });
      await loadGovernanceData();
      Alert.alert('Success', 'Proposal created successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to create proposal');
    } finally {
      setLoading(false);
    }
  };

  const handleCastVote = async (proposalId: string) => {
    try {
      setLoading(true);
      await castVote(proposalId, voteSupport, votingAmount);
      await loadGovernanceData();
      Alert.alert('Success', 'Vote cast successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to cast vote');
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: Proposal['status']) => {
    switch (status) {
      case 'pending':
        return { 
          color: theme.colors.warning,
          text: 'Pending' 
        };
      case 'active':
        return { 
          color: theme.colors.primary,
          text: 'Active' 
        };
      case 'succeeded':
        return { 
          color: theme.colors.success,
          text: 'Succeeded' 
        };
      case 'defeated':
        return { 
          color: theme.colors.error,
          text: 'Defeated' 
        };
      case 'executed':
        return { 
          color: theme.colors.info,
          text: 'Executed' 
        };
      default:
        return { 
          color: theme.colors.textSecondary,
          text: 'Unknown' 
        };
    }
  };

  const getTimeRemaining = (endTime: number) => {
    const now = Date.now() / 1000;
    const remaining = endTime - now;
    
    if (remaining <= 0) return 'Ended';
    
    const days = Math.floor(remaining / (24 * 60 * 60));
    const hours = Math.floor((remaining % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((remaining % (60 * 60)) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getVotingProgress = (proposal: Proposal) => {
    const total = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
    return total > 0 ? (proposal.forVotes / total) * 100 : 0;
  };

  const renderProposalsTab = () => (
    <ScrollView style={styles.tabContent}>
      {proposals.map((proposal) => {
        const statusInfo = getStatusInfo(proposal.status);
        return (
          <Card 
            key={proposal.id} 
            containerStyle={styles.card}
            onPress={() => setSelectedProposal(proposal)}
          >
            <View style={styles.proposalHeader}>
              <Text style={styles.proposalTitle}>{proposal.title}</Text>
              <Badge
                value={statusInfo.text}
                badgeStyle={[
                  styles.statusBadge,
                  { backgroundColor: statusInfo.color }
                ]}
                textStyle={styles.statusBadgeText}
              />
            </View>
            
            <Text style={styles.proposalDescription} numberOfLines={2}>
              {proposal.description}
            </Text>
            
            <View style={styles.voteContainer}>
              <View style={styles.voteItem}>
                <Text style={[styles.voteLabel, { color: theme.colors.success }]}>
                  For: {proposal.forVotes.toLocaleString()}
                </Text>
              </View>
              <View style={styles.voteItem}>
                <Text style={[styles.voteLabel, { color: theme.colors.error }]}>
                  Against: {proposal.againstVotes.toLocaleString()}
                </Text>
              </View>
            </View>

            {proposal.status === 'active' && (
              <View style={styles.timeContainer}>
                <Text style={styles.timeRemaining}>
                  Time remaining: {getTimeRemaining(proposal.endTime)}
                </Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill,
                      { 
                        width: `${getVotingProgress(proposal)}%`,
                        backgroundColor: theme.colors.primary 
                      }
                    ]} 
                  />
                </View>
              </View>
            )}
          </Card>
        );
      })}
      
      {proposals.length === 0 && (
        <Card containerStyle={styles.card}>
          <Text style={styles.emptyText}>No proposals found</Text>
        </Card>
      )}
    </ScrollView>
  );

  const renderCreateTab = () => (
    <ScrollView style={styles.tabContent}>
      <Card containerStyle={styles.card}>
        <Card.Title>Create New Proposal</Card.Title>
        <View style={styles.formContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Proposal Title</Text>
            <Input
              placeholder="Enter proposal title"
              value={newProposal.title}
              onChangeText={(text) => setNewProposal(prev => ({ ...prev, title: text }))}
              inputStyle={styles.input}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <Input
              placeholder="Describe your proposal in detail"
              value={newProposal.description}
              onChangeText={(text) => setNewProposal(prev => ({ ...prev, description: text }))}
              multiline
              numberOfLines={4}
              inputStyle={[styles.input, { height: 100, textAlignVertical: 'top' }]}
            />
          </View>
          
          <Button
            title="Create Proposal"
            onPress={handleCreateProposal}
            disabled={loading || !newProposal.title || !newProposal.description}
            buttonStyle={styles.primaryButton}
            titleStyle={styles.primaryButtonTitle}
          />
        </View>
      </Card>
    </ScrollView>
  );

  const renderVotingTab = () => (
    <ScrollView style={styles.tabContent}>
      <Card containerStyle={styles.card}>
        <Card.Title>Your Voting Power</Card.Title>
        <View style={styles.votingPowerContainer}>
          <Text style={styles.votingPowerValue}>
            {governanceStats.userVotingPower.toLocaleString()}
          </Text>
          <Text style={styles.votingPowerLabel}>Available Voting Power</Text>
        </View>
      </Card>

      {selectedProposal && selectedProposal.status === 'active' && (
        <Card containerStyle={styles.card}>
          <Card.Title>Cast Vote</Card.Title>
          <View style={styles.votingContainer}>
            <Text style={styles.proposalTitle}>{selectedProposal.title}</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Voting Power</Text>
              <Input
                placeholder="0"
                value={votingAmount}
                onChangeText={setVotingAmount}
                keyboardType="numeric"
                inputStyle={styles.input}
              />
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Support</Text>
              <Select
                value={voteSupport}
                onValueChange={(value: any) => setVoteSupport(value)}
                items={[
                  { label: 'For', value: 'for' },
                  { label: 'Against', value: 'against' },
                  { label: 'Abstain', value: 'abstain' },
                ]}
              />
            </View>
            
            <Button
              title="Cast Vote"
              onPress={() => handleCastVote(selectedProposal.id)}
              disabled={loading || !votingAmount}
              buttonStyle={styles.primaryButton}
              titleStyle={styles.primaryButtonTitle}
            />
          </View>
        </Card>
      )}

      <Card containerStyle={styles.card}>
        <Card.Title>Active Proposals</Card.Title>
        <View style={styles.proposalsList}>
          {proposals
            .filter(p => p.status === 'active')
            .map(proposal => (
              <ListItem
                key={proposal.id}
                containerStyle={styles.proposalItem}
                onPress={() => setSelectedProposal(proposal)}
              >
                <ListItem.Content>
                  <ListItem.Title style={styles.proposalItemTitle}>
                    {proposal.title}
                  </ListItem.Title>
                  <ListItem.Subtitle style={styles.proposalItemSubtitle}>
                    {getTimeRemaining(proposal.endTime)} remaining
                  </ListItem.Subtitle>
                </ListItem.Content>
              </ListItem>
            ))}
        </View>
      </Card>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Governance</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{governanceStats.totalProposals}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{governanceStats.activeProposals}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatPercentage(governanceStats.participationRate)}
            </Text>
            <Text style={styles.statLabel}>Participation</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Button
          title="Proposals"
          onPress={() => setActiveTab('proposals')}
          buttonStyle={[
            styles.tabButton,
            activeTab === 'proposals' ? styles.activeTabButton : styles.inactiveTabButton
          ]}
          titleStyle={[
            styles.tabButtonTitle,
            activeTab === 'proposals' ? styles.activeTabTitle : styles.inactiveTabTitle
          ]}
        />
        <Button
          title="Create"
          onPress={() => setActiveTab('create')}
          buttonStyle={[
            styles.tabButton,
            activeTab === 'create' ? styles.activeTabButton : styles.inactiveTabButton
          ]}
          titleStyle={[
            styles.tabButtonTitle,
            activeTab === 'create' ? styles.activeTabTitle : styles.inactiveTabTitle
          ]}
        />
        <Button
          title="Vote"
          onPress={() => setActiveTab('voting')}
          buttonStyle={[
            styles.tabButton,
            activeTab === 'voting' ? styles.activeTabButton : styles.inactiveTabButton
          ]}
          titleStyle={[
            styles.tabButtonTitle,
            activeTab === 'voting' ? styles.activeTabTitle : styles.inactiveTabTitle
          ]}
        />
      </View>

      {/* Content */}
      {activeTab === 'proposals' ? renderProposalsTab() : 
       activeTab === 'create' ? renderCreateTab() : 
       renderVotingTab()}

      {/* Refresh Control */}
      <RefreshControl
        refreshing={refreshing}
        onRefresh={loadGovernanceData}
        colors={[theme.colors.primary]}
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
  },
  tabButton: {
    flex: 1,
    marginHorizontal: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
  },
  activeTabButton: {
    backgroundColor: theme.colors.primary,
  },
  inactiveTabButton: {
    backgroundColor: 'transparent',
  },
  tabButtonTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeTabTitle: {
    color: theme.colors.onPrimary,
  },
  inactiveTabTitle: {
    color: theme.colors.textSecondary,
  },
  tabContent: {
    flex: 1,
  },
  card: {
    margin: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.small,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  proposalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  statusBadgeText: {
    color: theme.colors.onPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  proposalDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  voteContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  voteItem: {
    flex: 1,
  },
  voteLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeContainer: {
    marginTop: theme.spacing.sm,
  },
  timeRemaining: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  progressBar: {
    height: 4,
    backgroundColor: theme.colors.surface,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  formContainer: {
    gap: theme.spacing.md,
  },
  inputGroup: {
    gap: theme.spacing.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
  },
  primaryButtonTitle: {
    color: theme.colors.onPrimary,
    fontWeight: '600',
  },
  votingPowerContainer: {
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  votingPowerValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  votingPowerLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  votingContainer: {
    gap: theme.spacing.md,
  },
  proposalsList: {
    gap: theme.spacing.xs,
  },
  proposalItem: {
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
  },
  proposalItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  proposalItemSubtitle: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    padding: theme.spacing.lg,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default GovernanceScreen;