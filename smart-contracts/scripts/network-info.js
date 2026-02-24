const { ethers } = require("hardhat");

async function getNetworkInfo() {
  console.log("🌐 Network Information\n");
  
  const network = await ethers.provider.getNetwork();
  const blockNumber = await ethers.provider.getBlockNumber();
  const feeData = await ethers.provider.getFeeData();
  
  console.log(`Network Name: ${network.name}`);
  console.log(`Chain ID: ${network.chainId}`);
  console.log(`Block Number: ${blockNumber}`);
  console.log(`Gas Price: ${ethers.formatUnits(feeData.gasPrice, "gwei")} gwei`);
  console.log(`Max Fee Per Gas: ${ethers.formatUnits(feeData.maxFeePerGas || 0, "gwei")} gwei`);
  console.log(`Max Priority Fee: ${ethers.formatUnits(feeData.maxPriorityFeePerGas || 0, "gwei")} gwei`);
  
  // Get balance of current account
  const accounts = await ethers.getSigners();
  if (accounts.length > 0) {
    const balance = await ethers.provider.getBalance(accounts[0].address);
    console.log(`\n💰 Account Balance: ${ethers.formatEther(balance)} ETH`);
    console.log(`Current Account: ${accounts[0].address}`);
  }
  
  return {
    network,
    blockNumber,
    feeData
  };
}

async function getContractAddresses() {
  console.log("\n📍 Contract Addresses\n");
  
  const addresses = {
    SylOSToken: process.env.SYLOS_TOKEN_ADDRESS,
    WrappedSYLOS: process.env.WRAPPED_SYLOS_ADDRESS,
    PoPTracker: process.env.POP_TRACKER_ADDRESS,
    MetaTransactionPaymaster: process.env.META_TRANSACTION_PAYMASTER_ADDRESS,
    SylOSGovernance: process.env.SYLOS_GOVERNANCE_ADDRESS
  };
  
  for (const [name, address] of Object.entries(addresses)) {
    if (address) {
      console.log(`${name}: ${address}`);
    } else {
      console.log(`${name}: Not deployed`);
    }
  }
  
  return addresses;
}

async function checkContractVerification() {
  console.log("\n✅ Contract Verification Status\n");
  
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
        const code = await ethers.provider.getCode(address);
        if (code !== "0x") {
          console.log(`${name}: ✅ Deployed and has bytecode`);
        } else {
          console.log(`${name}: ❌ Deployed but no bytecode`);
        }
      } catch (error) {
        console.log(`${name}: ❌ Error checking contract: ${error.message}`);
      }
    } else {
      console.log(`${name}: ❌ Not deployed`);
    }
  }
}

async function getGasEstimates() {
  console.log("\n⛽ Gas Estimates for Common Operations\n");
  
  try {
    // Get a few accounts for estimation
    const [deployer] = await ethers.getSigners();
    
    // Estimate common contract functions
    const SylOSToken = await ethers.getContractFactory("SylOSToken");
    const sylosToken = SylOSToken.getDeployTransaction(
      "SylOSToken",
      "SYLOS",
      1000,
      deployer.address,
      deployer.address,
      deployer.address
    );
    
    console.log(`SylOSToken Deployment: ${sylosToken.gasLimit} gas`);
    
    // We can add more gas estimates here as needed
    
  } catch (error) {
    console.log("Could not estimate gas:", error.message);
  }
}

async function main() {
  console.log("🔍 SylOS Network Analysis\n");
  console.log("=".repeat(50));
  
  await getNetworkInfo();
  await getContractAddresses();
  await checkContractVerification();
  await getGasEstimates();
  
  console.log("\n" + "=".repeat(50));
  console.log("✅ Network analysis completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Analysis error:", error);
    process.exit(1);
  });