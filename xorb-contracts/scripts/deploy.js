const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting Xorb Smart Contracts Deployment...\n");

  // Get signers
  const [deployer, admin, taxWallet, liquidityWallet, treasury, manager, verifier, validator, pauser, emergency] = await ethers.getSigners();

  console.log("📋 Deploying with accounts:");
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Admin: ${admin.address}`);
  console.log(`  Treasury: ${treasury.address}\n`);

  // Contract addresses deployment tracking
  const deployedContracts = {};

  try {
    // Deploy XorbToken
    console.log("🏗️  Deploying XorbToken...");
    const initialSupply = ethers.parseEther("1000000"); // 1M XORB
    const XorbToken = await ethers.getContractFactory("XorbToken");
    const xorbToken = await XorbToken.deploy(
      "XorbToken",
      "XORB",
      ethers.parseEther("1000"), // Initial supply of 1000 tokens
      admin.address,
      taxWallet.address,
      liquidityWallet.address
    );
    await xorbToken.waitForDeployment();
    const xorbTokenAddress = await xorbToken.getAddress();

    console.log(`✅ XorbToken deployed at: ${xorbTokenAddress}`);
    deployedContracts.XorbToken = {
      address: xorbTokenAddress,
      transactionHash: xorbToken.deploymentTransaction().hash
    };

    // Mint additional tokens for development and testing
    console.log("🔨 Minting additional tokens for development...");
    const mintAmount = ethers.parseEther("100000"); // 100K tokens
    const mintTx = await xorbToken.mint(admin.address, mintAmount);
    await mintTx.wait();
    console.log("✅ Additional tokens minted");

    // Deploy WrappedXORB
    console.log("\n🏗️  Deploying WrappedXORB...");
    const WrappedXORB = await ethers.getContractFactory("WrappedXORB");
    const wrappedXORB = await WrappedXORB.deploy(
      xorbTokenAddress,
      "Wrapped Xorb Token",
      "USDC"
    );
    await wrappedXORB.waitForDeployment();
    const wrappedXORBAddress = await wrappedXORB.getAddress();

    console.log(`✅ WrappedXORB deployed at: ${wrappedXORBAddress}`);
    deployedContracts.WrappedXORB = {
      address: wrappedXORBAddress,
      transactionHash: wrappedXORB.deploymentTransaction().hash
    };

    // Deploy PoPTracker
    console.log("\n🏗️  Deploying PoPTracker...");
    const PoPTracker = await ethers.getContractFactory("PoPTracker");
    const popTracker = await PoPTracker.deploy(
      wrappedXORBAddress,
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

    // Deploy Xorb_SBT
    console.log("\n🏗️  Deploying Xorb_SBT...");
    const XorbSBT = await ethers.getContractFactory("Xorb_SBT");
    const xorbSBT = await XorbSBT.deploy(admin.address);
    await xorbSBT.waitForDeployment();
    const xorbSBTAddress = await xorbSBT.getAddress();

    console.log(`✅ Xorb_SBT deployed at: ${xorbSBTAddress}`);
    deployedContracts.Xorb_SBT = {
      address: xorbSBTAddress,
      transactionHash: xorbSBT.deploymentTransaction().hash
    };

    // Deploy XorbGovernance
    console.log("\n🏗️  Deploying XorbGovernance...");
    const XorbGovernance = await ethers.getContractFactory("XorbGovernance");
    const xorbGovernance = await XorbGovernance.deploy(
      wrappedXORBAddress,
      admin.address
    );
    await xorbGovernance.waitForDeployment();
    const xorbGovernanceAddress = await xorbGovernance.getAddress();

    console.log(`✅ XorbGovernance deployed at: ${xorbGovernanceAddress}`);
    deployedContracts.XorbGovernance = {
      address: xorbGovernanceAddress,
      transactionHash: xorbGovernance.deploymentTransaction().hash
    };

    // Post-deployment configuration
    console.log("\n⚙️  Configuring contracts...");

    // Add payment tokens to MetaTransactionPaymaster
    console.log("💳 Adding payment tokens to MetaTransactionPaymaster...");
    await metaTransactionPaymaster.addPaymentToken(
      xorbTokenAddress,
      ethers.parseEther("0.00002"), // 20 gwei in token units
      "XorbToken",
      "XORB"
    );

    await metaTransactionPaymaster.addPaymentToken(
      wrappedXORBAddress,
      ethers.parseEther("0.000025"), // 25 gwei
      "Wrapped Xorb",
      "USDC"
    );

    // Set up WrappedXORB reward period
    console.log("🎁 Setting up WrappedXORB reward period...");
    const rewardRate = ethers.parseEther("0.0001"); // 0.0001 tokens per second
    const startTime = Math.floor(Date.now() / 1000) + 3600; // Start in 1 hour
    const endTime = startTime + (365 * 24 * 60 * 60); // 1 year duration

    await wrappedXORB.setRewardPeriod(startTime, endTime, rewardRate);

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
    const identityCID = (addr) => "ipfs://" + ethers.keccak256(ethers.toUtf8Bytes(`xorb-identity-${addr}`)).slice(2);
    await xorbSBT.connect(admin).mintIdentity(manager.address, identityCID(manager.address));
    await xorbSBT.connect(admin).mintIdentity(verifier.address, identityCID(verifier.address));
    await xorbSBT.connect(admin).mintIdentity(validator.address, identityCID(validator.address));
    await xorbSBT.connect(admin).mintIdentity(emergency.address, identityCID(emergency.address));

    // Setup roles for various contracts
    console.log("🔐 Setting up roles...");

    // Add roles to PoPTracker
    await popTracker.grantRole(await popTracker.MANAGER_ROLE(), manager.address);
    await popTracker.grantRole(await popTracker.VERIFIER_ROLE(), verifier.address);
    await popTracker.grantRole(await popTracker.VALIDATOR_ROLE(), validator.address);

    // XorbGovernance roles (e.g., AGENT_ROLE) would be granted here.

    // Transfer additional tokens for testing
    console.log("💰 Distributing tokens for testing...");
    const testAmount = ethers.parseEther("1000"); // 1000 tokens each
    await xorbToken.transfer(manager.address, testAmount);
    await xorbToken.transfer(verifier.address, testAmount);
    await xorbToken.transfer(validator.address, testAmount);
    await xorbToken.transfer(emergency.address, testAmount);

    // Verify contracts on Etherscan (if not on local network)
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
      console.log("\n🔍 Verifying contracts on Etherscan...");

      try {
        await hre.run("verify:verify", {
          address: xorbTokenAddress,
          constructorArguments: [
            "XorbToken",
            "XORB",
            ethers.parseEther("1000"),
            admin.address,
            taxWallet.address,
            liquidityWallet.address
          ],
        });
        console.log("✅ XorbToken verified");

        await hre.run("verify:verify", {
          address: wrappedXORBAddress,
          constructorArguments: [
            xorbTokenAddress,
            "Wrapped Xorb Token",
            "USDC"
          ],
        });
        console.log("✅ WrappedXORB verified");

        await hre.run("verify:verify", {
          address: popTrackerAddress,
          constructorArguments: [
            wrappedXORBAddress,
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
          address: xorbSBTAddress,
          constructorArguments: [
            admin.address
          ],
        });
        console.log("✅ Xorb_SBT verified");

        await hre.run("verify:verify", {
          address: xorbGovernanceAddress,
          constructorArguments: [
            wrappedXORBAddress,
            admin.address
          ],
        });
        console.log("✅ XorbGovernance verified");
      } catch (error) {
        console.log("❌ Verification failed:", error.message);
      }
    }

    // Generate deployment summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 XORB SMART CONTRACTS DEPLOYMENT SUMMARY");
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
    console.log(`  Admin: ${ethers.formatEther(await xorbToken.balanceOf(admin.address))} XORB`);
    console.log(`  Manager: ${ethers.formatEther(await xorbToken.balanceOf(manager.address))} XORB`);
    console.log(`  Verifier: ${ethers.formatEther(await xorbToken.balanceOf(verifier.address))} XORB`);
    console.log(`  Validator: ${ethers.formatEther(await xorbToken.balanceOf(validator.address))} XORB`);
    console.log(`  Emergency: ${ethers.formatEther(await xorbToken.balanceOf(emergency.address))} XORB`);

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