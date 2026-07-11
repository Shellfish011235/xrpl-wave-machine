/** Basic invariant checks on differential test results */

export function checkInvariants({ baseline, candidate, scenario }) {
  const failures = [];
  const warnings = [];

  if (!baseline?.engineResult || !candidate?.engineResult) {
    failures.push({ code: "MISSING_ENGINE_RESULT", message: "One or both nodes returned no engine result" });
    return { passed: false, failures, warnings };
  }

  // Same input should not produce tesSUCCESS on one node and temMALFORMED on other for identical well-formed txs
  if (scenario?.category === "well_formed") {
    const bOk = baseline.engineResult === "tesSUCCESS";
    const cOk = candidate.engineResult === "tesSUCCESS";
    if (bOk !== cOk) {
      failures.push({
        code: "WELL_FORMED_DIVERGENCE",
        message: `Well-formed tx diverged: baseline=${baseline.engineResult}, candidate=${candidate.engineResult}`,
      });
    }
  }

  // Malformed txs should both reject (tem/tef class) — divergence is suspicious
  if (scenario?.category === "malformed") {
    const bFail = baseline.engineResult.startsWith("tem") || baseline.engineResult.startsWith("tef");
    const cFail = candidate.engineResult.startsWith("tem") || candidate.engineResult.startsWith("tef");
    if (bFail !== cFail) {
      warnings.push({
        code: "MALFORMED_HANDLING_DIVERGENCE",
        message: `Malformed tx handling differs: baseline=${baseline.engineResult}, candidate=${candidate.engineResult}`,
      });
    }
  }

  // Ledger sequence monotonicity (if ledger data present)
  for (const side of [{ label: "baseline", data: baseline }, { label: "candidate", data: candidate }]) {
    if (side.data.ledgerIndex != null && side.data.ledgerIndex < 1) {
      failures.push({ code: "INVALID_LEDGER", message: `${side.label} reported invalid ledger index` });
    }
  }

  // Build version must differ when comparing branches (otherwise diff is meaningless)
  if (baseline.buildVersion && candidate.buildVersion && baseline.buildVersion === candidate.buildVersion) {
    warnings.push({
      code: "SAME_BUILD_VERSION",
      message: `Both nodes report build ${baseline.buildVersion} — verify image tags map to different commits`,
    });
  }

  return { passed: failures.length === 0, failures, warnings };
}

export function summarizeDiff(results) {
  const divergences = results.filter((r) => r.baseline?.engineResult !== r.candidate?.engineResult);
  const invariantFailures = results.flatMap((r) => r.invariants?.failures || []);
  return {
    totalScenarios: results.length,
    divergences: divergences.length,
    divergenceDetails: divergences.map((r) => ({
      id: r.scenario.id,
      label: r.scenario.label,
      baseline: r.baseline?.engineResult,
      candidate: r.candidate?.engineResult,
    })),
    invariantFailures,
    allInvariantsPassed: invariantFailures.length === 0,
  };
}
