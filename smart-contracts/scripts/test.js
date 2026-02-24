const hre = require("hardhat");

async function runAllTests() {
  console.log("🧪 Running SylOS Smart Contract Tests\n");
  
  try {
    // Compile contracts first
    console.log("📦 Compiling contracts...");
    await hre.run("compile");
    console.log("✅ Compilation successful\n");
    
    // Run tests with coverage
    console.log("🧪 Running tests with coverage...");
    await hre.run("test");
    
    console.log("\n✅ All tests passed successfully!");
    
  } catch (error) {
    console.error("\n❌ Test execution failed!");
    console.error("Error:", error.message);
    process.exit(1);
  }
}

async function runSpecificTests(testFile) {
  console.log(`🧪 Running ${testFile} tests...\n`);
  
  try {
    const { spawn } = require("child_process");
    
    const testProcess = spawn("npx", ["hardhat", "test", testFile], {
      stdio: "inherit",
      shell: true
    });
    
    testProcess.on("close", (code) => {
      if (code === 0) {
        console.log(`\n✅ ${testFile} tests passed!`);
      } else {
        console.error(`\n❌ ${testFile} tests failed!`);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error(`Error running ${testFile}:`, error.message);
    process.exit(1);
  }
}

async function main() {
  const testFile = process.argv[2];
  
  if (testFile) {
    await runSpecificTests(testFile);
  } else {
    await runAllTests();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Test script error:", error);
    process.exit(1);
  });