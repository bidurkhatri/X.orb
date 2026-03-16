const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying X.orb contracts to Base with account:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)));

  // USDC addresses by network
  const USDC_ADDRESSES = {
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",    // Base Mainnet
    84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",   // Base Sepolia
    137: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",     // Polygon Mainnet
    80001: "0x0FA8781a83E46826621b3BC094Ea2A0212e71B23",   // Polygon Mumbai
  };

  const chainId = (await deployer.provider.getNetwork()).chainId;
  const usdcAddress = USDC_ADDRESSES[Number(chainId)];

  if (!usdcAddress) {
    throw new Error(`No USDC address configured for chain ${chainId}`);
  }

  console.log(`\nChain: ${chainId}`);
  console.log(`USDC: ${usdcAddress}`);
  console.log("\n--- Deploying Contracts ---\n");

  // 1. Deploy XorbEscrow
  const treasury = deployer.address; // Use deployer as treasury for now
  const XorbEscrow = await hre.ethers.getContractFactory("XorbEscrow");
  const escrow = await XorbEscrow.deploy(usdcAddress, treasury);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("1. XorbEscrow deployed to:", escrowAddr);

  // 2. Deploy AgentRegistry
  const minStake = hre.ethers.parseUnits("10", 6); // 10 USDC minimum
  const maxAgentsPerSponsor = 10;
  const AgentRegistry = await hre.ethers.getContractFactory("AgentRegistry");
  const registry = await AgentRegistry.deploy(usdcAddress, minStake, maxAgentsPerSponsor);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("2. AgentRegistry deployed to:", registryAddr);

  // 3. Deploy ReputationScore
  const ReputationScore = await hre.ethers.getContractFactory("ReputationScore");
  const reputation = await ReputationScore.deploy();
  await reputation.waitForDeployment();
  const reputationAddr = await reputation.getAddress();
  console.log("3. ReputationScore deployed to:", reputationAddr);

  // 4. Deploy SlashingEngine
  const SlashingEngine = await hre.ethers.getContractFactory("SlashingEngine");
  const slashing = await SlashingEngine.deploy(registryAddr, reputationAddr);
  await slashing.waitForDeployment();
  const slashingAddr = await slashing.getAddress();
  console.log("4. SlashingEngine deployed to:", slashingAddr);

  // 5. Deploy ActionVerifier
  const ActionVerifier = await hre.ethers.getContractFactory("ActionVerifier");
  const verifier = await ActionVerifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddr = await verifier.getAddress();
  console.log("5. ActionVerifier deployed to:", verifierAddr);

  // 6. Deploy PaymentStreaming
  const PaymentStreaming = await hre.ethers.getContractFactory("PaymentStreaming");
  const streaming = await PaymentStreaming.deploy(usdcAddress);
  await streaming.waitForDeployment();
  const streamingAddr = await streaming.getAddress();
  console.log("6. PaymentStreaming deployed to:", streamingAddr);

  // 7. Deploy AgentMarketplace
  const protocolFeeBps = 200; // 2%
  const AgentMarketplace = await hre.ethers.getContractFactory("AgentMarketplace");
  const marketplace = await AgentMarketplace.deploy(usdcAddress, registryAddr, reputationAddr, protocolFeeBps);
  await marketplace.waitForDeployment();
  const marketplaceAddr = await marketplace.getAddress();
  console.log("7. AgentMarketplace deployed to:", marketplaceAddr);

  // --- Print Summary ---
  console.log("\n=== X.orb Deployment Summary ===");
  console.log(`Chain ID:         ${chainId}`);
  console.log(`USDC:             ${usdcAddress}`);
  console.log(`XorbEscrow:       ${escrowAddr}`);
  console.log(`AgentRegistry:    ${registryAddr}`);
  console.log(`ReputationScore:  ${reputationAddr}`);
  console.log(`SlashingEngine:   ${slashingAddr}`);
  console.log(`ActionVerifier:   ${verifierAddr}`);
  console.log(`PaymentStreaming:  ${streamingAddr}`);
  console.log(`AgentMarketplace: ${marketplaceAddr}`);
  console.log("================================\n");

  // --- Write addresses to file ---
  const fs = require("fs");
  const addresses = {
    chainId: Number(chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      USDC: usdcAddress,
      XorbEscrow: escrowAddr,
      AgentRegistry: registryAddr,
      ReputationScore: reputationAddr,
      SlashingEngine: slashingAddr,
      ActionVerifier: verifierAddr,
      PaymentStreaming: streamingAddr,
      AgentMarketplace: marketplaceAddr,
    },
  };

  const filename = `deployments/base-${chainId}-${Date.now()}.json`;
  fs.mkdirSync("deployments", { recursive: true });
  fs.writeFileSync(filename, JSON.stringify(addresses, null, 2));
  console.log(`Addresses written to ${filename}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
