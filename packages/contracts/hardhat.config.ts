import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
require("dotenv").config();

const config: HardhatUserConfig = {
	solidity: "0.8.7",
  networks: {
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_API_KEY}`,
			accounts: [`${process.env.DEPLOYER_PRIVATE_KEY}`]
    }
  }
};

export default config;
