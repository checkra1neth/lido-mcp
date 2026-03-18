import { type Chain, mainnet, holesky } from "viem/chains";

export interface NetworkConfig {
  chain: Chain;
  chainId: number;
  name: string;
  contracts: {
    lido: `0x${string}`;
    wstETH: `0x${string}`;
    withdrawalQueue: `0x${string}`;
    voting: `0x${string}`;
    ldoToken: `0x${string}`;
  };
}

export const NETWORKS: Record<number, NetworkConfig> = {
  1: {
    chain: mainnet,
    chainId: 1,
    name: "Ethereum Mainnet",
    contracts: {
      lido: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
      wstETH: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
      withdrawalQueue: "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1",
      voting: "0x2e59A20f205bB85a89C53f1936454680651E618e",
      ldoToken: "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32",
    },
  },
  17000: {
    chain: holesky,
    chainId: 17000,
    name: "Holesky Testnet",
    contracts: {
      lido: "0x3F1c547b21f65e10480dE3ad8E19fAAC46C95034",
      wstETH: "0x8d09a4502Cc8Cf1547aD300E066060D043f6982D",
      withdrawalQueue: "0xc7cc160b58F8Bb0baC94b80847E2CF2800565C50",
      voting: "0x0000000000000000000000000000000000000000",
      ldoToken: "0x0000000000000000000000000000000000000000",
    },
  },
};

export function getNetworkConfig(chainId: number): NetworkConfig {
  const config = NETWORKS[chainId];
  if (!config) {
    throw new Error(
      `Unsupported chain ID: ${chainId}. Supported: ${Object.keys(NETWORKS).join(", ")}`,
    );
  }
  return config;
}

export const VOTING_ABI = [
  {
    name: "votesLength",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "getVote",
    type: "function",
    inputs: [{ name: "_voteId", type: "uint256" }],
    outputs: [
      { name: "open", type: "bool" },
      { name: "executed", type: "bool" },
      { name: "startDate", type: "uint64" },
      { name: "snapshotBlock", type: "uint64" },
      { name: "supportRequired", type: "uint64" },
      { name: "minAcceptQuorum", type: "uint64" },
      { name: "yea", type: "uint256" },
      { name: "nay", type: "uint256" },
      { name: "votingPower", type: "uint256" },
      { name: "script", type: "bytes" },
      { name: "phase", type: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    name: "canVote",
    type: "function",
    inputs: [
      { name: "_voteId", type: "uint256" },
      { name: "_voter", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    name: "canExecute",
    type: "function",
    inputs: [{ name: "_voteId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    name: "getVoterState",
    type: "function",
    inputs: [
      { name: "_voteId", type: "uint256" },
      { name: "_voter", type: "address" },
    ],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    name: "vote",
    type: "function",
    inputs: [
      { name: "_voteId", type: "uint256" },
      { name: "_supports", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
