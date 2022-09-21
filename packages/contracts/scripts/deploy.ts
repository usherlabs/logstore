import { ethers } from "hardhat";

async function main() {
  const Pipeline = await ethers.getContractFactory("Pipeline");
  const pipeline = await Pipeline.deploy();

  await pipeline.deployed();

  console.log(`Pipeline deployed to ${pipeline.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
