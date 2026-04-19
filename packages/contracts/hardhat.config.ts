import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ignition";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-ignition-ethers";
import "@typechain/hardhat";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      viaIR: true
    }
  },
  networks: {
    hardhat: {},
    baseSepolia: {
      url: process.env["BASE_SEPOLIA_RPC_URL"] ?? "http://127.0.0.1:8545",
      accounts: process.env["DEPLOYER_PRIVATE_KEY"]
        ? [process.env["DEPLOYER_PRIVATE_KEY"]]
        : []
    },
    baseMainnet: {
      url: process.env["BASE_MAINNET_RPC_URL"] ?? "http://127.0.0.1:8545",
      accounts: process.env["DEPLOYER_PRIVATE_KEY"]
        ? [process.env["DEPLOYER_PRIVATE_KEY"]]
        : []
    }
  }
};

export default config;
