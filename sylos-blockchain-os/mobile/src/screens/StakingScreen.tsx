import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  FlatList,
} from 'react-native';
import { stakingService } from '../../services/stakingService';

interface Validator {
  id: string;
  name: string;
  apr: number;
  totalStaked: string;
  minStake: string;
  commission: number;
  status: 'active' | 'inactive';
  isLiquidStaking: boolean;
}

interface StakingPosition {
  validatorId: string;
  validatorName: string;
  stakedAmount: string;
  rewards: string;
  apy: number;
  isLiquidStaking: boolean;
}

const StakingScreen: React.FC = () => {
  const [validators, setValidators] = useState<Validator[]>([]);
  const [userStakes, setUserStakes] = useState<StakingPosition[]>([]);
  const [totalStaked, setTotalStaked] = useState<string>('0.00');
  const [totalRewards, setTotalRewards] = useState<string>('0.00');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stake' | 'unstake' | 'liquid'>('stake');
  const [selectedValidator, setSelectedValidator] = useState<Validator | null>(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [validatorModalVisible, setValidatorModalVisible] = useState(false);
  const [claimAllModalVisible, setClaimAllModalVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load validators
      const validatorsData = await stakingService.getValidators();
      setValidators(validatorsData);

      // Load user stakes
      const stakesData = await stakingService.getUserStakingPositions();
      setUserStakes(stakesData);

      // Load totals
      const totals = await stakingService.getStakingTotals();
      setTotalStaked(totals.totalStaked);
      setTotalRewards(totals.totalRewards);
    } catch (error) {
      console.error('Error loading staking data:', error);
      Alert.alert('Error', 'Failed to load staking data');
    } finally {
      setLoading(false);
    }
  };

  const handleStake = async () => {
    if (!selectedValidator || !stakeAmount) {
      Alert.alert('Error', 'Please select a validator and enter amount');
      return;
    }

    try {
      const result = await stakingService.stakeTokens(
        selectedValidator.id,
        stakeAmount
      );
      
      if (result.success) {
        Alert.alert('Success', 'Tokens staked successfully!');
        setStakeAmount('');
        setSelectedValidator(null);
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Staking failed');
      }
    } catch (error) {
      console.error('Staking error:', error);
      Alert.alert('Error', 'Failed to stake tokens');
    }
  };

  const handleUnstake = async (position: StakingPosition) => {
    if (!unstakeAmount) {
      Alert.alert('Error', 'Please enter amount to unstake');
      return;
    }

    try {
      const result = await stakingService.unstakeTokens(
        position.validatorId,
        unstakeAmount
      );
      
      if (result.success) {
        Alert.alert('Success', 'Tokens unstaked successfully!');
        setUnstakeAmount('');
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Unstaking failed');
      }
    } catch (error) {
      console.error('Unstaking error:', error);
      Alert.alert('Error', 'Failed to unstake tokens');
    }
  };

  const handleClaimRewards = async (position: StakingPosition) => {
    try {
      const result = await stakingService.claimRewards(position.validatorId);
      
      if (result.success) {
        Alert.alert('Success', 'Rewards claimed successfully!');
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Claiming failed');
      }
    } catch (error) {
      console.error('Claiming error:', error);
      Alert.alert('Error', 'Failed to claim rewards');
    }
  };

  const handleClaimAll = async () => {
    try {
      const result = await stakingService.claimAllRewards();
      
      if (result.success) {
        Alert.alert('Success', 'All rewards claimed successfully!');
        setClaimAllModalVisible(false);
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Claiming failed');
      }
    } catch (error) {
      console.error('Claiming all error:', error);
      Alert.alert('Error', 'Failed to claim rewards');
    }
  };

  const renderValidatorItem = ({ item }: { item: Validator }) => (
    <TouchableOpacity
      style={styles.validatorItem}
      onPress={() => {
        setSelectedValidator(item);
        setValidatorModalVisible(false);
      }}
    >
      <View style={styles.validatorHeader}>
        <Text style={styles.validatorName}>{item.name}</Text>
        <View style={[
          styles.statusBadge,
          { backgroundColor: item.status === 'active' ? '#10B981' : '#EF4444' }
        ]}>
          <Text style={styles.statusText}>
            {item.status === 'active' ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
      
      <View style={styles.validatorStats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>APR</Text>
          <Text style={styles.statValue}>{item.apr}%</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Total Staked</Text>
          <Text style={styles.statValue}>{parseFloat(item.totalStaked).toFixed(2)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Commission</Text>
          <Text style={styles.statValue}>{item.commission}%</Text>
        </View>
      </View>
      
      {item.isLiquidStaking && (
        <View style={styles.liquidStakingBadge}>
          <Text style={styles.liquidStakingText}>💧 Liquid Staking</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderStakePosition = ({ item }: { item: StakingPosition }) => (
    <View style={styles.stakePosition}>
      <View style={styles.positionHeader}>
        <Text style={styles.positionName}>{item.validatorName}</Text>
        {item.isLiquidStaking && (
          <View style={styles.liquidStakingBadge}>
            <Text style={styles.liquidStakingText}>LST</Text>
          </View>
        )}
      </View>
      
      <View style={styles.positionStats}>
        <View style={styles.positionStat}>
          <Text style={styles.positionStatLabel}>Staked</Text>
          <Text style={styles.positionStatValue}>{parseFloat(item.stakedAmount).toFixed(4)}</Text>
        </View>
        <View style={styles.positionStat}>
          <Text style={styles.positionStatLabel}>Rewards</Text>
          <Text style={styles.positionStatValue}>{parseFloat(item.rewards).toFixed(4)}</Text>
        </View>
        <View style={styles.positionStat}>
          <Text style={styles.positionStatLabel}>APY</Text>
          <Text style={styles.positionStatValue}>{item.apy}%</Text>
        </View>
      </View>
      
      <View style={styles.positionActions}>
        <TouchableOpacity
          style={styles.claimButton}
          onPress={() => handleClaimRewards(item)}
        >
          <Text style={styles.claimButtonText}>Claim Rewards</Text>
        </TouchableOpacity>
        
        {activeTab === 'unstake' && (
          <TouchableOpacity
            style={styles.unstakeButton}
            onPress={() => handleUnstake(item)}
          >
            <Text style={styles.unstakeButtonText}>Unstake</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading staking data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Staking & Yield</Text>
        <View style={styles.totalsContainer}>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Total Staked</Text>
            <Text style={styles.totalValue}>{totalStaked}</Text>
          </View>
          <View style={styles.totalItem}>
            <Text style={styles.totalLabel}>Total Rewards</Text>
            <Text style={styles.totalValue}>{totalRewards}</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stake' && styles.activeTab]}
          onPress={() => setActiveTab('stake')}
        >
          <Text style={[styles.tabText, activeTab === 'stake' && styles.activeTabText]}>
            Stake
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'unstake' && styles.activeTab]}
          onPress={() => setActiveTab('unstake')}
        >
          <Text style={[styles.tabText, activeTab === 'unstake' && styles.activeTabText]}>
            Unstake
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'liquid' && styles.activeTab]}
          onPress={() => setActiveTab('liquid')}
        >
          <Text style={[styles.tabText, activeTab === 'liquid' && styles.activeTabText]}>
            Liquid Staking
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'stake' && (
          <View style={styles.stakeContainer}>
            <Text style={styles.sectionTitle}>Stake Tokens</Text>
            
            <TouchableOpacity
              style={styles.validatorSelector}
              onPress={() => setValidatorModalVisible(true)}
            >
              <Text style={styles.validatorSelectorText}>
                {selectedValidator ? selectedValidator.name : 'Select Validator'}
              </Text>
            </TouchableOpacity>
            
            <TextInput
              style={styles.amountInput}
              placeholder="Enter amount to stake"
              value={stakeAmount}
              onChangeText={setStakeAmount}
              keyboardType="numeric"
            />
            
            <TouchableOpacity style={styles.stakeButton} onPress={handleStake}>
              <Text style={styles.stakeButtonText}>Stake Tokens</Text>
            </TouchableOpacity>

            <View style={styles.validatorsList}>
              <Text style={styles.sectionTitle}>Available Validators</Text>
              <FlatList
                data={validators.filter(v => v.status === 'active')}
                renderItem={renderValidatorItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            </View>
          </View>
        )}

        {activeTab === 'unstake' && (
          <View style={styles.unstakeContainer}>
            <Text style={styles.sectionTitle}>Your Staking Positions</Text>
            
            <TouchableOpacity
              style={styles.claimAllButton}
              onPress={() => setClaimAllModalVisible(true)}
            >
              <Text style={styles.claimAllButtonText}>Claim All Rewards</Text>
            </TouchableOpacity>
            
            <FlatList
              data={userStakes}
              renderItem={renderStakePosition}
              keyExtractor={(item, index) => `${item.validatorId}-${index}`}
              scrollEnabled={false}
            />
          </View>
        )}

        {activeTab === 'liquid' && (
          <View style={styles.liquidContainer}>
            <Text style={styles.sectionTitle}>Liquid Staking Tokens</Text>
            <Text style={styles.description}>
              Earn staking rewards while maintaining liquidity with LST tokens.
            </Text>
            
            <View style={styles.lstFeature}>
              <Text style={styles.lstFeatureTitle}>💧 Instant Liquidity</Text>
              <Text style={styles.lstFeatureDesc}>
                Use your staked tokens in DeFi protocols
              </Text>
            </View>
            
            <View style={styles.lstFeature}>
              <Text style={styles.lstFeatureTitle}>⚡ Auto-Compounding</Text>
              <Text style={styles.lstFeatureDesc}>
                Rewards automatically reinvested
              </Text>
            </View>
            
            <View style={styles.lstFeature}>
              <Text style={styles.lstFeatureTitle}>🔒 No Lock Period</Text>
              <Text style={styles.lstFeatureDesc}>
                Stake and unstake anytime
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Validator Selection Modal */}
      <Modal visible={validatorModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Validator</Text>
            <FlatList
              data={validators.filter(v => v.status === 'active')}
              renderItem={renderValidatorItem}
              keyExtractor={(item) => item.id}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setValidatorModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Claim All Modal */}
      <Modal visible={claimAllModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Claim All Rewards</Text>
            <Text style={styles.modalDescription}>
              Are you sure you want to claim all rewards? This will process all pending rewards from your staking positions.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setClaimAllModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleClaimAll}
              >
                <Text style={styles.confirmButtonText}>Claim All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalItem: {
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
  },
  activeTabText: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  stakeContainer: {
    marginBottom: 20,
  },
  unstakeContainer: {
    marginBottom: 20,
  },
  liquidContainer: {
    marginBottom: 20,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  validatorSelector: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  validatorSelectorText: {
    fontSize: 16,
    color: '#374151',
  },
  amountInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  stakeButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  stakeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  validatorsList: {
    marginTop: 24,
  },
  validatorItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  validatorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  validatorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  validatorStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  liquidStakingBadge: {
    backgroundColor: '#06B6D4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  liquidStakingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  stakePosition: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  positionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  positionStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  positionStat: {
    alignItems: 'center',
  },
  positionStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  positionStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  positionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  claimButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    alignItems: 'center',
  },
  claimButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  unstakeButton: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flex: 1,
    alignItems: 'center',
  },
  unstakeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  claimAllButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  claimAllButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  lstFeature: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  lstFeatureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  lstFeatureDesc: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  closeButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    flex: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 16,
    flex: 1,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default StakingScreen;