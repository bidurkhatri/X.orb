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
  Switch,
} from 'react-native';
import { identityService } from '../../services/identityService';

interface Credential {
  id: string;
  type: string;
  issuer: string;
  issueDate: number;
  expiryDate?: number;
  isVerified: boolean;
  isRevocable: boolean;
  data: any;
  status: 'active' | 'expired' | 'revoked';
}

interface VerificationRequest {
  id: string;
  verifierName: string;
  credentialType: string;
  requestDate: number;
  status: 'pending' | 'approved' | 'rejected';
  requiredData: string[];
}

interface ReputationScore {
  category: string;
  score: number;
  maxScore: number;
  rank: number;
  totalUsers: number;
}

interface DIDDocument {
  did: string;
  publicKeys: Array<{
    id: string;
    type: string;
    publicKeyBase64: string;
  }>;
  services: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
  created: number;
  updated: number;
}

const IdentityScreen: React.FC = () => {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [reputationScores, setReputationScores] = useState<ReputationScore[]>([]);
  const [didDocument, setDidDocument] = useState<DIDDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'credentials' | 'verify' | 'reputation' | 'settings'>('credentials');
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [credentialDetailModalVisible, setCredentialDetailModalVisible] = useState(false);
  const [requestCredentialModalVisible, setRequestCredentialModalVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [requestedCredentialType, setRequestedCredentialType] = useState('');
  const [autoShareEnabled, setAutoShareEnabled] = useState(false);
  const [privacyLevel, setPrivacyLevel] = useState<'public' | 'private' | 'selective'>('selective');

  const credentialTypes = [
    'Email Verification',
    'Phone Number',
    'Government ID',
    'Educational Degree',
    'Professional License',
    'Employment Verification',
    'Bank Account',
    'Cryptocurrency Wallet',
    'Social Media Profile',
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [credentialsData, requestsData, reputationData, didData] = await Promise.all([
        identityService.getUserCredentials(),
        identityService.getVerificationRequests(),
        identityService.getReputationScores(),
        identityService.getDIDDocument()
      ]);
      
      setCredentials(credentialsData);
      setVerificationRequests(requestsData);
      setReputationScores(reputationData);
      setDidDocument(didData);
    } catch (error) {
      console.error('Error loading identity data:', error);
      Alert.alert('Error', 'Failed to load identity data');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCredential = async () => {
    if (!requestedCredentialType) {
      Alert.alert('Error', 'Please select a credential type');
      return;
    }

    try {
      const result = await identityService.requestCredential(requestedCredentialType);
      
      if (result.success) {
        Alert.alert('Success', 'Credential request sent successfully!');
        setRequestCredentialModalVisible(false);
        setRequestedCredentialType('');
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Request failed');
      }
    } catch (error) {
      console.error('Request error:', error);
      Alert.alert('Error', 'Failed to request credential');
    }
  };

  const handleShareCredential = async (credential: Credential) => {
    try {
      const result = await identityService.shareCredential(credential.id);
      
      if (result.success) {
        Alert.alert('Success', 'Credential shared successfully!');
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Sharing failed');
      }
    } catch (error) {
      console.error('Sharing error:', error);
      Alert.alert('Error', 'Failed to share credential');
    }
  };

  const handleRevokeCredential = async (credential: Credential) => {
    Alert.alert(
      'Revoke Credential',
      'Are you sure you want to revoke this credential? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await identityService.revokeCredential(credential.id);
              
              if (result.success) {
                Alert.alert('Success', 'Credential revoked successfully!');
                loadData();
              } else {
                Alert.alert('Error', result.error || 'Revocation failed');
              }
            } catch (error) {
              console.error('Revocation error:', error);
              Alert.alert('Error', 'Failed to revoke credential');
            }
          }
        }
      ]
    );
  };

  const handleApproveRequest = async (request: VerificationRequest) => {
    try {
      const result = await identityService.approveVerificationRequest(request.id);
      
      if (result.success) {
        Alert.alert('Success', 'Verification request approved!');
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Approval failed');
      }
    } catch (error) {
      console.error('Approval error:', error);
      Alert.alert('Error', 'Failed to approve request');
    }
  };

  const handleRejectRequest = async (request: VerificationRequest) => {
    try {
      const result = await identityService.rejectVerificationRequest(request.id);
      
      if (result.success) {
        Alert.alert('Success', 'Verification request rejected!');
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Rejection failed');
      }
    } catch (error) {
      console.error('Rejection error:', error);
      Alert.alert('Error', 'Failed to reject request');
    }
  };

  const renderCredentialItem = ({ item }: { item: Credential }) => (
    <TouchableOpacity
      style={styles.credentialItem}
      onPress={() => {
        setSelectedCredential(item);
        setCredentialDetailModalVisible(true);
      }}
    >
      <View style={styles.credentialHeader}>
        <View style={styles.credentialIcon}>
          <Text style={styles.credentialIconText}>
            {getCredentialIcon(item.type)}
          </Text>
        </View>
        <View style={styles.credentialInfo}>
          <Text style={styles.credentialType}>{item.type}</Text>
          <Text style={styles.credentialIssuer}>Issued by {item.issuer}</Text>
        </View>
        <View style={styles.credentialStatus}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) }
          ]}>
            <Text style={styles.statusText}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
          {item.isVerified && (
            <Text style={styles.verifiedIcon}>✅</Text>
          )}
        </View>
      </View>
      
      <View style={styles.credentialMeta}>
        <Text style={styles.credentialDate}>
          Issued: {new Date(item.issueDate).toLocaleDateString()}
        </Text>
        {item.expiryDate && (
          <Text style={styles.credentialExpiry}>
            Expires: {new Date(item.expiryDate).toLocaleDateString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderVerificationRequest = ({ item }: { item: VerificationRequest }) => (
    <View style={styles.requestItem}>
      <View style={styles.requestHeader}>
        <Text style={styles.requestVerifier}>{item.verifierName}</Text>
        <View style={[
          styles.requestStatus,
          { backgroundColor: getRequestStatusColor(item.status) }
        ]}>
          <Text style={styles.requestStatusText}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>
      
      <Text style={styles.requestType}>Requesting: {item.credentialType}</Text>
      <Text style={styles.requestDate}>
        {new Date(item.requestDate).toLocaleDateString()}
      </Text>
      
      {item.status === 'pending' && (
        <View style={styles.requestActions}>
          <TouchableOpacity
            style={styles.approveButton}
            onPress={() => handleApproveRequest(item)}
          >
            <Text style={styles.approveButtonText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => handleRejectRequest(item)}
          >
            <Text style={styles.rejectButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderReputationItem = ({ item }: { item: ReputationScore }) => {
    const percentage = (item.score / item.maxScore) * 100;
    
    return (
      <View style={styles.reputationItem}>
        <View style={styles.reputationHeader}>
          <Text style={styles.reputationCategory}>{item.category}</Text>
          <Text style={styles.reputationRank}>
            #{item.rank} of {item.totalUsers}
          </Text>
        </View>
        
        <View style={styles.reputationScoreContainer}>
          <View style={styles.reputationBar}>
            <View 
              style={[
                styles.reputationBarFill,
                { width: `${percentage}%` }
              ]} 
            />
          </View>
          <Text style={styles.reputationScore}>
            {item.score}/{item.maxScore}
          </Text>
        </View>
      </View>
    );
  };

  const getCredentialIcon = (type: string): string => {
    const icons: { [key: string]: string } = {
      'Email Verification': '📧',
      'Phone Number': '📱',
      'Government ID': '🆔',
      'Educational Degree': '🎓',
      'Professional License': '🏆',
      'Employment Verification': '💼',
      'Bank Account': '🏦',
      'Cryptocurrency Wallet': '💰',
      'Social Media Profile': '🌐',
    };
    return icons[type] || '📄';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return '#10B981';
      case 'expired': return '#F59E0B';
      case 'revoked': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getRequestStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
      default: return '#6B7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Loading identity data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Digital Identity</Text>
        {didDocument && (
          <Text style={styles.didText}>DID: {didDocument.did}</Text>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'credentials' && styles.activeTab]}
          onPress={() => setActiveTab('credentials')}
        >
          <Text style={[styles.tabText, activeTab === 'credentials' && styles.activeTabText]}>
            Credentials
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'verify' && styles.activeTab]}
          onPress={() => setActiveTab('verify')}
        >
          <Text style={[styles.tabText, activeTab === 'verify' && styles.activeTabText]}>
            Verify
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reputation' && styles.activeTab]}
          onPress={() => setActiveTab('reputation')}
        >
          <Text style={[styles.tabText, activeTab === 'reputation' && styles.activeTabText]}>
            Reputation
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'credentials' && (
          <View style={styles.credentialsContainer}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Credentials</Text>
              <TouchableOpacity
                style={styles.requestButton}
                onPress={() => setRequestCredentialModalVisible(true)}
              >
                <Text style={styles.requestButtonText}>Request New</Text>
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={credentials}
              renderItem={renderCredentialItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        {activeTab === 'verify' && (
          <View style={styles.verifyContainer}>
            <Text style={styles.sectionTitle}>Verification Requests</Text>
            <Text style={styles.description}>
              Review and respond to credential verification requests from trusted parties.
            </Text>
            
            <FlatList
              data={verificationRequests}
              renderItem={renderVerificationRequest}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
            
            {verificationRequests.filter(r => r.status === 'pending').length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No pending requests</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'reputation' && (
          <View style={styles.reputationContainer}>
            <Text style={styles.sectionTitle}>Reputation Scores</Text>
            <Text style={styles.description}>
              Your reputation across different categories based on verified credentials and peer ratings.
            </Text>
            
            <FlatList
              data={reputationScores}
              renderItem={renderReputationItem}
              keyExtractor={(item) => item.category}
              scrollEnabled={false}
            />
          </View>
        )}

        {activeTab === 'settings' && (
          <View style={styles.settingsContainer}>
            <Text style={styles.sectionTitle}>Privacy Settings</Text>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Auto-share Credentials</Text>
              <Switch
                value={autoShareEnabled}
                onValueChange={setAutoShareEnabled}
                trackColor={{ false: '#E5E7EB', true: '#8B5CF6' }}
                thumbColor={autoShareEnabled ? '#FFFFFF' : '#F3F4F6'}
              />
            </View>
            
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Privacy Level</Text>
              <View style={styles.privacyOptions}>
                {(['public', 'private', 'selective'] as const).map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.privacyOption,
                      privacyLevel === level && styles.selectedPrivacyOption
                    ]}
                    onPress={() => setPrivacyLevel(level)}
                  >
                    <Text style={[
                      styles.privacyOptionText,
                      privacyLevel === level && styles.selectedPrivacyOptionText
                    ]}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.shareAllButton}
              onPress={() => setShareModalVisible(true)}
            >
              <Text style={styles.shareAllButtonText}>Share All Credentials</Text>
            </TouchableOpacity>
            
            <View style={styles.didSection}>
              <Text style={styles.sectionTitle}>DID Document</Text>
              {didDocument && (
                <View style={styles.didInfo}>
                  <Text style={styles.didLabel}>DID</Text>
                  <Text style={styles.didValue}>{didDocument.did}</Text>
                  <Text style={styles.didLabel}>Public Keys</Text>
                  <Text style={styles.didValue}>
                    {didDocument.publicKeys.length} key(s)
                  </Text>
                  <Text style={styles.didLabel}>Services</Text>
                  <Text style={styles.didValue}>
                    {didDocument.services.length} service(s)
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Credential Detail Modal */}
      <Modal visible={credentialDetailModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedCredential && (
              <>
                <Text style={styles.modalTitle}>{selectedCredential.type}</Text>
                <Text style={styles.modalIssuer}>Issued by {selectedCredential.issuer}</Text>
                
                <View style={styles.modalStatus}>
                  <View style={[
                    styles.modalStatusBadge,
                    { backgroundColor: getStatusColor(selectedCredential.status) }
                  ]}>
                    <Text style={styles.modalStatusText}>
                      {selectedCredential.status.charAt(0).toUpperCase() + selectedCredential.status.slice(1)}
                    </Text>
                  </View>
                  {selectedCredential.isVerified && (
                    <Text style={styles.verifiedBadge}>✅ Verified</Text>
                  )}
                </View>
                
                <View style={styles.modalInfo}>
                  <View style={styles.modalInfoItem}>
                    <Text style={styles.modalInfoLabel}>Issue Date</Text>
                    <Text style={styles.modalInfoValue}>
                      {new Date(selectedCredential.issueDate).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  {selectedCredential.expiryDate && (
                    <View style={styles.modalInfoItem}>
                      <Text style={styles.modalInfoLabel}>Expiry Date</Text>
                      <Text style={styles.modalInfoValue}>
                        {new Date(selectedCredential.expiryDate).toLocaleDateString()}
                      </Text>
                    </View>
                  )}
                  
                  <View style={styles.modalInfoItem}>
                    <Text style={styles.modalInfoLabel}>Credential ID</Text>
                    <Text style={styles.modalInfoValue} numberOfLines={2}>
                      {selectedCredential.id}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={() => handleShareCredential(selectedCredential)}
                  >
                    <Text style={styles.shareButtonText}>Share</Text>
                  </TouchableOpacity>
                  
                  {selectedCredential.isRevocable && (
                    <TouchableOpacity
                      style={styles.revokeButton}
                      onPress={() => handleRevokeCredential(selectedCredential)}
                    >
                      <Text style={styles.revokeButtonText}>Revoke</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                <TouchableOpacity
                  style={styles.closeModalButton}
                  onPress={() => setCredentialDetailModalVisible(false)}
                >
                  <Text style={styles.closeModalButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Request Credential Modal */}
      <Modal visible={requestCredentialModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request New Credential</Text>
            <Text style={styles.modalDescription}>
              Select the type of credential you would like to request from a trusted issuer.
            </Text>
            
            <FlatList
              data={credentialTypes}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.credentialTypeItem}
                  onPress={() => setRequestedCredentialType(item)}
                >
                  <Text style={styles.credentialTypeText}>{item}</Text>
                  <View style={[
                    styles.radioButton,
                    requestedCredentialType === item && styles.radioButtonSelected
                  ]}>
                    {requestedCredentialType === item && (
                      <View style={styles.radioButtonInner} />
                    )}
                  </View>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setRequestCredentialModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.requestButton}
                onPress={handleRequestCredential}
              >
                <Text style={styles.requestButtonText}>Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Share All Modal */}
      <Modal visible={shareModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Share All Credentials</Text>
            <Text style={styles.modalDescription}>
              Generate a shareable link to your verified credentials.
            </Text>
            
            <View style={styles.sharePreview}>
              <Text style={styles.sharePreviewText}>
                This will create a secure link containing {credentials.length} verified credentials
              </Text>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShareModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.generateButton}
                onPress={() => {
                  // Generate share link logic
                  setShareModalVisible(false);
                }}
              >
                <Text style={styles.generateButtonText}>Generate Link</Text>
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
  didText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
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
    fontSize: 12,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  credentialsContainer: {
    marginBottom: 20,
  },
  verifyContainer: {
    marginBottom: 20,
  },
  reputationContainer: {
    marginBottom: 20,
  },
  settingsContainer: {
    marginBottom: 20,
  },
  requestButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  requestButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  credentialItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  credentialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  credentialIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  credentialIconText: {
    fontSize: 18,
  },
  credentialInfo: {
    flex: 1,
  },
  credentialType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  credentialIssuer: {
    fontSize: 12,
    color: '#6B7280',
  },
  credentialStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  verifiedIcon: {
    fontSize: 16,
  },
  credentialMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  credentialDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  credentialExpiry: {
    fontSize: 12,
    color: '#6B7280',
  },
  requestItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestVerifier: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  requestStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  requestStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  requestType: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  requestDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  approveButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flex: 1,
    alignItems: 'center',
  },
  approveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flex: 1,
    alignItems: 'center',
  },
  rejectButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  reputationItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reputationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reputationCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  reputationRank: {
    fontSize: 12,
    color: '#6B7280',
  },
  reputationScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reputationBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginRight: 12,
  },
  reputationBarFill: {
    height: 8,
    backgroundColor: '#8B5CF6',
    borderRadius: 4,
  },
  reputationScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  settingItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  privacyOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  privacyOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  selectedPrivacyOption: {
    backgroundColor: '#8B5CF6',
  },
  privacyOptionText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  selectedPrivacyOptionText: {
    color: '#FFFFFF',
  },
  shareAllButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  shareAllButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  didSection: {
    marginTop: 24,
  },
  didInfo: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
  },
  didLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 4,
  },
  didValue: {
    fontSize: 14,
    color: '#1F2937',
    fontFamily: 'monospace',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
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
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  modalIssuer: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  modalStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 12,
  },
  modalStatusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  verifiedBadge: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  modalInfo: {
    marginBottom: 24,
  },
  modalInfoItem: {
    marginBottom: 12,
  },
  modalInfoLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  modalInfoValue: {
    fontSize: 14,
    color: '#1F2937',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  shareButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  revokeButton: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    alignItems: 'center',
  },
  revokeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  closeModalButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  modalDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  credentialTypeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  },
  credentialTypeText: {
    fontSize: 16,
    color: '#1F2937',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#8B5CF6',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8B5CF6',
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
  generateButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    padding: 16,
    flex: 1,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sharePreview: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  sharePreviewText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default IdentityScreen;