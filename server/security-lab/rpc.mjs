/** JSON-RPC over HTTP for rippled / testnet nodes */
export async function jsonRpc(url, method, params = {}, id = 1) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, params: Array.isArray(params) ? params : [params], id }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status} from ${url}`);
  const data = await res.json();
  if (data.error) {
    const msg = data.error.message || JSON.stringify(data.error);
    throw new Error(`RPC error: ${msg}`);
  }
  const result = data.result;
  if (result?.error || result?.status === "error") {
    throw new Error(result.error_message || result.error || "RPC result error");
  }
  return result;
}

export async function waitForRpc(url, { retries = 40, delayMs = 2000 } = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const info = await jsonRpc(url, "server_info");
      if (info?.info?.complete_ledgers) return info;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Node not ready at ${url} after ${retries} attempts`);
}

export async function submitTx(url, txBlob) {
  return jsonRpc(url, "submit", { tx_blob: txBlob });
}

export async function accountInfo(url, account) {
  return jsonRpc(url, "account_info", { account, ledger_index: "validated" });
}
