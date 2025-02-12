import { getGckmsSigner, getMnemonicSigner, getRetryProvider } from "@uma/common";
import { Signer, Wallet } from "ethers";

import type { Provider } from "@ethersproject/abstract-provider";

export { OptimisticOracleV3Ethers } from "@uma/contracts-node";
export { Logger } from "@uma/financial-templates-lib";
export { getContractInstanceWithProvider } from "../utils/contracts";

export interface BotModes {
  settleAssertionsEnabled: boolean;
}

export interface BlockRange {
  start: number;
  end: number;
}

export interface MonitoringParams {
  provider: Provider;
  chainId: number;
  botModes: BotModes;
  signer: Signer;
  blockLookback: number;
  maxBlockLookBack: number;
  pollingDelay: number;
}

const blockDefaults = {
  "1": {
    // Mainnet
    oneHour: 300, // 12 seconds per block
    maxBlockLookBack: 20000,
  },
  "137": {
    // Polygon
    oneHour: 1800, // 2 seconds per block
    maxBlockLookBack: 3499,
  },
  "10": {
    // Optimism
    oneHour: 1800, // 2 seconds per block
    maxBlockLookBack: 10000,
  },
  "42161": {
    // Arbitrum
    oneHour: 240, // 15 seconds per block
    maxBlockLookBack: 10000,
  },
  "43114": {
    // Avalanche
    oneHour: 1800, // 2 seconds per block
    maxBlockLookBack: 2000,
  },
  other: {
    oneHour: 240, // 15 seconds per block
    maxBlockLookBack: 1000,
  },
};

export const initMonitoringParams = async (env: NodeJS.ProcessEnv): Promise<MonitoringParams> => {
  if (!env.CHAIN_ID) throw new Error("CHAIN_ID must be defined in env");
  const chainId = Number(env.CHAIN_ID);

  // Creating provider will check for other chainId specific env variables.
  const provider = getRetryProvider(chainId) as Provider;

  // Default to 1 minute polling delay.
  const pollingDelay = env.POLLING_DELAY ? Number(env.POLLING_DELAY) : 60;

  let signer;
  if (process.env.GCKMS_WALLET) {
    signer = ((await getGckmsSigner()) as Wallet).connect(provider);
  } else {
    // Throws if MNEMONIC env var is not defined.
    signer = (getMnemonicSigner() as Signer).connect(provider);
  }

  const botModes = {
    settleAssertionsEnabled: env.SETTLEMENTS_ENABLED === "true",
  };

  const blockLookback =
    Number(env.BLOCK_LOOKBACK) ||
    blockDefaults[chainId.toString() as keyof typeof blockDefaults]?.oneHour ||
    blockDefaults.other.oneHour;

  const maxBlockLookBack =
    Number(env.MAX_BLOCK_LOOKBACK) ||
    blockDefaults[chainId.toString() as keyof typeof blockDefaults]?.maxBlockLookBack ||
    blockDefaults.other.maxBlockLookBack;

  return {
    provider,
    chainId,
    botModes,
    signer,
    blockLookback,
    maxBlockLookBack,
    pollingDelay,
  };
};

export const startupLogLevel = (params: MonitoringParams): "debug" | "info" => {
  return params.pollingDelay === 0 ? "debug" : "info";
};
