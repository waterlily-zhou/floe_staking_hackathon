import "@nomicfoundation/hardhat-ethers";
import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Deploying AutoClaimDelegator contract...");

  // Get the Contract Factory
  const AutoClaimDelegator = await ethers.getContractFactory("AutoClaimDelegator");
  
  // Deploy the contract
  const delegator = await AutoClaimDelegator.deploy();
  
  // Wait for deployment
  await delegator.waitForDeployment();
  
  // Get the deployed contract address
  const delegatorAddress = await delegator.getAddress();
  
  console.log(`AutoClaimDelegator deployed to: ${delegatorAddress}`);
  
  // Save the contract address to a file for easy reference
  const deploymentInfo = {
    delegatorAddress,
    contractType: "AutoClaimDelegator",
    network: (await ethers.provider.getNetwork()).name,
    deployedAt: new Date().toISOString()
  };
  
  const deploymentDir = path.join(__dirname, "..", "data", "deployment");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  
  fs.writeFileSync(
    path.join(deploymentDir, "delegator_deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log("Deployment information saved to data/deployment/delegator_deployment.json");
}

// Run the deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 