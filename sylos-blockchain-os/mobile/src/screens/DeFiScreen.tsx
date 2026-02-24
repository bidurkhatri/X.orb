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
  Avatar,
  Divider
} from '@rneui/themed';
import { useWallet } from '../../hooks/useWallet';
import { useDefiService } from '../../hooks/useDefiService';
import { theme } from '../../theme/theme';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

interface SwapQuote {
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  gasEstimate: number;
  minReceived: string;
}

interface LendingPosition {
  id: string;
  asset: string;
  balance: number;
  apy: number;
  healthFactor: number;
  isCollateral: boolean;
}

const DeFiScreen: React.FC = () => {
  const { address } = useWallet();
  const { 
    getUniswapQuote, 
    executeSwap, 
    getLendingPositions, 
    supplyToAave,
    withdrawFromAave,
    getAaveHealthFactor
  } = useDefiService();

  // State management
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('swap');

  // Swap state
  const [swapTokens, setSwapTokens] = useState({
    from: 'ETH',
    to: 'USDC',
    amount: '',
    quote: null as SwapQuote | null
  });

  // Lending state
  const [lendingAmount, setLendingAmount] = useState('');
  const [selectedAsset, setSelectedAsset] = useState('USDC');
  const [lendingPositions, setLendingPositions] = useState<LendingPosition[]>([]);
  const [healthFactor, setHealthFactor] = useState<number>(0);
  const [portfolioValue, setPortfolioValue] = useState<number>(0);

  // Data
  const availableTokens = ['ETH', 'USDC', 'DAI', 'WBTC', 'UNI', 'LINK'];
  const lendingAssets = [
    { symbol: 'USDC', apy: 4.2, collateral: true },
    { symbol: 'DAI', apy: 3.8, collateral: true },
    { symbol: 'ETH', apy: 2.1, collateral: true },
    { symbol: 'WBTC', apy: 1.8, collateral: true }
  ];

  useEffect(() => {
    if (address) {
      loadUserData();
    }
  }, [address]);

  const loadUserData = async () => {
    try {
      setRefreshing(true);
      
      // Load lending positions
      const lending = await getLendingPositions(address!);
      setLendingPositions(lending);

      // Get health factor
      const health = await getAaveHealthFactor(address!);
      setHealthFactor(health);

      // Calculate portfolio value
      const totalValue = lending.reduce((sum, pos) => sum + pos.balance, 0);
      setPortfolioValue(totalValue);

    } catch (err) {
      Alert.alert('Error', 'Failed to load DeFi data');
    } finally {
      setRefreshing(false);
    }
  };

  const getQuote = async () => {
    if (!swapTokens.amount) return;

    try {
      setLoading(true);
      const quote = await getUniswapQuote(
        swapTokens.from,
        swapTokens.to,
        swapTokens.amount
      );
      setSwapTokens(prev => ({ ...prev, quote }));
    } catch (err) {
      Alert.alert('Error', 'Failed to get quote');
    } finally {
      setLoading(false);
    }
  };

  const executeSwapAction = async () => {
    if (!swapTokens.quote) return;

    try {
      setLoading(true);
      await executeSwap(
        swapTokens.from,
        swapTokens.to,
        swapTokens.amount,
        swapTokens.quote.minReceived
      );
      await loadUserData();
      Alert.alert('Success', 'Swap completed successfully');
    } catch (err) {
      Alert.alert('Error', 'Swap failed');
    } finally {
      setLoading(false);
    }
  };

  const supplyToLending = async () => {
    if (!lendingAmount) return;

    try {
      setLoading(true);
      await supplyToAave(selectedAsset, lendingAmount);
      setLendingAmount('');
      await loadUserData();
      Alert.alert('Success', 'Tokens supplied successfully');
    } catch (err) {
      Alert.alert('Error', 'Supply failed');
    } finally {
      setLoading(false);
    }
  };

  const getHealthFactorColor = (factor: number) => {
    if (factor >= 2) return theme.colors.success;
    if (factor >= 1.5) return theme.colors.warning;
    if (factor >= 1) return theme.colors.error;
    return theme.colors.error;
  };

  const renderSwapTab = () => (
    <ScrollView style={styles.tabContent}>
      <Card containerStyle={styles.card}>
        <Card.Title>Token Swap</Card.Title>
        <View style={styles.swapContainer}>
          <View style={styles.tokenInput}>
            <Text style={styles.label}>From</Text>
            <Select
              value={swapTokens.from}
              onValueChange={(value) => setSwapTokens(prev => ({ ...prev, from: value }))}
              items={availableTokens.map(token => ({ label: token, value: token }))}
            />
            <Input
              placeholder="0.0"
              value={swapTokens.amount}
              onChangeText={(text) => setSwapTokens(prev => ({ ...prev, amount: text }))}
              keyboardType="numeric"
              inputStyle={styles.input}
            />
          </View>

          <View style={styles.swapButton}>
            <Text style={styles.swapIcon}>⇅</Text>
          </View>

          <View style={styles.tokenInput}>
            <Text style={styles.label}>To</Text>
            <Select
              value={swapTokens.to}
              onValueChange={(value) => setSwapTokens(prev => ({ ...prev, to: value }))}
              items={availableTokens.filter(token => token !== swapTokens.from).map(token => ({ label: token, value: token }))}
            />
            <View style={styles.quoteContainer}>
              {swapTokens.quote ? (
                <View>
                  <Text style={styles.quoteAmount}>
                    {formatCurrency(parseFloat(swapTokens.quote.outputAmount))} {swapTokens.to}
                  </Text>
                  <Text style={styles.priceImpact}>
                    Price Impact: {formatPercentage(swapTokens.quote.priceImpact)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.placeholder}>Enter amount to get quote</Text>
              )}
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <Button
              title="Get Quote"
              onPress={getQuote}
              disabled={loading || !swapTokens.amount}
              buttonStyle={styles.secondaryButton}
              titleStyle={styles.secondaryButtonTitle}
            />
            <Button
              title="Execute Swap"
              onPress={executeSwapAction}
              disabled={loading || !swapTokens.quote}
              buttonStyle={styles.primaryButton}
              titleStyle={styles.primaryButtonTitle}
            />
          </View>
        </View>
      </Card>
    </ScrollView>
  );

  const renderLendingTab = () => (
    <ScrollView style={styles.tabContent}>
      <Card containerStyle={styles.card}>
        <Card.Title>Lending & Borrowing</Card.Title>
        <View style={styles.lendingContainer}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Asset</Text>
            <Select
              value={selectedAsset}
              onValueChange={setSelectedAsset}
              items={lendingAssets.map(asset => ({ 
                label: `${asset.symbol} (${asset.apy}% APY)`, 
                value: asset.symbol 
              }))}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount</Text>
            <Input
              placeholder="0.0"
              value={lendingAmount}
              onChangeText={setLendingAmount}
              keyboardType="numeric"
              inputStyle={styles.input}
            />
          </View>

          <View style={styles.buttonContainer}>
            <Button
              title="Supply"
              onPress={supplyToLending}
              disabled={loading || !lendingAmount}
              buttonStyle={[styles.primaryButton, { flex: 1 }]}
              titleStyle={styles.primaryButtonTitle}
            />
            <Button
              title="Withdraw"
              onPress={() => {
                // Implement withdraw logic
              }}
              disabled={loading || !lendingAmount}
              buttonStyle={[styles.secondaryButton, { flex: 1 }]}
              titleStyle={styles.secondaryButtonTitle}
            />
          </View>
        </View>
      </Card>

      <Card containerStyle={styles.card}>
        <Card.Title>Your Positions</Card.Title>
        <View style={styles.positionsContainer}>
          {lendingPositions.map((position) => (
            <View key={position.id} style={styles.positionItem}>
              <View style={styles.positionHeader}>
                <Text style={styles.positionAsset}>{position.asset}</Text>
                <Badge
                  value={position.apy}
                  badgeStyle={styles.apyBadge}
                  textStyle={styles.apyText}
                />
              </View>
              <View style={styles.positionDetails}>
                <Text style={styles.positionBalance}>
                  {formatCurrency(position.balance)}
                </Text>
                <Text style={styles.positionHealth}>
                  Health: {position.healthFactor.toFixed(2)}
                </Text>
              </View>
            </View>
          ))}
          
          {lendingPositions.length === 0 && (
            <Text style={styles.emptyText}>No lending positions</Text>
          )}
        </View>
      </Card>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>DeFi</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatCurrency(portfolioValue)}</Text>
            <Text style={styles.statLabel}>Portfolio</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: getHealthFactorColor(healthFactor) }]}>
              {healthFactor.toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>Health</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <Button
          title="Swap"
          onPress={() => setActiveTab('swap')}
          buttonStyle={[
            styles.tabButton,
            activeTab === 'swap' ? styles.activeTabButton : styles.inactiveTabButton
          ]}
          titleStyle={[
            styles.tabButtonTitle,
            activeTab === 'swap' ? styles.activeTabTitle : styles.inactiveTabTitle
          ]}
        />
        <Button
          title="Lending"
          onPress={() => setActiveTab('lending')}
          buttonStyle={[
            styles.tabButton,
            activeTab === 'lending' ? styles.activeTabButton : styles.inactiveTabButton
          ]}
          titleStyle={[
            styles.tabButtonTitle,
            activeTab === 'lending' ? styles.activeTabTitle : styles.inactiveTabTitle
          ]}
        />
      </View>

      {/* Content */}
      {activeTab === 'swap' ? renderSwapTab() : renderLendingTab()}

      {/* Refresh Control */}
      <RefreshControl
        refreshing={refreshing}
        onRefresh={loadUserData}
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
    fontSize: 14,
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
  swapContainer: {
    gap: theme.spacing.md,
  },
  tokenInput: {
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
  swapButton: {
    alignItems: 'center',
    padding: theme.spacing.sm,
  },
  swapIcon: {
    fontSize: 20,
    color: theme.colors.textSecondary,
  },
  quoteContainer: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    minHeight: 50,
    justifyContent: 'center',
  },
  quoteAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  priceImpact: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  placeholder: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
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
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
  },
  secondaryButtonTitle: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  lendingContainer: {
    gap: theme.spacing.md,
  },
  inputGroup: {
    gap: theme.spacing.sm,
  },
  positionsContainer: {
    gap: theme.spacing.sm,
  },
  positionItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  positionAsset: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  apyBadge: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  apyText: {
    color: theme.colors.onSuccess,
    fontSize: 12,
    fontWeight: '600',
  },
  positionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  positionBalance: {
    fontSize: 14,
    color: theme.colors.text,
  },
  positionHealth: {
    fontSize: 14,
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

export default DeFiScreen;