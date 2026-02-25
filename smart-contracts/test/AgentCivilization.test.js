const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SylOS Agent Civilization", function () {
  let admin, sponsor, sponsor2, sessionWallet, other;
  let sylToken, wrappedSylos, agentRegistry, reputationScore, slashingEngine;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const STAKE_AMOUNT = ethers.parseEther("200"); // 200 wSYLOS
  const MIN_STAKE = ethers.parseEther("100");

  // AgentRole enum values
  const ROLE_TRADER = 0;
  const ROLE_RESEARCHER = 1;
  const ROLE_MONITOR = 2;
  const ROLE_CODER = 3;
  const ROLE_GOVERNANCE = 4;

  // ViolationType enum values
  const VIOLATION_RATE_LIMIT = 0;
  const VIOLATION_PERMISSION = 1;
  const VIOLATION_FUND_MISUSE = 2;
  const VIOLATION_CRITICAL = 3;

  // ActionType enum values (ReputationScore)
  const ACTION_TOOL_SUCCESS = 0;
  const ACTION_TASK_COMPLETION = 1;
  const ACTION_TOOL_FAILURE = 2;
  const ACTION_TASK_FAILURE = 3;
  const ACTION_RATE_LIMIT = 4;
  const ACTION_PERMISSION = 5;

  beforeEach(async function () {
    [admin, sponsor, sponsor2, sessionWallet, other] = await ethers.getSigners();

    // Deploy SylOSToken
    const SylOSToken = await ethers.getContractFactory("SylOSToken");
    sylToken = await SylOSToken.deploy(
      "SylOS Token",
      "SYLOS",
      INITIAL_SUPPLY,
      admin.address, // tax wallet
      admin.address  // admin
    );

    // Deploy WrappedSYLOS
    const WrappedSYLOS = await ethers.getContractFactory("WrappedSYLOS");
    wrappedSylos = await WrappedSYLOS.deploy(
      await sylToken.getAddress(),
      "Wrapped SYLOS",
      "wSYLOS"
    );

    // Deploy AgentRegistry
    const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
    agentRegistry = await AgentRegistry.deploy(
      await wrappedSylos.getAddress(),
      admin.address, // treasury
      admin.address  // admin
    );

    // Deploy ReputationScore
    const ReputationScore = await ethers.getContractFactory("ReputationScore");
    reputationScore = await ReputationScore.deploy(
      await agentRegistry.getAddress(),
      admin.address
    );

    // Deploy SlashingEngine
    const SlashingEngine = await ethers.getContractFactory("SlashingEngine");
    slashingEngine = await SlashingEngine.deploy(
      await agentRegistry.getAddress(),
      await reputationScore.getAddress(),
      admin.address
    );

    // Configure cross-contract permissions
    await agentRegistry.setReputationContract(await reputationScore.getAddress());
    await agentRegistry.setSlashingContract(await slashingEngine.getAddress());

    // Give SlashingEngine the ORACLE_ROLE on ReputationScore
    const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
    await reputationScore.grantRole(ORACLE_ROLE, await slashingEngine.getAddress());

    // Distribute tokens to sponsors
    // First, transfer SYLOS to sponsors
    await sylToken.transfer(sponsor.address, ethers.parseEther("10000"));
    await sylToken.transfer(sponsor2.address, ethers.parseEther("10000"));

    // Sponsors wrap their SYLOS to wSYLOS
    const wSylosAddr = await wrappedSylos.getAddress();
    await sylToken.connect(sponsor).approve(wSylosAddr, ethers.parseEther("10000"));
    await wrappedSylos.connect(sponsor).wrap(ethers.parseEther("5000"));

    await sylToken.connect(sponsor2).approve(wSylosAddr, ethers.parseEther("10000"));
    await wrappedSylos.connect(sponsor2).wrap(ethers.parseEther("5000"));

    // Approve AgentRegistry to spend wSYLOS for staking
    const registryAddr = await agentRegistry.getAddress();
    await wrappedSylos.connect(sponsor).approve(registryAddr, ethers.parseEther("50000"));
    await wrappedSylos.connect(sponsor2).approve(registryAddr, ethers.parseEther("50000"));
  });

  // =====================
  // AgentRegistry Tests
  // =====================

  describe("AgentRegistry", function () {
    const permissionHash = ethers.keccak256(ethers.toUtf8Bytes('{"role":"TRADER","allowedTools":["get_wallet_balance"]}'));
    const expiresAt = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days

    it("should spawn an agent with correct state", async function () {
      const tx = await agentRegistry.connect(sponsor).spawnAgent(
        "TradingBot-1",
        ROLE_TRADER,
        STAKE_AMOUNT,
        permissionHash,
        expiresAt,
        sessionWallet.address
      );

      const receipt = await tx.wait();
      const event = receipt.logs.find(l => l.fragment?.name === "AgentSpawned");
      expect(event).to.not.be.undefined;

      const agentId = event.args.agentId;
      const agent = await agentRegistry.getAgent(agentId);

      expect(agent.sponsor).to.equal(sponsor.address);
      expect(agent.name).to.equal("TradingBot-1");
      expect(agent.role).to.equal(ROLE_TRADER);
      expect(agent.stakeBond).to.equal(STAKE_AMOUNT);
      expect(agent.status).to.equal(0); // Active
      expect(agent.reputationScore).to.equal(5000);
      expect(agent.sessionWallet).to.equal(sessionWallet.address);
    });

    it("should reject spawn with insufficient stake", async function () {
      await expect(
        agentRegistry.connect(sponsor).spawnAgent(
          "CheapBot",
          ROLE_RESEARCHER,
          ethers.parseEther("50"), // Below 100 minimum
          permissionHash,
          expiresAt,
          sessionWallet.address
        )
      ).to.be.revertedWithCustomError(agentRegistry, "InsufficientStake");
    });

    it("should reject spawn with empty name", async function () {
      await expect(
        agentRegistry.connect(sponsor).spawnAgent(
          "",
          ROLE_RESEARCHER,
          STAKE_AMOUNT,
          permissionHash,
          expiresAt,
          sessionWallet.address
        )
      ).to.be.revertedWithCustomError(agentRegistry, "AgentNameEmpty");
    });

    it("should enforce max 10 agents per sponsor", async function () {
      for (let i = 0; i < 10; i++) {
        await agentRegistry.connect(sponsor).spawnAgent(
          `Bot-${i}`,
          ROLE_MONITOR,
          MIN_STAKE,
          permissionHash,
          expiresAt,
          sessionWallet.address
        );
      }

      await expect(
        agentRegistry.connect(sponsor).spawnAgent(
          "Bot-11",
          ROLE_MONITOR,
          MIN_STAKE,
          permissionHash,
          expiresAt,
          sessionWallet.address
        )
      ).to.be.revertedWithCustomError(agentRegistry, "MaxAgentsReached");
    });

    it("should transfer stake to contract on spawn", async function () {
      const balBefore = await wrappedSylos.balanceOf(sponsor.address);

      await agentRegistry.connect(sponsor).spawnAgent(
        "StakeBot",
        ROLE_TRADER,
        STAKE_AMOUNT,
        permissionHash,
        expiresAt,
        sessionWallet.address
      );

      const balAfter = await wrappedSylos.balanceOf(sponsor.address);
      expect(balBefore - balAfter).to.equal(STAKE_AMOUNT);
    });

    it("should pause and resume an agent", async function () {
      const tx = await agentRegistry.connect(sponsor).spawnAgent(
        "PauseBot", ROLE_CODER, STAKE_AMOUNT, permissionHash, expiresAt, sessionWallet.address
      );
      const receipt = await tx.wait();
      const agentId = receipt.logs.find(l => l.fragment?.name === "AgentSpawned").args.agentId;

      // Pause
      await agentRegistry.connect(sponsor).pauseAgent(agentId);
      let agent = await agentRegistry.getAgent(agentId);
      expect(agent.status).to.equal(1); // Paused

      // Resume
      await agentRegistry.connect(sponsor).resumeAgent(agentId);
      agent = await agentRegistry.getAgent(agentId);
      expect(agent.status).to.equal(0); // Active
    });

    it("should revoke and return remaining stake", async function () {
      const tx = await agentRegistry.connect(sponsor).spawnAgent(
        "RevokeBot", ROLE_TRADER, STAKE_AMOUNT, permissionHash, expiresAt, sessionWallet.address
      );
      const receipt = await tx.wait();
      const agentId = receipt.logs.find(l => l.fragment?.name === "AgentSpawned").args.agentId;

      const balBefore = await wrappedSylos.balanceOf(sponsor.address);
      await agentRegistry.connect(sponsor).revokeAgent(agentId);
      const balAfter = await wrappedSylos.balanceOf(sponsor.address);

      // Full stake returned (nothing slashed)
      expect(balAfter - balBefore).to.equal(STAKE_AMOUNT);

      const agent = await agentRegistry.getAgent(agentId);
      expect(agent.status).to.equal(2); // Revoked
    });

    it("should reject unauthorized pause", async function () {
      const tx = await agentRegistry.connect(sponsor).spawnAgent(
        "SecureBot", ROLE_TRADER, STAKE_AMOUNT, permissionHash, expiresAt, sessionWallet.address
      );
      const receipt = await tx.wait();
      const agentId = receipt.logs.find(l => l.fragment?.name === "AgentSpawned").args.agentId;

      await expect(
        agentRegistry.connect(other).pauseAgent(agentId)
      ).to.be.revertedWithCustomError(agentRegistry, "NotSponsorOrAdmin");
    });

    it("should renew an agent expiry", async function () {
      const shortExpiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour
      const tx = await agentRegistry.connect(sponsor).spawnAgent(
        "RenewBot", ROLE_TRADER, STAKE_AMOUNT, permissionHash, shortExpiry, sessionWallet.address
      );
      const receipt = await tx.wait();
      const agentId = receipt.logs.find(l => l.fragment?.name === "AgentSpawned").args.agentId;

      const newExpiry = Math.floor(Date.now() / 1000) + 86400 * 365;
      await agentRegistry.connect(sponsor).renewAgent(agentId, newExpiry);

      const agent = await agentRegistry.getAgent(agentId);
      expect(agent.expiresAt).to.equal(newExpiry);
    });

    it("should top up stake", async function () {
      const tx = await agentRegistry.connect(sponsor).spawnAgent(
        "TopUpBot", ROLE_TRADER, STAKE_AMOUNT, permissionHash, expiresAt, sessionWallet.address
      );
      const receipt = await tx.wait();
      const agentId = receipt.logs.find(l => l.fragment?.name === "AgentSpawned").args.agentId;

      const topUpAmount = ethers.parseEther("100");
      await agentRegistry.connect(sponsor).topUpStake(agentId, topUpAmount);

      const agent = await agentRegistry.getAgent(agentId);
      expect(agent.stakeBond).to.equal(STAKE_AMOUNT + topUpAmount);
    });

    it("should return correct active status", async function () {
      const tx = await agentRegistry.connect(sponsor).spawnAgent(
        "StatusBot", ROLE_TRADER, STAKE_AMOUNT, permissionHash, expiresAt, sessionWallet.address
      );
      const receipt = await tx.wait();
      const agentId = receipt.logs.find(l => l.fragment?.name === "AgentSpawned").args.agentId;

      expect(await agentRegistry.isActive(agentId)).to.be.true;

      await agentRegistry.connect(sponsor).pauseAgent(agentId);
      expect(await agentRegistry.isActive(agentId)).to.be.false;
    });
  });

  // =======================
  // ReputationScore Tests
  // =======================

  describe("ReputationScore", function () {
    let agentId;

    beforeEach(async function () {
      const permissionHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const expiresAt = Math.floor(Date.now() / 1000) + 86400 * 30;

      const tx = await agentRegistry.connect(sponsor).spawnAgent(
        "RepBot", ROLE_RESEARCHER, STAKE_AMOUNT, permissionHash, expiresAt, sessionWallet.address
      );
      const receipt = await tx.wait();
      agentId = receipt.logs.find(l => l.fragment?.name === "AgentSpawned").args.agentId;

      // Initialize reputation
      await reputationScore.initializeReputation(agentId);
    });

    it("should initialize with default score of 5000", async function () {
      expect(await reputationScore.getReputation(agentId)).to.equal(5000);
    });

    it("should return RELIABLE tier for score 5000", async function () {
      expect(await reputationScore.getTier(agentId)).to.equal(2); // RELIABLE
    });

    it("should increase score on tool success", async function () {
      await reputationScore.recordAction(agentId, ACTION_TOOL_SUCCESS, "Fetched balance");
      expect(await reputationScore.getReputation(agentId)).to.equal(5001);
    });

    it("should increase score on task completion", async function () {
      await reputationScore.recordAction(agentId, ACTION_TASK_COMPLETION, "Completed trade analysis");
      expect(await reputationScore.getReputation(agentId)).to.equal(5005);
    });

    it("should decrease score on tool failure", async function () {
      await reputationScore.recordAction(agentId, ACTION_TOOL_FAILURE, "RPC call failed");
      expect(await reputationScore.getReputation(agentId)).to.equal(4995);
    });

    it("should decrease score on permission violation", async function () {
      await reputationScore.recordAction(agentId, ACTION_PERMISSION, "Tried to call unauthorized contract");
      expect(await reputationScore.getReputation(agentId)).to.equal(4900);
    });

    it("should not go below 0", async function () {
      // Apply massive penalty
      await reputationScore.applyCustomDelta(agentId, -10000, "test underflow");
      expect(await reputationScore.getReputation(agentId)).to.equal(0);
    });

    it("should not exceed 10000", async function () {
      await reputationScore.applyCustomDelta(agentId, 10000, "test overflow");
      expect(await reputationScore.getReputation(agentId)).to.equal(10000);
    });

    it("should track action history", async function () {
      await reputationScore.recordAction(agentId, ACTION_TOOL_SUCCESS, "action1");
      await reputationScore.recordAction(agentId, ACTION_TASK_COMPLETION, "action2");
      await reputationScore.recordAction(agentId, ACTION_TOOL_FAILURE, "action3");

      const historyLen = await reputationScore.getActionHistoryLength(agentId);
      expect(historyLen).to.equal(3);
    });

    it("should reject unauthorized reputation updates", async function () {
      await expect(
        reputationScore.connect(other).recordAction(agentId, ACTION_TOOL_SUCCESS, "unauthorized")
      ).to.be.reverted; // AccessControl revert
    });

    it("should auto-pause agent when reputation drops below 500", async function () {
      // Drop reputation to below 500: 5000 - 100*46 = 400
      for (let i = 0; i < 46; i++) {
        await reputationScore.recordAction(agentId, ACTION_PERMISSION, `violation-${i}`);
      }

      const rep = await reputationScore.getReputation(agentId);
      expect(rep).to.be.lessThan(500);

      // Agent should now be paused
      const agent = await agentRegistry.getAgent(agentId);
      expect(agent.status).to.equal(1); // Paused
    });
  });

  // =======================
  // SlashingEngine Tests
  // =======================

  describe("SlashingEngine", function () {
    let agentId;

    beforeEach(async function () {
      const permissionHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
      const expiresAt = Math.floor(Date.now() / 1000) + 86400 * 30;

      const tx = await agentRegistry.connect(sponsor).spawnAgent(
        "SlashBot", ROLE_TRADER, STAKE_AMOUNT, permissionHash, expiresAt, sessionWallet.address
      );
      const receipt = await tx.wait();
      agentId = receipt.logs.find(l => l.fragment?.name === "AgentSpawned").args.agentId;

      await reputationScore.initializeReputation(agentId);
    });

    it("should slash 5% for rate limit violation", async function () {
      const treasuryBefore = await wrappedSylos.balanceOf(admin.address);

      await slashingEngine.reportAndSlash(
        agentId, VIOLATION_RATE_LIMIT, "Exceeded 300 actions/hour"
      );

      const agent = await agentRegistry.getAgent(agentId);
      const expectedSlash = STAKE_AMOUNT * 500n / 10000n; // 5%
      expect(agent.slashedAmount).to.equal(expectedSlash);
    });

    it("should slash 10% for permission violation", async function () {
      await slashingEngine.reportAndSlash(
        agentId, VIOLATION_PERMISSION, "Called unauthorized contract"
      );

      const agent = await agentRegistry.getAgent(agentId);
      const expectedSlash = STAKE_AMOUNT * 1000n / 10000n; // 10%
      expect(agent.slashedAmount).to.equal(expectedSlash);
    });

    it("should slash 25% for fund misuse", async function () {
      await slashingEngine.reportAndSlash(
        agentId, VIOLATION_FUND_MISUSE, "Transferred to unauthorized address"
      );

      const agent = await agentRegistry.getAgent(agentId);
      const expectedSlash = STAKE_AMOUNT * 2500n / 10000n; // 25%
      expect(agent.slashedAmount).to.equal(expectedSlash);
    });

    it("should slash 50% and auto-revoke for critical fault", async function () {
      await slashingEngine.reportAndSlash(
        agentId, VIOLATION_CRITICAL, "Exploited protocol vulnerability"
      );

      const agent = await agentRegistry.getAgent(agentId);
      const expectedSlash = STAKE_AMOUNT * 5000n / 10000n; // 50%
      expect(agent.slashedAmount).to.equal(expectedSlash);
      expect(agent.status).to.equal(2); // Revoked
    });

    it("should send slashed funds to treasury", async function () {
      const treasuryBefore = await wrappedSylos.balanceOf(admin.address);

      await slashingEngine.reportAndSlash(
        agentId, VIOLATION_RATE_LIMIT, "Rate limit exceeded"
      );

      const treasuryAfter = await wrappedSylos.balanceOf(admin.address);
      const expectedSlash = STAKE_AMOUNT * 500n / 10000n;
      expect(treasuryAfter - treasuryBefore).to.equal(expectedSlash);
    });

    it("should also reduce reputation on slash", async function () {
      const repBefore = await reputationScore.getReputation(agentId);

      await slashingEngine.reportAndSlash(
        agentId, VIOLATION_RATE_LIMIT, "Rate limit exceeded"
      );

      const repAfter = await reputationScore.getReputation(agentId);
      expect(repAfter).to.be.lessThan(repBefore);
      expect(repBefore - repAfter).to.equal(50n); // -50 for rate limit
    });

    it("should enforce cooldown between slashes", async function () {
      await slashingEngine.reportAndSlash(
        agentId, VIOLATION_RATE_LIMIT, "First slash"
      );

      await expect(
        slashingEngine.reportAndSlash(agentId, VIOLATION_RATE_LIMIT, "Too soon")
      ).to.be.revertedWithCustomError(slashingEngine, "AgentOnCooldown");
    });

    it("should allow slash after cooldown expires", async function () {
      await slashingEngine.reportAndSlash(
        agentId, VIOLATION_RATE_LIMIT, "First slash"
      );

      // Advance time past cooldown (1 hour)
      await time.increase(3601);

      // Should succeed now
      await slashingEngine.reportAndSlash(
        agentId, VIOLATION_RATE_LIMIT, "Second slash"
      );

      expect(await slashingEngine.getAgentSlashCount(agentId)).to.equal(2);
    });

    it("should track slash records", async function () {
      await slashingEngine.reportAndSlash(
        agentId, VIOLATION_PERMISSION, "Unauthorized access"
      );

      const records = await slashingEngine.getAgentSlashRecords(agentId);
      expect(records.length).to.equal(1);

      const record = await slashingEngine.getSlashRecord(records[0]);
      expect(record.agentId).to.equal(agentId);
      expect(record.violationType).to.equal(VIOLATION_PERMISSION);
      expect(record.executed).to.be.true;
    });

    it("should support report-then-execute flow", async function () {
      const recordId = await slashingEngine.reportViolation.staticCall(
        agentId, VIOLATION_FUND_MISUSE, "Under review"
      );
      await slashingEngine.reportViolation(
        agentId, VIOLATION_FUND_MISUSE, "Under review"
      );

      // Not yet executed
      let record = await slashingEngine.getSlashRecord(recordId);
      expect(record.executed).to.be.false;

      // Governor executes
      const GOVERNOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("GOVERNOR_ROLE"));
      await slashingEngine.executeSlash(recordId);

      record = await slashingEngine.getSlashRecord(recordId);
      expect(record.executed).to.be.true;
    });

    it("should reject unauthorized reporters", async function () {
      await expect(
        slashingEngine.connect(other).reportAndSlash(
          agentId, VIOLATION_RATE_LIMIT, "unauthorized"
        )
      ).to.be.reverted;
    });
  });

  // ==============================
  // Full Lifecycle Integration Test
  // ==============================

  describe("Full Agent Lifecycle", function () {
    it("spawn → work → earn reputation → violate → slash → revoke", async function () {
      const permissionHash = ethers.keccak256(ethers.toUtf8Bytes("trader-scope"));
      const expiresAt = Math.floor(Date.now() / 1000) + 86400 * 90;

      // 1. Sponsor spawns an agent
      const tx = await agentRegistry.connect(sponsor).spawnAgent(
        "LifecycleBot", ROLE_TRADER, STAKE_AMOUNT, permissionHash, expiresAt, sessionWallet.address
      );
      const receipt = await tx.wait();
      const agentId = receipt.logs.find(l => l.fragment?.name === "AgentSpawned").args.agentId;

      // 2. Initialize reputation
      await reputationScore.initializeReputation(agentId);
      expect(await reputationScore.getReputation(agentId)).to.equal(5000);

      // 3. Agent does good work (20 successful tools, 5 completed tasks)
      for (let i = 0; i < 20; i++) {
        await reputationScore.recordAction(agentId, ACTION_TOOL_SUCCESS, `tool-${i}`);
      }
      for (let i = 0; i < 5; i++) {
        await reputationScore.recordAction(agentId, ACTION_TASK_COMPLETION, `task-${i}`);
      }
      // 5000 + 20 + 25 = 5045
      expect(await reputationScore.getReputation(agentId)).to.equal(5045);

      // 4. Agent hits a rate limit violation
      await slashingEngine.reportAndSlash(agentId, VIOLATION_RATE_LIMIT, "300+ actions in 1 hour");

      // Reputation decreased by 50: 5045 - 50 = 4995
      expect(await reputationScore.getReputation(agentId)).to.equal(4995);

      // Stake slashed by 5%: 200 * 5% = 10
      let agent = await agentRegistry.getAgent(agentId);
      expect(agent.slashedAmount).to.equal(ethers.parseEther("10"));

      // Agent still active
      expect(await agentRegistry.isActive(agentId)).to.be.true;

      // 5. Wait for cooldown, then critical fault
      await time.increase(3601);
      await slashingEngine.reportAndSlash(agentId, VIOLATION_CRITICAL, "Drained user funds");

      // Agent auto-revoked
      agent = await agentRegistry.getAgent(agentId);
      expect(agent.status).to.equal(2); // Revoked

      // 6. Remaining stake returned to sponsor (200 - 10 - 95 = 95 returned)
      // First slash: 10 wSYLOS
      // Second slash: 50% of remaining (190) = 95
      // Total slashed: 10 + 95 = 105
      // Returned: 200 - 105 = 95
      expect(agent.slashedAmount).to.equal(ethers.parseEther("105"));
    });
  });
});
