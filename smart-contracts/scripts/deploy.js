const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting SylOS Smart Contracts Deployment...\n");

  // Get signers
  const [deployer, admin, taxWallet, liquidityWallet, treasury, manager, verifier, validator, pauser, emergency] = await ethers.getSigners();

  console.log("📋 Deploying with accounts:");
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Admin: ${admin.address}`);
  console.log(`  Treasury: ${treasury.address}\n`);

  // Contract addresses deployment tracking
  const deployedContracts = {};

  try {
    // Deploy SylOSToken
    console.log("🏗️  Deploying SylOSToken...");
    const initialSupply = ethers.parseEther("1000000"); // 1M SYLOS
    const SylOSToken = await ethers.getContractFactory("SylOSToken");
    const sylosToken = await SylOSToken.deploy(
      "SylOSToken",
      "SYLOS",
      ethers.parseEther("1000"), // Initial supply of 1000 tokens
      admin.address,
      taxWallet.address,
      liquidityWallet.address
    );
    await sylosToken.waitForDeployment();
    const sylosTokenAddress = await sylosToken.getAddress();

    console.log(`✅ SylOSToken deployed at: ${sylosTokenAddress}`);
    deployedContracts.SylOSToken = {
      address: sylosTokenAddress,
      transactionHash: sylosToken.deploymentTransaction().hash
    };

    // Mint additional tokens for development and testing
    console.log("🔨 Minting additional tokens for development...");
    const mintAmount = ethers.parseEther("100000"); // 100K tokens
    const mintTx = await sylosToken.mint(admin.address, mintAmount);
    await mintTx.wait();
    console.log("✅ Additional tokens minted");

    // Deploy WrappedSYLOS
    console.log("\n🏗️  Deploying WrappedSYLOS...");
    const WrappedSYLOS = await ethers.getContractFactory("WrappedSYLOS");
    const wrappedSYLOS = await WrappedSYLOS.deploy(
      sylosTokenAddress,
      "Wrapped SylOS Token",
      "wSYLOS"
    );
    await wrappedSYLOS.waitForDeployment();
    const wrappedSYLOSAddress = await wrappedSYLOS.getAddress();

    console.log(`✅ WrappedSYLOS deployed at: ${wrappedSYLOSAddress}`);
    deployedContracts.WrappedSYLOS = {
      address: wrappedSYLOSAddress,
      transactionHash: wrappedSYLOS.deploymentTransaction().hash
    };

    // Deploy PoPTracker
    console.log("\n🏗️  Deploying PoPTracker...");
    const PoPTracker = await ethers.getContractFactory("PoPTracker");
    const popTracker = await PoPTracker.deploy(
      wrappedSYLOSAddress,
      treasury.address,
      admin.address,
      admin.address // Temporarily using admin as a mock Chainlink Router for network-agnostic deployment
    );
    await popTracker.waitForDeployment();
    const popTrackerAddress = await popTracker.getAddress();

    console.log(`✅ PoPTracker deployed at: ${popTrackerAddress}`);
    deployedContracts.PoPTracker = {
      address: popTrackerAddress,
      transactionHash: popTracker.deploymentTransaction().hash
    };

    // Deploy MetaTransactionPaymaster
    console.log("\n🏗️  Deploying MetaTransactionPaymaster...");
    const MetaTransactionPaymaster = await ethers.getContractFactory("MetaTransactionPaymaster");
    const metaTransactionPaymaster = await MetaTransactionPaymaster.deploy(
      admin.address,
      treasury.address
    );
    await metaTransactionPaymaster.waitForDeployment();
    const metaTransactionPaymasterAddress = await metaTransactionPaymaster.getAddress();

    console.log(`✅ MetaTransactionPaymaster deployed at: ${metaTransactionPaymasterAddress}`);
    deployedContracts.MetaTransactionPaymaster = {
      address: metaTransactionPaymasterAddress,
      transactionHash: metaTransactionPaymaster.deploymentTransaction().hash
    };

    // Deploy SylOS_SBT
    console.log("\n🏗️  Deploying SylOS_SBT...");
    const SylOSSBT = await ethers.getContractFactory("SylOS_SBT");
    const sylosSBT = await SylOSSBT.deploy(admin.address);
    await sylosSBT.waitForDeployment();
    const sylosSBTAddress = await sylosSBT.getAddress();

    console.log(`✅ SylOS_SBT deployed at: ${sylosSBTAddress}`);
    deployedContracts.SylOS_SBT = {
      address: sylosSBTAddress,
      transactionHash: sylosSBT.deploymentTransaction().hash
    };

    // Deploy SylOSGovernance
    console.log("\n🏗️  Deploying SylOSGovernance...");
    const SylOSGovernance = await ethers.getContractFactory("SylOSGovernance");
    const sylosGovernance = await SylOSGovernance.deploy(
      wrappedSYLOSAddress,
      admin.address
    );
    await sylosGovernance.waitForDeployment();
    const sylosGovernanceAddress = await sylosGovernance.getAddress();

    console.log(`✅ SylOSGovernance deployed at: ${sylosGovernanceAddress}`);
    deployedContracts.SylOSGovernance = {
      address: sylosGovernanceAddress,
      transactionHash: sylosGovernance.deploymentTransaction().hash
    };

    // Post-deployment configuration
    console.log("\n⚙️  Configuring contracts...");

    // Add payment tokens to MetaTransactionPaymaster
    console.log("💳 Adding payment tokens to MetaTransactionPaymaster...");
    await metaTransactionPaymaster.addPaymentToken(
      sylosTokenAddress,
      ethers.parseEther("0.00002"), // 20 gwei in token units
      "SylOSToken",
      "SYLOS"
    );

    await metaTransactionPaymaster.addPaymentToken(
      wrappedSYLOSAddress,
      ethers.parseEther("0.000025"), // 25 gwei
      "Wrapped SylOS",
      "wSYLOS"
    );

    // Set up WrappedSYLOS reward period
    console.log("🎁 Setting up WrappedSYLOS reward period...");
    const rewardRate = ethers.parseEther("0.0001"); // 0.0001 tokens per second
    const startTime = Math.floor(Date.now() / 1000) + 3600; // Start in 1 hour
    const endTime = startTime + (365 * 24 * 60 * 60); // 1 year duration

    await wrappedSYLOS.setRewardPeriod(startTime, endTime, rewardRate);

    // Create some sample tasks in PoPTracker
    console.log("📋 Creating sample tasks in PoPTracker...");
    await popTracker.createTask(
      "Implement smart contract security audit",
      40, // 40 hours
      8 // Complexity 8/10
    );

    await popTracker.createTask(
      "Develop frontend UI components",
      60, // 60 hours
      6 // Complexity 6/10
    );

    await popTracker.createTask(
      "Write comprehensive documentation",
      20, // 20 hours
      3 // Complexity 3/10
    );

    // Mint Identity SBTs for test accounts
    console.log("🪪 Minting Identity SBTs to test accounts...");
    // Generate identity CIDs from address hashes (deterministic per-account)
    const identityCID = (addr) => "ipfs://" + ethers.keccak256(ethers.toUtf8Bytes(`sylos-identity-${addr}`)).slice(2);
    await sylosSBT.connect(admin).mintIdentity(manager.address, identityCID(manager.address));
    await sylosSBT.connect(admin).mintIdentity(verifier.address, identityCID(verifier.address));
    await sylosSBT.connect(admin).mintIdentity(validator.address, identityCID(validator.address));
    await sylosSBT.connect(admin).mintIdentity(emergency.address, identityCID(emergency.address));

    // Setup roles for various contracts
    console.log("🔐 Setting up roles...");

    // Add roles to PoPTracker
    await popTracker.grantRole(await popTracker.MANAGER_ROLE(), manager.address);
    await popTracker.grantRole(await popTracker.VERIFIER_ROLE(), verifier.address);
    await popTracker.grantRole(await popTracker.VALIDATOR_ROLE(), validator.address);

    // SylOSGovernance roles (e.g., AGENT_ROLE) would be granted here.

    // Transfer additional tokens for testing
    console.log("💰 Distributing tokens for testing...");
    const testAmount = ethers.parseEther("1000"); // 1000 tokens each
    await sylosToken.transfer(manager.address, testAmount);
    await sylosToken.transfer(verifier.address, testAmount);
    await sylosToken.transfer(validator.address, testAmount);
    await sylosToken.transfer(emergency.address, testAmount);

    // Verify contracts on Etherscan (if not on local network)
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
      console.log("\n🔍 Verifying contracts on Etherscan...");

      try {
        await hre.run("verify:verify", {
          address: sylosTokenAddress,
          constructorArguments: [
            "SylOSToken",
            "SYLOS",
            ethers.parseEther("1000"),
            admin.address,
            taxWallet.address,
            liquidityWallet.address
          ],
        });
        console.log("✅ SylOSToken verified");

        await hre.run("verify:verify", {
          address: wrappedSYLOSAddress,
          constructorArguments: [
            sylosTokenAddress,
            "Wrapped SylOS Token",
            "wSYLOS"
          ],
        });
        console.log("✅ WrappedSYLOS verified");

        await hre.run("verify:verify", {
          address: popTrackerAddress,
          constructorArguments: [
            wrappedSYLOSAddress,
            treasury.address,
            admin.address,
            admin.address
          ],
        });
        console.log("✅ PoPTracker verified");

        await hre.run("verify:verify", {
          address: metaTransactionPaymasterAddress,
          constructorArguments: [
            admin.address,
            treasury.address
          ],
        });
        console.log("✅ MetaTransactionPaymaster verified");

        await hre.run("verify:verify", {
          address: sylosSBTAddress,
          constructorArguments: [
            admin.address
          ],
        });
        console.log("✅ SylOS_SBT verified");

        await hre.run("verify:verify", {
          address: sylosGovernanceAddress,
          constructorArguments: [
            wrappedSYLOSAddress,
            admin.address
          ],
        });
        console.log("✅ SylOSGovernance verified");
      } catch (error) {
        console.log("❌ Verification failed:", error.message);
      }
    }

    // Generate deployment summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 SYLOS SMART CONTRACTS DEPLOYMENT SUMMARY");
    console.log("=".repeat(80));
    console.log("\n🏢 Contract Addresses:");
    Object.entries(deployedContracts).forEach(([name, contract]) => {
      console.log(`  ${name}: ${contract.address}`);
    });

    console.log("\n👥 Test Accounts:");
    console.log(`  Admin: ${admin.address}`);
    console.log(`  Manager: ${manager.address}`);
    console.log(`  Verifier: ${verifier.address}`);
    console.log(`  Validator: ${validator.address}`);
    console.log(`  Emergency: ${emergency.address}`);

    console.log("\n💎 Token Balances:");
    console.log(`  Admin: ${ethers.formatEther(await sylosToken.balanceOf(admin.address))} SYLOS`);
    console.log(`  Manager: ${ethers.formatEther(await sylosToken.balanceOf(manager.address))} SYLOS`);
    console.log(`  Verifier: ${ethers.formatEther(await sylosToken.balanceOf(verifier.address))} SYLOS`);
    console.log(`  Validator: ${ethers.formatEther(await sylosToken.balanceOf(validator.address))} SYLOS`);
    console.log(`  Emergency: ${ethers.formatEther(await sylosToken.balanceOf(emergency.address))} SYLOS`);

    console.log("\n🔗 Network Information:");
    console.log(`  Network: ${hre.network.name}`);
    console.log(`  Chain ID: ${(await ethers.provider.getNetwork()).chainId}`);
    console.log(`  Block Number: ${await ethers.provider.getBlockNumber()}`);

    console.log("\n✅ Deployment completed successfully!");
    console.log("\n📝 Next Steps:");
    console.log("  1. Update frontend configuration with contract addresses");
    console.log("  2. Run tests with: npm run test");
    console.log("  3. Set up monitoring and alerts");
    console.log("  4. Plan initial governance proposals");
    console.log("  5. Start user onboarding process");

  } catch (error) {
    console.error("\n❌ Deployment failed!");
    console.error("Error:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

// Run the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });