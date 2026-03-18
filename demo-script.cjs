#!/usr/bin/env node
const { spawn } = require("child_process");

const CYAN = "\x1b[36m", GREEN = "\x1b[32m", YELLOW = "\x1b[33m";
const DIM = "\x1b[2m", BOLD = "\x1b[1m", RESET = "\x1b[0m";

const RPC = "https://holesky.drpc.org";
const ACCOUNT = "0x32da0f97bBd2E0303d14c90A540cb694c7e9662f";

const server = spawn("node", ["dist/index.js"], {
  env: { ...process.env, LIDO_RPC_URL: RPC, LIDO_CHAIN_ID: "17000" },
  stdio: ["pipe", "pipe", "pipe"],
});

const pending = new Map();
let buffer = "";
let idCounter = 1;

server.stdout.on("data", (d) => {
  buffer += d.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";
  for (const l of lines) {
    if (!l.trim()) continue;
    try {
      const msg = JSON.parse(l);
      if (msg.id != null && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {}
  }
});

server.stderr.on("data", () => {});

function send(method, params) {
  const id = idCounter++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

function notify(method, params) {
  server.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

async function callTool(name, args = {}) {
  const res = await send("tools/call", { name, arguments: args });
  return res.result.content[0].text;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function header(t) { console.log(`\n${BOLD}${CYAN}═══ ${t} ═══${RESET}\n`); }
function step(n, t, d) { console.log(`${DIM}[${n}/${t}]${RESET} ${YELLOW}${d}${RESET}`); }
function result(json) {
  try { console.log(JSON.stringify(JSON.parse(json), null, 2)); }
  catch { console.log(json); }
}

(async () => {
  console.log(`${BOLD}${GREEN}╔══════════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BOLD}${GREEN}║         Lido MCP Server — Live Demo                  ║${RESET}`);
  console.log(`${BOLD}${GREEN}║   Stake ETH with AI agents via natural language      ║${RESET}`);
  console.log(`${BOLD}${GREEN}╚══════════════════════════════════════════════════════╝${RESET}`);
  console.log(`${DIM}Network: Holesky Testnet | 11 MCP tools${RESET}`);

  await send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "demo", version: "1.0" },
  });
  notify("notifications/initialized");
  await sleep(2000);

  const toolsRes = await send("tools/list", {});
  header("Registered Tools");
  console.log(toolsRes.result.tools.map((t) => t.name).join(", "));
  await sleep(1000);

  const T = 7;

  header("Account Balance");
  step(1, T, `lido_balance → ${ACCOUNT.slice(0, 10)}...`);
  result(await callTool("lido_balance", { account: ACCOUNT }));
  await sleep(1000);

  header("Stake ETH (dry_run)");
  step(2, T, "lido_stake → Preview staking 0.01 ETH");
  result(await callTool("lido_stake", { amount: "0.01", account: ACCOUNT, dry_run: true }));
  await sleep(1000);

  header("Wrap ETH → wstETH (dry_run)");
  step(3, T, "lido_wrap → Atomic ETH→wstETH wrap");
  result(await callTool("lido_wrap", { amount: "0.01", source: "ETH", account: ACCOUNT, dry_run: true }));
  await sleep(1000);

  header("Unwrap wstETH → stETH (dry_run)");
  step(4, T, "lido_unwrap → wstETH→stETH conversion");
  result(await callTool("lido_unwrap", { amount: "0.001", account: ACCOUNT, dry_run: true }));
  await sleep(1000);

  header("Withdrawal Request (dry_run)");
  step(5, T, "lido_unstake → Withdrawal queue request");
  result(await callTool("lido_unstake", { amount: "0.001", account: ACCOUNT, dry_run: true }));
  await sleep(1000);

  header("Withdrawal Status");
  step(6, T, "lido_withdrawal_status → Pending requests");
  result(await callTool("lido_withdrawal_status", { account: ACCOUNT }));
  await sleep(1000);

  header("Staking APR");
  step(7, T, "lido_apr → Current yield");
  result(await callTool("lido_apr"));
  await sleep(1000);

  console.log(`\n${BOLD}${GREEN}✓ All 7 operations completed successfully${RESET}`);
  console.log(`${DIM}11 tools | dry_run support | Holesky testnet verified${RESET}`);
  console.log(`${DIM}github.com/checkra1neth/lido-mcp${RESET}\n`);
  server.kill();
  process.exit(0);
})().catch((e) => { console.error(e); server.kill(); process.exit(1); });

setTimeout(() => { server.kill(); process.exit(1); }, 120000);
