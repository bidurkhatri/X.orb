const { ethers } = require("hardhat");

/**
 * Deploys the Xorb Agent Network contracts:
 *   1. AgentRegistry — On-chain agent lifecycle
 *   2. ReputationScore — Non-transferable reputation
 *   3. SlashingEngine — Automated penalty enforcement
 *
 * Requires existing deployments of:
 *   - WrappedXORB (USDC) — used as stake token
 *
 * Cross-contract permissions are configured automatically.
 */
async function main() {
  console.log("=".repeat(70));
  console.log("  Xorb Agent Network — Contract Deployment");
  console.log("=".repeat(70));

  const [deployer] = await ethers.getSigners();
  console.log(`\nDeployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // ---------------------------------------------------------------
  // Configuration — set these for your environment
  // ---------------------------------------------------------------

  // If deploying alongside existing contracts, set the USDC address:
  const WXORB_ADDRESS = process.env.WXORB_ADDRESS || "";
  const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || deployer.address;
  const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || deployer.address;

  let wrappedSylosAddress = WXORB_ADDRESS;

  // If no existing USDC, deploy full stack (for testing)
  if (!wrappedSylosAddress) {
    console.log("No WXORB_ADDRESS set — deploying full token stack...\n");

    // Deploy XorbToken
    console.log("[1/8] Deploying XorbToken...");
    const XorbToken = await ethers.getContractFactory("XorbToken");
    const sylToken = await XorbToken.deploy(
      "Xorb Token",
      "XORB",
      ethers.parseEther("1000000"),
      ADMIN_ADDRESS,
      ADMIN_ADDRESS
    );
    await sylToken.waitForDeployment();
    const sylTokenAddr = await sylToken.getAddress();
    console.log(`  XorbToken: ${sylTokenAddr}`);

    // Deploy WrappedXORB
    console.log("[2/8] Deploying WrappedXORB...");
    const WrappedXORB = await ethers.getContractFactory("WrappedXORB");
    const wrappedSylos = await WrappedXORB.deploy(
      sylTokenAddr,
      "Wrapped XORB",
      "USDC"
    );
    await wrappedSylos.waitForDeployment();
    wrappedSylosAddress = await wrappedSylos.getAddress();
    console.log(`  WrappedXORB: ${wrappedSylosAddress}`);
  } else {
    console.log(`Using existing USDC at: ${wrappedSylosAddress}\n`);
  }

  // ---------------------------------------------------------------
  // Deploy Agent Network Contracts
  // ---------------------------------------------------------------

  // Deploy AgentRegistry
  console.log("[3/8] Deploying AgentRegistry...");
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy(
    wrappedSylosAddress,
    TREASURY_ADDRESS,
    ADMIN_ADDRESS
  );
  await agentRegistry.waitForDeployment();
  const agentRegistryAddr = await agentRegistry.getAddress();
  console.log(`  AgentRegistry: ${agentRegistryAddr}`);

  // Deploy ReputationScore
  console.log("[4/8] Deploying ReputationScore...");
  const ReputationScore = await ethers.getContractFactory("ReputationScore");
  const reputationScore = await ReputationScore.deploy(
    agentRegistryAddr,
    ADMIN_ADDRESS
  );
  await reputationScore.waitForDeployment();
  const reputationScoreAddr = await reputationScore.getAddress();
  console.log(`  ReputationScore: ${reputationScoreAddr}`);

  // Deploy SlashingEngine
  console.log("[5/8] Deploying SlashingEngine...");
  const SlashingEngine = await ethers.getContractFactory("SlashingEngine");
  const slashingEngine = await SlashingEngine.deploy(
    agentRegistryAddr,
    reputationScoreAddr,
    ADMIN_ADDRESS
  );
  await slashingEngine.waitForDeployment();
  const slashingEngineAddr = await slashingEngine.getAddress();
  console.log(`  SlashingEngine: ${slashingEngineAddr}`);

  // ---------------------------------------------------------------
  // Configure Cross-Contract Permissions
  // ---------------------------------------------------------------

  console.log("\n[6/8] Configuring cross-contract permissions...");

  // AgentRegistry needs to know about ReputationScore and SlashingEngine
  await agentRegistry.setReputationContract(reputationScoreAddr);
  console.log("  AgentRegistry.reputationContract = ReputationScore");

  await agentRegistry.setSlashingContract(slashingEngineAddr);
  console.log("  AgentRegistry.slashingContract = SlashingEngine");

  // SlashingEngine needs ORACLE_ROLE on ReputationScore to apply deltas
  console.log("\n[7/8] Granting roles...");
  const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
  await reputationScore.grantRole(ORACLE_ROLE, slashingEngineAddr);
  console.log("  SlashingEngine granted ORACLE_ROLE on ReputationScore");

  // Grant OPERATOR_ROLE on AgentRegistry to deployer (for recordAction calls)
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  await agentRegistry.grantRole(OPERATOR_ROLE, deployer.address);
  console.log("  Deployer granted OPERATOR_ROLE on AgentRegistry");

  // Grant REPORTER_ROLE on SlashingEngine to deployer
  const REPORTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("REPORTER_ROLE"));
  await slashingEngine.grantRole(REPORTER_ROLE, deployer.address);
  console.log("  Deployer granted REPORTER_ROLE on SlashingEngine");

  // ---------------------------------------------------------------
  // Deploy Economy Contracts
  // ---------------------------------------------------------------

  console.log("\n[6/10] Deploying PaymentStreaming...");
  const PaymentStreaming = await ethers.getContractFactory("PaymentStreaming");
  const paymentStreaming = await PaymentStreaming.deploy(
    wrappedSylosAddress,
    TREASURY_ADDRESS
  );
  await paymentStreaming.waitForDeployment();
  const paymentStreamingAddr = await paymentStreaming.getAddress();
  console.log(`  PaymentStreaming: ${paymentStreamingAddr}`);

  console.log("[7/10] Deploying AgentMarketplace...");
  const AgentMarketplace = await ethers.getContractFactory("AgentMarketplace");
  const agentMarketplace = await AgentMarketplace.deploy(
    wrappedSylosAddress,
    TREASURY_ADDRESS
  );
  await agentMarketplace.waitForDeployment();
  const agentMarketplaceAddr = await agentMarketplace.getAddress();
  console.log(`  AgentMarketplace: ${agentMarketplaceAddr}`);

  // ---------------------------------------------------------------
  // Configure Cross-Contract Permissions
  // ---------------------------------------------------------------

  console.log("\n[8/10] Configuring cross-contract permissions...");

  // AgentRegistry needs to know about ReputationScore and SlashingEngine
  await agentRegistry.setReputationContract(reputationScoreAddr);
  console.log("  AgentRegistry.reputationContract = ReputationScore");

  await agentRegistry.setSlashingContract(slashingEngineAddr);
  console.log("  AgentRegistry.slashingContract = SlashingEngine");

  // SlashingEngine needs ORACLE_ROLE on ReputationScore to apply deltas
  console.log("\n[9/10] Granting roles...");
  const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
  await reputationScore.grantRole(ORACLE_ROLE, slashingEngineAddr);
  console.log("  SlashingEngine granted ORACLE_ROLE on ReputationScore");

  // Grant OPERATOR_ROLE on AgentRegistry to deployer (for recordAction calls)
  const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
  await agentRegistry.grantRole(OPERATOR_ROLE, deployer.address);
  console.log("  Deployer granted OPERATOR_ROLE on AgentRegistry");

  // Grant REPORTER_ROLE on SlashingEngine to deployer
  const REPORTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("REPORTER_ROLE"));
  await slashingEngine.grantRole(REPORTER_ROLE, deployer.address);
  console.log("  Deployer granted REPORTER_ROLE on SlashingEngine");

  // ---------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------

  console.log("\n[10/10] Verifying configuration...");
  console.log(`  AgentRegistry.reputationContract: ${await agentRegistry.reputationContract()}`);
  console.log(`  AgentRegistry.slashingContract: ${await agentRegistry.slashingContract()}`);
  console.log(`  AgentRegistry.minStakeBond: ${ethers.formatEther(await agentRegistry.minStakeBond())} USDC`);
  console.log(`  AgentRegistry.maxAgentsPerSponsor: ${await agentRegistry.maxAgentsPerSponsor()}`);

  console.log("\n" + "=".repeat(70));
  console.log("  DEPLOYMENT COMPLETE — Xorb Network + Economy Contracts");
  console.log("=".repeat(70));

  const contracts = {
    WrappedXORB: wrappedSylosAddress,
    AgentRegistry: agentRegistryAddr,
    ReputationScore: reputationScoreAddr,
    SlashingEngine: slashingEngineAddr,
    PaymentStreaming: paymentStreamingAddr,
    AgentMarketplace: agentMarketplaceAddr,
  };

  console.log("\nContract Addresses:");
  Object.entries(contracts).forEach(([name, addr]) => {
    console.log(`  ${name.padEnd(20)} ${addr}`);
  });

  console.log(`\nNetwork: ${hre.network.name}`);
  console.log(`Chain ID: ${(await ethers.provider.getNetwork()).chainId}`);

  console.log("\nNext Steps:");
  console.log("  1. Update frontend env vars with all contract addresses");
  console.log("  2. Grant ORACLE_ROLE to your backend oracle service");
  console.log("  3. Grant REPORTER_ROLE to your agent runtime service");
  console.log("  4. Run: npx hardhat test");

  return contracts;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error);
    process.exit(1);
  });
