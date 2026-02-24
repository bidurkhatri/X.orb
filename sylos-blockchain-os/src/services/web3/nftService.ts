// src/services/web3/nftService.ts
import { ethers } from 'ethers';

const NFT_MARKETPLACE_ABI = [
  "function listERC721(address nftContract, uint256 tokenId, uint256 price, uint256 duration) external",
  "function listERC1155(address nftContract, uint256 tokenId, uint256 amount, uint256 price, uint256 duration) external",
  "function buyNFT(bytes32 listingId) external payable",
  "function buyNFTWithToken(bytes32 listingId, address paymentToken) external",
  "function cancelListing(bytes32 listingId) external",
  "function createERC721Auction(address nftContract, uint256 tokenId, uint256 startPrice, uint256 reservePrice, uint256 duration) external",
  "function createERC1155Auction(address nftContract, uint256 tokenId, uint256 amount, uint256 startPrice, uint256 reservePrice, uint256 duration) external",
  "function placeBid(uint256 auctionId) external payable",
  "function settleAuction(uint256 auctionId) external",
  "function makeOffer(address nftContract, uint256 tokenId, uint256 amount, uint256 price, uint256 duration, address paymentToken) external",
  "function acceptOffer(bytes32 offerId) external",
  "function getListing(bytes32 listingId) external view returns (address nftContract, uint256 tokenId, uint256 amount, uint256 price, address seller, uint8 standard, uint8 status, uint256 createdAt, uint256 expiresAt)",
  "function getAuction(uint256 auctionId) external view returns (address nftContract, uint256 tokenId, uint256 startPrice, uint256 reservePrice, address seller, address highestBidder, uint256 highestBid, uint256 endTime, uint8 standard, uint8 status, uint256 createdAt, bool reserveMet)",
  "function getUserStats(address user) external view returns (uint256 listingsCount, uint256 salesCount, uint256 purchasesCount, uint256 totalVolume)",
  "function getMarketplaceStats() external view returns (uint256 totalVolume, uint256 totalSales, uint256 marketplaceFee)"
];

export interface NFTListing {
  id: string;
  nftContract: string;
  tokenId: string;
  amount: number;
  price: string;
  seller: string;
  standard: 'ERC721' | 'ERC1155';
  status: 'ACTIVE' | 'SOLD' | 'CANCELED' | 'EXPIRED';
  createdAt: number;
  expiresAt: number;
  nft?: {
    name: string;
    symbol: string;
    image: string;
    description?: string;
  };
}

export interface NFTAuction {
  id: number;
  nftContract: string;
  tokenId: string;
  startPrice: string;
  reservePrice: string;
  seller: string;
  highestBidder: string;
  highestBid: string;
  endTime: number;
  standard: 'ERC721' | 'ERC1155';
  status: 'ACTIVE' | 'SETTLED' | 'CANCELED';
  reserveMet: boolean;
}

export interface NFTOffer {
  id: string;
  nftContract: string;
  tokenId: string;
  amount: number;
  buyer: string;
  price: string;
  paymentToken: string;
  status: 'PENDING' | 'ACCEPTED' | 'CANCELED' | 'EXPIRED';
  expiresAt: number;
}

export interface MarketplaceStats {
  totalVolume: string;
  totalSales: number;
  marketplaceFee: string;
  totalListings: number;
  totalAuctions: number;
  activeListings: number;
  activeAuctions: number;
}

export class NFTService {
  private provider: ethers.BrowserProvider;
  private signer: ethers.JsonRpcSigner | null = null;
  private contract: ethers.Contract;

  constructor(provider: ethers.BrowserProvider) {
    this.provider = provider;
    this.contract = new ethers.Contract(
      process.env.REACT_APP_NFT_MARKETPLACE!,
      NFT_MARKETPLACE_ABI,
      this.provider
    );
  }

  async connect(): Promise<string> {
    if (!window.ethereum) {
      throw new Error('MetaMask not found');
    }

    await this.provider.send('eth_requestAccounts', []);
    this.signer = await this.provider.getSigner();
    this.contract = this.contract.connect(this.signer);
    
    return await this.signer.getAddress();
  }

  // Listing Operations
  async listERC721(
    nftContract: string,
    tokenId: string,
    price: string,
    duration: number = 24 * 60 * 60 // 24 hours
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      // Check NFT ownership
      const nftContract = new ethers.Contract(
        nftContract,
        ['function ownerOf(uint256 tokenId) view returns (address)'],
        this.signer
      );

      const userAddress = await this.signer.getAddress();
      const owner = await nftContract.ownerOf(tokenId);
      
      if (owner.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error('You do not own this NFT');
      }

      // Check if NFT is approved for marketplace
      const isApproved = await nftContract.isApprovedForAll(userAddress, this.contract.target) ||
                        (await nftContract.getApproved(tokenId)) === this.contract.target;

      if (!isApproved) {
        throw new Error('NFT not approved for marketplace');
      }

      const tx = await this.contract.listERC721(
        nftContract,
        tokenId,
        ethers.parseEther(price),
        duration
      );

      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to list ERC721:', error);
      throw new Error('Failed to list NFT');
    }
  }

  async listERC1155(
    nftContract: string,
    tokenId: string,
    amount: number,
    price: string,
    duration: number = 24 * 60 * 60
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      // Check NFT balance and approval
      const nftContract = new ethers.Contract(
        nftContract,
        ['function balanceOf(address account, uint256 id) view returns (uint256)', 'function isApprovedForAll(address,address) view returns (bool)'],
        this.signer
      );

      const userAddress = await this.signer.getAddress();
      const balance = await nftContract.balanceOf(userAddress, tokenId);
      
      if (balance < amount) {
        throw new Error('Insufficient NFT balance');
      }

      const isApproved = await nftContract.isApprovedForAll(userAddress, this.contract.target);
      if (!isApproved) {
        throw new Error('NFT not approved for marketplace');
      }

      const tx = await this.contract.listERC1155(
        nftContract,
        tokenId,
        amount,
        ethers.parseEther(price),
        duration
      );

      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to list ERC1155:', error);
      throw new Error('Failed to list NFT');
    }
  }

  async buyNFT(listingId: string, paymentToken: string = '0x0000000000000000000000000000000000000000'): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const listing = await this.getListing(listingId);
      if (listing.status !== 'ACTIVE') {
        throw new Error('Listing not active');
      }

      const tx = paymentToken === '0x0000000000000000000000000000000000000000' 
        ? await this.contract.buyNFT(listingId, { value: ethers.parseEther(listing.price) })
        : await this.contract.buyNFTWithToken(listingId, paymentToken);

      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to buy NFT:', error);
      throw new Error('Failed to buy NFT');
    }
  }

  async cancelListing(listingId: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.contract.cancelListing(listingId);
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to cancel listing:', error);
      throw new Error('Failed to cancel listing');
    }
  }

  // Auction Operations
  async createERC721Auction(
    nftContract: string,
    tokenId: string,
    startPrice: string,
    reservePrice: string,
    duration: number = 7 * 24 * 60 * 60 // 7 days
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      // Check ownership and approval
      const nftContract = new ethers.Contract(
        nftContract,
        ['function ownerOf(uint256 tokenId) view returns (address)', 'function isApprovedForAll(address,address) view returns (bool)'],
        this.signer
      );

      const userAddress = await this.signer.getAddress();
      const owner = await nftContract.ownerOf(tokenId);
      
      if (owner.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error('You do not own this NFT');
      }

      const isApproved = await nftContract.isApprovedForAll(userAddress, this.contract.target);
      if (!isApproved) {
        throw new Error('NFT not approved for marketplace');
      }

      const tx = await this.contract.createERC721Auction(
        nftContract,
        tokenId,
        ethers.parseEther(startPrice),
        ethers.parseEther(reservePrice),
        duration
      );

      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to create auction:', error);
      throw new Error('Failed to create auction');
    }
  }

  async placeBid(auctionId: number, amount: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.contract.placeBid(auctionId, { value: ethers.parseEther(amount) });
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to place bid:', error);
      throw new Error('Failed to place bid');
    }
  }

  async settleAuction(auctionId: number): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.contract.settleAuction(auctionId);
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to settle auction:', error);
      throw new Error('Failed to settle auction');
    }
  }

  // Offer Operations
  async makeOffer(
    nftContract: string,
    tokenId: string,
    amount: number,
    price: string,
    duration: number = 24 * 60 * 60, // 24 hours
    paymentToken: string = '0x0000000000000000000000000000000000000000'
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      // For native token offers, require payment
      let value = 0;
      if (paymentToken === '0x0000000000000000000000000000000000000000') {
        value = ethers.parseEther(price);
      }

      const tx = await this.contract.makeOffer(
        nftContract,
        tokenId,
        amount,
        ethers.parseEther(price),
        duration,
        paymentToken,
        { value }
      );

      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to make offer:', error);
      throw new Error('Failed to make offer');
    }
  }

  async acceptOffer(offerId: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.contract.acceptOffer(offerId);
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to accept offer:', error);
      throw new Error('Failed to accept offer');
    }
  }

  // Data Retrieval
  async getListing(listingId: string): Promise<NFTListing> {
    try {
      const [nftContract, tokenId, amount, price, seller, standard, status, createdAt, expiresAt] = 
        await this.contract.getListing(listingId);

      return {
        id: listingId,
        nftContract,
        tokenId: tokenId.toString(),
        amount: Number(amount),
        price: ethers.formatEther(price),
        seller,
        standard: standard === 0 ? 'ERC721' : 'ERC1155',
        status: ['ACTIVE', 'SOLD', 'CANCELED', 'EXPIRED'][Number(status)] as NFTListing['status'],
        createdAt: Number(createdAt) * 1000,
        expiresAt: Number(expiresAt) * 1000
      };
    } catch (error) {
      console.error('Failed to get listing:', error);
      throw new Error('Failed to fetch listing');
    }
  }

  async getAuction(auctionId: number): Promise<NFTAuction> {
    try {
      const [
        nftContract, tokenId, startPrice, reservePrice, seller, 
        highestBidder, highestBid, endTime, standard, status, createdAt, reserveMet
      ] = await this.contract.getAuction(auctionId);

      return {
        id: auctionId,
        nftContract,
        tokenId: tokenId.toString(),
        startPrice: ethers.formatEther(startPrice),
        reservePrice: ethers.formatEther(reservePrice),
        seller,
        highestBidder,
        highestBid: ethers.formatEther(highestBid),
        endTime: Number(endTime) * 1000,
        standard: standard === 0 ? 'ERC721' : 'ERC1155',
        status: ['ACTIVE', 'SETTLED', 'CANCELED'][Number(status)] as NFTAuction['status'],
        reserveMet
      };
    } catch (error) {
      console.error('Failed to get auction:', error);
      throw new Error('Failed to fetch auction');
    }
  }

  async getUserStats(): Promise<{
    listingsCount: number;
    salesCount: number;
    purchasesCount: number;
    totalVolume: string;
  }> {
    if (!this.signer) {
      return {
        listingsCount: 0,
        salesCount: 0,
        purchasesCount: 0,
        totalVolume: '0'
      };
    }

    try {
      const userAddress = await this.signer.getAddress();
      const [listingsCount, salesCount, purchasesCount, totalVolume] = 
        await this.contract.getUserStats(userAddress);

      return {
        listingsCount: Number(listingsCount),
        salesCount: Number(salesCount),
        purchasesCount: Number(purchasesCount),
        totalVolume: ethers.formatEther(totalVolume)
      };
    } catch (error) {
      console.error('Failed to get user stats:', error);
      return {
        listingsCount: 0,
        salesCount: 0,
        purchasesCount: 0,
        totalVolume: '0'
      };
    }
  }

  async getMarketplaceStats(): Promise<MarketplaceStats> {
    try {
      const [totalVolume, totalSales, marketplaceFee] = await this.contract.getMarketplaceStats();

      return {
        totalVolume: ethers.formatEther(totalVolume),
        totalSales: Number(totalSales),
        marketplaceFee: (Number(marketplaceFee) / 100).toString() + '%',
        totalListings: 0, // Would need additional contract method
        totalAuctions: 0,
        activeListings: 0,
        activeAuctions: 0
      };
    } catch (error) {
      console.error('Failed to get marketplace stats:', error);
      return {
        totalVolume: '0',
        totalSales: 0,
        marketplaceFee: '0%',
        totalListings: 0,
        totalAuctions: 0,
        activeListings: 0,
        activeAuctions: 0
      };
    }
  }

  // Utility Functions
  async generateListingId(
    seller: string,
    nftContract: string,
    tokenId: string,
    amount: number,
    timestamp: number
  ): Promise<string> {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address', 'uint256', 'uint256', 'uint256'],
        [seller, nftContract, tokenId, amount, timestamp]
      )
    );
  }

  async generateOfferId(
    buyer: string,
    nftContract: string,
    tokenId: string,
    amount: number,
    timestamp: number
  ): Promise<string> {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address', 'uint256', 'uint256', 'uint256'],
        [buyer, nftContract, tokenId, amount, timestamp]
      )
    );
  }

  calculateTimeRemaining(endTime: number): {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    expired: boolean;
  } {
    const now = Date.now();
    const remaining = endTime - now;

    if (remaining <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    }

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, expired: false };
  }

  formatPrice(price: string, decimals: number = 6): string {
    const num = parseFloat(price);
    if (num === 0) return '0';
    if (num < 0.000001) return '< 0.000001';
    return num.toFixed(decimals);
  }
}