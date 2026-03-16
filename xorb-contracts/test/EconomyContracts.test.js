const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Xorb Economy Contracts", function () {
    let token, paymentStreaming, marketplace;
    let owner, sponsor, agentWallet, hirer, treasury, arbiter;
    const ONE_TOKEN = ethers.parseEther("1");
    const HUNDRED_TOKENS = ethers.parseEther("100");
    const THOUSAND_TOKENS = ethers.parseEther("1000");
    const agentId = ethers.keccak256(ethers.toUtf8Bytes("agent-economy-1"));

    beforeEach(async function () {
        [owner, sponsor, agentWallet, hirer, treasury, arbiter] = await ethers.getSigners();

        // Deploy a simple ERC20 for testing (mock USDC)
        const MockToken = await ethers.getContractFactory("XorbToken");
        token = await MockToken.deploy();
        await token.waitForDeployment();

        // Distribute tokens
        await token.transfer(sponsor.address, THOUSAND_TOKENS);
        await token.transfer(hirer.address, THOUSAND_TOKENS);

        // Deploy PaymentStreaming
        const PaymentStreaming = await ethers.getContractFactory("PaymentStreaming");
        paymentStreaming = await PaymentStreaming.deploy(
            await token.getAddress(),
            treasury.address
        );
        await paymentStreaming.waitForDeployment();

        // Deploy AgentMarketplace
        const AgentMarketplace = await ethers.getContractFactory("AgentMarketplace");
        marketplace = await AgentMarketplace.deploy(
            await token.getAddress(),
            treasury.address
        );
        await marketplace.waitForDeployment();

        // Grant arbiter role
        const ARBITER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ARBITER_ROLE"));
        await marketplace.grantRole(ARBITER_ROLE, arbiter.address);

        // Approve token spending
        await token.connect(sponsor).approve(await paymentStreaming.getAddress(), ethers.MaxUint256);
        await token.connect(sponsor).approve(await marketplace.getAddress(), ethers.MaxUint256);
        await token.connect(hirer).approve(await marketplace.getAddress(), ethers.MaxUint256);
    });

    // ═══════════════════════════════════════
    //   PAYMENT STREAMING TESTS
    // ═══════════════════════════════════════

    describe("PaymentStreaming", function () {
        const ratePerSecond = ethers.parseEther("0.01"); // 0.01 USDC/sec
        const deposit = ethers.parseEther("36"); // enough for 1 hour at 0.01/sec

        it("should create a stream", async function () {
            const tx = await paymentStreaming.connect(sponsor).createStream(
                agentId, agentWallet.address, ratePerSecond, deposit, "Task payment"
            );
            await tx.wait();

            const stream = await paymentStreaming.getStream(1);
            expect(stream.sponsor).to.equal(sponsor.address);
            expect(stream.agentId).to.equal(agentId);
            expect(stream.agentWallet).to.equal(agentWallet.address);
            expect(stream.ratePerSecond).to.equal(ratePerSecond);
            expect(stream.deposit).to.equal(deposit);
            expect(stream.status).to.equal(0); // Active
        });

        it("should reject stream with insufficient deposit", async function () {
            const smallDeposit = ethers.parseEther("0.1");
            await expect(
                paymentStreaming.connect(sponsor).createStream(
                    agentId, agentWallet.address, ratePerSecond, smallDeposit, "Too small"
                )
            ).to.be.revertedWith("Min deposit = 1 hour of streaming");
        });

        it("should accrue earnings over time", async function () {
            await paymentStreaming.connect(sponsor).createStream(
                agentId, agentWallet.address, ratePerSecond, deposit, "Work"
            );

            // Fast-forward 100 seconds
            await ethers.provider.send("evm_increaseTime", [100]);
            await ethers.provider.send("evm_mine");

            const earned = await paymentStreaming.getEarned(1);
            // Should be roughly 100 * 0.01 = 1 token (± block timing)
            expect(earned).to.be.gte(ethers.parseEther("0.9"));
        });

        it("should allow agent to withdraw", async function () {
            await paymentStreaming.connect(sponsor).createStream(
                agentId, agentWallet.address, ratePerSecond, deposit, "Work"
            );

            await ethers.provider.send("evm_increaseTime", [100]);
            await ethers.provider.send("evm_mine");

            const balBefore = await token.balanceOf(agentWallet.address);
            await paymentStreaming.connect(agentWallet).withdraw(1);
            const balAfter = await token.balanceOf(agentWallet.address);

            expect(balAfter).to.be.gt(balBefore);
        });

        it("should reject withdrawal from non-agent", async function () {
            await paymentStreaming.connect(sponsor).createStream(
                agentId, agentWallet.address, ratePerSecond, deposit, "Work"
            );
            await expect(
                paymentStreaming.connect(sponsor).withdraw(1)
            ).to.be.revertedWith("Not agent wallet");
        });

        it("should allow sponsor to pause and resume", async function () {
            await paymentStreaming.connect(sponsor).createStream(
                agentId, agentWallet.address, ratePerSecond, deposit, "Work"
            );

            await paymentStreaming.connect(sponsor).pauseStream(1);
            let stream = await paymentStreaming.getStream(1);
            expect(stream.status).to.equal(1); // Paused

            await paymentStreaming.connect(sponsor).resumeStream(1);
            stream = await paymentStreaming.getStream(1);
            expect(stream.status).to.equal(0); // Active
        });

        it("should stop accruing when paused", async function () {
            await paymentStreaming.connect(sponsor).createStream(
                agentId, agentWallet.address, ratePerSecond, deposit, "Work"
            );

            await ethers.provider.send("evm_increaseTime", [50]);
            await ethers.provider.send("evm_mine");

            await paymentStreaming.connect(sponsor).pauseStream(1);
            const earnedAtPause = await paymentStreaming.getEarned(1);

            // Wait more time while paused
            await ethers.provider.send("evm_increaseTime", [200]);
            await ethers.provider.send("evm_mine");

            const earnedAfterWait = await paymentStreaming.getEarned(1);
            // Earnings should not have increased
            expect(earnedAfterWait).to.equal(earnedAtPause);
        });

        it("should cancel stream and refund", async function () {
            await paymentStreaming.connect(sponsor).createStream(
                agentId, agentWallet.address, ratePerSecond, deposit, "Work"
            );

            await ethers.provider.send("evm_increaseTime", [50]);
            await ethers.provider.send("evm_mine");

            const sponsorBalBefore = await token.balanceOf(sponsor.address);
            await paymentStreaming.connect(sponsor).cancelStream(1);
            const sponsorBalAfter = await token.balanceOf(sponsor.address);

            // Sponsor should get refund
            expect(sponsorBalAfter).to.be.gt(sponsorBalBefore);

            const stream = await paymentStreaming.getStream(1);
            expect(stream.status).to.equal(2); // Cancelled
        });

        it("should allow top up", async function () {
            await paymentStreaming.connect(sponsor).createStream(
                agentId, agentWallet.address, ratePerSecond, deposit, "Work"
            );

            const extraDeposit = ethers.parseEther("10");
            await paymentStreaming.connect(sponsor).topUp(1, extraDeposit);

            const stream = await paymentStreaming.getStream(1);
            expect(stream.deposit).to.equal(deposit + extraDeposit);
        });

        it("should collect protocol fee on withdrawal", async function () {
            await paymentStreaming.connect(sponsor).createStream(
                agentId, agentWallet.address, ratePerSecond, deposit, "Work"
            );

            await ethers.provider.send("evm_increaseTime", [1000]);
            await ethers.provider.send("evm_mine");

            const treasuryBefore = await token.balanceOf(treasury.address);
            await paymentStreaming.connect(agentWallet).withdraw(1);
            const treasuryAfter = await token.balanceOf(treasury.address);

            // Treasury should have received fee
            expect(treasuryAfter).to.be.gt(treasuryBefore);
        });

        it("should track sponsor stream IDs", async function () {
            await paymentStreaming.connect(sponsor).createStream(
                agentId, agentWallet.address, ratePerSecond, deposit, "Stream 1"
            );

            const agentId2 = ethers.keccak256(ethers.toUtf8Bytes("agent-2"));
            await paymentStreaming.connect(sponsor).createStream(
                agentId2, agentWallet.address, ratePerSecond, deposit, "Stream 2"
            );

            const ids = await paymentStreaming.getSponsorStreamIds(sponsor.address);
            expect(ids.length).to.equal(2);
        });
    });

    // ═══════════════════════════════════════
    //   AGENT MARKETPLACE TESTS
    // ═══════════════════════════════════════

    describe("AgentMarketplace", function () {
        const hourlyPrice = ethers.parseEther("5"); // 5 USDC/hour

        it("should list an agent", async function () {
            await marketplace.connect(sponsor).listAgent(
                agentId, hourlyPrice, 0, 0, 3, "Expert trading agent"
            );

            const listing = await marketplace.getListing(1);
            expect(listing.owner).to.equal(sponsor.address);
            expect(listing.agentId).to.equal(agentId);
            expect(listing.pricePerUnit).to.equal(hourlyPrice);
            expect(listing.status).to.equal(0); // Active
        });

        it("should prevent duplicate listing for same agent", async function () {
            await marketplace.connect(sponsor).listAgent(
                agentId, hourlyPrice, 0, 0, 3, "Agent"
            );
            await expect(
                marketplace.connect(sponsor).listAgent(
                    agentId, hourlyPrice, 0, 0, 3, "Duplicate"
                )
            ).to.be.revertedWith("Agent already listed");
        });

        it("should allow hiring an agent", async function () {
            await marketplace.connect(sponsor).listAgent(
                agentId, hourlyPrice, 0, 0, 3, "Agent"
            );

            const hirerBalBefore = await token.balanceOf(hirer.address);
            await marketplace.connect(hirer).hireAgent(1, 2, 7200, "Analyze portfolio");
            const hirerBalAfter = await token.balanceOf(hirer.address);

            // Hirer paid 2 * 5 = 10 tokens
            expect(hirerBalBefore - hirerBalAfter).to.equal(ethers.parseEther("10"));

            const engagement = await marketplace.getEngagement(1);
            expect(engagement.hirer).to.equal(hirer.address);
            expect(engagement.escrowAmount).to.equal(ethers.parseEther("10"));
            expect(engagement.status).to.equal(0); // Active
        });

        it("should prevent self-hire", async function () {
            await marketplace.connect(sponsor).listAgent(
                agentId, hourlyPrice, 0, 0, 3, "Agent"
            );
            await expect(
                marketplace.connect(sponsor).hireAgent(1, 1, 3600, "Self hire")
            ).to.be.revertedWith("Cannot hire own agent");
        });

        it("should enforce max concurrent hires", async function () {
            await marketplace.connect(sponsor).listAgent(
                agentId, hourlyPrice, 0, 0, 1, "Agent"  // max 1 concurrent
            );
            await marketplace.connect(hirer).hireAgent(1, 1, 3600, "Task 1");
            await expect(
                marketplace.connect(hirer).hireAgent(1, 1, 3600, "Task 2")
            ).to.be.revertedWith("Fully booked");
        });

        it("should complete engagement and pay owner", async function () {
            await marketplace.connect(sponsor).listAgent(
                agentId, hourlyPrice, 0, 0, 3, "Agent"
            );
            await marketplace.connect(hirer).hireAgent(1, 2, 7200, "Task");

            const sponsorBalBefore = await token.balanceOf(sponsor.address);
            await marketplace.connect(hirer).completeEngagement(1);
            const sponsorBalAfter = await token.balanceOf(sponsor.address);

            // Owner should get 10 tokens minus 2.5% fee
            const expectedPayout = ethers.parseEther("9.75"); // 10 - 0.25
            expect(sponsorBalAfter - sponsorBalBefore).to.equal(expectedPayout);
        });

        it("should collect fee to treasury on completion", async function () {
            await marketplace.connect(sponsor).listAgent(
                agentId, hourlyPrice, 0, 0, 3, "Agent"
            );
            await marketplace.connect(hirer).hireAgent(1, 2, 7200, "Task");

            const treasuryBefore = await token.balanceOf(treasury.address);
            await marketplace.connect(hirer).completeEngagement(1);
            const treasuryAfter = await token.balanceOf(treasury.address);

            expect(treasuryAfter - treasuryBefore).to.equal(ethers.parseEther("0.25"));
        });

        it("should allow hirer to dispute", async function () {
            await marketplace.connect(sponsor).listAgent(
                agentId, hourlyPrice, 0, 0, 3, "Agent"
            );
            await marketplace.connect(hirer).hireAgent(1, 1, 3600, "Task");

            await marketplace.connect(hirer).disputeEngagement(1);
            const engagement = await marketplace.getEngagement(1);
            expect(engagement.status).to.equal(2); // Disputed
        });

        it("should resolve dispute with refund split", async function () {
            await marketplace.connect(sponsor).listAgent(
                agentId, hourlyPrice, 0, 0, 3, "Agent"
            );
            await marketplace.connect(hirer).hireAgent(1, 2, 7200, "Task");
            await marketplace.connect(hirer).disputeEngagement(1);

            const hirerBalBefore = await token.balanceOf(hirer.address);
            // 50% refund
            await marketplace.connect(arbiter).resolveDispute(1, 50);
            const hirerBalAfter = await token.balanceOf(hirer.address);

            // Hirer gets 50% of 10 = 5 tokens back
            expect(hirerBalAfter - hirerBalBefore).to.equal(ethers.parseEther("5"));
        });

        it("should allow rating after completion", async function () {
            await marketplace.connect(sponsor).listAgent(
                agentId, hourlyPrice, 0, 0, 3, "Agent"
            );
            await marketplace.connect(hirer).hireAgent(1, 1, 3600, "Task");
            await marketplace.connect(hirer).completeEngagement(1);

            await marketplace.connect(hirer).rateEngagement(1, 5);
            const engagement = await marketplace.getEngagement(1);
            expect(engagement.rating).to.equal(5);

            const listing = await marketplace.getListing(1);
            expect(listing.avgRating).to.equal(100); // 5 * 20 = 100
        });

        it("should reject rating before completion", async function () {
            await marketplace.connect(sponsor).listAgent(
                agentId, hourlyPrice, 0, 0, 3, "Agent"
            );
            await marketplace.connect(hirer).hireAgent(1, 1, 3600, "Task");

            await expect(
                marketplace.connect(hirer).rateEngagement(1, 5)
            ).to.be.revertedWith("Not completed");
        });

        it("should update listing", async function () {
            await marketplace.connect(sponsor).listAgent(
                agentId, hourlyPrice, 0, 0, 3, "Agent"
            );

            const newPrice = ethers.parseEther("10");
            await marketplace.connect(sponsor).updateListing(1, newPrice, 0);

            const listing = await marketplace.getListing(1);
            expect(listing.pricePerUnit).to.equal(newPrice);
        });

        it("should delist an agent", async function () {
            await marketplace.connect(sponsor).listAgent(
                agentId, hourlyPrice, 0, 0, 3, "Agent"
            );

            await marketplace.connect(sponsor).updateListing(1, 0, 2); // Delisted
            const listing = await marketplace.getListing(1);
            expect(listing.status).to.equal(2); // Delisted

            // Should be able to relist
            const agentId2 = ethers.keccak256(ethers.toUtf8Bytes("agent-2"));
            await marketplace.connect(sponsor).listAgent(
                agentId2, hourlyPrice, 0, 0, 3, "New agent"
            );
        });

        it("should track marketplace volume", async function () {
            await marketplace.connect(sponsor).listAgent(
                agentId, hourlyPrice, 0, 0, 3, "Agent"
            );
            await marketplace.connect(hirer).hireAgent(1, 2, 7200, "Task");
            await marketplace.connect(hirer).completeEngagement(1);

            const volume = await marketplace.totalVolume();
            expect(volume).to.equal(ethers.parseEther("10"));
        });
    });
});
