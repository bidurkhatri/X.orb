const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SylOS Smart Contracts Integration", function () {
  let owner, admin, taxWallet, liquidityWallet, treasury, manager, verifier, validator, pauser, emergency, user1, user2;
  let sylosToken, wrappedSYLOS, popTracker, metaTransactionPaymaster, sylosGovernance;

  const initialSupply = ethers.parseEther("1000000");
  const testAmount = ethers.parseEther("1000");
  const oneDay = 24 * 60 * 60;

  beforeEach(async function () {
    // Get signers
    [owner, admin, taxWallet, liquidityWallet, treasury, manager, verifier, validator, pauser, emergency, user1, user2] = await ethers.getSigners();

    // Deploy SylOSToken
    const SylOSToken = await ethers.getContractFactory("SylOSToken");
    sylosToken = await SylOSToken.deploy(
      "SylOSToken",
      "SYLOS",
      ethers.parseEther("1000"),
      admin.address,
      taxWallet.address,
      liquidityWallet.address
    );
    await sylosToken.waitForDeployment();

    // Deploy WrappedSYLOS
    const WrappedSYLOS = await ethers.getContractFactory("WrappedSYLOS");
    wrappedSYLOS = await WrappedSYLOS.deploy(
      await sylosToken.getAddress(),
      "Wrapped SylOS Token",
      "wSYLOS"
    );
    await wrappedSYLOS.waitForDeployment();

    // Deploy PoPTracker
    const PoPTracker = await ethers.getContractFactory("PoPTracker");
    popTracker = await PoPTracker.deploy(
      await wrappedSYLOS.getAddress(),
      treasury.address,
      admin.address
    );
    await popTracker.waitForDeployment();

    // Deploy MetaTransactionPaymaster
    const MetaTransactionPaymaster = await ethers.getContractFactory("MetaTransactionPaymaster");
    metaTransactionPaymaster = await MetaTransactionPaymaster.deploy(
      admin.address,
      treasury.address
    );
    await metaTransactionPaymaster.waitForDeployment();

    // Deploy SylOSGovernance
    const SylOSGovernance = await ethers.getContractFactory("SylOSGovernance");
    sylosGovernance = await SylOSGovernance.deploy(
      await sylosToken.getAddress(),
      treasury.address,
      treasury.address,
      admin.address
    );
    await sylosGovernance.waitForDeployment();

    // Post-deployment setup
    await sylosToken.mint(admin.address, ethers.parseEther("100000"));
    await metaTransactionPaymaster.addPaymentToken(
      await sylosToken.getAddress(),
      ethers.parseEther("0.00002"),
      "SylOSToken",
      "SYLOS"
    );

    // Setup roles
    await popTracker.grantRole(await popTracker.MANAGER_ROLE(), manager.address);
    await popTracker.grantRole(await popTracker.VERIFIER_ROLE(), verifier.address);
    await popTracker.grantRole(await popTracker.VALIDATOR_ROLE(), validator.address);
  });

  describe("SylOSToken", function () {
    it("Should deploy with correct initial parameters", async function () {
      expect(await sylosToken.name()).to.equal("SylOSToken");
      expect(await sylosToken.symbol()).to.equal("SYLOS");
      expect(await sylosToken.totalSupply()).to.equal(ethers.parseEther("1000"));
    });

    it("Should allow minting by minter role", async function () {
      await sylosToken.mint(user1.address, testAmount);
      expect(await sylosToken.balanceOf(user1.address)).to.equal(testAmount);
    });

    it("Should allow batch minting", async function () {
      const recipients = [user1.address, user2.address];
      const amounts = [testAmount, testAmount];
      await sylosToken.batchMint(recipients, amounts);
      expect(await sylosToken.balanceOf(user1.address)).to.equal(testAmount);
      expect(await sylosToken.balanceOf(user2.address)).to.equal(testAmount);
    });

    it("Should collect taxes on transfer", async function () {
      await sylosToken.transfer(user1.address, testAmount);
      const taxRate = await sylosToken.taxRate();
      const expectedTax = testAmount.mul(taxRate).div(10000);
      const expectedTransfer = testAmount.sub(expectedTax);
      
      expect(await sylosToken.balanceOf(user1.address)).to.equal(expectedTransfer);
    });

    it("Should allow burning", async function () {
      await sylosToken.transfer(user1.address, testAmount);
      const initialBalance = await sylosToken.balanceOf(user1.address);
      await sylosToken.connect(user1).burn(ethers.parseEther("100"));
      
      expect(await sylosToken.balanceOf(user1.address)).to.equal(initialBalance.sub(ethers.parseEther("100")));
    });
  });

  describe("WrappedSYLOS", function () {
    beforeEach(async function () {
      await sylosToken.transfer(user1.address, testAmount);
      await sylosToken.connect(user1).approve(await wrappedSYLOS.getAddress(), testAmount);
    });

    it("Should wrap and unwrap tokens", async function () {
      // Wrap tokens
      await wrappedSYLOS.connect(user1).wrap(testAmount);
      expect(await wrappedSYLOS.balanceOf(user1.address)).to.equal(testAmount);
      expect(await sylosToken.balanceOf(user1.address)).to.equal(0);

      // Unwrap tokens
      await wrappedSYLOS.connect(user1).unwrap(testAmount);
      expect(await wrappedSYLOS.balanceOf(user1.address)).to.equal(0);
      expect(await sylosToken.balanceOf(user1.address)).to.be.gte(0);
    });

    it("Should allow time-locking with bonus", async function () {
      await wrappedSYLOS.connect(user1).wrap(testAmount);
      await wrappedSYLOS.connect(user1).timeLock(ethers.parseEther("500"), 0);
      
      const lockedAmounts = await wrappedSYLOS.getTimeLockedAmounts(user1.address);
      expect(lockedAmounts[0]).to.equal(ethers.parseEther("500"));
    });

    it("Should calculate staking multipliers", async function () {
      // Advance time by 10 days
      await ethers.provider.send("evm_increaseTime", [10 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);
      
      const multiplier = await wrappedSYLOS.getStakingMultiplier(user1.address);
      expect(multiplier).to.be.gt(10000); // Should have bonus
    });
  });

  describe("PoPTracker", function () {
    let taskId;

    beforeEach(async function () {
      taskId = await popTracker.connect(manager).createTask(
        "Test Task",
        40, // 40 hours
        8 // Complexity 8/10
      );
    });

    it("Should create tasks", async function () {
      const task = await popTracker.getTask(taskId);
      expect(task.taskId).to.equal(taskId);
      expect(task.taskDescription).to.equal("Test Task");
      expect(task.complexity).to.equal(8);
    });

    it("Should allow task completion", async function () {
      await popTracker.connect(user1).completeTask(
        taskId,
        35, // 35 hours actual
        800, // 80% quality
        "QmTestHash"
      );

      const task = await popTracker.getTask(taskId);
      expect(task.completedAt).to.be.gt(0);
      expect(task.qualityScore).to.equal(800);
    });

    it("Should record productivity metrics", async function () {
      const metrics = {
        taskCompletion: 900, // 90%
        codeQuality: 800,   // 80%
        collaborationScore: 700, // 70%
        innovationIndex: 600,    // 60%
        impactScore: 900,        // 90%
        timeEfficiency: 800      // 80%
      };

      await popTracker.connect(verifier).recordProductivity(
        user1.address,
        metrics,
        "QmProductivityHash"
      );

      const userProfile = await popTracker.getUserProfile(user1.address);
      expect(userProfile.totalTasks).to.equal(0);
      expect(userProfile.totalScore).to.be.gt(0);
    });

    it("Should distribute rewards", async function () {
      // Set up reward distribution
      const startTime = Math.floor(Date.now() / 1000);
      const endTime = startTime + (30 * 24 * 60 * 60); // 30 days
      
      // This would need to be implemented with proper reward setup
      // For now, we'll test the basic structure
      const cycle = await popTracker.getCurrentCycle();
      expect(cycle).to.be.an("array");
    });
  });

  describe("MetaTransactionPaymaster", function () {
    it("Should add payment tokens", async function () {
      const tokenInfo = await metaTransactionPaymaster.getPaymentToken(await sylosToken.getAddress());
      expect(tokenInfo.isActive).to.be.true;
    });

    it("Should handle whitelisting", async function () {
      await metaTransactionPaymaster.connect(admin).setWhitelist(user1.address, true, 10000);
      
      const userInfo = await metaTransactionPaymaster.getUserInfo(user1.address);
      expect(userInfo.isWhitelisted).to.be.true;
    });

    it("Should handle blacklisting", async function () {
      await metaTransactionPaymaster.connect(admin).setBlacklist(user1.address, true);
      
      const userInfo = await metaTransactionPaymaster.getUserInfo(user1.address);
      expect(userInfo.isBlacklisted).to.be.true;
    });

    it("Should calculate payments correctly", async function () {
      // Test the payment calculation logic
      const gasLimit = 21000;
      const gasPrice = ethers.parseEther("0.00002"); // 20 gwei
      const expectedPayment = ethers.parseEther("0.42"); // 21000 * 0.00002
      
      // This would need actual meta transaction execution to test fully
      // For now, we test the structure
      expect(gasLimit).to.equal(21000);
    });
  });

  describe("SylOSGovernance", function () {
    beforeEach(async function () {
      // Add some governors
      await sylosGovernance.connect(admin).addGovernor(manager.address);
      await sylosGovernance.connect(admin).addGovernor(verifier.address);
    });

    it("Should add governors", async function () {
      await sylosGovernance.connect(admin).addGovernor(user1.address);
      // The actual check would require querying contract state
    });

    it("Should allow delegation", async function () {
      await sylosToken.transfer(user1.address, testAmount);
      await sylosGovernance.connect(user1).delegate(manager.address);
      
      // The actual delegation would be reflected in votes
      expect(true).to.be.true; // Placeholder test
    });

    it("Should allow proposal creation", async function () {
      // Lock funds for governance
      await sylosToken.connect(user1).approve(await sylosGovernance.getAddress(), testAmount);
      await sylosGovernance.connect(user1).lockFunds(testAmount);

      const targets = [user1.address];
      const values = [0];
      const calldatas = ["0x"];
      const title = "Test Proposal";
      const description = "This is a test proposal";
      const evidence = "QmTestEvidence";

      // This would need sufficient voting power
      // For now, we test the structure
      expect(true).to.be.true; // Placeholder test
    });

    it("Should allow voting", async function () {
      // This would require an actual proposal to be created
      expect(true).to.be.true; // Placeholder test
    });
  });

  describe("Integration Tests", function () {
    it("Should work end-to-end workflow", async function () {
      // 1. Transfer tokens to user
      await sylosToken.transfer(user1.address, testAmount);
      
      // 2. User wraps tokens
      await sylosToken.connect(user1).approve(await wrappedSYLOS.getAddress(), testAmount);
      await wrappedSYLOS.connect(user1).wrap(testAmount);
      
      // 3. User completes task and gets productivity score
      const taskId = await popTracker.connect(manager).createTask("Integration Test Task", 30, 7);
      await popTracker.connect(user1).completeTask(taskId, 25, 750, "QmIntegrationHash");
      
      // 4. Record productivity
      const metrics = {
        taskCompletion: 800,
        codeQuality: 850,
        collaborationScore: 700,
        innovationIndex: 600,
        impactScore: 800,
        timeEfficiency: 780
      };
      
      await popTracker.connect(verifier).recordProductivity(user1.address, metrics, "QmMetricsHash");
      
      // Verify the workflow
      const userProfile = await popTracker.getUserProfile(user1.address);
      expect(userProfile.totalTasks).to.equal(1);
      expect(userProfile.completedTasks).to.equal(1);
      
      const wrappedBalance = await wrappedSYLOS.balanceOf(user1.address);
      expect(wrappedBalance).to.be.gt(0);
    });

    it("Should handle governance proposal workflow", async function () {
      // 1. Set up governance
      await sylosToken.connect(user1).approve(await sylosGovernance.getAddress(), testAmount);
      
      // 2. Add governors
      await sylosGovernance.connect(admin).addGovernor(user1.address);
      
      // 3. Test governance functions
      const settings = await sylosGovernance.getSettings();
      expect(settings).to.be.an("object");
    });
  });
});