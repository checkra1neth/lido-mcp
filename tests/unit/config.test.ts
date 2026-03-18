import { describe, it, expect } from "vitest";
import { getNetworkConfig, NETWORKS, VOTING_ABI } from "../../src/config.js";

describe("getNetworkConfig", () => {
  it("returns mainnet config for chain ID 1", () => {
    const config = getNetworkConfig(1);
    expect(config.chainId).toBe(1);
    expect(config.name).toBe("Ethereum Mainnet");
    expect(config.chain.id).toBe(1);
  });

  it("returns holesky config for chain ID 17000", () => {
    const config = getNetworkConfig(17000);
    expect(config.chainId).toBe(17000);
    expect(config.name).toBe("Holesky Testnet");
    expect(config.chain.id).toBe(17000);
  });

  it("mainnet has correct contract addresses", () => {
    const config = getNetworkConfig(1);
    expect(config.contracts.lido).toBe(
      "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
    );
    expect(config.contracts.wstETH).toBe(
      "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
    );
    expect(config.contracts.withdrawalQueue).toBe(
      "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1",
    );
    expect(config.contracts.voting).toBe(
      "0x2e59A20f205bB85a89C53f1936454680651E618e",
    );
    expect(config.contracts.ldoToken).toBe(
      "0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32",
    );
  });

  it("holesky has correct contract addresses", () => {
    const config = getNetworkConfig(17000);
    expect(config.contracts.lido).toBe(
      "0x3F1c547b21f65e10480dE3ad8E19fAAC46C95034",
    );
    expect(config.contracts.wstETH).toBe(
      "0x8d09a4502Cc8Cf1547aD300E066060D043f6982D",
    );
    expect(config.contracts.withdrawalQueue).toBe(
      "0xc7cc160b58F8Bb0baC94b80847E2CF2800565C50",
    );
  });

  it("throws for unsupported chain ID", () => {
    expect(() => getNetworkConfig(42)).toThrow("Unsupported chain ID: 42");
  });

  it("error message lists supported chain IDs", () => {
    expect(() => getNetworkConfig(999)).toThrow("Supported: 1, 17000");
  });

  it("throws for chain ID 0", () => {
    expect(() => getNetworkConfig(0)).toThrow("Unsupported chain ID");
  });
});

describe("NETWORKS", () => {
  it("has entries for mainnet and holesky", () => {
    expect(NETWORKS[1]).toBeDefined();
    expect(NETWORKS[17000]).toBeDefined();
  });

  it("each network has required contract fields", () => {
    const requiredFields = [
      "lido",
      "wstETH",
      "withdrawalQueue",
      "voting",
      "ldoToken",
    ] as const;

    for (const chainId of [1, 17000]) {
      const config = NETWORKS[chainId];
      for (const field of requiredFields) {
        expect(config.contracts[field]).toBeDefined();
        expect(config.contracts[field]).toMatch(/^0x[0-9a-fA-F]{40}$/);
      }
    }
  });
});

describe("VOTING_ABI", () => {
  it("is an array of ABI entries", () => {
    expect(Array.isArray(VOTING_ABI)).toBe(true);
    expect(VOTING_ABI.length).toBeGreaterThan(0);
  });

  it("contains votesLength function", () => {
    const entry = VOTING_ABI.find((e) => e.name === "votesLength");
    expect(entry).toBeDefined();
    expect(entry!.type).toBe("function");
    expect(entry!.stateMutability).toBe("view");
    expect(entry!.inputs).toHaveLength(0);
  });

  it("contains getVote function with correct outputs", () => {
    const entry = VOTING_ABI.find((e) => e.name === "getVote");
    expect(entry).toBeDefined();
    expect(entry!.type).toBe("function");
    expect(entry!.inputs).toHaveLength(1);
    expect(entry!.inputs[0].type).toBe("uint256");
    expect(entry!.outputs.length).toBeGreaterThanOrEqual(10);
  });

  it("contains canVote function", () => {
    const entry = VOTING_ABI.find((e) => e.name === "canVote");
    expect(entry).toBeDefined();
    expect(entry!.inputs).toHaveLength(2);
    expect(entry!.outputs).toHaveLength(1);
    expect(entry!.outputs[0].type).toBe("bool");
  });

  it("contains canExecute function", () => {
    const entry = VOTING_ABI.find((e) => e.name === "canExecute");
    expect(entry).toBeDefined();
    expect(entry!.inputs).toHaveLength(1);
  });

  it("contains getVoterState function", () => {
    const entry = VOTING_ABI.find((e) => e.name === "getVoterState");
    expect(entry).toBeDefined();
    expect(entry!.inputs).toHaveLength(2);
  });

  it("contains vote function (nonpayable)", () => {
    const entry = VOTING_ABI.find((e) => e.name === "vote");
    expect(entry).toBeDefined();
    expect(entry!.stateMutability).toBe("nonpayable");
    expect(entry!.inputs).toHaveLength(2);
  });

  it("all entries have name, type, inputs, outputs", () => {
    for (const entry of VOTING_ABI) {
      expect(entry.name).toBeDefined();
      expect(entry.type).toBe("function");
      expect(Array.isArray(entry.inputs)).toBe(true);
      expect(Array.isArray(entry.outputs)).toBe(true);
    }
  });
});
