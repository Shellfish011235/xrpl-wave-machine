import { TESTNET } from "../config.mjs";
import { appendLog, updateJob, JOB_STATUS } from "../jobStore.mjs";
import { jsonRpc } from "../rpc.mjs";
import { Client, Wallet } from "xrpl";

/** Real Testnet proof — funds via faucet, signs locally, submits Payment */
export async function runTestnetProof(jobId) {
  await updateJob(jobId, { status: JOB_STATUS.TESTING });
  await appendLog(jobId, "Requesting Testnet faucet account (authorized public testnet only)");

  const faucetRes = await fetch(TESTNET.faucet, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!faucetRes.ok) throw new Error(`Faucet HTTP ${faucetRes.status}`);
  const funded = await faucetRes.json();
  const acct = funded.account || funded;
  const address = acct.address || acct.classicAddress;
  const seed = funded.seed || acct.secret || funded.secret;
  if (!address || !seed) throw new Error("Faucet did not return address/seed");

  await appendLog(jobId, `Funded Testnet account ${address.slice(0, 8)}…`);

  for (let i = 0; i < 15; i++) {
    try {
      const probe = await jsonRpc(TESTNET.rpc, "account_info", { account: address, ledger_index: "validated" });
      if (probe?.account_data?.Sequence != null) break;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  await appendLog(jobId, "Signing locally and submitting real Testnet Payment (1 XRP to generated dest)");

  const client = new Client(TESTNET.ws);
  await client.connect();
  try {
    const wallet = Wallet.fromSeed(seed);
    const dest = Wallet.generate();
    const payment = {
      TransactionType: "Payment",
      Account: wallet.address,
      Destination: dest.address,
      Amount: "1000000",
    };
    const prepared = await client.autofill(payment);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const engineResult = result.result.meta.TransactionResult;
    const txHash = result.result.hash;

    await appendLog(jobId, `Engine result: ${engineResult}, hash: ${txHash}`);

    await updateJob(jobId, { status: JOB_STATUS.ANALYZING });

    const bundle = {
      environment: "testnet",
      network: "altnet",
      rpc: TESTNET.rpc,
      ws: TESTNET.ws,
      account: address,
      transaction: { type: "Payment", amount: "1000000", fee: String(prepared.Fee), destination: dest.address },
      engineResult,
      txHash,
      validated: engineResult === "tesSUCCESS",
      real: true,
      simulated: false,
      disclaimer: "Authorized Testnet only. Never Mainnet. Signed locally — not via public sign RPC.",
    };

    await updateJob(jobId, { status: JOB_STATUS.COMPLETE, result: bundle });
    return bundle;
  } finally {
    await client.disconnect();
  }
}
