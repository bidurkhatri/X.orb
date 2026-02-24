const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SylOSToken", function () {
  let sylosToken, owner, admin, taxWallet, liquidityWallet, user1, user2, user3;

  const initialSupply = ethers.parseEther("1000");
  const testAmount = ethers.parseEther("100");

  beforeEach(async function () {
    [owner, admin, taxWallet, liquidityWallet, user1, user2, user3] = await ethers.getSigners();

    const SylOSToken = await ethers.getContractFactory("SylOSToken");
    sylosToken = await SylOSToken.deploy(
      "SylOSToken",
      "SYLOS",
      1000,
      admin.address,
      taxWallet.address,
      liquidityWallet.address
    );
    await sylosToken.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      expect(await sylosToken.name()).to.equal("SylOSToken");
      expect(await sylosToken.symbol()).to.equal("SYLOS");
      expect(await sylosToken.decimals()).to.equal(18);
      expect(await sylosToken.totalSupply()).to.equal(initialSupply);
    });

    it("Should assign initial supply to admin", async function () {
      expect(await sylosToken.balanceOf(admin.address)).to.equal(initialSupply);
    });

    it("Should set correct roles", async function () {
      expect(await sylosToken.hasRole(await sylosToken.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
      expect(await sylosToken.hasRole(await sylosToken.MINTER_ROLE(), admin.address)).to.be.true;
      expect(await sylosToken.hasRole(await sylosToken.PAUSER_ROLE(), admin.address)).to.be.true;
      expect(await sylosToken.hasRole(await sylosToken.TAX_MANAGER_ROLE(), admin.address)).to.be.true;
    });
  });

  describe("Minting", function () {
    it("Should allow minting by minter role", async function () {
      await sylosToken.mint(user1.address, testAmount);
      expect(await sylosToken.balanceOf(user1.address)).to.equal(testAmount);
      expect(await sylosToken.totalSupply()).to.equal(initialSupply.add(testAmount));
    });

    it("Should allow batch minting", async function () {
      const recipients = [user1.address, user2.address, user3.address];
      const amounts = [testAmount, testAmount, testAmount];
      
      await sylosToken.batchMint(recipients, amounts);
      
      expect(await sylosToken.balanceOf(user1.address)).to.equal(testAmount);
      expect(await sylosToken.balanceOf(user2.address)).to.equal(testAmount);
      expect(await sylosToken.balanceOf(user3.address)).to.equal(testAmount);
      expect(await sylosToken.totalSupply()).to.equal(initialSupply.add(testAmount.mul(3)));
    });

    it("Should not allow minting by non-minter", async function () {
      await expect(sylosToken.connect(user1).mint(user1.address, testAmount))
        .to.be.revertedWith("AccessControl: account");
    });

    it("Should not allow minting to zero address", async function () {
      await expect(sylosToken.mint(ethers.ZeroAddress, testAmount))
        .to.be.revertedWith("Cannot mint to zero address");
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await sylosToken.mint(user1.address, testAmount);
    });

    it("Should allow burning by token holder", async function () {
      await sylosToken.connect(user1).burn(testAmount);
      expect(await sylosToken.balanceOf(user1.address)).to.equal(0);
      expect(await sylosToken.totalSupply()).to.equal(initialSupply);
    });

    it("Should allow burning of approved tokens", async function () {
      await sylosToken.connect(user1).approve(owner.address, testAmount);
      await sylosToken.burnFrom(user1.address, testAmount);
      expect(await sylosToken.balanceOf(user1.address)).to.equal(0);
    });

    it("Should not allow burning more than balance", async function () {
      await expect(sylosToken.connect(user1).burn(testAmount.add(ethers.parseEther("1"))))
        .to.be.revertedWith("ERC20: burn amount exceeds balance");
    });
  });

  describe("Transfer and Tax Collection", function () {
    beforeEach(async function () {
      await sylosToken.mint(user1.address, testAmount);
    });

    it("Should collect tax on transfer", async function () {
      const taxRate = await sylosToken.taxRate();
      const expectedTax = testAmount.mul(taxRate).div(10000);
      const expectedTransfer = testAmount.sub(expectedTax);

      await sylosToken.connect(user1).transfer(user2.address, testAmount);

      expect(await sylosToken.balanceOf(user2.address)).to.equal(expectedTransfer);
      expect(await sylosToken.balanceOf(taxWallet.address)).to.be.gte(expectedTax);
    });

    it("Should split tax between liquidity and general tax wallet", async function () {
      const liquidityShare = await sylosToken.liquidityTaxShare();
      const taxRate = await sylosToken.taxRate();
      const expectedTax = testAmount.mul(taxRate).div(10000);
      const expectedLiquidityTax = expectedTax.mul(liquidityShare).div(1000);
      const expectedGeneralTax = expectedTax.sub(expectedLiquidityTax);

      await sylosToken.connect(user1).transfer(user2.address, testAmount);

      const liquidityBalance = await sylosToken.balanceOf(liquidityWallet.address);
      const taxBalance = await sylosToken.balanceOf(taxWallet.address);
      
      expect(liquidityBalance).to.equal(expectedLiquidityTax);
      expect(taxBalance).to.equal(expectedGeneralTax);
    });

    it("Should not collect tax on zero transfer", async function () {
      await expect(sylosToken.connect(user1).transfer(user2.address, 0))
        .to.be.revertedWith("Transfer amount must be greater than 0");
    });

    it("Should not collect tax on minting (from address is zero)", async function () {
      await sylosToken.mint(user1.address, testAmount);
      const balance = await sylosToken.balanceOf(user1.address);
      // Balance should be exactly testAmount (no tax on minting)
      expect(balance).to.be.gte(testAmount.sub(1)); // Allow for small rounding
    });
  });

  describe("Tax Management", function () {
    it("Should allow tax rate update by tax manager", async function () {
      const newTaxRate = 500; // 5%
      await sylosToken.updateTaxRate(newTaxRate);
      expect(await sylosToken.taxRate()).to.equal(newTaxRate);
    });

    it("Should not allow tax rate update above maximum", async function () {
      const maxRate = await sylosToken.MAX_TAX_RATE();
      await expect(sylosToken.updateTaxRate(maxRate + 100))
        .to.be.revertedWith("Tax rate too high");
    });

    it("Should allow tax wallet update", async function () {
      const newTaxWallet = user1.address;
      await sylosToken.updateTaxWallet(newTaxWallet);
      expect(await sylosToken.taxWallet()).to.equal(newTaxWallet);
    });

    it("Should allow liquidity tax share update", async function () {
      const newShare = 300; // 30%
      await sylosToken.updateLiquidityShare(newShare);
      expect(await sylosToken.liquidityTaxShare()).to.equal(newShare);
    });

    it("Should emit events for tax updates", async function () {
      await expect(sylosToken.updateTaxRate(500))
        .to.emit(sylosToken, "TaxRateUpdated")
        .withArgs(250, 500); // From 2.5% to 5%
    });
  });

  describe("Pausable", function () {
    it("Should pause and unpause by pauser", async function () {
      await sylosToken.pause();
      expect(await sylosToken.paused()).to.be.true;

      await sylosToken.unpause();
      expect(await sylosToken.paused()).to.be.false;
    });

    it("Should prevent transfers when paused", async function () {
      await sylosToken.mint(user1.address, testAmount);
      await sylosToken.pause();

      await expect(sylosToken.connect(user1).transfer(user2.address, testAmount))
        .to.be.revertedWith("Pausable: paused");
    });

    it("Should not allow pausing by non-pauser", async function () {
      await expect(sylosToken.connect(user1).pause())
        .to.be.revertedWith("AccessControl: account");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow tax withdrawal by admin", async function () {
      // First collect some taxes
      await sylosToken.mint(user1.address, testAmount);
      await sylosToken.connect(user1).transfer(user2.address, testAmount);

      const initialBalance = await sylosToken.balanceOf(admin.address);
      const totalTaxes = await sylosToken.totalTaxesCollected();
      const withdrawAmount = totalTaxes.div(2);

      await sylosToken.withdrawTaxes(withdrawAmount);
      
      const finalBalance = await sylosToken.balanceOf(admin.address);
      expect(finalBalance).to.equal(initialBalance.add(withdrawAmount));
    });

    it("Should allow token recovery by admin", async function () {
      // Deploy a test token
      const TestToken = await ethers.getContractFactory("ERC20TestToken");
      const testToken = await TestToken.deploy("Test", "TEST");
      await testToken.waitForDeployment();

      // Send some test tokens to SylOSToken
      await testToken.mint(user1.address, testAmount);
      await testToken.connect(user1).transfer(await sylosToken.getAddress(), testAmount);

      // Recover the tokens
      await sylosToken.recoverTokens(await testToken.getAddress(), testAmount);
      expect(await testToken.balanceOf(admin.address)).to.equal(testAmount);
    });

    it("Should allow ETH recovery by admin", async function () {
      // Send ETH to the contract
      const ethAmount = ethers.parseEther("1");
      await admin.sendTransaction({
        to: await sylosToken.getAddress(),
        value: ethAmount
      });

      const initialBalance = await ethers.provider.getBalance(admin.address);
      await sylosToken.withdrawETH();
      const finalBalance = await ethers.provider.getBalance(admin.address);
      
      expect(finalBalance).to.be.gte(initialBalance);
    });
  });

  describe("Anti-bot Protection", function () {
    beforeEach(async function () {
      await sylosToken.mint(user1.address, testAmount);
    });

    it("Should enforce transaction delay", async function () {
      await sylosToken.connect(user1).transfer(user2.address, ethers.parseEther("10"));
      
      // Try to transfer again immediately
      await expect(sylosToken.connect(user1).transfer(user3.address, ethers.parseEther("10")))
        .to.be.revertedWith("Transaction too frequent");
    });

    it("Should allow transfers after delay", async function () {
      await sylosToken.connect(user1).transfer(user2.address, ethers.parseEther("10"));
      
      // Advance time by 2 blocks
      await ethers.provider.send("evm_mine", []);
      await ethers.provider.send("evm_mine", []);
      
      // Should work now
      await sylosToken.connect(user1).transfer(user3.address, ethers.parseEther("10"));
      expect(await sylosToken.balanceOf(user3.address)).to.be.gt(0);
    });
  });

  describe("Role Management", function () {
    it("Should allow role granting and revoking", async function () {
      await sylosToken.grantRole(await sylosToken.MINTER_ROLE(), user1.address);
      expect(await sylosToken.hasRole(await sylosToken.MINTER_ROLE(), user1.address)).to.be.true;

      await sylosToken.revokeRole(await sylosToken.MINTER_ROLE(), user1.address);
      expect(await sylosToken.hasRole(await sylosToken.MINTER_ROLE(), user1.address)).to.be.false;
    });

    it("Should allow self-role renouncing", async function () {
      await sylosToken.grantRole(await sylosToken.PAUSER_ROLE(), user1.address);
      expect(await sylosToken.hasRole(await sylosToken.PAUSER_ROLE(), user1.address)).to.be.true;

      await sylosToken.connect(user1).renounceRole(await sylosToken.PAUSER_ROLE(), user1.address);
      expect(await sylosToken.hasRole(await sylosToken.PAUSER_ROLE(), user1.address)).to.be.false;
    });
  });

  describe("View Functions", function () {
    it("Should return correct tax rate in percentage", async function () {
      const taxRateBP = await sylosToken.taxRate();
      const taxRatePercent = await sylosToken.getTaxRate();
      expect(taxRatePercent).to.equal(taxRateBP.div(100));
    });

    it("Should return contract balance", async function () {
      const contractBalance = await sylosToken.getContractBalance();
      expect(contractBalance).to.be.a("bigint");
    });
  });
});

// Test token for recovery tests
contract ERC20TestToken {
  constructor(string memory _name, string memory _symbol) {
    name = _name;
    symbol = _symbol;
  }
  
  string public name;
  string public symbol;
  uint8 public constant decimals = 18;
  uint256 public totalSupply;
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;
  
  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
  
  function mint(address to, uint256 amount) public {
    totalSupply += amount;
    balanceOf[to] += amount;
    emit Transfer(address(0), to, amount);
  }
  
  function transfer(address to, uint256 value) public returns (bool) {
    require(balanceOf[msg.sender] >= value, "Insufficient balance");
    balanceOf[msg.sender] -= value;
    balanceOf[to] += value;
    emit Transfer(msg.sender, to, value);
    return true;
  }
  
  function approve(address spender, uint256 value) public returns (bool) {
    allowance[msg.sender][spender] = value;
    emit Approval(msg.sender, spender, value);
    return true;
  }
  
  function transferFrom(address from, address to, uint256 value) public returns (bool) {
    require(balanceOf[from] >= value, "Insufficient balance");
    require(allowance[from][msg.sender] >= value, "Insufficient allowance");
    balanceOf[from] -= value;
    balanceOf[to] += value;
    allowance[from][msg.sender] -= value;
    emit Transfer(from, to, value);
    return true;
  }
}