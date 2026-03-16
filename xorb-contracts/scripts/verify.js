const { ethers } = require("hardhat");

async function verifyContract(address, constructorArguments) {
  console.log(`Verifying contract at address: ${address}`);
  
  try {
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: constructorArguments,
    });
    console.log("✅ Contract verified successfully!");
  } catch (error) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("ℹ️  Contract is already verified");
    } else {
      console.log("❌ Verification failed:", error.message);
    }
  }
}

async function main() {
  console.log("🔍 Verifying Xorb Smart Contracts...\n");

  const contracts = [
    {
      name: "XorbToken",
      address: process.env.XORB_TOKEN_ADDRESS,
      args: [
        "XorbToken",
        "XORB",
        "1000",
        process.env.ADMIN_ADDRESS,
        process.env.TAX_WALLET_ADDRESS,
        process.env.LIQUIDITY_WALLET_ADDRESS
      ]
    },
    {
      name: "WrappedXORB",
      address: process.env.WRAPPED_XORB_ADDRESS,
      args: [
        process.env.XORB_TOKEN_ADDRESS,
        "Wrapped Xorb Token",
        "USDC"
      ]
    },
    {
      name: "PoPTracker",
      address: process.env.POP_TRACKER_ADDRESS,
      args: [
        process.env.WRAPPED_XORB_ADDRESS,
        process.env.TREASURY_ADDRESS,
        process.env.ADMIN_ADDRESS
      ]
    },
    {
      name: "MetaTransactionPaymaster",
      address: process.env.META_TRANSACTION_PAYMASTER_ADDRESS,
      args: [
        process.env.ADMIN_ADDRESS,
        process.env.TREASURY_ADDRESS
      ]
    },
    {
      name: "XorbGovernance",
      address: process.env.XORB_GOVERNANCE_ADDRESS,
      args: [
        process.env.XORB_TOKEN_ADDRESS,
        process.env.TREASURY_ADDRESS,
        process.env.TREASURY_ADDRESS,
        process.env.ADMIN_ADDRESS
      ]
    }
  ];

  for (const contract of contracts) {
    if (!contract.address) {
      console.log(`⚠️  ${contract.name} address not found, skipping...`);
      continue;
    }
    
    console.log(`\n📋 Verifying ${contract.name}...`);
    await verifyContract(contract.address, contract.args);
  }
  
  console.log("\n✅ All contract verification attempts completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Verification error:", error);
    process.exit(1);
  });