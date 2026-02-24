const { ethers } = require("hardhat");

/**
 * Contract Interaction Utility
 * Provides easy-to-use functions for interacting with deployed SylOS contracts
 */
class SylOSContracts {
  constructor() {
    this.contracts = {};
  }

  /**
   * Initialize contract instances
   */
  async initialize() {
    console.log("🔗 Initializing SylOS Contracts...");

    const addresses = {
      SylOSToken: process.env.SYLOS_TOKEN_ADDRESS,
      WrappedSYLOS: process.env.WRAPPED_SYLOS_ADDRESS,
      PoPTracker: process.env.POP_TRACKER_ADDRESS,
      MetaTransactionPaymaster: process.env.META_TRANSACTION_PAYMASTER_ADDRESS,
      SylOSGovernance: process.env.SYLOS_GOVERNANCE_ADDRESS
    };

    for (const [name, address] of Object.entries(addresses)) {
      if (address) {
        try {
          const contractFactory = await ethers.getContractFactory(name);
          this.contracts[name] = await contractFactory.attach(address);
          console.log(`✅ ${name} loaded: ${address}`);
        } catch (error) {
          console.log(`❌ Failed to load ${name}: ${error.message}`);
        }
      } else {
        console.log(`⚠️  ${name} not found, skipping...`);
      }
    }
  }

  /**
   * Get SYLOS token balance for an address
   */
  async getSYLOSBalance(address) {
    if (!this.contracts.SylOSToken) {
      throw new Error("SylOSToken not loaded");
    }
    const balance = await this.contracts.SylOSToken.balanceOf(address);
    return ethers.formatEther(balance);
  }

  /**
   * Get wSYLOS token balance for an address
   */
  async getWSYLOSBalance(address) {
    if (!this.contracts.WrappedSYLOS) {
      throw new Error("WrappedSYLOS not loaded");
    }
    const balance = await this.contracts.WrappedSYLOS.balanceOf(address);
    return ethers.formatEther(balance);
  }

  /**
   * Get pending rewards for a user
   */
  async getPendingRewards(address) {
    if (!this.contracts.WrappedSYLOS) {
      throw new Error("WrappedSYLOS not loaded");
    }
    const rewards = await this.contracts.WrappedSYLOS.getPendingRewards(address);
    return ethers.formatEther(rewards);
  }

  /**
   * Wrap SYLOS tokens
   */
  async wrapTokens(amount, signer) {
    if (!this.contracts.WrappedSYLOS) {
      throw new Error("WrappedSYLOS not loaded");
    }
    
    const amountWei = ethers.parseEther(amount.toString());
    const tx = await this.contracts.WrappedSYLOS.connect(signer).wrap(amountWei);
    await tx.wait();
    console.log(`✅ Wrapped ${amount} SYLOS tokens`);
    return tx.hash;
  }

  /**
   * Unwrap wSYLOS tokens
   */
  async unwrapTokens(amount, signer) {
    if (!this.contracts.WrappedSYLOS) {
      throw new Error("WrappedSYLOS not loaded");
    }
    
    const amountWei = ethers.parseEther(amount.toString());
    const tx = await this.contracts.WrappedSYLOS.connect(signer).unwrap(amountWei);
    await tx.wait();
    console.log(`✅ Unwrapped ${amount} wSYLOS tokens`);
    return tx.hash;
  }

  /**
   * Claim staking rewards
   */
  async claimRewards(signer) {
    if (!this.contracts.WrappedSYLOS) {
      throw new Error("WrappedSYLOS not loaded");
    }
    
    const tx = await this.contracts.WrappedSYLOS.connect(signer).claimRewards();
    await tx.wait();
    console.log("✅ Claimed staking rewards");
    return tx.hash;
  }

  /**
   * Create a task in PoPTracker
   */
  async createTask(description, estimatedHours, complexity, signer) {
    if (!this.contracts.PoPTracker) {
      throw new Error("PoPTracker not loaded");
    }
    
    const tx = await this.contracts.PoPTracker.connect(signer).createTask(
      description,
      estimatedHours,
      complexity
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'TaskCreated');
    const taskId = event ? event.args[0] : null;
    
    console.log(`✅ Created task: ${description} (ID: ${taskId})`);
    return { txHash: tx.hash, taskId };
  }

  /**
   * Complete a task
   */
  async completeTask(taskId, actualHours, qualityScore, deliverableHash, signer) {
    if (!this.contracts.PoPTracker) {
      throw new Error("PoPTracker not loaded");
    }
    
    const tx = await this.contracts.PoPTracker.connect(signer).completeTask(
      taskId,
      actualHours,
      qualityScore,
      deliverableHash
    );
    await tx.wait();
    console.log(`✅ Completed task ${taskId} with ${qualityScore}% quality`);
    return tx.hash;
  }

  /**
   * Get user profile from PoPTracker
   */
  async getUserProfile(userAddress) {
    if (!this.contracts.PoPTracker) {
      throw new Error("PoPTracker not loaded");
    }
    
    const profile = await this.contracts.PoPTracker.getUserProfile(userAddress);
    return {
      totalTasks: profile.totalTasks.toString(),
      completedTasks: profile.completedTasks.toString(),
      totalScore: profile.totalScore.toString(),
      averageScore: profile.averageScore.toString(),
      isActive: profile.isActive
    };
  }

  /**
   * Create a governance proposal
   */
  async createProposal(targets, values, calldatas, title, description, evidence, signer) {
    if (!this.contracts.SylOSGovernance) {
      throw new Error("SylOSGovernance not loaded");
    }
    
    // Convert values to wei
    const valuesWei = values.map(v => ethers.parseEther(v.toString()));
    
    const tx = await this.contracts.SylOSGovernance.connect(signer).propose(
      targets,
      valuesWei,
      calldatas,
      title,
      description,
      evidence
    );
    const receipt = await tx.wait();
    const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'ProposalCreated');
    const proposalId = event ? event.args[0] : null;
    
    console.log(`✅ Created proposal: ${title} (ID: ${proposalId})`);
    return { txHash: tx.hash, proposalId };
  }

  /**
   * Vote on a proposal
   */
  async voteOnProposal(proposalId, support, reason, signer) {
    if (!this.contracts.SylOSGovernance) {
      throw new Error("SylOSGovernance not loaded");
    }
    
    const tx = await this.contracts.SylOSGovernance.connect(signer).vote(
      proposalId,
      support,
      reason
    );
    await tx.wait();
    console.log(`✅ Voted ${support} on proposal ${proposalId}`);
    return tx.hash;
  }

  /**
   * Lock funds for governance
   */
  async lockGovernanceFunds(amount, signer) {
    if (!this.contracts.SylOSGovernance) {
      throw new Error("SylOSGovernance not loaded");
    }
    
    const amountWei = ethers.parseEther(amount.toString());
    const tx = await this.contracts.SylOSGovernance.connect(signer).lockFunds(amountWei);
    await tx.wait();
    console.log(`✅ Locked ${amount} SYLOS for governance`);
    return tx.hash;
  }

  /**
   * Get contract information
   */
  async getContractInfo() {
    const info = {};
    
    for (const [name, contract] of Object.entries(this.contracts)) {
      if (contract) {
        try {
          if (name === "SylOSToken") {
            info[name] = {
              name: await contract.name(),
              symbol: await contract.symbol(),
              totalSupply: ethers.formatEther(await contract.totalSupply()),
              taxRate: (await contract.taxRate()) / 100,
              taxWallet: await contract.taxWallet()
            };
          } else if (name === "WrappedSYLOS") {
            info[name] = {
              name: await contract.name(),
              symbol: await contract.symbol(),
              totalSupply: ethers.formatEther(await contract.totalSupply()),
              underlyingToken: await contract.underlying()
            };
          } else if (name === "PoPTracker") {
            const cycle = await contract.getCurrentCycle();
            info[name] = {
              totalUsers: await contract.totalUsers(),
              totalTasksCompleted: await contract.totalTasksCompleted(),
              currentCycle: {
                startTime: cycle[0].toString(),
                endTime: cycle[1].toString(),
                totalRewards: ethers.formatEther(cycle[2]),
                distributedRewards: ethers.formatEther(cycle[3])
              }
            };
          } else if (name === "SylOSGovernance") {
            info[name] = {
              proposalCount: (await contract.proposalCount()).toString(),
              currentCycleId: (await contract.currentCycleId()).toString()
            };
          }
        } catch (error) {
          console.log(`Error getting info for ${name}: ${error.message}`);
        }
      }
    }
    
    return info;
  }

  /**
   * Transfer tokens
   */
  async transferTokens(to, amount, signer, tokenName = "SylOSToken") {
    if (!this.contracts[tokenName]) {
      throw new Error(`${tokenName} not loaded`);
    }
    
    const amountWei = ethers.parseEther(amount.toString());
    const tx = await this.contracts[tokenName].connect(signer).transfer(to, amountWei);
    await tx.wait();
    console.log(`✅ Transferred ${amount} ${tokenName} to ${to}`);
    return tx.hash;
  }

  /**
   * Get transaction history for an address
   */
  async getTransactionHistory(address, limit = 10) {
    // This would require event filtering and processing
    // Implementation depends on specific requirements
    console.log("Transaction history not yet implemented");
    return [];
  }
}

/**
 * Demo function showing contract interactions
 */
async function runDemo() {
  console.log("🎬 SylOS Contract Interaction Demo\n");
  
  const sylosContracts = new SylOSContracts();
  await sylosContracts.initialize();
  
  // Get signers
  const [deployer, user1] = await ethers.getSigners();
  
  console.log("📊 Contract Information:");
  const contractInfo = await sylosContracts.getContractInfo();
  console.log(JSON.stringify(contractInfo, null, 2));
  
  console.log("\n💰 User Balances:");
  const sylosBalance = await sylosContracts.getSYLOSBalance(user1.address);
  const wSYLOSBalance = await sylosContracts.getWSYLOSBalance(user1.address);
  const pendingRewards = await sylosContracts.getPendingRewards(user1.address);
  
  console.log(`User1 SYLOS Balance: ${sylosBalance}`);
  console.log(`User1 wSYLOS Balance: ${wSYLOSBalance}`);
  console.log(`User1 Pending Rewards: ${pendingRewards}`);
  
  console.log("\n✅ Demo completed successfully!");
}

/**
 * Main CLI interface
 */
async function main() {
  const command = process.argv[2];
  
  if (command === "demo") {
    await runDemo();
  } else if (command === "balance") {
    const address = process.argv[3];
    if (!address) {
      console.log("Usage: npm run interact balance <address>");
      process.exit(1);
    }
    
    const sylosContracts = new SylOSContracts();
    await sylosContracts.initialize();
    
    const sylosBalance = await sylosContracts.getSYLOSBalance(address);
    const wSYLOSBalance = await sylosContracts.getWSYLOSBalance(address);
    const pendingRewards = await sylosContracts.getPendingRewards(address);
    
    console.log(`Address: ${address}`);
    console.log(`SYLOS Balance: ${sylosBalance}`);
    console.log(`wSYLOS Balance: ${wSYLOSBalance}`);
    console.log(`Pending Rewards: ${pendingRewards}`);
  } else {
    console.log(`
SylOS Contract Interaction CLI

Usage:
  npm run interact demo                         - Run interactive demo
  npm run interact balance <address>            - Get balance for address
  npm run interact info                         - Get contract information

Environment variables required:
  SYLOS_TOKEN_ADDRESS
  WRAPPED_SYLOS_ADDRESS
  POP_TRACKER_ADDRESS
  META_TRANSACTION_PAYMASTER_ADDRESS
  SYLOS_GOVERNANCE_ADDRESS
    `);
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Interaction error:", error);
      process.exit(1);
    });
}

module.exports = { SylOSContracts };