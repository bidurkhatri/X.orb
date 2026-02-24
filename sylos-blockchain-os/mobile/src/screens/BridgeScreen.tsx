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
import { bridgeService } from '../../services/bridgeService';

interface Network {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  isLayer1: boolean;
  isLayer2: boolean;
  color: string;
}

interface BridgeTransaction {
  id: string;
  fromNetwork: string;
  toNetwork: string;
  token: string;
  amount: string;
  status: 'pending' | 'confirmed' | 'failed' | 'completed';
  timestamp: number;
  txHash: string;
  estimatedTime: number;
}

interface Token {
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  isNative: boolean;
}

const BridgeScreen: React.FC = () => {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [transactions, setTransactions] = useState<BridgeTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'bridge' | 'history' | 'assets'>('bridge');
  const [fromNetwork, setFromNetwork] = useState<Network | null>(null);
  const [toNetwork, setToNetwork] = useState<Network | null>(null);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [amount, setAmount] = useState('');
  const [bridgeFee, setBridgeFee] = useState('0.00');
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [isSwapping, setIsSwapping] = useState(false);
  const [networkModalVisible, setNetworkModalVisible] = useState<'from' | 'to' | null>(null);
  const [tokenModalVisible, setTokenModalVisible] = useState(false);
  const [bridgeModalVisible, setBridgeModalVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [networksData, tokensData, transactionsData] = await Promise.all([
        bridgeService.getSupportedNetworks(),
        bridgeService.getUserTokens(),
        bridgeService.getBridgeHistory()
      ]);
      
      setNetworks(networksData);
      setTokens(tokensData);
      setTransactions(transactionsData);
      
      // Set default networks
      if (networksData.length >= 2) {
        setFromNetwork(networksData[0]);
        setToNetwork(networksData[1]);
      }
    } catch (error) {
      console.error('Error loading bridge data:', error);
      Alert.alert('Error', 'Failed to load bridge data');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateFee = async () => {
    if (!fromNetwork || !toNetwork || !selectedToken || !amount) return;

    try {
      const { fee, estimatedTime } = await bridgeService.calculateBridgeFee(
        fromNetwork.id,
        toNetwork.id,
        selectedToken.symbol,
        amount
      );
      
      setBridgeFee(fee);
      setEstimatedTime(estimatedTime);
    } catch (error) {
      console.error('Error calculating fee:', error);
    }
  };

  useEffect(() => {
    handleCalculateFee();
  }, [fromNetwork, toNetwork, selectedToken, amount]);

  const handleBridge = async () => {
    if (!fromNetwork || !toNetwork || !selectedToken || !amount) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (fromNetwork.id === toNetwork.id) {
      Alert.alert('Error', 'Please select different networks');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    const selectedTokenBalance = parseFloat(selectedToken.balance);
    if (amountNum > selectedTokenBalance) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    setIsSwapping(true);
    try {
      const result = await bridgeService.initiateBridge(
        fromNetwork.id,
        toNetwork.id,
        selectedToken.symbol,
        amount
      );
      
      if (result.success) {
        Alert.alert(
          'Bridge Initiated',
          'Your bridge transaction has been initiated. You will be notified when it completes.',
          [{ text: 'OK', onPress: () => {
            setBridgeModalVisible(false);
            setAmount('');
            loadData();
          }}]
        );
      } else {
        Alert.alert('Error', result.error || 'Bridge failed');
      }
    } catch (error) {
      console.error('Bridge error:', error);
      Alert.alert('Error', 'Failed to initiate bridge');
    } finally {
      setIsSwapping(false);
    }
  };

  const swapNetworks = () => {
    if (!fromNetwork || !toNetwork) return;
    const temp = fromNetwork;
    setFromNetwork(toNetwork);
    setTempNetwork(temp);
  };

  const getTokenBalance = (symbol: string): string => {
    const token = tokens.find(t => t.symbol === symbol);
    return token ? token.balance : '0.00';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'confirmed': return '#3B82F6';
      case 'completed': return '#10B981';
      case 'failed': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'confirmed': return 'Confirmed';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return 'Unknown';
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const renderNetworkItem = ({ item, onSelect }: { item: Network; onSelect: (network: Network) => void }) => (
    <TouchableOpacity
      style={styles.networkItem}
      onPress={() => onSelect(item)}
    >
      <View style={styles.networkIcon}>
        <Text style={styles.networkIconText}>{item.icon}</Text>
      </View>
      <View style={styles.networkInfo}>
        <Text style={styles.networkName}>{item.name}</Text>
        <View style={styles.networkTypeContainer}>
          <View style={[
            styles.networkTypeBadge,
            { backgroundColor: item.color }
          ]}>
            <Text style={styles.networkTypeText}>
              {item.isLayer1 ? 'L1' : item.isLayer2 ? 'L2' : 'External'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderTokenItem = ({ item }: { item: Token }) => (
    <TouchableOpacity
      style={styles.tokenItem}
      onPress={() => {
        setSelectedToken(item);
        setTokenModalVisible(false);
      }}
    >
      <View style={styles.tokenIcon}>
        <Text style={styles.tokenSymbol}>
          {item.symbol.substring(0, 2).toUpperCase()}
        </Text>
      </View>
      <View style={styles.tokenInfo}>
        <Text style={styles.tokenName}>{item.name}</Text>
        <Text style={styles.tokenBalance}>{item.balance} {item.symbol}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderTransactionItem = ({ item }: { item: BridgeTransaction }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionHeader}>
        <Text style={styles.transactionRoute}>
          {item.fromNetwork} → {item.toNetwork}
        </Text>
        <View style={[
          styles.transactionStatus,
          { backgroundColor: getStatusColor(item.status) }
        ]}>
          <Text style={styles.transactionStatusText}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>
      
      <Text style={styles.transactionDetails}>
        {item.amount} {item.token}
      </Text>
      
      <View style={styles.transactionMeta}>
        <Text style={styles.transactionTime}>
          {new Date(item.timestamp).toLocaleDateString()}
        </Text>
        {item.estimatedTime > 0 && (
          <Text style={styles.transactionETA}>
            ETA: {formatTime(item.estimatedTime)}
          </Text>
        )}
      </View>
      
      {item.txHash && (
        <TouchableOpacity style={styles.viewTxButton}>
          <Text style={styles.viewTxText}>View Transaction</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Loading bridge data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Cross-Chain Bridge</Text>
        <Text style={styles.subtitle}>
          Transfer assets between different networks
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bridge' && styles.activeTab]}
          onPress={() => setActiveTab('bridge')}
        >
          <Text style={[styles.tabText, activeTab === 'bridge' && styles.activeTabText]}>
            Bridge
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            History
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'assets' && styles.activeTab]}
          onPress={() => setActiveTab('assets')}
        >
          <Text style={[styles.tabText, activeTab === 'assets' && styles.activeTabText]}>
            Assets
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'bridge' && (
          <View style={styles.bridgeContainer}>
            {/* From Network */}
            <View style={styles.networkSection}>
              <Text style={styles.sectionLabel}>From</Text>
              <TouchableOpacity
                style={styles.networkSelector}
                onPress={() => setNetworkModalVisible('from')}
              >
                {fromNetwork ? (
                  <View style={styles.selectedNetwork}>
                    <View style={styles.selectedNetworkIcon}>
                      <Text style={styles.selectedNetworkIconText}>
                        {fromNetwork.icon}
                      </Text>
                    </View>
                    <Text style={styles.selectedNetworkName}>{fromNetwork.name}</Text>
                  </View>
                ) : (
                  <Text style={styles.selectorPlaceholder}>Select network</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Swap Button */}
            <TouchableOpacity style={styles.swapButton} onPress={swapNetworks}>
              <Text style={styles.swapButtonText}>⇄</Text>
            </TouchableOpacity>

            {/* To Network */}
            <View style={styles.networkSection}>
              <Text style={styles.sectionLabel}>To</Text>
              <TouchableOpacity
                style={styles.networkSelector}
                onPress={() => setNetworkModalVisible('to')}
              >
                {toNetwork ? (
                  <View style={styles.selectedNetwork}>
                    <View style={styles.selectedNetworkIcon}>
                      <Text style={styles.selectedNetworkIconText}>
                        {toNetwork.icon}
                      </Text>
                    </View>
                    <Text style={styles.selectedNetworkName}>{toNetwork.name}</Text>
                  </View>
                ) : (
                  <Text style={styles.selectorPlaceholder}>Select network</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Token Selection */}
            <View style={styles.tokenSection}>
              <Text style={styles.sectionLabel}>Token</Text>
              <TouchableOpacity
                style={styles.tokenSelector}
                onPress={() => setTokenModalVisible(true)}
              >
                {selectedToken ? (
                  <View style={styles.selectedToken}>
                    <View style={styles.selectedTokenIcon}>
                      <Text style={styles.selectedTokenSymbol}>
                        {selectedToken.symbol.substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.selectedTokenName}>{selectedToken.name}</Text>
                      <Text style={styles.selectedTokenBalance}>
                        Balance: {selectedToken.balance}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.selectorPlaceholder}>Select token</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Amount Input */}
            <View style={styles.amountSection}>
              <Text style={styles.sectionLabel}>Amount</Text>
              <View style={styles.amountInputContainer}>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0.00"
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />
                {selectedToken && (
                  <TouchableOpacity
                    style={styles.maxButton}
                    onPress={() => setAmount(selectedToken.balance)}
                  >
                    <Text style={styles.maxButtonText}>MAX</Text>
                  </TouchableOpacity>
                )}
              </View>
              {selectedToken && (
                <Text style={styles.usdValue}>
                  ≈ ${(parseFloat(amount) * 1).toFixed(2)} USD
                </Text>
              )}
            </View>

            {/* Bridge Info */}
            {bridgeFee !== '0.00' && (
              <View style={styles.bridgeInfo}>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Bridge Fee</Text>
                  <Text style={styles.infoValue}>{bridgeFee} {selectedToken?.symbol}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>Estimated Time</Text>
                  <Text style={styles.infoValue}>{formatTime(estimatedTime)}</Text>
                </View>
                <View style={styles.infoItem}>
                  <Text style={styles.infoLabel}>You Will Receive</Text>
                  <Text style={styles.infoValue}>
                    {amount && selectedToken ? 
                      (parseFloat(amount) - parseFloat(bridgeFee)).toFixed(4) : '0.00'
                    } {selectedToken?.symbol}
                  </Text>
                </View>
              </View>
            )}

            {/* Bridge Button */}
            <TouchableOpacity
              style={[
                styles.bridgeButton,
                (!fromNetwork || !toNetwork || !selectedToken || !amount || isSwapping) &&
                styles.bridgeButtonDisabled
              ]}
              onPress={() => setBridgeModalVisible(true)}
              disabled={!fromNetwork || !toNetwork || !selectedToken || !amount || isSwapping}
            >
              {isSwapping ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.bridgeButtonText}>Bridge Assets</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'history' && (
          <View style={styles.historyContainer}>
            <Text style={styles.sectionTitle}>Bridge History</Text>
            
            {transactions.length > 0 ? (
              <FlatList
                data={transactions}
                renderItem={renderTransactionItem}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No bridge transactions</Text>
                <Text style={styles.emptyStateSubtext}>
                  Your bridge history will appear here
                </Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'assets' && (
          <View style={styles.assetsContainer}>
            <Text style={styles.sectionTitle}>Your Assets</Text>
            <Text style={styles.description}>
              Manage your tokens across all supported networks
            </Text>
            
            <FlatList
              data={tokens}
              renderItem={renderTokenItem}
              keyExtractor={(item) => item.symbol}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>

      {/* Network Selection Modal */}
      <Modal visible={networkModalVisible !== null} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Select {networkModalVisible === 'from' ? 'Source' : 'Destination'} Network
            </Text>
            
            <FlatList
              data={networks}
              renderItem={({ item }) => renderNetworkItem({
                item,
                onSelect: (network) => {
                  if (networkModalVisible === 'from') {
                    setFromNetwork(network);
                  } else {
                    setToNetwork(network);
                  }
                  setNetworkModalVisible(null);
                }
              })}
              keyExtractor={(item) => item.id}
            />
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setNetworkModalVisible(null)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Token Selection Modal */}
      <Modal visible={tokenModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Token</Text>
            
            <FlatList
              data={tokens}
              renderItem={renderTokenItem}
              keyExtractor={(item) => item.symbol}
            />
            
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setTokenModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bridge Confirmation Modal */}
      <Modal visible={bridgeModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Bridge</Text>
            
            <View style={styles.bridgeSummary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>From</Text>
                <Text style={styles.summaryValue}>
                  {fromNetwork?.name}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>To</Text>
                <Text style={styles.summaryValue}>
                  {toNetwork?.name}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Token</Text>
                <Text style={styles.summaryValue}>
                  {selectedToken?.symbol}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryValue}>
                  {amount} {selectedToken?.symbol}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Fee</Text>
                <Text style={styles.summaryValue}>
                  {bridgeFee} {selectedToken?.symbol}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>You Will Receive</Text>
                <Text style={styles.summaryValue}>
                  {amount && selectedToken ? 
                    (parseFloat(amount) - parseFloat(bridgeFee)).toFixed(4) : '0.00'
                  } {selectedToken?.symbol}
                </Text>
              </View>
            </View>
            
            <Text style={styles.modalWarning}>
              ⚠️ Make sure the destination network is correct. Cross-chain transfers cannot be reversed.
            </Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setBridgeModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleBridge}
                disabled={isSwapping}
              >
                {isSwapping ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm Bridge</Text>
                )}
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
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
    borderBottomColor: '#8B5CF6',
  },
  tabText: {
    fontSize: 14,
    color: '#6B7280',
  },
  activeTabText: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  bridgeContainer: {
    marginBottom: 20,
  },
  networkSection: {
    marginBottom: 16,
  },
  networkSelector: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
  },
  selectedNetwork: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedNetworkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectedNetworkIconText: {
    fontSize: 18,
  },
  selectedNetworkName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  swapButton: {
    position: 'absolute',
    right: 20,
    top: '50%',
    transform: [{ translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  swapButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  tokenSection: {
    marginBottom: 20,
  },
  tokenSelector: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
  },
  selectedToken: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedTokenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  selectedTokenSymbol: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectedTokenName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  selectedTokenBalance: {
    fontSize: 12,
    color: '#6B7280',
  },
  amountSection: {
    marginBottom: 20,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  maxButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  maxButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  usdValue: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'right',
  },
  selectorPlaceholder: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  bridgeInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  bridgeButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  bridgeButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  bridgeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  historyContainer: {
    marginBottom: 20,
  },
  assetsContainer: {
    marginBottom: 20,
  },
  transactionItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  transactionRoute: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  transactionStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  transactionStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  transactionDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  transactionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  transactionTime: {
    fontSize: 12,
    color: '#6B7280',
  },
  transactionETA: {
    fontSize: 12,
    color: '#6B7280',
  },
  viewTxButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  viewTxText: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '500',
  },
  networkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  networkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  networkIconText: {
    fontSize: 18,
  },
  networkInfo: {
    flex: 1,
  },
  networkName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  networkTypeContainer: {
    flexDirection: 'row',
  },
  networkTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  networkTypeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  tokenItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tokenIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  tokenSymbol: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tokenInfo: {
    flex: 1,
  },
  tokenName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  tokenBalance: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
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
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  bridgeSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalWarning: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    fontSize: 14,
    color: '#92400E',
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
    backgroundColor: '#8B5CF6',
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

export default BridgeScreen;