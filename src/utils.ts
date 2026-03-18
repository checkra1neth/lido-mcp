import { formatEther, formatUnits } from "viem";

export interface ToolResponse {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
}

export function formatStethAmount(wei: bigint): string {
  return `${formatEther(wei)} stETH`;
}

export function formatWstethAmount(wei: bigint): string {
  return `${formatEther(wei)} wstETH`;
}

export function formatEthAmount(wei: bigint): string {
  return `${formatEther(wei)} ETH`;
}

export function formatLdoAmount(wei: bigint): string {
  return `${formatEther(wei)} LDO`;
}

export function formatPercent(value: bigint, decimals: number = 16): string {
  const num = Number(formatUnits(value, decimals));
  return `${num.toFixed(2)}%`;
}

export function formatApr(apr: number): string {
  return `${apr.toFixed(2)}%`;
}

export function toolError(message: string): ToolResponse {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
  };
}

export function toolSuccess(data: Record<string, unknown>): ToolResponse {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function validateAddress(address: string): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error(`Invalid Ethereum address: ${address}`);
  }
  return address as `0x${string}`;
}

export function parseEthValue(value: string): bigint {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) throw new Error(`Invalid ETH value: ${value}`);

  const whole = parts[0] || "0";
  const decimal = (parts[1] || "").padEnd(18, "0").slice(0, 18);
  return BigInt(whole) * 10n ** 18n + BigInt(decimal);
}
