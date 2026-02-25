/**
 * Wallet tab — shows wallet balance, address, network, and quick actions.
 */
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, RefreshControl, Clipboard, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../../src/context';

const NETWORK_LABELS: Record<string, { label: string; color: string }> = {
  'polygon-pos': { label: 'Polygon PoS', color: '#8247E5' },
  'polygon-zkevm': { label: 'Polygon zkEVM', color: '#8247E5' },
  'goerli': { label: 'Goerli Testnet', color: '#3B82F6' },
  'sepolia': { label: 'Sepolia', color: '#F59E0B' },
  'mainnet': { label: 'Ethereum', color: '#627EEA' },
};

export default function WalletScreen() {
  const { wallets, activeWallet, network, isLoading, error, refreshBalances, createWallet, importWallet } = useWallet();
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'balance' | 'create' | 'import'>('balance');

  // Create wallet form
  const [walletName, setWalletName] = useState('');
  const [walletPass, setWalletPass] = useState('');
  // Import wallet form
  const [importMnemonic, setImportMnemonic] = useState('');
  const [importName, setImportName] = useState('');
  const [importPass, setImportPass] = useState('');

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshBalances();
    setRefreshing(false);
  };

  const handleCopyAddress = () => {
    if (activeWallet?.address) {
      Clipboard.setString(activeWallet.address);
      Alert.alert('Copied', 'Wallet address copied to clipboard');
    }
  };

  const handleCreate = async () => {
    if (!walletName || !walletPass) {
      Alert.alert('Error', 'Please enter wallet name and password');
      return;
    }
    const result = await createWallet(walletName, walletPass);
    if (result) {
      setWalletName('');
      setWalletPass('');
      setTab('balance');
      Alert.alert('Success', 'Wallet created successfully');
    }
  };

  const handleImport = async () => {
    if (!importMnemonic || !importName || !importPass) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }
    const result = await importWallet(importMnemonic, importName, importPass);
    if (result) {
      setImportMnemonic('');
      setImportName('');
      setImportPass('');
      setTab('balance');
      Alert.alert('Success', 'Wallet imported successfully');
    }
  };

  const netInfo = NETWORK_LABELS[network] || { label: network, color: '#6b7280' };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0e1a" />

      <View style={s.header}>
        <Text style={s.headerTitle}>Wallet</Text>
        <View style={[s.networkBadge, { backgroundColor: netInfo.color + '20' }]}>
          <View style={[s.networkDot, { backgroundColor: netInfo.color }]} />
          <Text style={[s.networkText, { color: netInfo.color }]}>{netInfo.label}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['balance', 'create', 'import'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#818cf8" />}
      >
        {tab === 'balance' && (
          activeWallet ? (
            <>
              {/* Balance Card */}
              <View style={s.balanceCard}>
                <Text style={s.balanceLabel}>Total Balance</Text>
                <Text style={s.balanceValue}>
                  {activeWallet.balance < 0.001 ? '< 0.001' : activeWallet.balance.toFixed(4)} MATIC
                </Text>
                <TouchableOpacity onPress={handleCopyAddress} style={s.addressRow}>
                  <Text style={s.address}>
                    {activeWallet.address.slice(0, 8)}...{activeWallet.address.slice(-6)}
                  </Text>
                  <Ionicons name="copy-outline" size={14} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>

              {/* Quick Actions */}
              <View style={s.quickActions}>
                <TouchableOpacity style={s.quickBtn}>
                  <View style={[s.quickIcon, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
                    <Ionicons name="arrow-down" size={18} color="#3b82f6" />
                  </View>
                  <Text style={s.quickLabel}>Receive</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickBtn}>
                  <View style={[s.quickIcon, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                    <Ionicons name="arrow-up" size={18} color="#8b5cf6" />
                  </View>
                  <Text style={s.quickLabel}>Send</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickBtn}>
                  <View style={[s.quickIcon, { backgroundColor: 'rgba(34,197,94,0.1)' }]}>
                    <Ionicons name="swap-horizontal" size={18} color="#22c55e" />
                  </View>
                  <Text style={s.quickLabel}>Swap</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.quickBtn}>
                  <View style={[s.quickIcon, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
                    <Ionicons name="qr-code" size={18} color="#f59e0b" />
                  </View>
                  <Text style={s.quickLabel}>Scan QR</Text>
                </TouchableOpacity>
              </View>

              {/* Wallet List */}
              {wallets.length > 1 && (
                <View style={s.section}>
                  <Text style={s.sectionTitle}>Your Wallets</Text>
                  {wallets.map(w => (
                    <View key={w.id} style={s.walletRow}>
                      <View style={s.walletIcon}>
                        <Ionicons name="wallet" size={16} color="#818cf8" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.walletName}>{w.name}</Text>
                        <Text style={s.walletAddr}>{w.address.slice(0, 8)}...{w.address.slice(-4)}</Text>
                      </View>
                      <Text style={s.walletBal}>{w.balance.toFixed(4)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={s.empty}>
              <Ionicons name="wallet" size={48} color="rgba(255,255,255,0.12)" />
              <Text style={s.emptyTitle}>No Wallet</Text>
              <Text style={s.emptyText}>Create or import a wallet to get started.</Text>
            </View>
          )
        )}

        {tab === 'create' && (
          <View style={s.form}>
            <Text style={s.formTitle}>Create New Wallet</Text>
            <Text style={s.formDesc}>A new HD wallet will be generated with a secure mnemonic.</Text>
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>Wallet Name</Text>
              <View style={s.input}>
                <Ionicons name="text" size={16} color="rgba(255,255,255,0.3)" />
                <Text style={s.inputField}
                  onPress={() => { /* TextInput would go here */ }}>
                  {walletName || 'Enter wallet name...'}
                </Text>
              </View>
            </View>
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>Password</Text>
              <View style={s.input}>
                <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.3)" />
                <Text style={s.inputField}>
                  {walletPass ? '••••••••' : 'Enter password...'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[s.submitBtn, (!walletName || !walletPass) && s.submitDisabled]}
              onPress={handleCreate}
              disabled={isLoading}
            >
              <Text style={s.submitText}>Create Wallet</Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'import' && (
          <View style={s.form}>
            <Text style={s.formTitle}>Import Wallet</Text>
            <Text style={s.formDesc}>Enter your 12 or 24-word mnemonic phrase.</Text>
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>Mnemonic Phrase</Text>
              <View style={[s.input, { height: 80 }]}>
                <Text style={s.inputField}>
                  {importMnemonic || 'Enter mnemonic phrase...'}
                </Text>
              </View>
            </View>
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>Wallet Name</Text>
              <View style={s.input}>
                <Text style={s.inputField}>{importName || 'Enter name...'}</Text>
              </View>
            </View>
            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>Password</Text>
              <View style={s.input}>
                <Text style={s.inputField}>{importPass ? '••••••••' : 'Enter password...'}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[s.submitBtn, (!importMnemonic || !importName || !importPass) && s.submitDisabled]}
              onPress={handleImport}
              disabled={isLoading}
            >
              <Text style={s.submitText}>Import Wallet</Text>
            </TouchableOpacity>
          </View>
        )}

        {error && (
          <View style={s.errorBanner}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e1a' },
  header: { paddingTop: 55, paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#fff' },
  networkBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  networkDot: { width: 6, height: 6, borderRadius: 3 },
  networkText: { fontSize: 11, fontWeight: '600' },

  tabs: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  tabActive: { backgroundColor: 'rgba(129,140,248,0.1)', borderColor: 'rgba(129,140,248,0.3)' },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  tabTextActive: { color: '#818cf8' },

  scroll: { flex: 1, paddingHorizontal: 16 },

  balanceCard: {
    backgroundColor: 'rgba(129,140,248,0.06)', borderRadius: 20,
    padding: 24, alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(129,140,248,0.12)',
  },
  balanceLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  balanceValue: { fontSize: 32, fontWeight: '800', color: '#fff', marginTop: 8 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20 },
  address: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' },

  quickActions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
  quickBtn: { alignItems: 'center' },
  quickIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  quickLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600' },

  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  walletIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(129,140,248,0.1)' },
  walletName: { fontSize: 13, fontWeight: '600', color: '#fff' },
  walletAddr: { fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginTop: 1 },
  walletBal: { fontSize: 14, fontWeight: '700', color: '#818cf8' },

  form: { padding: 4 },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 6 },
  formDesc: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20, lineHeight: 19 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 6 },
  input: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  inputField: { fontSize: 14, color: 'rgba(255,255,255,0.3)', flex: 1 },
  submitBtn: { backgroundColor: '#6366f1', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  submitDisabled: { opacity: 0.4 },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.08)', padding: 12, borderRadius: 10, marginTop: 12 },
  errorText: { fontSize: 12, color: '#ef4444', flex: 1 },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.4)', marginTop: 12, marginBottom: 6 },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 20 },
});
