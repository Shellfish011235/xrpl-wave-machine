/**
 * Client for Security Lab job API — polls real job status.
 * Proxied to localhost:3001 in dev via vite.config.js
 */

const API_BASE = import.meta.env.VITE_SECURITY_LAB_API || "/api/security-lab";

export const JOB_STATUS = {
  queued: { label: "Queued", tone: "slate" },
  building: { label: "Building", tone: "amber" },
  testing: { label: "Testing", tone: "cyan" },
  analyzing: { label: "Analyzing", tone: "purple" },
  complete: { label: "Complete", tone: "green" },
  failed: { label: "Failed", tone: "red" },
};

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function checkApiHealth() {
  try {
    const data = await api("/health");
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function createJob(payload) {
  const { job } = await api("/jobs", { method: "POST", body: JSON.stringify(payload) });
  return job;
}

export async function getJob(id) {
  const { job } = await api(`/jobs/${id}`);
  return job;
}

export function pollJob(id, { intervalMs = 1500, onUpdate, signal } = {}) {
  return new Promise((resolve, reject) => {
    let timer;
    const tick = async () => {
      if (signal?.aborted) return reject(new Error("Polling aborted"));
      try {
        const job = await getJob(id);
        onUpdate?.(job);
        if (job.status === "complete" || job.status === "failed") {
          clearInterval(timer);
          return resolve(job);
        }
      } catch (e) {
        clearInterval(timer);
        reject(e);
      }
    };
    tick();
    timer = setInterval(tick, intervalMs);
  });
}

export function downloadBundle(job, filename) {
  const blob = new Blob([JSON.stringify({
    id: job.id,
    type: job.type,
    input: job.input,
    result: job.result,
    logs: job.logs,
    exportedAt: new Date().toISOString(),
  }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `security-lab-${job.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildReportFromJob(job) {
  const r = job.result;
  if (!r) return "";
  if (job.type === "testnet_proof") {
    return `## XRPL Security Test Report (Testnet Proof)

**Environment:** Testnet (authorized public altnet)
**Date:** ${new Date().toISOString().slice(0, 10)}
**Real transaction:** yes — not simulated

### Summary
Submitted Payment on Testnet via public faucet-funded account.

### Engine result
${r.engineResult}

### Transaction hash
${r.txHash || "pending"}

### Responsible disclosure
Submit validated findings via Ripple's private bug bounty program — request access at bugs@ripple.com, then submit through Bugcrowd once invited.
`;
  }

  const divs = r.summary?.divergenceDetails || [];
  return `## XRPL Branch Differential Test Report

**Repository:** ${r.repository}
**Baseline:** ${r.baselineRef} (${r.baselineBuild})
**Candidate:** ${r.candidateRef} (${r.candidateBuild})
**Environment:** Docker isolated standalone — never Mainnet
**Date:** ${new Date().toISOString().slice(0, 10)}

### Summary
${r.summary?.divergences || 0} engine-result divergence(s) across ${r.summary?.totalScenarios || 0} scenarios.
Invariant failures: ${r.summary?.invariantFailures?.length || 0}.

### Divergences
${divs.length ? divs.map((d) => `- ${d.label}: baseline=${d.baseline}, candidate=${d.candidate}`).join("\n") : "None detected in this run."}

### Impact assessment
Review divergences on isolated nodes before any bounty submission. AI-assisted draft — researcher must verify.

### Responsible disclosure
Request access via bugs@ripple.com for the Ripple XRP Ledger Managed Bug Bounty Program; submit through private Bugcrowd after invitation — no auto-submit from Wave Machine.
`;
}
