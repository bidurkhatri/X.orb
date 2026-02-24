import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../../src/context';
import { theme } from '../../src/theme';
import { strings } from '../../src/constants/strings';
import { Button, Card } from '../../src/components/ui';

export default function Wallet() {
  const { activeWallet, isLoading, createWallet, importWallet } = useWallet();
  const [activeTab, setActiveTab] = useState<'balances' | 'create' | 'import'>('balances');
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletPassword, setNewWalletPassword] = useState('');
  const [mnemonic, setMnemonic] = useState('');

  const handleCreateWallet = async () => {
    if (!newWalletName || !newWalletPassword) {
      Alert.alert(strings.common.error, strings.wallet.enterWalletDetails);
      return;
    }

    const result = await createWallet(newWalletName, newWalletPassword);
    if (result) {
      setNewWalletName('');
      setNewWalletPassword('');
      setActiveTab('balances');
      Alert.alert(strings.common.success, strings.wallet.walletCreated);
    } else {
      Alert.alert(strings.common.error, strings.wallet.createWalletFailed);
    }
  };

  const handleImportWallet = async () => {
    if (!mnemonic || !newWalletName || !newWalletPassword) {
      Alert.alert(strings.common.error, strings.wallet.enterImportDetails);
      return;
    }

    const result = await importWallet(mnemonic, newWalletName, newWalletPassword);
    if (result) {
      setMnemonic('');
      setNewWalletName('');
      setNewWalletPassword('');
      setActiveTab('balances');
      Alert.alert(strings.common.success, strings.wallet.walletImported);
    } else {
      Alert.alert(strings.common.error, strings.wallet.importWalletFailed);
    }
  };

  const formatBalance = (balance: number) => {
    if (balance < 0.001) return '< 0.001';
    return balance.toFixed(4);
  };

  const renderBalances = () => (
    <View style={styles.content}>
      {activeWallet ? (
        <Card>
          <View style={styles.walletInfo}>
            <Ionicons name="wallet" size={24} color={theme.colors.primary} />
            <View style={styles.walletDetails}>
              <Text style={styles.walletName}>{activeWallet.name}</Text>
              <Text style={styles.walletAddress}>
                {`${activeWallet.address.slice(0, 8)}...${activeWallet.address.slice(-6)}`}
              </Text>
            </View>
          </View>
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>MATIC Balance</Text>
            <Text style={styles.balance}>
              {formatBalance(activeWallet.balance)} MATIC
            </Text>
          </View>
        </Card>
      ) : (
        <Card>
          <Text style={styles.noWalletText}>
            {strings.wallet.noWalletMessage}
          </Text>
        </Card>
      )}
    </View>
  );

  const renderCreateWallet = () => (
    <View style={styles.content}>
      <Card>
        <Text style={styles.sectionTitle}>
          {strings.wallet.createNewWallet}
        </Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            {strings.wallet.walletName}
          </Text>
          <TextInput
            style={styles.input}
            value={newWalletName}
            onChangeText={setNewWalletName}
            placeholder={strings.wallet.enterWalletName}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            {strings.wallet.walletPassword}
          </Text>
          <TextInput
            style={styles.input}
            value={newWalletPassword}
            onChangeText={setNewWalletPassword}
            placeholder={strings.wallet.enterWalletPassword}
            secureTextEntry
          />
        </View>

        <Button
          title={strings.wallet.createWallet}
          onPress={handleCreateWallet}
          loading={isLoading}
          style={styles.button}
        />
      </Card>
    </View>
  );

  const renderImportWallet = () => (
    <View style={styles.content}>
      <Card>
        <Text style={styles.sectionTitle}>
          {strings.wallet.importExistingWallet}
        </Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            {strings.wallet.mnemonicPhrase}
          </Text>
          <TextInput
            style={[styles.input, styles.mnemonicInput]}
            value={mnemonic}
            onChangeText={setMnemonic}
            placeholder={strings.wallet.enterMnemonic}
            multiline
            numberOfLines={3}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            {strings.wallet.walletName}
          </Text>
          <TextInput
            style={styles.input}
            value={newWalletName}
            onChangeText={setNewWalletName}
            placeholder={strings.wallet.enterWalletName}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>
            {strings.wallet.walletPassword}
          </Text>
          <TextInput
            style={styles.input}
            value={newWalletPassword}
            onChangeText={setNewWalletPassword}
            placeholder={strings.wallet.enterWalletPassword}
            secureTextEntry
          />
        </View>

        <Button
          title={strings.wallet.importWallet}
          onPress={handleImportWallet}
          loading={isLoading}
          style={styles.button}
          variant="secondary"
        />
      </Card>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{strings.apps.wallet}</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'balances' && styles.activeTab
          ]}
          onPress={() => setActiveTab('balances')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'balances' && styles.activeTabText
          ]}>
            {strings.wallet.balances}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'create' && styles.activeTab
          ]}
          onPress={() => setActiveTab('create')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'create' && styles.activeTabText
          ]}>
            {strings.wallet.create}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'import' && styles.activeTab
          ]}
          onPress={() => setActiveTab('import')}
        >
          <Text style={[
            styles.tabText,
            activeTab === 'import' && styles.activeTabText
          ]}>
            {strings.wallet.import}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {activeTab === 'balances' && renderBalances()}
        {activeTab === 'create' && renderCreateWallet()}
        {activeTab === 'import' && renderImportWallet()}
      </ScrollView>
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
  headerTitle: {
    fontSize: theme.typography.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  tab: {
    flex: 1,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.primary,
  },
  tabText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
  },
  activeTabText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  walletDetails: {
    marginLeft: theme.spacing.md,
    flex: 1,
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
  balanceContainer: {
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  balance: {
    fontSize: theme.typography.fontSize.xxxl,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  noWalletText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  mnemonicInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  button: {
    marginTop: theme.spacing.lg,
  },
});

import { TouchableOpacity } from 'react-native';
