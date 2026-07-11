import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { COMPOSE_FILE, REPOSITORY } from "../config.mjs";
import { appendLog, updateJob, JOB_STATUS } from "../jobStore.mjs";
import { checkInvariants, summarizeDiff } from "../invariants.mjs";
import { jsonRpc, waitForRpc } from "../rpc.mjs";

const BASELINE_RPC = "http://127.0.0.1:51234";
const CANDIDATE_RPC = "http://127.0.0.1:51235";

function refToImageTag(ref) {
  if (!ref) return "latest";
  if (/^\d+\.\d+/.test(ref)) return ref;
  if (ref.startsWith("v") && /^\d/.test(ref.slice(1))) return ref.slice(1);
  return "latest";
}

function runCmd(cmd, args, env = {}) {
  return new Promise((res, rej) => {
    const child = spawn(cmd, args, { env: { ...process.env, ...env }, shell: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("close", (code) => {
      if (code === 0) res({ out, err });
      else rej(new Error(`${cmd} ${args.join(" ")} exited ${code}: ${err || out}`));
    });
  });
}

async function dockerAvailable() {
  try {
    await runCmd("docker", ["info"]);
    return true;
  } catch {
    return false;
  }
}

function buildScenarios(input) {
  const mutation = input.mutation || "none";
  const base = [
    {
      id: "server_info",
      label: "Server info probe",
      category: "probe",
      rpcMethod: "server_info",
      params: {},
    },
    {
      id: "malformed_account_info",
      label: "Malformed account_info",
      category: "malformed",
      rpcMethod: "account_info",
      params: { account: "rNOTVALID", ledger_index: "validated" },
      expectError: true,
    },
    {
      id: "ledger_current",
      label: "Current ledger",
      category: "probe",
      rpcMethod: "ledger_current",
      params: {},
    },
  ];

  if (mutation === "high_fee") {
    base.push({
      id: "fee_query",
      label: "Fee query (mutation: high_fee context)",
      category: "well_formed",
      rpcMethod: "fee",
      params: {},
    });
  }

  return base;
}

async function runScenarioOnNode(rpcUrl, scenario, buildVersion) {
  try {
    const result = await jsonRpc(rpcUrl, scenario.rpcMethod, scenario.params);
    return {
      engineResult: "tesSUCCESS",
      raw: result,
      buildVersion,
      ledgerIndex: result?.ledger_index || result?.info?.validated_ledger?.seq,
    };
  } catch (e) {
    const msg = e.message || "";
    const code = msg.includes("actNotFound") ? "actNotFound"
      : msg.includes("malformed") ? "temMALFORMED"
      : "rpcERROR";
    return {
      engineResult: scenario.expectError ? code : "rpcERROR",
      error: msg,
      buildVersion,
    };
  }
}

export async function runBranchDiff(jobId, input) {
  const composePath = resolve(COMPOSE_FILE);
  const baselineTag = refToImageTag(input.baselineRef || REPOSITORY.defaultBaseline);
  const candidateTag = refToImageTag(input.candidateRef || REPOSITORY.defaultCandidate);

  await updateJob(jobId, { status: JOB_STATUS.BUILDING });
  await appendLog(jobId, `Repository: ${REPOSITORY.url}`);
  await appendLog(jobId, `Baseline ref: ${input.baselineRef || REPOSITORY.defaultBaseline} → image tag ${baselineTag}`);
  await appendLog(jobId, `Candidate ref: ${input.candidateRef || REPOSITORY.defaultCandidate} → image tag ${candidateTag}`);
  await appendLog(jobId, `Amendment flags: ${JSON.stringify(input.amendments || {})}`);

  if (!(await dockerAvailable())) {
    throw new Error(
      "Docker is required for Branch Differential Tester. Install Docker Desktop, then run: docker compose -f docker/security-lab/docker-compose.yml up -d"
    );
  }

  await appendLog(jobId, "Starting isolated standalone nodes via Docker Compose…");

  const env = {
    BASELINE_TAG: baselineTag,
    CANDIDATE_TAG: candidateTag,
    BASELINE_RPC_PORT: "51234",
    CANDIDATE_RPC_PORT: "51235",
  };

  try {
    await runCmd("docker", ["compose", "-f", composePath, "down", "-v"]);
    await runCmd("docker", ["compose", "-f", composePath, "up", "-d", "--pull", "missing"], env);
  } catch (e) {
    throw new Error(`Docker compose failed: ${e.message}. Ensure images xrpllab/xrpld:${baselineTag} and :${candidateTag} exist or use semver tags.`);
  }

  await updateJob(jobId, { status: JOB_STATUS.TESTING });
  await appendLog(jobId, "Waiting for baseline and candidate RPC endpoints…");

  let baselineInfo;
  let candidateInfo;
  try {
    baselineInfo = await waitForRpc(BASELINE_RPC, { retries: 30, delayMs: 3000 });
    candidateInfo = await waitForRpc(CANDIDATE_RPC, { retries: 30, delayMs: 3000 });
  } catch (e) {
    throw new Error(`${e.message}. Check: docker compose -f ${COMPOSE_FILE} logs`);
  }

  const baselineVersion = baselineInfo?.info?.build_version;
  const candidateVersion = candidateInfo?.info?.build_version;
  await appendLog(jobId, `Baseline build: ${baselineVersion}`);
  await appendLog(jobId, `Candidate build: ${candidateVersion}`);

  const scenarios = buildScenarios(input);
  const results = [];

  for (const scenario of scenarios) {
    await appendLog(jobId, `Running scenario: ${scenario.label}`);
    const baseline = await runScenarioOnNode(BASELINE_RPC, scenario, baselineVersion);
    const candidate = await runScenarioOnNode(CANDIDATE_RPC, scenario, candidateVersion);
    const invariants = checkInvariants({ baseline, candidate, scenario });
    results.push({ scenario, baseline, candidate, invariants });
  }

  await updateJob(jobId, { status: JOB_STATUS.ANALYZING });
  const summary = summarizeDiff(results);

  const bundle = {
    environment: "docker-standalone",
    real: true,
    simulated: false,
    repository: REPOSITORY.url,
    baselineRef: input.baselineRef || REPOSITORY.defaultBaseline,
    candidateRef: input.candidateRef || REPOSITORY.defaultCandidate,
    baselineImage: `xrpllab/xrpld:${baselineTag}`,
    candidateImage: `xrpllab/xrpld:${candidateTag}`,
    baselineBuild: baselineVersion,
    candidateBuild: candidateVersion,
    amendments: input.amendments || {},
    scenario: input.scenario || "payment_edge_cases",
    mutation: input.mutation || "none",
    results,
    summary,
    disclaimer: "Isolated standalone networks only. Never Mainnet. Full commit builds require local rippled compile — MVP uses pre-built image tags mapped from refs.",
  };

  await appendLog(jobId, `Analysis complete: ${summary.divergences} divergence(s), ${summary.invariantFailures.length} invariant failure(s)`);

  await updateJob(jobId, { status: JOB_STATUS.COMPLETE, result: bundle });
  return bundle;
}

export async function teardownDocker() {
  try {
    const composePath = resolve(COMPOSE_FILE);
    await runCmd("docker", ["compose", "-f", composePath, "down", "-v"]);
  } catch {
    /* best effort */
  }
}
