import { ethers } from "hardhat";

async function main() {
  const Pipeline = await ethers.getContractFactory("Pipeline");
  const pipeline = await Pipeline.deploy();

  await pipeline.deployed();

  console.log(`Pipeline deployed to ${pipeline.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// 0x1850f080eb4C7f824B1Db2550Ea828467adc6b9B -- contract in use on goerli network
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
