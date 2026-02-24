// src/services/web3/identityService.ts
import { ethers } from 'ethers';

const IDENTITY_CONTRACT_ABI = [
  "function registerDID(bytes32 did, string documentHash, string[] publicKeys, string[] services, uint256 expiry) external payable",
  "function transferDID(bytes32 did, address newOwner) external",
  "function revokeDID(bytes32 did) external",
  "function updateDIDDocument(bytes32 did, string documentHash, string[] publicKeys, string[] services) external",
  "function addDIDAttribute(bytes32 did, string key, string value, uint256 expiry) external payable",
  "function removeDIDAttribute(bytes32 did, string key) external",
  "function addDIDController(bytes32 did, address controller) external",
  "function removeDIDController(bytes32 did, address controller) external",
  "function issueCredential(bytes32 credentialId, bytes32 subject, string credentialHash, string[] attributes, string[] values, uint256 expiresAt) external payable",
  "function revokeCredential(bytes32 credentialId) external",
  "function verifyCredential(bytes32 credentialId) external view returns (bool valid, string credentialHash, string[] attributes, string[] values, address issuer, uint256 issuedAt, uint256 expiresAt)",
  "function batchVerifyCredentials(bytes32[] credentialIds) external view returns (bool[] results)",
  "function resolveDID(bytes32 did) external view returns (address owner, address[] controllers, string documentHash, string[] publicKeys, string[] services, uint256 expiry, uint256 createdAt, uint256 lastUpdated)",
  "function getDIDAttributes(bytes32 did) external view returns (string[] keys, string[] values, uint256[] expiries, bool[] active)",
  "function getCredentialsByIssuer(address issuer) external view returns (bytes32[])",
  "function getCredentialsBySubject(bytes32 subject) external view returns (bytes32[])",
  "function getUserStats(address user) external view returns (uint256 didRegistrationsCount, uint256 credentialsIssuedCount, uint256 credentialsVerifiedCount)",
  "function registrationFee() external view returns (uint256)",
  "function attributeFee() external view returns (uint256)",
  "function credentialFee() external view returns (uint256)"
];

export interface DIDDocument {
  owner: string;
  controllers: string[];
  documentHash: string;
  publicKeys: string[];
  services: string[];
  expiry: number;
  createdAt: number;
  lastUpdated: number;
}

export interface DIDAttribute {
  key: string;
  value: string;
  expiry: number;
  active: boolean;
}

export interface VerifiableCredential {
  subject: string;
  issuer: string;
  credentialHash: string;
  attributes: string[];
  values: string[];
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
  active: boolean;
}

export interface CredentialVerification {
  valid: boolean;
  credentialHash: string;
  attributes: string[];
  values: string[];
  issuer: string;
  issuedAt: number;
  expiresAt: number;
}

export interface IdentityStats {
  didRegistrations: number;
  credentialsIssued: number;
  credentialsVerified: number;
  totalFees: string;
}

export class IdentityService {
  private provider: ethers.BrowserProvider;
  private signer: ethers.JsonRpcSigner | null = null;
  private contract: ethers.Contract;

  constructor(provider: ethers.BrowserProvider) {
    this.provider = provider;
    this.contract = new ethers.Contract(
      process.env.REACT_APP_IDENTITY_CONTRACT!,
      IDENTITY_CONTRACT_ABI,
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

  // DID Operations
  async registerDID(
    did: string,
    documentHash: string,
    publicKeys: string[] = [],
    services: string[] = [],
    expiry: number = 0
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const [registrationFee] = await Promise.all([
        this.contract.registrationFee()
      ]);

      const tx = await this.contract.registerDID(
        did,
        documentHash,
        publicKeys,
        services,
        expiry,
        { value: registrationFee }
      );

      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to register DID:', error);
      throw new Error('Failed to register DID');
    }
  }

  async transferDID(did: string, newOwner: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.contract.transferDID(did, newOwner);
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to transfer DID:', error);
      throw new Error('Failed to transfer DID');
    }
  }

  async revokeDID(did: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.contract.revokeDID(did);
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to revoke DID:', error);
      throw new Error('Failed to revoke DID');
    }
  }

  async updateDIDDocument(
    did: string,
    documentHash: string,
    publicKeys: string[] = [],
    services: string[] = []
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.contract.updateDIDDocument(did, documentHash, publicKeys, services);
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to update DID document:', error);
      throw new Error('Failed to update DID document');
    }
  }

  async addDIDAttribute(
    did: string,
    key: string,
    value: string,
    expiry: number = 0
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const [attributeFee] = await Promise.all([
        this.contract.attributeFee()
      ]);

      const tx = await this.contract.addDIDAttribute(did, key, value, expiry, { value: attributeFee });
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to add DID attribute:', error);
      throw new Error('Failed to add DID attribute');
    }
  }

  async removeDIDAttribute(did: string, key: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.contract.removeDIDAttribute(did, key);
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to remove DID attribute:', error);
      throw new Error('Failed to remove DID attribute');
    }
  }

  async addDIDController(did: string, controller: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.contract.addDIDController(did, controller);
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to add DID controller:', error);
      throw new Error('Failed to add DID controller');
    }
  }

  async removeDIDController(did: string, controller: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.contract.removeDIDController(did, controller);
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to remove DID controller:', error);
      throw new Error('Failed to remove DID controller');
    }
  }

  // Credential Operations
  async issueCredential(
    credentialId: string,
    subject: string,
    credentialHash: string,
    attributes: string[],
    values: string[],
    expiresAt: number = 0
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const [credentialFee] = await Promise.all([
        this.contract.credentialFee()
      ]);

      const tx = await this.contract.issueCredential(
        credentialId,
        subject,
        credentialHash,
        attributes,
        values,
        expiresAt,
        { value: credentialFee }
      );

      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to issue credential:', error);
      throw new Error('Failed to issue credential');
    }
  }

  async revokeCredential(credentialId: string): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.contract.revokeCredential(credentialId);
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to revoke credential:', error);
      throw new Error('Failed to revoke credential');
    }
  }

  async verifyCredential(credentialId: string): Promise<CredentialVerification> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const [valid, credentialHash, attributes, values, issuer, issuedAt, expiresAt] = 
        await this.contract.verifyCredential(credentialId);

      return {
        valid,
        credentialHash,
        attributes,
        values,
        issuer,
        issuedAt: Number(issuedAt) * 1000,
        expiresAt: Number(expiresAt) * 1000
      };
    } catch (error) {
      console.error('Failed to verify credential:', error);
      return {
        valid: false,
        credentialHash: '',
        attributes: [],
        values: [],
        issuer: '',
        issuedAt: 0,
        expiresAt: 0
      };
    }
  }

  async batchVerifyCredentials(credentialIds: string[]): Promise<boolean[]> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      return await this.contract.batchVerifyCredentials(credentialIds);
    } catch (error) {
      console.error('Failed to batch verify credentials:', error);
      return new Array(credentialIds.length).fill(false);
    }
  }

  // Data Retrieval
  async resolveDID(did: string): Promise<DIDDocument> {
    try {
      const [owner, controllers, documentHash, publicKeys, services, expiry, createdAt, lastUpdated] = 
        await this.contract.resolveDID(did);

      return {
        owner,
        controllers,
        documentHash,
        publicKeys,
        services,
        expiry: Number(expiry) * 1000,
        createdAt: Number(createdAt) * 1000,
        lastUpdated: Number(lastUpdated) * 1000
      };
    } catch (error) {
      console.error('Failed to resolve DID:', error);
      throw new Error('Failed to resolve DID');
    }
  }

  async getDIDAttributes(did: string): Promise<DIDAttribute[]> {
    try {
      const [keys, values, expiries, active] = await this.contract.getDIDAttributes(did);

      return keys.map((key, index) => ({
        key,
        value: values[index],
        expiry: Number(expiries[index]) * 1000,
        active: active[index]
      }));
    } catch (error) {
      console.error('Failed to get DID attributes:', error);
      return [];
    }
  }

  async getCredentialsByIssuer(issuer: string): Promise<string[]> {
    try {
      return await this.contract.getCredentialsByIssuer(issuer);
    } catch (error) {
      console.error('Failed to get credentials by issuer:', error);
      return [];
    }
  }

  async getCredentialsBySubject(subject: string): Promise<string[]> {
    try {
      return await this.contract.getCredentialsBySubject(subject);
    } catch (error) {
      console.error('Failed to get credentials by subject:', error);
      return [];
    }
  }

  async getUserStats(): Promise<IdentityStats> {
    if (!this.signer) {
      return {
        didRegistrations: 0,
        credentialsIssued: 0,
        credentialsVerified: 0,
        totalFees: '0'
      };
    }

    try {
      const userAddress = await this.signer.getAddress();
      const [didRegistrations, credentialsIssued, credentialsVerified] = 
        await this.contract.getUserStats(userAddress);

      return {
        didRegistrations: Number(didRegistrations),
        credentialsIssued: Number(credentialsIssued),
        credentialsVerified: Number(credentialsVerified),
        totalFees: '0' // Would need additional tracking
      };
    } catch (error) {
      console.error('Failed to get user stats:', error);
      return {
        didRegistrations: 0,
        credentialsIssued: 0,
        credentialsVerified: 0,
        totalFees: '0'
      };
    }
  }

  // Utility Functions
  generateDID(method: string, network: string, identifier: string): string {
    return `did:${method}:${network}:${identifier}`;
  }

  async hashDocument(document: any): Promise<string> {
    // This would typically use IPFS or similar for document storage
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(document));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async createCredentialDocument(
    subject: string,
    issuer: string,
    attributes: Record<string, any>,
    expiration: Date
  ): Promise<any> {
    return {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/security/suites/jws-2020/v1'
      ],
      type: ['VerifiableCredential'],
      issuer,
      subject,
      issuanceDate: new Date().toISOString(),
      expirationDate: expiration.toISOString(),
      credentialSubject: attributes
    };
  }

  formatDIDDocument(document: DIDDocument): any {
    return {
      id: `did:sylos:${document.owner}`,
      publicKey: document.publicKeys.map((key, index) => ({
        id: `did:sylos:${document.owner}#key-${index}`,
        type: 'EcdsaSecp256r1VerificationKey2020',
        publicKeyBase58: key
      })),
      authentication: document.publicKeys.map((_, index) => `did:sylos:${document.owner}#key-${index}`),
      service: document.services.map((service, index) => ({
        id: `did:sylos:${document.owner}#service-${index}`,
        type: 'ServiceEndpoint',
        serviceEndpoint: service
      }))
    };
  }

  validateDID(did: string): { valid: boolean; error?: string } {
    if (!did.startsWith('did:')) {
      return { valid: false, error: 'DID must start with "did:"' };
    }

    const parts = did.split(':');
    if (parts.length < 3) {
      return { valid: false, error: 'DID must have at least 3 parts' };
    }

    if (parts[1] !== 'sylos') {
      return { valid: false, error: 'Only "sylos" method supported' };
    }

    return { valid: true };
  }

  calculateTimeRemaining(timestamp: number): {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    expired: boolean;
  } {
    const now = Date.now();
    const remaining = timestamp - now;

    if (remaining <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    }

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds, expired: false };
  }

  async estimateFees(): Promise<{
    registration: string;
    attribute: string;
    credential: string;
  }> {
    try {
      const [registrationFee, attributeFee, credentialFee] = await Promise.all([
        this.contract.registrationFee(),
        this.contract.attributeFee(),
        this.contract.credentialFee()
      ]);

      return {
        registration: ethers.formatEther(registrationFee),
        attribute: ethers.formatEther(attributeFee),
        credential: ethers.formatEther(credentialFee)
      };
    } catch (error) {
      console.error('Failed to estimate fees:', error);
      return {
        registration: '0.01',
        attribute: '0.001',
        credential: '0.005'
      };
    }
  }
}