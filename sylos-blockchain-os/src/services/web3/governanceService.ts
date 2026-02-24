// src/services/web3/governanceService.ts
import { ethers } from 'ethers';

const GOVERNANCE_CONTRACT_ABI = [
  "function createProposal(string description, bytes[] targets, uint256[] values, bytes[] calldatas) external returns (uint256)",
  "function castVote(uint256 proposalId, uint8 support, uint256 amount) external",
  "function getProposal(uint256 proposalId) external view returns (address proposer, string description, uint256 startBlock, uint256 endBlock, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, bool executed, bool canceled, uint256 executionETA)",
  "function getUserVote(uint256 proposalId, address user) external view returns (bool hasVoted, uint8 support, uint256 weight, uint256 tokensUsed, uint256 timestamp)",
  "function getProposalResults(uint256 proposalId) external view returns (uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, bool hasQuorum, bool hasMajority)",
  "function proposalThreshold() external view returns (uint256)",
  "function quorumVotes() external view returns (uint256)",
  "function votingPeriod() external view returns (uint256)",
  "function votingDelay() external view returns (uint256)",
  "function timelockPeriod() external view returns (uint256)",
  "function hasVotingPower(address user) external view returns (bool)",
  "event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description, uint256 startTime, uint256 endTime)",
  "event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 weight, uint256 tokensUsed)"
];

export interface Proposal {
  id: number;
  proposer: string;
  description: string;
  startBlock: number;
  endBlock: number;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  executed: boolean;
  canceled: boolean;
  executionETA?: number;
  status: 'pending' | 'active' | 'succeeded' | 'defeated' | 'executed' | 'canceled';
}

export interface Vote {
  hasVoted: boolean;
  support: 0 | 1 | 2; // 0=against, 1=for, 2=abstain
  weight: string;
  tokensUsed: string;
  timestamp: number;
}

export interface ProposalResults {
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  hasQuorum: boolean;
  hasMajority: boolean;
  participation: string;
  status: string;
}

export class GovernanceService {
  private provider: ethers.BrowserProvider;
  private signer: ethers.JsonRpcSigner | null = null;
  private contract: ethers.Contract;

  constructor(provider: ethers.BrowserProvider) {
    this.provider = provider;
    this.contract = new ethers.Contract(
      process.env.REACT_APP_GOVERNANCE_CONTRACT!,
      GOVERNANCE_CONTRACT_ABI,
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

  async getGovernanceParams(): Promise<{
    proposalThreshold: string;
    quorumVotes: string;
    votingPeriod: number;
    votingDelay: number;
    timelockPeriod: number;
  }> {
    try {
      const [proposalThreshold, quorumVotes, votingPeriod, votingDelay, timelockPeriod] = 
        await Promise.all([
          this.contract.proposalThreshold(),
          this.contract.quorumVotes(),
          this.contract.votingPeriod(),
          this.contract.votingDelay(),
          this.contract.timelockPeriod()
        ]);

      return {
        proposalThreshold: ethers.formatEther(proposalThreshold),
        quorumVotes: ethers.formatEther(quorumVotes),
        votingPeriod: Number(votingPeriod),
        votingDelay: Number(votingDelay),
        timelockPeriod: Number(timelockPeriod)
      };
    } catch (error) {
      console.error('Failed to get governance params:', error);
      throw new Error('Failed to fetch governance parameters');
    }
  }

  async hasVotingPower(userAddress: string): Promise<boolean> {
    try {
      return await this.contract.hasVotingPower(userAddress);
    } catch (error) {
      console.error('Failed to check voting power:', error);
      return false;
    }
  }

  async createProposal(
    description: string,
    targets: string[] = [],
    values: number[] = [],
    calldatas: string[] = []
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.contract.createProposal(
        description,
        targets,
        values,
        calldatas
      );

      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to create proposal:', error);
      throw new Error('Failed to create proposal');
    }
  }

  async castVote(
    proposalId: number,
    support: 0 | 1 | 2,
    amount: string
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const userAddress = await this.signer.getAddress();
      
      // Check if user has voting power
      const hasPower = await this.contract.hasVotingPower(userAddress);
      if (!hasPower) {
        throw new Error('Insufficient voting power');
      }

      // Check if voting is still active
      const proposal = await this.getProposal(proposalId);
      if (proposal.status !== 'active') {
        throw new Error('Voting not active');
      }

      const amountWei = ethers.parseEther(amount);
      const tx = await this.contract.castVote(proposalId, support, amountWei);
      
      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to cast vote:', error);
      throw new Error('Failed to cast vote');
    }
  }

  async executeProposal(
    proposalId: number,
    targets: string[] = [],
    values: number[] = [],
    calldatas: string[] = []
  ): Promise<string> {
    if (!this.signer) {
      throw new Error('Wallet not connected');
    }

    try {
      const tx = await this.contract.executeProposal(
        proposalId,
        targets,
        values,
        calldatas
      );

      const receipt = await tx.wait();
      return receipt?.hash || '';
    } catch (error) {
      console.error('Failed to execute proposal:', error);
      throw new Error('Failed to execute proposal');
    }
  }

  async getProposal(proposalId: number): Promise<Proposal> {
    try {
      const [
        proposer,
        description,
        startBlock,
        endBlock,
        forVotes,
        againstVotes,
        abstainVotes,
        executed,
        canceled,
        executionETA
      ] = await this.contract.getProposal(proposalId);

      // Determine status based on current block and vote results
      const currentBlock = await this.provider.getBlockNumber();
      let status: Proposal['status'];

      if (canceled) {
        status = 'canceled';
      } else if (executed) {
        status = 'executed';
      } else if (currentBlock < startBlock) {
        status = 'pending';
      } else if (currentBlock <= endBlock) {
        status = 'active';
      } else {
        const forVotesBN = BigInt(forVotes);
        const againstVotesBN = BigInt(againstVotes);
        const abstainVotesBN = BigInt(abstainVotes);
        const totalVotes = forVotesBN + againstVotesBN + abstainVotesBN;

        if (forVotesBN > againstVotesBN && totalVotes > 0) {
          status = 'succeeded';
        } else {
          status = 'defeated';
        }
      }

      return {
        id: proposalId,
        proposer,
        description,
        startBlock: Number(startBlock),
        endBlock: Number(endBlock),
        forVotes: ethers.formatEther(forVotes),
        againstVotes: ethers.formatEther(againstVotes),
        abstainVotes: ethers.formatEther(abstainVotes),
        executed,
        canceled,
        executionETA: executionETA > 0 ? Number(executionETA) : undefined,
        status
      };
    } catch (error) {
      console.error('Failed to get proposal:', error);
      throw new Error('Failed to fetch proposal');
    }
  }

  async getUserVote(proposalId: number, userAddress: string): Promise<Vote> {
    try {
      const [hasVoted, support, weight, tokensUsed, timestamp] = 
        await this.contract.getUserVote(proposalId, userAddress);

      return {
        hasVoted,
        support: Number(support) as 0 | 1 | 2,
        weight: ethers.formatEther(weight),
        tokensUsed: ethers.formatEther(tokensUsed),
        timestamp: Number(timestamp) * 1000
      };
    } catch (error) {
      console.error('Failed to get user vote:', error);
      return {
        hasVoted: false,
        support: 0 as 0 | 1 | 2,
        weight: '0',
        tokensUsed: '0',
        timestamp: 0
      };
    }
  }

  async getProposalResults(proposalId: number): Promise<ProposalResults> {
    try {
      const [forVotes, againstVotes, abstainVotes, hasQuorum, hasMajority] = 
        await this.contract.getProposalResults(proposalId);

      const forVotesBN = BigInt(forVotes);
      const againstVotesBN = BigInt(againstVotes);
      const abstainVotesBN = BigInt(abstainVotes);
      const totalVotes = forVotesBN + againstVotesBN + abstainVotesBN;

      const participation = totalVotes > 0 ? 
        (Number((forVotesBN + againstVotesBN + abstainVotesBN) * 100n / 100000000000000000000n) / 100).toString() + '%' : 
        '0%';

      let status = 'pending';
      if (hasQuorum && hasMajority) {
        status = 'succeeded';
      } else if (totalVotes > 0) {
        status = 'defeated';
      }

      return {
        forVotes: ethers.formatEther(forVotes),
        againstVotes: ethers.formatEther(againstVotes),
        abstainVotes: ethers.formatEther(abstainVotes),
        hasQuorum,
        hasMajority,
        participation,
        status
      };
    } catch (error) {
      console.error('Failed to get proposal results:', error);
      return {
        forVotes: '0',
        againstVotes: '0',
        abstainVotes: '0',
        hasQuorum: false,
        hasMajority: false,
        participation: '0%',
        status: 'pending'
      };
    }
  }

  async getAllProposals(): Promise<Proposal[]> {
    try {
      // This would require additional contract methods or event filtering
      // For now, return a mock structure
      const proposalCount = await this.contract.proposalCount();
      const proposals: Proposal[] = [];

      for (let i = 1; i <= Number(proposalCount); i++) {
        try {
          const proposal = await this.getProposal(i);
          proposals.push(proposal);
        } catch (error) {
          console.error(`Failed to fetch proposal ${i}:`, error);
        }
      }

      return proposals.sort((a, b) => b.id - a.id);
    } catch (error) {
      console.error('Failed to get all proposals:', error);
      return [];
    }
  }

  async getUserProposals(userAddress: string): Promise<Proposal[]> {
    try {
      const proposals = await this.getAllProposals();
      return proposals.filter(proposal => 
        proposal.proposer.toLowerCase() === userAddress.toLowerCase()
      );
    } catch (error) {
      console.error('Failed to get user proposals:', error);
      return [];
    }
  }

  async getVotingHistory(userAddress: string): Promise<Array<{
    proposalId: number;
    proposal: Proposal;
    vote: Vote;
  }>> {
    try {
      const proposals = await this.getAllProposals();
      const votingHistory = [];

      for (const proposal of proposals) {
        try {
          const vote = await this.getUserVote(proposal.id, userAddress);
          if (vote.hasVoted) {
            votingHistory.push({
              proposalId: proposal.id,
              proposal,
              vote
            });
          }
        } catch (error) {
          console.error(`Failed to get vote for proposal ${proposal.id}:`, error);
        }
      }

      return votingHistory.sort((a, b) => b.vote.timestamp - a.vote.timestamp);
    } catch (error) {
      console.error('Failed to get voting history:', error);
      return [];
    }
  }

  async getGovernanceStats(): Promise<{
    totalProposals: number;
    activeProposals: number;
    successfulProposals: number;
    totalVotes: string;
    uniqueVoters: number;
  }> {
    try {
      const proposals = await this.getAllProposals();
      const activeProposals = proposals.filter(p => p.status === 'active').length;
      const successfulProposals = proposals.filter(p => p.status === 'succeeded').length;
      
      // Calculate total votes and unique voters
      let totalVotes = 0;
      const uniqueVoters = new Set<string>();
      
      for (const proposal of proposals) {
        const forVotes = parseFloat(proposal.forVotes);
        const againstVotes = parseFloat(proposal.againstVotes);
        const abstainVotes = parseFloat(proposal.abstainVotes);
        totalVotes += forVotes + againstVotes + abstainVotes;
        
        // This would require additional data to get unique voters
      }

      return {
        totalProposals: proposals.length,
        activeProposals,
        successfulProposals,
        totalVotes: totalVotes.toString(),
        uniqueVoters: uniqueVoters.size
      };
    } catch (error) {
      console.error('Failed to get governance stats:', error);
      return {
        totalProposals: 0,
        activeProposals: 0,
        successfulProposals: 0,
        totalVotes: '0',
        uniqueVoters: 0
      };
    }
  }

  // Utility functions
  formatProposalDescription(description: string): string {
    // Remove excessive whitespace and format for display
    return description.trim().replace(/\s+/g, ' ');
  }

  calculateVoteWeight(tokens: string, support: 0 | 1 | 2): { weight: string; tokens: string } {
    // For quadratic voting: weight = sqrt(tokens)
    const tokensBN = ethers.parseEther(tokens);
    const weight = Math.sqrt(Number(ethers.formatEther(tokensBN)));
    
    return {
      weight: weight.toString(),
      tokens
    };
  }

  async estimateProposalExecutionTime(proposalId: number): Promise<{
    votingEnds: number;
    executionReady: number;
    executionComplete: number;
  }> {
    try {
      const proposal = await this.getProposal(proposalId);
      const params = await this.getGovernanceParams();
      
      const votingEnds = proposal.endBlock * 12; // Rough block time estimate
      const executionReady = votingEnds + params.timelockPeriod;
      const executionComplete = executionReady + 3600; // 1 hour for execution

      return {
        votingEnds,
        executionReady,
        executionComplete
      };
    } catch (error) {
      console.error('Failed to estimate execution time:', error);
      return {
        votingEnds: 0,
        executionReady: 0,
        executionComplete: 0
      };
    }
  }
}