/**
 * Deploy XorbPaymentSplitter to Polygon PoS mainnet.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-splitter.js --network polygon
 *
 * Required env vars:
 *   POLYGON_PRIVATE_KEY — deployer wallet private key
 *   POLYGON_RPC_URL — Polygon RPC endpoint
 *   XORB_TREASURY_ADDRESS — treasury wallet for fee collection
 *
 * USDC on Polygon PoS: 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
 */

const { ethers } = require("hardhat")

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log("Deploying XorbPaymentSplitter with account:", deployer.address)

  const balance = await ethers.provider.getBalance(deployer.address)
  console.log("Account balance:", ethers.formatEther(balance), "MATIC")

  // USDC on Polygon PoS
  const USDC_ADDRESS = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"

  // Treasury address — where fees accumulate
  const TREASURY_ADDRESS = process.env.XORB_TREASURY_ADDRESS
  if (!TREASURY_ADDRESS) {
    throw new Error("XORB_TREASURY_ADDRESS env var required")
  }

  // Default fee: 30 basis points (0.30%)
  const FEE_BPS = 30

  console.log("\nDeployment parameters:")
  console.log("  USDC:", USDC_ADDRESS)
  console.log("  Treasury:", TREASURY_ADDRESS)
  console.log("  Fee:", FEE_BPS, "bps (0.30%)")

  const XorbPaymentSplitter = await ethers.getContractFactory("XorbPaymentSplitter")
  const splitter = await XorbPaymentSplitter.deploy(USDC_ADDRESS, TREASURY_ADDRESS, FEE_BPS)
  await splitter.waitForDeployment()

  const address = await splitter.getAddress()
  console.log("\n✅ XorbPaymentSplitter deployed to:", address)
  console.log("\nAdd to .env:")
  console.log(`  XORB_PAYMENT_SPLITTER_ADDRESS=${address}`)
  console.log("\nVerify on Polygonscan:")
  console.log(`  npx hardhat verify --network polygon ${address} ${USDC_ADDRESS} ${TREASURY_ADDRESS} ${FEE_BPS}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
