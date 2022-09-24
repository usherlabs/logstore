import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
require("dotenv").config();

const config: HardhatUserConfig = {
	solidity: "0.8.7",
  networks: {
    "mumbai": {
      url: "https://rpc-mumbai.maticvigil.com",
			accounts: [`${process.env.DEPLOYER_PRIVATE_KEY}`]
    }
  }
};

export default config;
