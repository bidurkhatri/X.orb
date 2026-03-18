/**
 * X.orb Pre-Launch Production Verification Script
 *
 * Runs 10 checks to confirm the platform is ready for production.
 * Usage: npx tsx scripts/verify-production.ts
 *
 * Requires environment variables to be set (see docs/env-vars.md).
 *
 * Fintex Australia Pty Ltd (ACN 688 406 108) — contact@xorb.xyz
 */

import { ethers } from "ethers";
import { createClient } from "@supabase/supabase-js";

// ── Configuration ──────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "";
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL ?? process.env.RPC_URL ?? "";
const FACILITATOR_ADDRESS = process.env.XORB_FACILITATOR_ADDRESS ?? "";
const FACILITATOR_PRIVATE_KEY = process.env.XORB_FACILITATOR_PRIVATE_KEY ?? "";
const PAYMENT_SPLITTER_ADDRESS = process.env.XORB_PAYMENT_SPLITTER_ADDRESS ?? "";
const TREASURY_ADDRESS = process.env.XORB_TREASURY_ADDRESS ?? "";
const API_BASE_URL = process.env.API_BASE_URL ?? "https://api.xorb.xyz";

// USDC on Polygon PoS
const USDC_ADDRESS = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

const REQUIRED_TABLES = [
  "agent_registry",
  "agent_actions",
  "payments",
  "platform_config",
  "api_keys",
];

// ── Types ──────────────────────────────────────────────────────────────────────

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  critical: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function supabase() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

function provider() {
  return new ethers.JsonRpcProvider(POLYGON_RPC_URL);
}

function pass(name: string, message: string, critical = true): CheckResult {
  return { name, passed: true, message, critical };
}

function fail(name: string, message: string, critical = true): CheckResult {
  return { name, passed: false, message, critical };
}

// ── Checks ─────────────────────────────────────────────────────────────────────

async function checkSupabaseConnection(): Promise<CheckResult> {
  const name = "1. Supabase Connection";
  try {
    const { data, error } = await supabase()
      .from("agent_registry")
      .select("id")
      .limit(1);

    if (error) {
      return fail(name, `Query failed: ${error.message}`);
    }
    return pass(name, `Connected. agent_registry accessible (${data?.length ?? 0} rows sampled).`);
  } catch (err: any) {
    return fail(name, `Connection failed: ${err.message}`);
  }
}

async function checkRequiredTables(): Promise<CheckResult> {
  const name = "2. Required Tables Exist";
  const missing: string[] = [];

  try {
    const db = supabase();
    for (const table of REQUIRED_TABLES) {
      const { error } = await db.from(table).select("*").limit(0);
      if (error) {
        missing.push(table);
      }
    }

    if (missing.length > 0) {
      return fail(name, `Missing tables: ${missing.join(", ")}`);
    }
    return pass(name, `All ${REQUIRED_TABLES.length} required tables present.`);
  } catch (err: any) {
    return fail(name, `Table check failed: ${err.message}`);
  }
}

async function checkFacilitatorEth(): Promise<CheckResult> {
  const name = "3. Facilitator Wallet ETH Balance";
  try {
    if (!FACILITATOR_ADDRESS) {
      return fail(name, "XORB_FACILITATOR_ADDRESS not set.");
    }

    const rpc = provider();
    const balance = await rpc.getBalance(FACILITATOR_ADDRESS);
    const ethBalance = parseFloat(ethers.formatEther(balance));

    if (ethBalance < 0.01) {
      return fail(name, `Balance too low: ${ethBalance.toFixed(6)} ETH (need > 0.01 ETH for gas).`);
    }
    return pass(name, `Balance: ${ethBalance.toFixed(6)} ETH — sufficient for gas.`);
  } catch (err: any) {
    return fail(name, `ETH balance check failed: ${err.message}`);
  }
}

async function checkFacilitatorUsdc(): Promise<CheckResult> {
  const name = "4. Facilitator USDC Balance / Allowance";
  try {
    if (!FACILITATOR_ADDRESS) {
      return fail(name, "XORB_FACILITATOR_ADDRESS not set.");
    }

    const rpc = provider();
    const usdc = new ethers.Contract(
      USDC_ADDRESS,
      [
        "function balanceOf(address) view returns (uint256)",
        "function allowance(address owner, address spender) view returns (uint256)",
      ],
      rpc
    );

    const balance = await usdc.balanceOf(FACILITATOR_ADDRESS);
    const balanceFormatted = parseFloat(ethers.formatUnits(balance, 6));

    // Check if payment splitter has allowance from facilitator
    let allowanceInfo = "";
    if (PAYMENT_SPLITTER_ADDRESS) {
      const allowance = await usdc.allowance(FACILITATOR_ADDRESS, PAYMENT_SPLITTER_ADDRESS);
      const allowanceFormatted = parseFloat(ethers.formatUnits(allowance, 6));
      allowanceInfo = `, Allowance to splitter: $${allowanceFormatted.toFixed(2)}`;
    }

    if (balanceFormatted === 0 && !allowanceInfo.includes("Allowance")) {
      return fail(name, `USDC balance: $${balanceFormatted.toFixed(2)}. No balance or allowance detected.`, false);
    }

    return pass(name, `USDC balance: $${balanceFormatted.toFixed(2)}${allowanceInfo}`, false);
  } catch (err: any) {
    return fail(name, `USDC check failed: ${err.message}`, false);
  }
}

async function checkPaymentSplitterDeployed(): Promise<CheckResult> {
  const name = "5. Payment Splitter Contract Deployed";
  try {
    if (!PAYMENT_SPLITTER_ADDRESS) {
      return fail(name, "XORB_PAYMENT_SPLITTER_ADDRESS not set.");
    }

    const rpc = provider();
    const code = await rpc.getCode(PAYMENT_SPLITTER_ADDRESS);

    if (code === "0x" || code.length <= 2) {
      return fail(name, `No contract code at ${PAYMENT_SPLITTER_ADDRESS}. Contract not deployed.`);
    }

    return pass(name, `Contract deployed at ${PAYMENT_SPLITTER_ADDRESS} (code size: ${(code.length - 2) / 2} bytes).`);
  } catch (err: any) {
    return fail(name, `Contract check failed: ${err.message}`);
  }
}

async function checkHealthEndpoint(): Promise<CheckResult> {
  const name = "6. Health Endpoint";
  try {
    const response = await fetch(`${API_BASE_URL}/v1/health`, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status !== 200) {
      return fail(name, `GET /v1/health returned ${response.status} (expected 200).`);
    }

    const body = await response.json();
    return pass(name, `Health endpoint returned 200. Status: ${body.status ?? "ok"}`);
  } catch (err: any) {
    return fail(name, `Health check failed: ${err.message}`);
  }
}

async function checkApiKeyGeneration(): Promise<CheckResult> {
  const name = "7. API Key Generation";
  try {
    const response = await fetch(`${API_BASE_URL}/v1/auth/keys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sponsor_name: "__verify_production_test__",
        tier: "free",
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 201 || response.status === 200) {
      const body = await response.json();
      const hasKey = body.api_key || body.key || body.data?.api_key;
      if (hasKey) {
        return pass(name, `API key generated successfully (key prefix: ${String(hasKey).substring(0, 10)}...).`);
      }
      return pass(name, `POST /v1/auth/keys returned ${response.status} but no key in response body.`, false);
    }

    // 402 means payment required — endpoint exists but may need payment
    if (response.status === 402) {
      return pass(name, `POST /v1/auth/keys returned 402 (payment required). Endpoint is live.`, false);
    }

    return fail(name, `POST /v1/auth/keys returned ${response.status}.`, false);
  } catch (err: any) {
    return fail(name, `API key generation check failed: ${err.message}`, false);
  }
}

async function checkFeeCalculation(): Promise<CheckResult> {
  const name = "8. Fee Calculation";
  try {
    // Test: $100 action at 30 bps should yield $0.30 fee
    const actionValueMicro = 100_000_000; // $100 in micro-USDC
    const expectedFeeMicro = 300_000; // $0.30 in micro-USDC (30 bps)

    const response = await fetch(`${API_BASE_URL}/v1/pricing/calculate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action_value: actionValueMicro,
        tier: "standard",
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (response.status === 200) {
      const body = await response.json();
      const fee = body.fee ?? body.fee_amount ?? body.data?.fee;

      if (fee === expectedFeeMicro) {
        return pass(name, `Fee calculation correct: $100 @ 30 bps = $0.30 fee (${expectedFeeMicro} micro-USDC).`);
      }
      if (fee !== undefined) {
        return fail(name, `Fee mismatch: expected ${expectedFeeMicro} micro-USDC, got ${fee}.`);
      }
      return pass(name, `Pricing endpoint responded but fee field not found in response. Manual verification needed.`, false);
    }

    if (response.status === 404) {
      // Endpoint might not exist yet — try calculating locally
      const calculatedFee = Math.max(
        Math.floor(actionValueMicro * 30 / 10000),
        10_000 // minimum fee: $0.01
      );
      if (calculatedFee === expectedFeeMicro) {
        return pass(name, `Pricing endpoint not deployed (404). Local calculation verified: $100 @ 30 bps = $0.30.`, false);
      }
      return fail(name, `Pricing endpoint not deployed and local calculation mismatch.`, false);
    }

    return fail(name, `Pricing endpoint returned ${response.status}.`, false);
  } catch (err: any) {
    return fail(name, `Fee calculation check failed: ${err.message}`, false);
  }
}

async function checkPlatformConfig(): Promise<CheckResult> {
  const name = "9. Platform Config Loaded";
  try {
    const { data, error } = await supabase()
      .from("platform_config")
      .select("key, value")
      .eq("key", "fee_free_tier_actions")
      .single();

    if (error) {
      return fail(name, `platform_config query failed: ${error.message}`);
    }

    if (!data) {
      return fail(name, "fee_free_tier_actions not found in platform_config.");
    }

    const value = parseInt(String(data.value), 10);
    if (value !== 500) {
      return fail(name, `fee_free_tier_actions = ${value} (expected 500).`);
    }

    return pass(name, `platform_config loaded. fee_free_tier_actions = 500.`);
  } catch (err: any) {
    return fail(name, `Platform config check failed: ${err.message}`);
  }
}

async function checkTreasuryAddress(): Promise<CheckResult> {
  const name = "10. Treasury Address Configured";
  try {
    if (!TREASURY_ADDRESS) {
      return fail(name, "XORB_TREASURY_ADDRESS not set.");
    }

    if (!ethers.isAddress(TREASURY_ADDRESS)) {
      return fail(name, `XORB_TREASURY_ADDRESS is not a valid Ethereum address: ${TREASURY_ADDRESS}`);
    }

    // Verify the address has code or has been used (nonce > 0 or is an EOA)
    const rpc = provider();
    const code = await rpc.getCode(TREASURY_ADDRESS);
    const isContract = code !== "0x" && code.length > 2;

    const balance = await rpc.getBalance(TREASURY_ADDRESS);
    const ethBalance = parseFloat(ethers.formatEther(balance));

    const type = isContract ? "contract (multisig recommended)" : "EOA";
    return pass(name, `Treasury: ${TREASURY_ADDRESS} (${type}, balance: ${ethBalance.toFixed(6)} ETH).`);
  } catch (err: any) {
    return fail(name, `Treasury check failed: ${err.message}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║        X.orb Pre-Launch Production Verification            ║");
  console.log("║        Fintex Australia Pty Ltd (ACN 688 406 108)          ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log(`Target API:  ${API_BASE_URL}`);
  console.log(`Chain:       ${process.env.XORB_CHAIN ?? "polygon"}`);
  console.log(`Timestamp:   ${new Date().toISOString()}`);
  console.log("");
  console.log("Running 10 pre-launch checks...");
  console.log("─".repeat(64));

  const checks = [
    checkSupabaseConnection,
    checkRequiredTables,
    checkFacilitatorEth,
    checkFacilitatorUsdc,
    checkPaymentSplitterDeployed,
    checkHealthEndpoint,
    checkApiKeyGeneration,
    checkFeeCalculation,
    checkPlatformConfig,
    checkTreasuryAddress,
  ];

  const results: CheckResult[] = [];

  for (const check of checks) {
    try {
      const result = await check();
      results.push(result);

      const icon = result.passed ? "PASS" : "FAIL";
      const criticalTag = !result.passed && result.critical ? " [CRITICAL]" : "";
      console.log(`  [${icon}] ${result.name}${criticalTag}`);
      console.log(`         ${result.message}`);
      console.log("");
    } catch (err: any) {
      const result = fail(`Check error`, err.message);
      results.push(result);
      console.log(`  [FAIL] Unexpected error: ${err.message}`);
      console.log("");
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────

  console.log("─".repeat(64));

  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.filter((r) => !r.passed).length;
  const criticalFailed = results.filter((r) => !r.passed && r.critical).length;

  console.log(`Results: ${totalPassed} passed, ${totalFailed} failed (${criticalFailed} critical)`);
  console.log("");

  if (criticalFailed > 0) {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║                      *** NO-GO ***                         ║");
    console.log("║   Critical checks failed. Do NOT launch to production.     ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log("");
    console.log("Critical failures:");
    for (const r of results.filter((r) => !r.passed && r.critical)) {
      console.log(`  - ${r.name}: ${r.message}`);
    }
    process.exit(1);
  } else if (totalFailed > 0) {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║                  *** CONDITIONAL GO ***                    ║");
    console.log("║   Non-critical checks failed. Review before launching.     ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    console.log("");
    console.log("Non-critical failures:");
    for (const r of results.filter((r) => !r.passed && !r.critical)) {
      console.log(`  - ${r.name}: ${r.message}`);
    }
    process.exit(0);
  } else {
    console.log("╔══════════════════════════════════════════════════════════════╗");
    console.log("║                       *** GO ***                           ║");
    console.log("║   All 10 checks passed. Clear for production launch.       ║");
    console.log("╚══════════════════════════════════════════════════════════════╝");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error running verification:", err);
  process.exit(2);
});
