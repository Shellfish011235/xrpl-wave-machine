#!/usr/bin/env node
/** CLI: node scripts/security-lab/run-job.mjs branch_diff --baseline 2.3.0 --candidate 2.4.0 */
import { handleCreateJob } from "../../server/security-lab/handlers.mjs";

const type = process.argv[2] === "testnet" ? "testnet_proof" : "branch_diff";
const args = Object.fromEntries(
  process.argv.slice(3).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const body = type === "branch_diff"
  ? {
      type: "branch_diff",
      baselineRef: args.baseline || "2.3.0",
      candidateRef: args.candidate || "2.4.0",
      scenario: args.scenario || "payment_edge_cases",
      mutation: args.mutation || "none",
    }
  : { type: "testnet_proof" };

const job = await handleCreateJob(body, "cli");
console.log("Job created:", job.id);
console.log("Poll: curl http://localhost:3001/api/security-lab/jobs/" + job.id);
