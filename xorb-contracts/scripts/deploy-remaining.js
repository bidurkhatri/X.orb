const { ethers } = require("hardhat")

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log("Deployer:", deployer.address)
  const balance = await ethers.provider.getBalance(deployer.address)
  console.log("Balance:", ethers.formatEther(balance), "MATIC")

  const USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359"
  const TREASURY = process.env.XORB_TREASURY_ADDRESS || deployer.address
  const ADMIN = deployer.address

  // 1. ActionVerifier (no constructor args)
  console.log("\n--- Deploying ActionVerifier ---")
  const AV = await ethers.getContractFactory("ActionVerifier")
  const av = await AV.deploy()
  await av.waitForDeployment()
  const avAddr = await av.getAddress()
  console.log("ActionVerifier:", avAddr)

  // 2. XorbEscrow(address _usdc, address _treasury)
  console.log("\n--- Deploying XorbEscrow ---")
  const XE = await ethers.getContractFactory("XorbEscrow")
  const xe = await XE.deploy(USDC, TREASURY)
  await xe.waitForDeployment()
  const xeAddr = await xe.getAddress()
  console.log("XorbEscrow:", xeAddr)

  console.log("\n=== DEPLOYMENT COMPLETE ===")
  console.log("ACTION_VERIFIER_ADDRESS=" + avAddr)
  console.log("XORB_ESCROW_ADDRESS=" + xeAddr)
  console.log("XORB_PAYMENT_SPLITTER_ADDRESS=0xc038C3116CD4997fF4C8f42b2d97effb023214c9")
}

main()
  .then(() => process.exit(0))
  .catch((error) => { console.error(error); process.exit(1) })
