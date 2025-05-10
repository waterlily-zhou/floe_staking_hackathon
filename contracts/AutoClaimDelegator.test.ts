import { expect } from "chai";
import "@nomicfoundation/hardhat-ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, network } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { AutoClaimDelegator } from "../../typechain-types";
import { Signer } from "ethers";

describe("AutoClaimDelegator", function () {
  let autoClaimDelegator: AutoClaimDelegator;
  let admin: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  
  // Test parameters
  const minRewardsUsd = ethers.parseEther("1.0"); // 1 USD
  const gasAwareRatio = ethers.parseEther("1.2"); // 1.2x gas cost
  const compoundAwareRatio = ethers.parseEther("1.5"); // 1.5x gas cost
  const durationDays = 30; // 30 days
  

  beforeEach(async function () {
    // Get signers
    [admin, user1, user2] = await ethers.getSigners();
    
    // Deploy the contract
    const AutoClaimDelegatorFactory = await ethers.getContractFactory("AutoClaimDelegator");
    autoClaimDelegator = await AutoClaimDelegatorFactory.deploy();
    
    // Wait for deployment
    await autoClaimDelegator.waitForDeployment();
  });

  describe("Initialization", function () {
    it("should set the deployer as admin", async function () {
      expect(await autoClaimDelegator.admin()).to.equal(await admin.getAddress());
    });
  });

  describe("Admin management", function () {
    it("should allow admin to change admin", async function () {
      await autoClaimDelegator.setAdmin(await user1.getAddress());
      expect(await autoClaimDelegator.admin()).to.equal(await user1.getAddress());
    });

    it("should not allow non-admin to change admin", async function () {
      await expect(
        autoClaimDelegator.connect(user1).setAdmin(await user2.getAddress())
      ).to.be.rejectedWith("Only admin can call this function");
    });

    it("should not allow setting admin to zero address", async function () {
      await expect(
        autoClaimDelegator.setAdmin(ethers.ZeroAddress)
      ).to.be.rejectedWith("Invalid address");
    });
  });

  describe("Delegation", function () {
    it("should allow users to delegate claims", async function () {
      const user1Address = await user1.getAddress();
      await autoClaimDelegator.connect(user1).delegateClaims(
        minRewardsUsd,
        gasAwareRatio,
        compoundAwareRatio,
        durationDays
      );
      
      // Check if delegation was successful
      expect(await autoClaimDelegator.hasDelegatedClaims(user1Address)).to.be.true;
      
      // Calculate expected expiry
      const blockTimestamp = await time.latest();
      const expectedExpiry = blockTimestamp + (durationDays * 24 * 60 * 60);
      expect(await autoClaimDelegator.delegationExpiry(user1Address)).to.equal(expectedExpiry);
      
      // Check thresholds
      const details = await autoClaimDelegator.getDelegationDetails(user1Address);
      expect(details.hasValidDelegation).to.be.true;
      expect(details.minRewardsUsd).to.equal(minRewardsUsd);
      expect(details.gasAwareRatio).to.equal(gasAwareRatio);
      expect(details.compoundAwareRatio).to.equal(compoundAwareRatio);
    });

    it("should reject invalid delegation duration", async function () {
      await expect(
        autoClaimDelegator.connect(user1).delegateClaims(
          minRewardsUsd,
          gasAwareRatio,
          compoundAwareRatio,
          0 // Invalid duration (0 days)
        )
      ).to.be.rejectedWith("Duration must be between 1 and 365 days");
      
      await expect(
        autoClaimDelegator.connect(user1).delegateClaims(
          minRewardsUsd,
          gasAwareRatio,
          compoundAwareRatio,
          366 // Invalid duration (366 days)
        )
      ).to.be.rejectedWith("Duration must be between 1 and 365 days");
    });

    it("should reject zero thresholds", async function () {
      await expect(
        autoClaimDelegator.connect(user1).delegateClaims(
          0, // 0 minRewardsUsd
          gasAwareRatio,
          compoundAwareRatio,
          durationDays
        )
      ).to.be.rejectedWith("All thresholds must be greater than 0");
    });

    it("should allow users to revoke delegation", async function () {
      const user1Address = await user1.getAddress();
      // First delegate
      await autoClaimDelegator.connect(user1).delegateClaims(
        minRewardsUsd,
        gasAwareRatio,
        compoundAwareRatio,
        durationDays
      );
      
      // Then revoke
      await autoClaimDelegator.connect(user1).revokeDelegation();
      
      // Check if delegation was revoked
      expect(await autoClaimDelegator.hasDelegatedClaims(user1Address)).to.be.false;
    });
  });

  describe("ShouldClaim logic", function () {
    let user1Address: string;
    let user2Address: string;
    
    beforeEach(async function () {
      user1Address = await user1.getAddress();
      user2Address = await user2.getAddress();
    });

    it("should return true when all set thresholds are met", async function () {
      // Setup delegation with all thresholds
      await autoClaimDelegator.connect(user1).delegateClaims(
        minRewardsUsd,
        gasAwareRatio,
        compoundAwareRatio,
        durationDays
      );
      
      // Set values that meet all thresholds
      const currentRewardsUsd = ethers.parseEther("1.5"); // > minRewardsUsd (1.0)
      const gasPrice = ethers.parseUnits("20", "gwei"); // Low gas price
      const estimatedGasCost = 150000n;
      const estimatedCompoundReturn = ethers.parseEther("0.5"); // High compound return
      
      expect(await autoClaimDelegator.shouldClaim(
        user1Address,
        currentRewardsUsd,
        gasPrice,
        estimatedGasCost,
        estimatedCompoundReturn
      )).to.be.true;
    });

    it("should return false when any set threshold is not met", async function () {
      // Setup delegation with all thresholds
      await autoClaimDelegator.connect(user1).delegateClaims(
        minRewardsUsd,
        gasAwareRatio,
        compoundAwareRatio,
        durationDays
      );
      
      // Set values where minRewardsUsd is not met
      const currentRewardsUsd = ethers.parseEther("0.5"); // < minRewardsUsd (1.0)
      const gasPrice = ethers.parseUnits("20", "gwei");
      const estimatedGasCost = ethers.parseUnits("150000", "wei");
      const estimatedCompoundReturn = ethers.parseEther("0.5");
      
      expect(await autoClaimDelegator.shouldClaim(
        user1Address,
        currentRewardsUsd,
        gasPrice,
        estimatedGasCost,
        estimatedCompoundReturn
      )).to.be.false;
    });

    it("should work with only minRewardsUsd threshold set", async function () {
      // Setup delegation with only minRewardsUsd
      await autoClaimDelegator.connect(user1).delegateClaims(
        minRewardsUsd,
        0, // No gasAwareRatio
        0, // No compoundAwareRatio
        durationDays
      );
      
      // Should return true when minRewardsUsd is met
      const currentRewardsUsd = ethers.parseEther("1.5"); // > minRewardsUsd (1.0)
      const gasPrice = ethers.parseUnits("50", "gwei");
      const estimatedGasCost = ethers.parseUnits("150000", "wei");
      const estimatedCompoundReturn = ethers.parseEther("0.1");
      
      expect(await autoClaimDelegator.shouldClaim(
        user1Address,
        currentRewardsUsd,
        gasPrice,
        estimatedGasCost,
        estimatedCompoundReturn
      )).to.be.true;
      
      // Should return false when minRewardsUsd is not met
      const lowRewardsUsd = ethers.parseEther("0.5"); // < minRewardsUsd (1.0)
      expect(await autoClaimDelegator.shouldClaim(
        user1Address,
        lowRewardsUsd,
        gasPrice,
        estimatedGasCost,
        estimatedCompoundReturn
      )).to.be.false;
    });

    it("should work with only gasAwareRatio threshold set", async function () {
      // Setup delegation with only gasAwareRatio
      await autoClaimDelegator.connect(user1).delegateClaims(
        0, // No minRewardsUsd
        gasAwareRatio,
        0, // No compoundAwareRatio
        durationDays
      );
      
      // Should return true when gasAwareRatio is met
      const currentRewardsUsd = ethers.parseEther("0.5");
      const gasPrice = ethers.parseUnits("20", "gwei"); // Low gas price to meet ratio
      const estimatedGasCost = ethers.parseUnits("150000", "wei");
      const estimatedCompoundReturn = ethers.parseEther("0.1");
      
      expect(await autoClaimDelegator.shouldClaim(
        user1Address,
        currentRewardsUsd,
        gasPrice,
        estimatedGasCost,
        estimatedCompoundReturn
      )).to.be.true;
      
      // Should return false when gasAwareRatio is not met
      const highGasPrice = ethers.parseUnits("50", "gwei"); // High gas price
      expect(await autoClaimDelegator.shouldClaim(
        user1Address,
        currentRewardsUsd,
        highGasPrice,
        estimatedGasCost,
        estimatedCompoundReturn
      )).to.be.false;
    });

    it("should work with only compoundAwareRatio threshold set", async function () {
      // Setup delegation with only compoundAwareRatio
      await autoClaimDelegator.connect(user1).delegateClaims(
        0, // No minRewardsUsd
        0, // No gasAwareRatio
        compoundAwareRatio,
        durationDays
      );
      
      // Should return true when compoundAwareRatio is met
      const currentRewardsUsd = ethers.parseEther("0.5");
      const gasPrice = ethers.parseUnits("20", "gwei");
      const estimatedGasCost = ethers.parseUnits("150000", "wei");
      const estimatedCompoundReturn = ethers.parseEther("0.5"); // High compound return
      
      expect(await autoClaimDelegator.shouldClaim(
        user1Address,
        currentRewardsUsd,
        gasPrice,
        estimatedGasCost,
        estimatedCompoundReturn
      )).to.be.true;
      
      // Should return false when compoundAwareRatio is not met
      const lowCompoundReturn = ethers.parseEther("0.1"); // Low compound return
      expect(await autoClaimDelegator.shouldClaim(
        user1Address,
        currentRewardsUsd,
        gasPrice,
        estimatedGasCost,
        lowCompoundReturn
      )).to.be.false;
    });

    it("should return false for user without delegation", async function () {
      const currentRewardsUsd = ethers.parseEther("2.0");
      const gasPrice = ethers.parseUnits("50", "gwei");
      const estimatedGasCost = ethers.parseUnits("150000", "wei");
      const estimatedCompoundReturn = ethers.parseEther("0.1");
      
      expect(await autoClaimDelegator.shouldClaim(
        user2Address, // user2 has not delegated
        currentRewardsUsd,
        gasPrice,
        estimatedGasCost,
        estimatedCompoundReturn
      )).to.be.false;
    });

    it("should return false after delegation expiry", async function () {
      // Setup delegation
      await autoClaimDelegator.connect(user1).delegateClaims(
        minRewardsUsd,
        gasAwareRatio,
        compoundAwareRatio,
        durationDays
      );
      
      // Fast forward time to after expiration
      await time.increase(durationDays * 24 * 60 * 60 + 1); // +1 second after expiry
      
      const currentRewardsUsd = ethers.parseEther("2.0");
      const gasPrice = ethers.parseUnits("50", "gwei");
      const estimatedGasCost = ethers.parseUnits("150000", "wei");
      const estimatedCompoundReturn = ethers.parseEther("0.1");
      
      expect(await autoClaimDelegator.shouldClaim(
        user1Address,
        currentRewardsUsd,
        gasPrice,
        estimatedGasCost,
        estimatedCompoundReturn
      )).to.be.false;
    });
  });

  describe("shouldClaimSimple", function () {
    let user1Address: string;
    
    beforeEach(async function () {
      user1Address = await user1.getAddress();
      // Setup delegation for user1
      await autoClaimDelegator.connect(user1).delegateClaims(
        minRewardsUsd,
        gasAwareRatio,
        compoundAwareRatio,
        durationDays
      );
    });

    it("should return true when minRewardsUsd threshold is met", async function () {
      const currentRewardsUsd = ethers.parseEther("1.5"); // Greater than minRewardsUsd (1.0)
      
      expect(await autoClaimDelegator.shouldClaimSimple(
        user1Address,
        currentRewardsUsd
      )).to.be.true;
    });

    it("should return false when minRewardsUsd threshold is not met", async function () {
      const currentRewardsUsd = ethers.parseEther("0.5"); // Less than minRewardsUsd (1.0)
      
      expect(await autoClaimDelegator.shouldClaimSimple(
        user1Address,
        currentRewardsUsd
      )).to.be.false;
    });
  });

  // Note: We can't fully test batchClaimOnBehalf without mocking gauge contracts
  // This would require additional setup with mock contracts
}); 