/* Read-only XRPL mainnet helpers — no keys, no signing. */
export const XRPL_WS = import.meta.env.VITE_XRPL_WS || "wss://xrplcluster.com";

/* ---------- XRPL helpers (read-only) ---------- */
export function xrplRequest(payload, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    let done = false;
    let ws;
    const timer = setTimeout(() => {
      if (!done) { done = true; try { ws && ws.close(); } catch (e) {} reject(new Error("XRPL connection timed out")); }
    }, timeoutMs);
    try {
      ws = new WebSocket(XRPL_WS);
    } catch (e) { clearTimeout(timer); return reject(e); }
    ws.onopen = () => ws.send(JSON.stringify(payload));
    ws.onmessage = (evt) => {
      if (done) return;
      done = true; clearTimeout(timer);
      try { resolve(JSON.parse(evt.data)); } catch (e) { reject(e); }
      try { ws.close(); } catch (e) {}
    };
    ws.onerror = () => {
      if (!done) { done = true; clearTimeout(timer); reject(new Error("XRPL connection failed")); }
    };
  });
}

export const isValidAddress = (a) => /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test((a || "").trim());
export const shortAddr = (a) => (a ? `${a.slice(0, 4)}...${a.slice(-4)}` : "");

export async function fetchAccountInfo(address) {
  const res = await xrplRequest({ id: 1, command: "account_info", account: address, ledger_index: "validated" });
  if (res.status === "success" && res.result && res.result.account_data) return res.result.account_data;
  const err = (res.error === "actNotFound") ? "Account not found on mainnet (unfunded)." : (res.error_message || res.error || "Lookup failed");
  throw new Error(err);
}

export async function fetchAccountLines(address) {
  const res = await xrplRequest({
    id: 3, command: "account_lines", account: address, ledger_index: "validated",
  });
  if (res.status === "success" && res.result) {
    return { lines: res.result.lines || [], account: address };
  }
  const err = (res.error === "actNotFound") ? "Account not found on mainnet." : (res.error_message || res.error || "Lookup failed");
  throw new Error(err);
}

export async function findAnyRecentTx(address, sinceUnixMs) {
  const res = await xrplRequest({
    id: 4, command: "account_tx", account: address,
    ledger_index_min: -1, ledger_index_max: -1, limit: 20, forward: false,
  }, 15000);
  if (res.status !== "success" || !res.result?.transactions?.length) return null;
  const RIPPLE_EPOCH = 946684800;
  for (const entry of res.result.transactions) {
    const tx = entry.tx_json || entry.tx || {};
    const meta = entry.meta || {};
    if (meta.TransactionResult !== "tesSUCCESS") continue;
    const txMs = ((tx.date || 0) + RIPPLE_EPOCH) * 1000;
    if (tx.Account === address && txMs >= sinceUnixMs - 90000) {
      return { hash: entry.hash || tx.hash, type: tx.TransactionType, when: txMs };
    }
  }
  return null;
}

export async function findMatchingTx(address, txType, sinceUnixMs) {
  const res = await xrplRequest({
    id: 2, command: "account_tx", account: address,
    ledger_index_min: -1, ledger_index_max: -1, limit: 40, forward: false,
  }, 15000);
  if (res.status !== "success" || !res.result || !Array.isArray(res.result.transactions)) {
    throw new Error(res.error_message || "Could not read transaction history");
  }
  const RIPPLE_EPOCH = 946684800; // seconds between 1970 and 2000
  for (const entry of res.result.transactions) {
    const tx = entry.tx_json || entry.tx || {};
    const meta = entry.meta || {};
    const type = tx.TransactionType;
    const acct = tx.Account;
    const ok = meta.TransactionResult === "tesSUCCESS";
    const txMs = ((tx.date || 0) + RIPPLE_EPOCH) * 1000;
    if (ok && type === txType && acct === address && txMs >= sinceUnixMs - 90000) {
      return { hash: entry.hash || tx.hash, when: txMs };
    }
  }
  return null;
}
