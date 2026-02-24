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
  Image,
  Dimensions,
} from 'react-native';
import { nftService } from '../../services/nftService';

const { width } = Dimensions.get('window');

interface NFT {
  id: string;
  tokenId: string;
  name: string;
  description: string;
  image: string;
  collection: string;
  price: string;
  currency: string;
  seller: string;
  isAuction: boolean;
  auctionEndTime?: number;
  highestBid?: string;
  royalty: number;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
  isOwned: boolean;
  isForSale: boolean;
}

interface Auction {
  id: string;
  nftId: string;
  nftName: string;
  nftImage: string;
  startingPrice: string;
  currentBid: string;
  highestBidder: string;
  endTime: number;
  seller: string;
  status: 'active' | 'ended' | 'cancelled';
  bids: number;
}

const NFTMarketplaceScreen: React.FC = () => {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [userNfts, setUserNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'market' | 'auctions' | 'my-nfts' | 'create'>('market');
  const [selectedNFT, setSelectedNFT] = useState<NFT | null>(null);
  const [nftDetailModalVisible, setNftDetailModalVisible] = useState(false);
  const [createListingModalVisible, setCreateListingModalVisible] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string>('all');

  const collections = ['all', 'art', 'gaming', 'collectibles', 'utility', 'sports'];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [nftsData, auctionsData, userNftsData] = await Promise.all([
        nftService.getMarketplaceNFTs(),
        nftService.getActiveAuctions(),
        nftService.getUserNFTs()
      ]);
      
      setNfts(nftsData);
      setAuctions(auctionsData);
      setUserNfts(userNftsData);
    } catch (error) {
      console.error('Error loading NFT data:', error);
      Alert.alert('Error', 'Failed to load NFT data');
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNFT = async (nft: NFT) => {
    try {
      const result = await nftService.buyNFT(nft.id, nft.price);
      
      if (result.success) {
        Alert.alert('Success', 'NFT purchased successfully!');
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Purchase failed');
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('Error', 'Failed to purchase NFT');
    }
  };

  const handleCreateListing = async () => {
    if (!selectedNFT || !listPrice) {
      Alert.alert('Error', 'Please select NFT and enter price');
      return;
    }

    try {
      const result = await nftService.createListing(
        selectedNFT.id,
        listPrice,
        'fixed' // fixed price listing
      );
      
      if (result.success) {
        Alert.alert('Success', 'NFT listed successfully!');
        setCreateListingModalVisible(false);
        setListPrice('');
        setSelectedNFT(null);
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Listing failed');
      }
    } catch (error) {
      console.error('Listing error:', error);
      Alert.alert('Error', 'Failed to list NFT');
    }
  };

  const handlePlaceBid = async (auction: Auction) => {
    if (!bidAmount) {
      Alert.alert('Error', 'Please enter bid amount');
      return;
    }

    try {
      const result = await nftService.placeBid(auction.id, bidAmount);
      
      if (result.success) {
        Alert.alert('Success', 'Bid placed successfully!');
        setBidAmount('');
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Bid failed');
      }
    } catch (error) {
      console.error('Bid error:', error);
      Alert.alert('Error', 'Failed to place bid');
    }
  };

  const handleCancelListing = async (nft: NFT) => {
    try {
      const result = await nftService.cancelListing(nft.id);
      
      if (result.success) {
        Alert.alert('Success', 'Listing cancelled successfully!');
        loadData();
      } else {
        Alert.alert('Error', result.error || 'Cancellation failed');
      }
    } catch (error) {
      console.error('Cancellation error:', error);
      Alert.alert('Error', 'Failed to cancel listing');
    }
  };

  const renderNFTItem = ({ item }: { item: NFT }) => (
    <TouchableOpacity
      style={styles.nftItem}
      onPress={() => {
        setSelectedNFT(item);
        setNftDetailModalVisible(true);
      }}
    >
      <Image source={{ uri: item.image }} style={styles.nftImage} />
      <View style={styles.nftInfo}>
        <Text style={styles.nftName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.collectionName} numberOfLines={1}>{item.collection}</Text>
        <View style={styles.nftPriceContainer}>
          <Text style={styles.nftPrice}>{item.price} {item.currency}</Text>
          {item.isAuction && (
            <View style={styles.auctionBadge}>
              <Text style={styles.auctionBadgeText}>🏛️ Auction</Text>
            </View>
          )}
        </View>
        {item.attributes.length > 0 && (
          <View style={styles.attributesContainer}>
            {item.attributes.slice(0, 2).map((attr, index) => (
              <View key={index} style={styles.attribute}>
                <Text style={styles.attributeType} numberOfLines={1}>
                  {attr.trait_type}
                </Text>
                <Text style={styles.attributeValue} numberOfLines={1}>
                  {attr.value}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderAuctionItem = ({ item }: { item: Auction }) => {
    const timeLeft = getTimeLeft(item.endTime);
    
    return (
      <View style={styles.auctionItem}>
        <Image source={{ uri: item.nftImage }} style={styles.auctionImage} />
        <View style={styles.auctionInfo}>
          <Text style={styles.auctionName} numberOfLines={1}>{item.nftName}</Text>
          
          <View style={styles.auctionStats}>
            <View style={styles.auctionStat}>
              <Text style={styles.auctionStatLabel}>Current Bid</Text>
              <Text style={styles.auctionStatValue}>
                {item.currentBid || item.startingPrice} ETH
              </Text>
            </View>
            <View style={styles.auctionStat}>
              <Text style={styles.auctionStatLabel}>Ends In</Text>
              <Text style={styles.auctionStatValue}>{timeLeft}</Text>
            </View>
            <View style={styles.auctionStat}>
              <Text style={styles.auctionStatLabel}>Bids</Text>
              <Text style={styles.auctionStatValue}>{item.bids}</Text>
            </View>
          </View>

          <View style={styles.bidInputContainer}>
            <TextInput
              style={styles.bidInput}
              placeholder="Enter bid amount"
              value={bidAmount}
              onChangeText={setBidAmount}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={styles.bidButton}
              onPress={() => handlePlaceBid(item)}
            >
              <Text style={styles.bidButtonText}>Place Bid</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderUserNFTItem = ({ item }: { item: NFT }) => (
    <View style={styles.userNftItem}>
      <Image source={{ uri: item.image }} style={styles.userNftImage} />
      <View style={styles.userNftInfo}>
        <Text style={styles.userNftName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.userNftCollection} numberOfLines={1}>{item.collection}</Text>
        
        <View style={styles.userNftActions}>
          {item.isForSale ? (
            <TouchableOpacity
              style={styles.cancelListingButton}
              onPress={() => handleCancelListing(item)}
            >
              <Text style={styles.cancelListingButtonText}>Cancel Listing</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.sellButton}
              onPress={() => {
                setSelectedNFT(item);
                setCreateListingModalVisible(true);
              }}
            >
              <Text style={styles.sellButtonText}>Sell NFT</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  const getTimeLeft = (endTime: number): string => {
    const now = Date.now();
    const timeLeft = endTime - now;
    
    if (timeLeft <= 0) return 'Ended';
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const filteredNFTs = nfts.filter(nft => {
    const matchesSearch = nft.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         nft.collection.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCollection = selectedCollection === 'all' || 
                             nft.collection.toLowerCase() === selectedCollection.toLowerCase();
    return matchesSearch && matchesCollection;
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={styles.loadingText}>Loading marketplace...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>NFT Marketplace</Text>
        <View style={styles.collectionFilter}>
          <FlatList
            horizontal
            data={collections}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.collectionChip,
                  selectedCollection === item && styles.selectedCollectionChip
                ]}
                onPress={() => setSelectedCollection(item)}
              >
                <Text style={[
                  styles.collectionChipText,
                  selectedCollection === item && styles.selectedCollectionChipText
                ]}>
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </Text>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search NFTs and collections..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'market' && styles.activeTab]}
          onPress={() => setActiveTab('market')}
        >
          <Text style={[styles.tabText, activeTab === 'market' && styles.activeTabText]}>
            Market
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'auctions' && styles.activeTab]}
          onPress={() => setActiveTab('auctions')}
        >
          <Text style={[styles.tabText, activeTab === 'auctions' && styles.activeTabText]}>
            Auctions
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-nfts' && styles.activeTab]}
          onPress={() => setActiveTab('my-nfts')}
        >
          <Text style={[styles.tabText, activeTab === 'my-nfts' && styles.activeTabText]}>
            My NFTs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'create' && styles.activeTab]}
          onPress={() => setActiveTab('create')}
        >
          <Text style={[styles.tabText, activeTab === 'create' && styles.activeTabText]}>
            Create
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'market' && (
          <View style={styles.marketContainer}>
            <FlatList
              data={filteredNFTs}
              renderItem={renderNFTItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.nftGrid}
              scrollEnabled={false}
            />
          </View>
        )}

        {activeTab === 'auctions' && (
          <View style={styles.auctionsContainer}>
            <FlatList
              data={auctions}
              renderItem={renderAuctionItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        {activeTab === 'my-nfts' && (
          <View style={styles.myNftsContainer}>
            <FlatList
              data={userNfts}
              renderItem={renderUserNFTItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        {activeTab === 'create' && (
          <View style={styles.createContainer}>
            <Text style={styles.sectionTitle}>Create New NFT</Text>
            <Text style={styles.description}>
              Mint your own NFT and list it on the marketplace.
            </Text>
            
            <TouchableOpacity style={styles.createButton}>
              <Text style={styles.createButtonText}>Mint NFT</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.createCollectionButton}>
              <Text style={styles.createCollectionButtonText}>Create Collection</Text>
            </TouchableOpacity>
            
            <View style={styles.createFeatures}>
              <View style={styles.createFeature}>
                <Text style={styles.createFeatureTitle}>🎨 Create Art</Text>
                <Text style={styles.createFeatureDesc}>
                  Upload images, videos, or audio to create unique digital assets
                </Text>
              </View>
              
              <View style={styles.createFeature}>
                <Text style={styles.createFeatureTitle}>💎 Add Utility</Text>
                <Text style={styles.createFeatureDesc}>
                  Define special abilities, access rights, or benefits
                </Text>
              </View>
              
              <View style={styles.createFeature}>
                <Text style={styles.createFeatureTitle}>🏆 Set Royalties</Text>
                <Text style={styles.createFeatureDesc}>
                  Earn royalties from secondary sales automatically
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* NFT Detail Modal */}
      <Modal visible={nftDetailModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedNFT && (
              <>
                <Image source={{ uri: selectedNFT.image }} style={styles.modalImage} />
                <Text style={styles.modalTitle}>{selectedNFT.name}</Text>
                <Text style={styles.modalCollection}>{selectedNFT.collection}</Text>
                <Text style={styles.modalDescription}>{selectedNFT.description}</Text>
                
                <View style={styles.modalPrice}>
                  <Text style={styles.modalPriceText}>
                    {selectedNFT.price} {selectedNFT.currency}
                  </Text>
                  <Text style={styles.modalRoyalty}>
                    {selectedNFT.royalty}% royalty
                  </Text>
                </View>

                {selectedNFT.attributes.length > 0 && (
                  <View style={styles.modalAttributes}>
                    <Text style={styles.modalAttributesTitle}>Attributes</Text>
                    {selectedNFT.attributes.map((attr, index) => (
                      <View key={index} style={styles.modalAttribute}>
                        <Text style={styles.modalAttributeType}>{attr.trait_type}</Text>
                        <Text style={styles.modalAttributeValue}>{attr.value}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.buyButton}
                  onPress={() => handleBuyNFT(selectedNFT)}
                >
                  <Text style={styles.buyButtonText}>Buy Now</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.closeModalButton}
                  onPress={() => setNftDetailModalVisible(false)}
                >
                  <Text style={styles.closeModalButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Create Listing Modal */}
      <Modal visible={createListingModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>List NFT for Sale</Text>
            
            {selectedNFT && (
              <View style={styles.selectedNftPreview}>
                <Image source={{ uri: selectedNFT.image }} style={styles.selectedNftImage} />
                <Text style={styles.selectedNftName}>{selectedNFT.name}</Text>
              </View>
            )}
            
            <TextInput
              style={styles.modalInput}
              placeholder="Enter price in ETH"
              value={listPrice}
              onChangeText={setListPrice}
              keyboardType="numeric"
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => setCreateListingModalVisible(false)}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createListingButton}
                onPress={handleCreateListing}
              >
                <Text style={styles.createListingButtonText}>List NFT</Text>
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
  collectionFilter: {
    marginTop: 8,
  },
  collectionChip: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
  },
  selectedCollectionChip: {
    backgroundColor: '#8B5CF6',
  },
  collectionChipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  selectedCollectionChipText: {
    color: '#FFFFFF',
  },
  searchContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
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
  marketContainer: {
    marginBottom: 20,
  },
  nftGrid: {
    justifyContent: 'space-between',
  },
  nftItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: (width - 60) / 2,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  nftImage: {
    width: '100%',
    height: 160,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  nftInfo: {
    padding: 12,
  },
  nftName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  collectionName: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  nftPriceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nftPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  auctionBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  auctionBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '500',
  },
  attributesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  attribute: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    padding: 4,
    width: '48%',
  },
  attributeType: {
    fontSize: 10,
    color: '#6B7280',
  },
  attributeValue: {
    fontSize: 10,
    fontWeight: '600',
    color: '#1F2937',
  },
  auctionsContainer: {
    marginBottom: 20,
  },
  auctionItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  auctionImage: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  auctionInfo: {
    padding: 16,
  },
  auctionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  auctionStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  auctionStat: {
    alignItems: 'center',
  },
  auctionStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  auctionStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  bidInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  bidInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  bidButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  bidButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  myNftsContainer: {
    marginBottom: 20,
  },
  userNftItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  userNftImage: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  userNftInfo: {
    padding: 16,
  },
  userNftName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  userNftCollection: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },
  userNftActions: {
    flexDirection: 'row',
    gap: 12,
  },
  sellButton: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    alignItems: 'center',
  },
  sellButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelListingButton: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 1,
    alignItems: 'center',
  },
  cancelListingButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  createContainer: {
    marginBottom: 20,
  },
  createButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  createCollectionButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  createCollectionButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  createFeatures: {
    gap: 16,
  },
  createFeature: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  createFeatureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  createFeatureDesc: {
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
    maxHeight: '90%',
  },
  modalImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  modalCollection: {
    fontSize: 16,
    color: '#8B5CF6',
    marginBottom: 12,
  },
  modalDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalPrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalPriceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalRoyalty: {
    fontSize: 12,
    color: '#6B7280',
  },
  modalAttributes: {
    marginBottom: 20,
  },
  modalAttributesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  modalAttribute: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalAttributeType: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalAttributeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  buyButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  buyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
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
  selectedNftPreview: {
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedNftImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedNftName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelModalButton: {
    backgroundColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
    flex: 1,
    alignItems: 'center',
  },
  cancelModalButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  createListingButton: {
    backgroundColor: '#8B5CF6',
    borderRadius: 8,
    padding: 16,
    flex: 1,
    alignItems: 'center',
  },
  createListingButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default NFTMarketplaceScreen;