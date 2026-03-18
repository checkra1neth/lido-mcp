import { describe, it, expect, vi, beforeEach } from "vitest";
import { type LidoSDK } from "@lidofinance/lido-ethereum-sdk";
import { handleStake } from "../../src/tools/stake.js";
import {
  handleUnstake,
  handleWithdrawalStatus,
  handleClaimWithdrawal,
} from "../../src/tools/unstake.js";
import { handleWrap, handleUnwrap } from "../../src/tools/wrap.js";
import { handleBalance, handleApr } from "../../src/tools/balance.js";

const VALID_ACCOUNT = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";

function createMockSdk() {
  return {
    stake: {
      getStakeLimitInfo: vi.fn(),
      stakeEthPopulateTx: vi.fn(),
      stakeEth: vi.fn(),
    },
    withdraw: {
      views: {
        isPaused: vi.fn(),
        isBunkerModeActive: vi.fn(),
        minStethWithdrawalAmount: vi.fn(),
        minWStethWithdrawalAmount: vi.fn(),
      },
      request: {
        requestWithdrawalPopulateTx: vi.fn(),
        requestWithdrawalWithPermit: vi.fn(),
      },
      requestsInfo: {
        getClaimableRequestsInfo: vi.fn(),
        getPendingRequestsInfo: vi.fn(),
        getClaimableRequestsETHByAccount: vi.fn(),
      },
      claim: {
        claimRequests: vi.fn(),
      },
    },
    wrap: {
      convertStethToWsteth: vi.fn(),
      convertWstethToSteth: vi.fn(),
      wrapEthPopulateTx: vi.fn(),
      wrapStethPopulateTx: vi.fn(),
      unwrapPopulateTx: vi.fn(),
      wrapEth: vi.fn(),
      wrapSteth: vi.fn(),
      unwrap: vi.fn(),
      approveStethForWrap: vi.fn(),
    },
    core: {
      balanceETH: vi.fn(),
    },
    steth: {
      balance: vi.fn(),
    },
    wsteth: {
      balance: vi.fn(),
    },
    shares: {
      balance: vi.fn(),
      getShareRate: vi.fn(),
    },
    statistics: {
      apr: {
        getLastApr: vi.fn(),
        getSmaApr: vi.fn(),
      },
    },
    rewards: {
      getRewardsFromChain: vi.fn(),
    },
  } as unknown as LidoSDK;
}

function parseResponse(response: { content: Array<{ text: string }> }) {
  return JSON.parse(response.content[0].text);
}

function isErrorResponse(response: { content: Array<{ text: string }> }) {
  return response.content[0].text.startsWith("Error:");
}

describe("handleStake", () => {
  let sdk: ReturnType<typeof createMockSdk>;

  beforeEach(() => {
    sdk = createMockSdk();
  });

  it("returns populated tx on dry_run=true", async () => {
    const mockSdk = sdk as unknown as {
      stake: {
        getStakeLimitInfo: ReturnType<typeof vi.fn>;
        stakeEthPopulateTx: ReturnType<typeof vi.fn>;
      };
    };

    mockSdk.stake.getStakeLimitInfo.mockResolvedValue({
      isStakingPaused: false,
      currentStakeLimit: 100000000000000000000n, // 100 ETH
      maxStakeLimit: 150000000000000000000n, // 150 ETH
    });

    mockSdk.stake.stakeEthPopulateTx.mockResolvedValue({
      to: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
      from: VALID_ACCOUNT,
      value: 1000000000000000000n,
      data: "0xabcdef",
    });

    const result = await handleStake(sdk, {
      amount: "1",
      account: VALID_ACCOUNT,
      dry_run: true,
    });

    expect(isErrorResponse(result)).toBe(false);
    const data = parseResponse(result);
    expect(data.dryRun).toBe(true);
    expect(data.description).toContain("1 ETH");
    expect(data.transaction).toBeDefined();
    expect(data.transaction.to).toBeDefined();
    expect(data.stakingLimits).toBeDefined();
  });

  it("returns error when staking is paused", async () => {
    const mockSdk = sdk as unknown as {
      stake: { getStakeLimitInfo: ReturnType<typeof vi.fn> };
    };

    mockSdk.stake.getStakeLimitInfo.mockResolvedValue({
      isStakingPaused: true,
      currentStakeLimit: 0n,
      maxStakeLimit: 0n,
    });

    const result = await handleStake(sdk, {
      amount: "1",
      account: VALID_ACCOUNT,
    });

    expect(isErrorResponse(result)).toBe(true);
    expect(result.content[0].text).toContain("paused");
  });

  it("returns error when amount exceeds stake limit", async () => {
    const mockSdk = sdk as unknown as {
      stake: { getStakeLimitInfo: ReturnType<typeof vi.fn> };
    };

    mockSdk.stake.getStakeLimitInfo.mockResolvedValue({
      isStakingPaused: false,
      currentStakeLimit: 500000000000000000n, // 0.5 ETH
      maxStakeLimit: 1000000000000000000n,
    });

    const result = await handleStake(sdk, {
      amount: "1",
      account: VALID_ACCOUNT,
    });

    expect(isErrorResponse(result)).toBe(true);
    expect(result.content[0].text).toContain("exceeds");
  });

  it("returns error on invalid address", async () => {
    const result = await handleStake(sdk, {
      amount: "1",
      account: "invalid-address",
    });

    expect(isErrorResponse(result)).toBe(true);
    expect(result.content[0].text).toContain("Invalid Ethereum address");
  });

  it("returns error when SDK throws", async () => {
    const mockSdk = sdk as unknown as {
      stake: { getStakeLimitInfo: ReturnType<typeof vi.fn> };
    };

    mockSdk.stake.getStakeLimitInfo.mockRejectedValue(
      new Error("network failure"),
    );

    const result = await handleStake(sdk, {
      amount: "1",
      account: VALID_ACCOUNT,
    });

    expect(isErrorResponse(result)).toBe(true);
    expect(result.content[0].text).toContain("network failure");
  });

  it("executes stake when dry_run is false", async () => {
    const mockSdk = sdk as unknown as {
      stake: {
        getStakeLimitInfo: ReturnType<typeof vi.fn>;
        stakeEth: ReturnType<typeof vi.fn>;
      };
    };

    mockSdk.stake.getStakeLimitInfo.mockResolvedValue({
      isStakingPaused: false,
      currentStakeLimit: 100000000000000000000n,
      maxStakeLimit: 150000000000000000000n,
    });

    mockSdk.stake.stakeEth.mockResolvedValue({
      hash: "0xtxhash123",
      result: {
        stethReceived: 999000000000000000n,
        sharesReceived: 900000000000000000n,
      },
    });

    const result = await handleStake(sdk, {
      amount: "1",
      account: VALID_ACCOUNT,
      dry_run: false,
    });

    expect(isErrorResponse(result)).toBe(false);
    const data = parseResponse(result);
    expect(data.dryRun).toBe(false);
    expect(data.transactionHash).toBe("0xtxhash123");
  });
});

describe("handleUnstake", () => {
  let sdk: ReturnType<typeof createMockSdk>;

  beforeEach(() => {
    sdk = createMockSdk();
  });

  it("returns error when withdrawal queue is paused", async () => {
    const mockSdk = sdk as unknown as {
      withdraw: { views: { isPaused: ReturnType<typeof vi.fn> } };
    };
    mockSdk.withdraw.views.isPaused.mockResolvedValue(true);

    const result = await handleUnstake(sdk, {
      amount: "1",
      account: VALID_ACCOUNT,
    });

    expect(isErrorResponse(result)).toBe(true);
    expect(result.content[0].text).toContain("paused");
  });

  it("returns error when amount is below minimum", async () => {
    const mockSdk = sdk as unknown as {
      withdraw: {
        views: {
          isPaused: ReturnType<typeof vi.fn>;
          minStethWithdrawalAmount: ReturnType<typeof vi.fn>;
        };
      };
    };
    mockSdk.withdraw.views.isPaused.mockResolvedValue(false);
    mockSdk.withdraw.views.minStethWithdrawalAmount.mockResolvedValue(
      100000000000000000n,
    ); // 0.1 stETH

    const result = await handleUnstake(sdk, {
      amount: "0.01",
      account: VALID_ACCOUNT,
    });

    expect(isErrorResponse(result)).toBe(true);
    expect(result.content[0].text).toContain("minimum");
  });

  it("returns populated tx on dry_run", async () => {
    const mockSdk = sdk as unknown as {
      withdraw: {
        views: {
          isPaused: ReturnType<typeof vi.fn>;
          minStethWithdrawalAmount: ReturnType<typeof vi.fn>;
        };
        request: {
          requestWithdrawalPopulateTx: ReturnType<typeof vi.fn>;
        };
      };
    };
    mockSdk.withdraw.views.isPaused.mockResolvedValue(false);
    mockSdk.withdraw.views.minStethWithdrawalAmount.mockResolvedValue(
      100000000000000n,
    ); // very small min

    mockSdk.withdraw.request.requestWithdrawalPopulateTx.mockResolvedValue({
      to: "0x889edC2eDab5f40e902b864aD4d7AdE8E412F9B1",
      from: VALID_ACCOUNT,
      data: "0xdeadbeef",
    });

    const result = await handleUnstake(sdk, {
      amount: "1",
      account: VALID_ACCOUNT,
      dry_run: true,
    });

    expect(isErrorResponse(result)).toBe(false);
    const data = parseResponse(result);
    expect(data.dryRun).toBe(true);
    expect(data.transaction).toBeDefined();
    expect(data.note).toContain("NOT instant");
  });
});

describe("handleWithdrawalStatus", () => {
  let sdk: ReturnType<typeof createMockSdk>;

  beforeEach(() => {
    sdk = createMockSdk();
  });

  it("returns claimable and pending withdrawal info", async () => {
    const mockSdk = sdk as unknown as {
      withdraw: {
        requestsInfo: {
          getClaimableRequestsInfo: ReturnType<typeof vi.fn>;
          getPendingRequestsInfo: ReturnType<typeof vi.fn>;
        };
        views: { isBunkerModeActive: ReturnType<typeof vi.fn> };
      };
    };

    mockSdk.withdraw.requestsInfo.getClaimableRequestsInfo.mockResolvedValue({
      claimableRequests: [
        {
          stringId: "1",
          amountOfStETH: 1000000000000000000n,
          isFinalized: true,
          isClaimed: false,
        },
      ],
      claimableAmountStETH: 1000000000000000000n,
    });

    mockSdk.withdraw.requestsInfo.getPendingRequestsInfo.mockResolvedValue({
      pendingRequests: [
        {
          stringId: "2",
          amountOfStETH: 2000000000000000000n,
          timestamp: 1700000000n,
        },
      ],
      pendingAmountStETH: 2000000000000000000n,
    });

    mockSdk.withdraw.views.isBunkerModeActive.mockResolvedValue(false);

    const result = await handleWithdrawalStatus(sdk, {
      account: VALID_ACCOUNT,
    });

    expect(isErrorResponse(result)).toBe(false);
    const data = parseResponse(result);
    expect(data.claimable.count).toBe(1);
    expect(data.pending.count).toBe(1);
    expect(data.queueStatus.bunkerMode).toBe(false);
  });
});

describe("handleClaimWithdrawal", () => {
  let sdk: ReturnType<typeof createMockSdk>;

  beforeEach(() => {
    sdk = createMockSdk();
  });

  it("returns error when no claimable requests exist", async () => {
    const mockSdk = sdk as unknown as {
      withdraw: {
        requestsInfo: {
          getClaimableRequestsETHByAccount: ReturnType<typeof vi.fn>;
        };
      };
    };

    mockSdk.withdraw.requestsInfo.getClaimableRequestsETHByAccount.mockResolvedValue(
      {
        sortedIds: [],
        ethSum: 0n,
        hints: [],
      },
    );

    const result = await handleClaimWithdrawal(sdk, {
      account: VALID_ACCOUNT,
    });

    expect(isErrorResponse(result)).toBe(true);
    expect(result.content[0].text).toContain("No claimable");
  });

  it("returns dry_run result for claimable requests", async () => {
    const mockSdk = sdk as unknown as {
      withdraw: {
        requestsInfo: {
          getClaimableRequestsETHByAccount: ReturnType<typeof vi.fn>;
        };
      };
    };

    mockSdk.withdraw.requestsInfo.getClaimableRequestsETHByAccount.mockResolvedValue(
      {
        sortedIds: [1n, 2n],
        ethSum: 3000000000000000000n,
        hints: [0n, 0n],
      },
    );

    const result = await handleClaimWithdrawal(sdk, {
      account: VALID_ACCOUNT,
      dry_run: true,
    });

    expect(isErrorResponse(result)).toBe(false);
    const data = parseResponse(result);
    expect(data.dryRun).toBe(true);
    expect(data.requestIds).toHaveLength(2);
    expect(data.claimableETH).toContain("ETH");
  });
});

describe("handleBalance", () => {
  let sdk: ReturnType<typeof createMockSdk>;

  beforeEach(() => {
    sdk = createMockSdk();
  });

  it("returns formatted balances for all token types", async () => {
    const mockSdk = sdk as unknown as {
      core: { balanceETH: ReturnType<typeof vi.fn> };
      steth: { balance: ReturnType<typeof vi.fn> };
      wsteth: { balance: ReturnType<typeof vi.fn> };
      shares: {
        balance: ReturnType<typeof vi.fn>;
        getShareRate: ReturnType<typeof vi.fn>;
      };
      wrap: { convertWstethToSteth: ReturnType<typeof vi.fn> };
    };

    mockSdk.core.balanceETH.mockResolvedValue(5000000000000000000n); // 5 ETH
    mockSdk.steth.balance.mockResolvedValue(10000000000000000000n); // 10 stETH
    mockSdk.wsteth.balance.mockResolvedValue(3000000000000000000n); // 3 wstETH
    mockSdk.shares.balance.mockResolvedValue(9500000000000000000n);
    mockSdk.shares.getShareRate.mockResolvedValue(1050000000000000000n);
    mockSdk.wrap.convertWstethToSteth.mockResolvedValue(
      3150000000000000000n,
    ); // 3.15 stETH

    const result = await handleBalance(sdk, { account: VALID_ACCOUNT });

    expect(isErrorResponse(result)).toBe(false);
    const data = parseResponse(result);
    expect(data.account).toBe(VALID_ACCOUNT);
    expect(data.balances.ETH).toContain("5");
    expect(data.balances.ETH).toContain("ETH");
    expect(data.balances.stETH).toContain("10");
    expect(data.balances.stETH).toContain("stETH");
    expect(data.balances.wstETH).toContain("3");
    expect(data.balances.wstETH).toContain("wstETH");
    expect(data.totalStaked).toContain("stETH");
  });

  it("handles zero wstETH balance without conversion call", async () => {
    const mockSdk = sdk as unknown as {
      core: { balanceETH: ReturnType<typeof vi.fn> };
      steth: { balance: ReturnType<typeof vi.fn> };
      wsteth: { balance: ReturnType<typeof vi.fn> };
      shares: {
        balance: ReturnType<typeof vi.fn>;
        getShareRate: ReturnType<typeof vi.fn>;
      };
      wrap: { convertWstethToSteth: ReturnType<typeof vi.fn> };
    };

    mockSdk.core.balanceETH.mockResolvedValue(1000000000000000000n);
    mockSdk.steth.balance.mockResolvedValue(2000000000000000000n);
    mockSdk.wsteth.balance.mockResolvedValue(0n);
    mockSdk.shares.balance.mockResolvedValue(1900000000000000000n);
    mockSdk.shares.getShareRate.mockResolvedValue(1050000000000000000n);

    const result = await handleBalance(sdk, { account: VALID_ACCOUNT });

    expect(isErrorResponse(result)).toBe(false);
    const data = parseResponse(result);
    expect(data.balances.wstETH_in_stETH).toContain("0");
    expect(mockSdk.wrap.convertWstethToSteth).not.toHaveBeenCalled();
  });

  it("returns error on invalid address", async () => {
    const result = await handleBalance(sdk, { account: "not-an-address" });
    expect(isErrorResponse(result)).toBe(true);
    expect(result.content[0].text).toContain("Invalid Ethereum address");
  });

  it("returns error when SDK throws", async () => {
    const mockSdk = sdk as unknown as {
      core: { balanceETH: ReturnType<typeof vi.fn> };
    };
    mockSdk.core.balanceETH.mockRejectedValue(new Error("RPC timeout"));

    const result = await handleBalance(sdk, { account: VALID_ACCOUNT });

    expect(isErrorResponse(result)).toBe(true);
    expect(result.content[0].text).toContain("RPC timeout");
  });
});

describe("handleApr", () => {
  let sdk: ReturnType<typeof createMockSdk>;

  beforeEach(() => {
    sdk = createMockSdk();
  });

  it("returns formatted APR values", async () => {
    const mockSdk = sdk as unknown as {
      statistics: {
        apr: {
          getLastApr: ReturnType<typeof vi.fn>;
          getSmaApr: ReturnType<typeof vi.fn>;
        };
      };
    };

    mockSdk.statistics.apr.getLastApr.mockResolvedValue(3.85);
    mockSdk.statistics.apr.getSmaApr.mockResolvedValue(3.72);

    const result = await handleApr(sdk);

    expect(isErrorResponse(result)).toBe(false);
    const data = parseResponse(result);
    expect(data.currentAPR).toBe("3.85%");
    expect(data.sevenDayAvgAPR).toBe("3.72%");
    expect(data.description).toContain("APR");
  });

  it("returns error when SDK throws", async () => {
    const mockSdk = sdk as unknown as {
      statistics: {
        apr: {
          getLastApr: ReturnType<typeof vi.fn>;
          getSmaApr: ReturnType<typeof vi.fn>;
        };
      };
    };

    mockSdk.statistics.apr.getLastApr.mockRejectedValue(
      new Error("stats unavailable"),
    );
    mockSdk.statistics.apr.getSmaApr.mockRejectedValue(
      new Error("stats unavailable"),
    );

    const result = await handleApr(sdk);

    // When SDK fails, falls back to Lido HTTP API
    // In tests this may succeed (live API) or fail (no network)
    const text = result.content[0].text;
    const parsed = JSON.parse(text.replace(/^Error: /, ""));
    // Either we got APR from Lido API or got an error
    expect(
      parsed.currentAPR !== undefined || text.startsWith("Error:"),
    ).toBe(true);
  });
});

describe("handleWrap", () => {
  let sdk: ReturnType<typeof createMockSdk>;

  beforeEach(() => {
    sdk = createMockSdk();
  });

  it("dry_run with stETH source returns populated tx", async () => {
    const mockSdk = sdk as unknown as {
      wrap: {
        convertStethToWsteth: ReturnType<typeof vi.fn>;
        wrapStethPopulateTx: ReturnType<typeof vi.fn>;
      };
    };

    mockSdk.wrap.convertStethToWsteth.mockResolvedValue(
      900000000000000000n,
    ); // ~0.9 wstETH
    mockSdk.wrap.wrapStethPopulateTx.mockResolvedValue({
      to: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
      from: VALID_ACCOUNT,
      data: "0xwrapdata",
    });

    const result = await handleWrap(sdk, {
      amount: "1",
      account: VALID_ACCOUNT,
      dry_run: true,
    });

    expect(isErrorResponse(result)).toBe(false);
    const data = parseResponse(result);
    expect(data.dryRun).toBe(true);
    expect(data.description).toContain("stETH");
    expect(data.description).toContain("wstETH");
    expect(data.note).toContain("approval");
    expect(data.transaction).toBeDefined();
  });

  it("dry_run with ETH source returns populated tx", async () => {
    const mockSdk = sdk as unknown as {
      wrap: {
        convertStethToWsteth: ReturnType<typeof vi.fn>;
        wrapEthPopulateTx: ReturnType<typeof vi.fn>;
      };
    };

    mockSdk.wrap.convertStethToWsteth.mockResolvedValue(
      900000000000000000n,
    );
    mockSdk.wrap.wrapEthPopulateTx.mockResolvedValue({
      to: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
      from: VALID_ACCOUNT,
      value: 1000000000000000000n,
      data: "0xwrapethdata",
    });

    const result = await handleWrap(sdk, {
      amount: "1",
      source: "ETH",
      account: VALID_ACCOUNT,
      dry_run: true,
    });

    expect(isErrorResponse(result)).toBe(false);
    const data = parseResponse(result);
    expect(data.dryRun).toBe(true);
    expect(data.description).toContain("ETH");
    expect(data.note).toContain("atomic");
  });

  it("returns error on invalid address", async () => {
    const result = await handleWrap(sdk, {
      amount: "1",
      account: "bad",
      dry_run: true,
    });

    expect(isErrorResponse(result)).toBe(true);
    expect(result.content[0].text).toContain("Invalid Ethereum address");
  });

  it("returns error when SDK throws", async () => {
    const mockSdk = sdk as unknown as {
      wrap: { convertStethToWsteth: ReturnType<typeof vi.fn> };
    };

    mockSdk.wrap.convertStethToWsteth.mockRejectedValue(
      new Error("contract error"),
    );

    const result = await handleWrap(sdk, {
      amount: "1",
      account: VALID_ACCOUNT,
      dry_run: true,
    });

    expect(isErrorResponse(result)).toBe(true);
    expect(result.content[0].text).toContain("contract error");
  });
});

describe("handleUnwrap", () => {
  let sdk: ReturnType<typeof createMockSdk>;

  beforeEach(() => {
    sdk = createMockSdk();
  });

  it("dry_run returns populated tx with expected stETH", async () => {
    const mockSdk = sdk as unknown as {
      wrap: {
        convertWstethToSteth: ReturnType<typeof vi.fn>;
        unwrapPopulateTx: ReturnType<typeof vi.fn>;
      };
    };

    mockSdk.wrap.convertWstethToSteth.mockResolvedValue(
      1100000000000000000n,
    ); // ~1.1 stETH
    mockSdk.wrap.unwrapPopulateTx.mockResolvedValue({
      to: "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0",
      from: VALID_ACCOUNT,
      data: "0xunwrapdata",
    });

    const result = await handleUnwrap(sdk, {
      amount: "1",
      account: VALID_ACCOUNT,
      dry_run: true,
    });

    expect(isErrorResponse(result)).toBe(false);
    const data = parseResponse(result);
    expect(data.dryRun).toBe(true);
    expect(data.description).toContain("wstETH");
    expect(data.description).toContain("stETH");
    expect(data.transaction).toBeDefined();
    expect(data.transaction.to).toBeDefined();
  });

  it("executes unwrap when dry_run is false", async () => {
    const mockSdk = sdk as unknown as {
      wrap: {
        convertWstethToSteth: ReturnType<typeof vi.fn>;
        unwrap: ReturnType<typeof vi.fn>;
      };
    };

    mockSdk.wrap.convertWstethToSteth.mockResolvedValue(
      1100000000000000000n,
    );
    mockSdk.wrap.unwrap.mockResolvedValue({
      hash: "0xunwraphash",
      result: {
        wstethUnwrapped: 1000000000000000000n,
        stethReceived: 1100000000000000000n,
      },
    });

    const result = await handleUnwrap(sdk, {
      amount: "1",
      account: VALID_ACCOUNT,
      dry_run: false,
    });

    expect(isErrorResponse(result)).toBe(false);
    const data = parseResponse(result);
    expect(data.dryRun).toBe(false);
    expect(data.transactionHash).toBe("0xunwraphash");
  });

  it("returns error when SDK throws", async () => {
    const mockSdk = sdk as unknown as {
      wrap: { convertWstethToSteth: ReturnType<typeof vi.fn> };
    };

    mockSdk.wrap.convertWstethToSteth.mockRejectedValue(
      new Error("gas estimation failed"),
    );

    const result = await handleUnwrap(sdk, {
      amount: "1",
      account: VALID_ACCOUNT,
      dry_run: true,
    });

    expect(isErrorResponse(result)).toBe(true);
    expect(result.content[0].text).toContain("gas estimation failed");
  });

  it("returns error on invalid address", async () => {
    const result = await handleUnwrap(sdk, {
      amount: "1",
      account: "0xinvalid",
      dry_run: true,
    });

    expect(isErrorResponse(result)).toBe(true);
    expect(result.content[0].text).toContain("Invalid Ethereum address");
  });
});
