import { TESTNET } from "../config.mjs";
import { appendLog, updateJob, JOB_STATUS } from "../jobStore.mjs";
import { jsonRpc } from "../rpc.mjs";
import { Client, Wallet } from "xrpl";

const CARD_TEMPLATES = {
  duplicate_sequence_payment: runDuplicatePayment,
  insufficient_funds_payment: runInsufficientFunds,
  expired_last_ledger: runExpiredTx,
  future_sequence_payment: runFutureSequence,
  wrong_signer_payment: runWrongSigner,
  trustline_zero_limit: runTrustlineBoundary,
  cancel_missing_offer: runCancelMissingOffer,
  nft_transfer_without_token: runNftWithoutToken,
  amm_zero_deposit: runAmmZeroDeposit,
  amendment_status_probe: runAmendmentProbe,
};

async function fundAccount() {
  const faucetRes = await fetch(TESTNET.faucet, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!faucetRes.ok) throw new Error(`Faucet HTTP ${faucetRes.status}`);
  const funded = await faucetRes.json();
  const acct = funded.account || funded;
  const address = acct.address || acct.classicAddress;
  const seed = funded.seed || acct.secret;
  if (!address || !seed) throw new Error("Faucet did not return address/seed");

  for (let i = 0; i < 15; i++) {
    try {
      const probe = await jsonRpc(TESTNET.rpc, "account_info", { account: address, ledger_index: "validated" });
      if (probe?.account_data?.Sequence != null) return { address, seed, wallet: Wallet.fromSeed(seed) };
    } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Testnet account not ready after faucet");
}

async function submitAndGetResult(client, wallet, tx) {
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  try {
    const result = await client.submitAndWait(signed.tx_blob);
    return {
      engineResult: result.result.meta.TransactionResult,
      txHash: result.result.hash,
      validated: true,
    };
  } catch (e) {
    const msg = e.message || "";
    const code = msg.match(/(tec|tes|tef|tem|ter)[A-Z_]+/)?.[0] || "rpcERROR";
    return { engineResult: code, error: msg, validated: false };
  }
}

async function runDuplicatePayment(client, wallet, params) {
  const dest = Wallet.generate();
  const amount = String(params.amount || 1000000);
  const tx1 = { TransactionType: "Payment", Account: wallet.address, Destination: dest.address, Amount: amount };
  const prepared1 = await client.autofill(tx1);
  const signed1 = wallet.sign(prepared1);
  const sub1 = await client.submitAndWait(signed1.tx_blob);
  const r1Code = sub1.result.meta.TransactionResult;
  if (r1Code !== "tesSUCCESS") {
    return { primary: { engineResult: r1Code }, observed: r1Code, steps: ["First payment failed unexpectedly"] };
  }
  const usedSeq = prepared1.Sequence;
  const dup = { TransactionType: "Payment", Account: wallet.address, Destination: dest.address, Amount: amount, Sequence: usedSeq, Fee: prepared1.Fee };
  const signed2 = wallet.sign(dup);
  const sub2 = await client.submit(signed2.tx_blob);
  const r2Code = sub2.result.engine_result || sub2.result.engine_result_code;
  return { primary: { engineResult: r2Code }, observed: r2Code, steps: ["First payment succeeded", `Replayed sequence ${usedSeq}`] };
}

async function runInsufficientFunds(client, wallet, params) {
  const dest = Wallet.generate();
  const amount = String(params.amount || "999999999999");
  const tx = { TransactionType: "Payment", Account: wallet.address, Destination: dest.address, Amount: amount };
  const r = await submitAndGetResult(client, wallet, tx);
  return { primary: r, observed: r.engineResult, steps: ["Submitted over-limit payment"] };
}

async function runExpiredTx(client, wallet, params) {
  const dest = Wallet.generate();
  const ledger = await client.request({ command: "ledger_current" });
  const current = ledger.result.ledger_current_index;
  const offset = Number(params.lastLedgerOffset || 10);
  const tx = {
    TransactionType: "Payment", Account: wallet.address, Destination: dest.address, Amount: "1000000",
    LastLedgerSequence: Math.max(1, current - offset),
  };
  const r = await submitAndGetResult(client, wallet, tx);
  return { primary: r, observed: r.engineResult, steps: [`Set LastLedgerSequence ${current - offset} (current ${current})`] };
}

async function runFutureSequence(client, wallet, params) {
  const dest = Wallet.generate();
  const info = await client.getAccountInfo(wallet.address);
  const skip = Number(params.sequenceSkip || 100);
  const tx = {
    TransactionType: "Payment", Account: wallet.address, Destination: dest.address, Amount: "1000000",
    Sequence: info.account_data.Sequence + skip,
  };
  const prepared = await client.autofill(tx);
  const signed = wallet.sign(prepared);
  try {
    const sub = await client.submit(signed.tx_blob);
    return { primary: { engineResult: sub.result.engine_result, txHash: sub.result.tx_json?.hash }, observed: sub.result.engine_result, steps: [`Used sequence +${skip}`] };
  } catch (e) {
    return { primary: { engineResult: "rpcERROR", error: e.message }, observed: "rpcERROR", steps: [`Used sequence +${skip}`] };
  }
}

async function runWrongSigner(client, wallet, params) {
  const wrong = Wallet.generate();
  const dest = Wallet.generate();
  const tx = { TransactionType: "Payment", Account: wallet.address, Destination: dest.address, Amount: "1000000" };
  const prepared = await client.autofill(tx);
  const signed = wrong.sign(prepared);
  try {
    const sub = await client.submit(signed.tx_blob);
    return { primary: { engineResult: sub.result.engine_result }, observed: sub.result.engine_result, steps: ["Signed with wrong account key"] };
  } catch (e) {
    const code = e.message?.match(/(tec|tes|tef|tem|ter)[A-Z_]+/)?.[0] || "temBAD_SIGNATURE";
    return { primary: { engineResult: code, error: e.message }, observed: code, steps: ["Signed with wrong account key"] };
  }
}

async function runTrustlineBoundary(client, wallet, params) {
  const issuer = Wallet.generate().address;
  const limit = String(params.limit ?? 0);
  const tx = {
    TransactionType: "TrustSet",
    Account: wallet.address,
    LimitAmount: { currency: "USD", issuer, value: limit },
  };
  const r = await submitAndGetResult(client, wallet, tx);
  return { primary: r, observed: r.engineResult, steps: [`TrustSet limit ${limit}`] };
}

async function runCancelMissingOffer(client, wallet, params) {
  const seq = Number(params.offerSequence || 99999);
  const tx = { TransactionType: "OfferCancel", Account: wallet.address, OfferSequence: seq };
  const r = await submitAndGetResult(client, wallet, tx);
  return { primary: r, observed: r.engineResult, steps: [`Cancel offer sequence ${seq}`] };
}

async function runNftWithoutToken(client, wallet) {
  const fakeTokenId = "0000000000000000000000000000000000000000000000000000000000000001";
  const tx = {
    TransactionType: "NFTokenCreateOffer",
    Account: wallet.address,
    NFTokenID: fakeTokenId,
    Amount: "1",
  };
  const r = await submitAndGetResult(client, wallet, tx);
  return { primary: r, observed: r.engineResult, steps: ["Offer to sell NFT not owned"] };
}

async function runAmmZeroDeposit(client, wallet, params) {
  const tx = {
    TransactionType: "AMMDeposit",
    Account: wallet.address,
    Asset: { currency: "XRP" },
    Asset2: { currency: "USD", issuer: Wallet.generate().address },
    Amount: String(params.assetAmount ?? 0),
  };
  const r = await submitAndGetResult(client, wallet, tx);
  return { primary: r, observed: r.engineResult, steps: ["AMM deposit with zero/boundary amount"] };
}

async function runAmendmentProbe(client, wallet, params) {
  const name = String(params.amendmentName || "fixTokenEscrowV1");
  const info = await client.request({ command: "server_info" });
  const amendments = info.result.info.amendments || [];
  const found = amendments.find((a) => (typeof a === "string" ? a : a.name) === name || a.id === name);
  const enabled = !!found;
  return {
    primary: { engineResult: "tesSUCCESS", amendment: name, enabled },
    observed: enabled ? "ENABLED" : "DISABLED",
    steps: [`Read server_info for amendment ${name}`],
    readOnly: true,
  };
}

export async function runTemplateJob(jobId, input) {
  const template = input.testTemplate;
  const runner = CARD_TEMPLATES[template];
  if (!runner) throw new Error(`Unknown test template: ${template}`);

  await updateJob(jobId, { status: JOB_STATUS.TESTING });
  await appendLog(jobId, `Bug Hunt template: ${template} (authorized Testnet)`);
  await appendLog(jobId, `Card: ${input.cardId || "unknown"}`);

  const client = new Client(TESTNET.ws);
  await client.connect();
  try {
    const { wallet } = await fundAccount();
    await appendLog(jobId, `Testnet account funded: ${wallet.address.slice(0, 8)}…`);

    const result = await runner(client, wallet, input.params || {});
    await appendLog(jobId, `Observed: ${result.observed}`);

    await updateJob(jobId, { status: JOB_STATUS.ANALYZING });

    const bundle = {
      environment: "testnet",
      real: true,
      simulated: false,
      cardId: input.cardId,
      testTemplate: template,
      expectedBehavior: input.expectedBehavior,
      observed: result.observed,
      engineResult: result.primary?.engineResult || result.observed,
      txHash: result.primary?.txHash,
      steps: result.steps,
      readOnly: result.readOnly || false,
      params: input.params,
      reproductionRuns: 1,
      disclaimer: "Authorized Testnet only. Never Mainnet.",
    };

    await updateJob(jobId, { status: JOB_STATUS.COMPLETE, result: bundle });
    return bundle;
  } finally {
    await client.disconnect();
  }
}
