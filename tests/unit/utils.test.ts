import { describe, it, expect } from "vitest";
import {
  parseEthValue,
  validateAddress,
  formatEthAmount,
  formatStethAmount,
  formatWstethAmount,
  formatLdoAmount,
  formatPercent,
  formatApr,
  toolSuccess,
  toolError,
} from "../../src/utils.js";

describe("parseEthValue", () => {
  it("parses whole number", () => {
    expect(parseEthValue("1")).toBe(1000000000000000000n);
  });

  it("parses decimal value", () => {
    expect(parseEthValue("1.5")).toBe(1500000000000000000n);
  });

  it("parses small decimal", () => {
    expect(parseEthValue("0.001")).toBe(1000000000000000n);
  });

  it("parses large whole number", () => {
    expect(parseEthValue("100")).toBe(100000000000000000000n);
  });

  it("parses zero", () => {
    expect(parseEthValue("0")).toBe(0n);
  });

  it("parses value with leading decimal", () => {
    expect(parseEthValue(".5")).toBe(500000000000000000n);
  });

  it("strips non-numeric characters except dots", () => {
    // "1.5 ETH" -> cleaned to "1.5" -> 1.5 ETH in wei
    expect(parseEthValue("1.5 ETH")).toBe(1500000000000000000n);
  });

  it("handles 18 decimal places exactly", () => {
    expect(parseEthValue("0.000000000000000001")).toBe(1n);
  });

  it("truncates beyond 18 decimal places", () => {
    // 19 digits after dot: last digit truncated
    expect(parseEthValue("0.0000000000000000019")).toBe(1n);
  });

  it("throws on multiple decimal points", () => {
    expect(() => parseEthValue("1.2.3")).toThrow("Invalid ETH value");
  });
});

describe("validateAddress", () => {
  it("accepts valid lowercase address", () => {
    const addr = "0xae7ab96520de3a18e5e111b5eaab095312d7fe84";
    expect(validateAddress(addr)).toBe(addr);
  });

  it("accepts valid mixed case address", () => {
    const addr = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
    expect(validateAddress(addr)).toBe(addr);
  });

  it("accepts valid uppercase address", () => {
    const addr = "0xAE7AB96520DE3A18E5E111B5EAAB095312D7FE84";
    expect(validateAddress(addr)).toBe(addr);
  });

  it("rejects address without 0x prefix", () => {
    expect(() =>
      validateAddress("ae7ab96520DE3A18E5e111B5EaAb095312D7fE84"),
    ).toThrow("Invalid Ethereum address");
  });

  it("rejects address that is too short", () => {
    expect(() => validateAddress("0xae7ab96520DE3A")).toThrow(
      "Invalid Ethereum address",
    );
  });

  it("rejects address that is too long", () => {
    expect(() =>
      validateAddress("0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84ff"),
    ).toThrow("Invalid Ethereum address");
  });

  it("rejects empty string", () => {
    expect(() => validateAddress("")).toThrow("Invalid Ethereum address");
  });

  it("rejects address with invalid hex characters", () => {
    expect(() =>
      validateAddress("0xGE7ab96520DE3A18E5e111B5EaAb095312D7fE84"),
    ).toThrow("Invalid Ethereum address");
  });

  it("returns the address typed as 0x-prefixed string", () => {
    const addr = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
    const result: `0x${string}` = validateAddress(addr);
    expect(result.startsWith("0x")).toBe(true);
  });
});

describe("formatEthAmount", () => {
  it("formats 1 ETH", () => {
    expect(formatEthAmount(1000000000000000000n)).toBe("1 ETH");
  });

  it("formats 0 ETH", () => {
    expect(formatEthAmount(0n)).toBe("0 ETH");
  });

  it("formats fractional ETH", () => {
    expect(formatEthAmount(1500000000000000000n)).toBe("1.5 ETH");
  });

  it("formats very small amount", () => {
    expect(formatEthAmount(1n)).toBe("0.000000000000000001 ETH");
  });
});

describe("formatStethAmount", () => {
  it("formats 1 stETH", () => {
    expect(formatStethAmount(1000000000000000000n)).toBe("1 stETH");
  });

  it("formats 0 stETH", () => {
    expect(formatStethAmount(0n)).toBe("0 stETH");
  });

  it("formats fractional stETH", () => {
    expect(formatStethAmount(2500000000000000000n)).toBe("2.5 stETH");
  });
});

describe("formatWstethAmount", () => {
  it("formats 1 wstETH", () => {
    expect(formatWstethAmount(1000000000000000000n)).toBe("1 wstETH");
  });

  it("formats 0 wstETH", () => {
    expect(formatWstethAmount(0n)).toBe("0 wstETH");
  });
});

describe("formatLdoAmount", () => {
  it("formats 1 LDO", () => {
    expect(formatLdoAmount(1000000000000000000n)).toBe("1 LDO");
  });

  it("formats 0 LDO", () => {
    expect(formatLdoAmount(0n)).toBe("0 LDO");
  });
});

describe("formatPercent", () => {
  it("formats with default decimals (16)", () => {
    // 50% = 50 * 10^16 = 500000000000000000
    const value = 500000000000000000n;
    expect(formatPercent(value)).toBe("50.00%");
  });

  it("formats with custom decimals", () => {
    const value = 5000n; // 50% with 2 decimals
    expect(formatPercent(value, 2)).toBe("50.00%");
  });

  it("formats zero", () => {
    expect(formatPercent(0n)).toBe("0.00%");
  });
});

describe("formatApr", () => {
  it("formats APR", () => {
    expect(formatApr(3.45)).toBe("3.45%");
  });

  it("formats zero APR", () => {
    expect(formatApr(0)).toBe("0.00%");
  });

  it("formats APR with many decimals (rounds to 2)", () => {
    expect(formatApr(4.567)).toBe("4.57%");
  });
});

describe("toolSuccess", () => {
  it("returns correct structure with stringified data", () => {
    const result = toolSuccess({ foo: "bar", num: 42 });
    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: JSON.stringify({ foo: "bar", num: 42 }, null, 2),
        },
      ],
    });
  });

  it("has content array with single text entry", () => {
    const result = toolSuccess({ key: "value" });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
  });

  it("serializes nested objects", () => {
    const data = { a: { b: { c: 1 } } };
    const result = toolSuccess(data);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.a.b.c).toBe(1);
  });
});

describe("toolError", () => {
  it("returns correct error structure", () => {
    const result = toolError("something went wrong");
    expect(result).toEqual({
      content: [{ type: "text", text: "Error: something went wrong" }],
    });
  });

  it("has content array with single text entry", () => {
    const result = toolError("fail");
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
  });

  it("prefixes message with Error:", () => {
    const result = toolError("test");
    expect(result.content[0].text).toMatch(/^Error: /);
  });
});
