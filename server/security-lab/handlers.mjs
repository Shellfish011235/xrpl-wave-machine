import { createJob, getJob, listJobs, checkRateLimit, updateJob, appendLog, JOB_STATUS } from "./jobStore.mjs";
import { runBranchDiff } from "./runners/branchDiff.mjs";
import { runTestnetProof } from "./runners/testnetProof.mjs";
import { runTemplateJob } from "./runners/templateRun.mjs";
import { JOB_LIMITS } from "./config.mjs";

const running = new Set();

function validateBranchDiffInput(body) {
  const input = {
    repository: body.repository || "XRPLF/rippled",
    baselineRef: String(body.baselineRef || "2.3.0").slice(0, 64),
    candidateRef: String(body.candidateRef || "2.4.0").slice(0, 64),
    scenario: String(body.scenario || "payment_edge_cases").slice(0, 64),
    mutation: String(body.mutation || "none").slice(0, 32),
    amendments: body.amendments || {},
  };
  if (!input.baselineRef || !input.candidateRef) throw new Error("baselineRef and candidateRef are required");
  return input;
}

async function executeJob(jobId) {
  if (running.has(jobId)) return;
  running.add(jobId);
  const started = Date.now();

  try {
    const job = await getJob(jobId);
    if (!job) return;

    const timeout = setInterval(async () => {
      if (Date.now() - started > JOB_LIMITS.maxDurationMs) {
        clearInterval(timeout);
        await updateJob(jobId, { status: JOB_STATUS.FAILED, error: "Job exceeded time limit" });
        running.delete(jobId);
      }
    }, 10000);

    let result;
    if (job.type === "branch_diff") {
      result = await runBranchDiff(jobId, job.input);
    } else if (job.type === "testnet_proof") {
      result = await runTestnetProof(jobId);
    } else if (job.type === "template_run") {
      result = await runTemplateJob(jobId, job.input);
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    clearInterval(timeout);
    return result;
  } catch (e) {
    await appendLog(jobId, `ERROR: ${e.message}`);
    await updateJob(jobId, { status: JOB_STATUS.FAILED, error: e.message });
  } finally {
    running.delete(jobId);
  }
}

function validateTemplateInput(body) {
  return {
    cardId: String(body.cardId || "").slice(0, 64),
    testTemplate: String(body.testTemplate || "").slice(0, 64),
    expectedBehavior: String(body.expectedBehavior || "").slice(0, 500),
    params: body.params || {},
  };
}

export async function handleCreateJob(body, ip) {
  const rate = checkRateLimit(ip);
  if (!rate.ok) {
    const err = new Error("Rate limit exceeded — max jobs per hour reached");
    err.status = 429;
    err.retryAfterMs = rate.retryAfterMs;
    throw err;
  }

  const type = ["testnet_proof", "template_run", "branch_diff"].includes(body.type)
    ? body.type
    : body.testTemplate ? "template_run" : "branch_diff";

  let input;
  if (type === "branch_diff") input = validateBranchDiffInput(body);
  else if (type === "template_run") input = validateTemplateInput(body);
  else input = { note: "authorized testnet proof" };

  const job = await createJob({ type, input, ip });
  executeJob(job.id).catch(() => {});
  return job;
}

export async function handleGetJob(id) {
  return getJob(id);
}

export async function handleListJobs() {
  return listJobs();
}

export { JOB_STATUS };
