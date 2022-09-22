import { ethers } from "hardhat";

async function main() {
  const Pipeline = await ethers.getContractFactory("Pipeline");
  const pipeline = await Pipeline.deploy();

  await pipeline.deployed();

  console.log(`Pipeline deployed to ${pipeline.address}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
// 0x709ba82c3D1E1089E29D0354C131CF62fA46D134 -- contract in use on goerli network
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
