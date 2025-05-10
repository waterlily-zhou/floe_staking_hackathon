import { ethers } from "hardhat";

async function main() {
  const Token = await ethers.getContractFactory("TestToken");
  const aaveToken = await Token.deploy("MockAAVE", "MAAVE", ethers.parseEther("1000000"));
  await aaveToken.waitForDeployment();

  const rewardToken = await Token.deploy("MockREWARD", "MREWARD", ethers.parseEther("1000000"));
  await rewardToken.waitForDeployment();

  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with:", deployer.address);

  const Staking = await ethers.getContractFactory("MockStaking");
  const staking = await Staking.deploy(await aaveToken.getAddress(), await rewardToken.getAddress());
  await staking.waitForDeployment();

  console.log("AAVE:", await aaveToken.getAddress());
  console.log("REWARD:", await rewardToken.getAddress());
  console.log("STAKING:", await staking.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});