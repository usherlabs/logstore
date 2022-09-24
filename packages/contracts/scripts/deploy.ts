import { ethers } from "hardhat";

async function main() {
  const Pipeline = await ethers.getContractFactory("PipelineContract");
  const pipeline = await Pipeline.deploy();

  await pipeline.deployed();

  console.log(`Pipeline deployed to ${pipeline.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// 0xDA50a7A41e5ac1d9d49A56A2647123Ed65F3e4B7 -- contract in use on mumbai network
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
