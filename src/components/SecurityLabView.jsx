import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, AlertTriangle, ChevronRight, CheckCircle2, XCircle,
  FileText, ExternalLink, BookOpen, GitCompare, Search, Bug, ClipboardList,
  Award, Loader2, Download, Server, Play, RefreshCw,
} from "lucide-react";
import {
  LAB_SECTIONS, REPOSITORY_OPTIONS, TEST_SCENARIOS, TX_MUTATIONS,
  AMENDMENT_FLAGS, DISCLOSURE_CHECKLIST, BOUNTY_INFO, LEARN_CONTENT, SKILL_TRACKS,
} from "../data/securityLab";
import {
  checkApiHealth, createJob, pollJob, downloadBundle, buildReportFromJob, JOB_STATUS,
} from "../lib/securityLabRunner";

const Panel = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-indigo-500/25 bg-[#0b0b22]/90 shadow-[0_0_40px_rgba(60,40,160,0.12)] ${className}`}>{children}</div>
);

const Chip = ({ children, tone = "cyan" }) => {
  const tones = {
    cyan: "border-cyan-400/40 text-cyan-300 bg-cyan-400/10",
    green: "border-emerald-400/40 text-emerald-300 bg-emerald-400/10",
    amber: "border-amber-400/40 text-amber-300 bg-amber-400/10",
    red: "border-rose-400/40 text-rose-300 bg-rose-400/10",
    slate: "border-slate-500/40 text-slate-300 bg-slate-500/10",
    purple: "border-purple-400/40 text-purple-300 bg-purple-400/10",
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono tracking-wide uppercase ${tones[tone] || tones.cyan}`}>{children}</span>;
};

const SECTION_ICONS = {
  learn: BookOpen,
  "branch-diff": GitCompare,
  "testnet-proof": Server,
  compare: GitCompare,
  proposal: Search,
  reproduce: Bug,
  report: ClipboardList,
  bounty: Award,
};

const STATUS_TONE = { queued: "slate", building: "amber", testing: "cyan", analyzing: "purple", complete: "green", failed: "red" };

export default function SecurityLabView({ onQuestComplete, wallet }) {
  const [section, setSection] = useState("learn");
  const [apiOk, setApiOk] = useState(null);
  const [job, setJob] = useState(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState("");
  const [disclosure, setDisclosure] = useState({});
  const [reportText, setReportText] = useState("");
  const [questDone, setQuestDone] = useState(false);

  const repo = REPOSITORY_OPTIONS.find((r) => r.available) || REPOSITORY_OPTIONS[0];
  const [baselineRef, setBaselineRef] = useState(repo.defaultBaseline);
  const [candidateRef, setCandidateRef] = useState(repo.defaultCandidate);
  const [scenario, setScenario] = useState("payment_edge_cases");
  const [mutation, setMutation] = useState("none");
  const [amendments, setAmendments] = useState(
    Object.fromEntries(AMENDMENT_FLAGS.map((a) => [a.id, a.default]))
  );

  const refreshHealth = useCallback(async () => {
    const h = await checkApiHealth();
    setApiOk(h.ok);
    return h;
  }, []);

  useEffect(() => { refreshHealth(); }, [refreshHealth]);

  const allDisclosureChecked = DISCLOSURE_CHECKLIST.every((_, i) => disclosure[i]);

  const startJob = async (type) => {
    setError("");
    setJob(null);
    setQuestDone(false);
    setReportText("");
    setPolling(true);
    try {
      const payload = type === "branch_diff"
        ? { type: "branch_diff", repository: repo.id, baselineRef, candidateRef, scenario, mutation, amendments }
        : { type: "testnet_proof" };
      const created = await createJob(payload);
      setJob(created);
      const final = await pollJob(created.id, { onUpdate: setJob });
      if (final.status === "complete" && final.result?.real) {
        setReportText(buildReportFromJob(final));
      }
    } catch (e) {
      setError(e.message || "Job failed");
    } finally {
      setPolling(false);
    }
  };

  const finishQuest = () => {
    if (!allDisclosureChecked || !job?.result?.real) return;
    setQuestDone(true);
    onQuestComplete?.({
      xp: 250,
      badge: "securityResearcher",
      title: job.type === "testnet_proof" ? "Testnet Proof" : "Branch Differential Test",
      real: true,
      jobId: job.id,
    });
  };

  const renderBanner = () => (
    <Panel className="p-4 border-rose-400/30 bg-rose-400/5">
      <div className="flex gap-2 text-rose-200 text-sm">
        <AlertTriangle size={18} className="shrink-0" />
        <span>
          <strong>Authorized security testing only.</strong> Isolated Docker standalone or public Testnet — never Mainnet or third-party production.
        </span>
      </div>
    </Panel>
  );

  const renderApiStatus = () => (
    <Panel className="p-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs font-mono">
        <Server size={14} className={apiOk ? "text-emerald-400" : "text-amber-400"} />
        <span className="text-slate-400">Job API:</span>
        {apiOk === null ? <span className="text-slate-500">checking…</span>
          : apiOk ? <Chip tone="green">Online — real jobs</Chip>
          : <Chip tone="amber">Offline — run pnpm run security-lab:api</Chip>}
      </div>
      <button type="button" onClick={refreshHealth} className="text-[10px] font-mono text-cyan-300 flex items-center gap-1">
        <RefreshCw size={12} /> Refresh
      </button>
    </Panel>
  );

  const renderLearn = () => (
    <div className="space-y-4">
      {[
        { title: "Platform scope", items: LEARN_CONTENT.policy },
        { title: "XRPLF conduct", items: LEARN_CONTENT.xrplf },
        { title: "Testnet vs Mainnet", items: LEARN_CONTENT.testnetVsMainnet },
        { title: "In-scope components", items: LEARN_CONTENT.components },
      ].map((block) => (
        <Panel key={block.title} className="p-5">
          <h4 className="font-bold text-white mb-2">{block.title}</h4>
          <ul className="space-y-2 text-sm text-slate-300">
            {block.items.map((line, i) => (
              <li key={i} className="flex gap-2"><ChevronRight size={14} className="text-cyan-400 shrink-0 mt-0.5" />{line}</li>
            ))}
          </ul>
        </Panel>
      ))}
      <Panel className="p-5">
        <div className="text-[10px] font-mono tracking-widest text-slate-500 uppercase mb-2">Skill tracks</div>
        <div className="grid sm:grid-cols-3 gap-3">
          {SKILL_TRACKS.map((tr) => (
            <div key={tr.id} className="rounded-xl border border-indigo-500/25 bg-[#0e0e2a] p-3">
              <div className="font-bold text-cyan-200 text-sm">{tr.label}</div>
              <div className="text-xs text-slate-400 mt-1">{tr.desc}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );

  const renderJobStatus = () => {
    if (!job) return null;
    const st = JOB_STATUS[job.status] || { label: job.status, tone: "slate" };
    return (
      <Panel className="p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Job {job.id?.slice(0, 8)}…</span>
          <Chip tone={STATUS_TONE[job.status] || st.tone}>{st.label}</Chip>
          {job.result?.real && <Chip tone="green">Real execution</Chip>}
          {polling && <Loader2 size={14} className="animate-spin text-cyan-400" />}
        </div>
        {job.logs?.length > 0 && (
          <div className="rounded-lg bg-[#0e0e2a] border border-indigo-500/20 p-3 max-h-40 overflow-y-auto">
            {job.logs.map((l, i) => (
              <div key={i} className="text-[11px] font-mono text-slate-500">
                <span className="text-slate-600">{l.at?.slice(11, 19)}</span> {l.line}
              </div>
            ))}
          </div>
        )}
        {job.error && (
          <div className="text-sm text-rose-300 flex gap-2"><XCircle size={16} />{job.error}</div>
        )}
        {job.status === "complete" && job.result && (
          <div className="space-y-3">
            {job.type === "branch_diff" && (
              <>
                <div className="grid sm:grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-indigo-500/20 p-2">
                    <div className="text-slate-500 font-mono">Baseline</div>
                    <div className="text-white">{job.result.baselineBuild}</div>
                  </div>
                  <div className="rounded-lg border border-indigo-500/20 p-2">
                    <div className="text-slate-500 font-mono">Candidate</div>
                    <div className="text-white">{job.result.candidateBuild}</div>
                  </div>
                </div>
                {(job.result.results || []).map((r) => (
                  <div key={r.scenario.id} className="rounded-xl border border-indigo-500/25 bg-[#0e0e2a] p-3">
                    <div className="font-bold text-white text-sm">{r.scenario.label}</div>
                    <div className="flex gap-2 mt-1 text-[10px] font-mono">
                      <Chip tone="cyan">B: {r.baseline?.engineResult}</Chip>
                      <Chip tone="purple">C: {r.candidate?.engineResult}</Chip>
                      {r.invariants?.passed ? <Chip tone="green">invariants ok</Chip> : <Chip tone="red">invariant fail</Chip>}
                    </div>
                  </div>
                ))}
                {job.result.summary?.divergenceDetails?.length > 0 && (
                  <div className="text-xs text-amber-200">
                    {job.result.summary.divergences} divergence(s) detected — review before bounty submission.
                  </div>
                )}
              </>
            )}
            {job.type === "testnet_proof" && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-400/5 p-4 text-sm">
                <div className="font-bold text-emerald-200">Real Testnet transaction</div>
                <div className="text-slate-300 mt-1">Engine: <code className="text-cyan-300">{job.result.engineResult}</code></div>
                {job.result.txHash && <div className="text-slate-400 text-xs mt-1 font-mono break-all">Hash: {job.result.txHash}</div>}
              </div>
            )}
            <button type="button" onClick={() => downloadBundle(job)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cyan-400/40 text-cyan-300 text-xs">
              <Download size={14} /> Export reproduction bundle
            </button>
          </div>
        )}
      </Panel>
    );
  };

  const renderBranchDiff = () => (
    <div className="space-y-4">
      <Panel className="p-4 border-cyan-400/20">
        <p className="text-sm text-slate-300">
          Authorized security testing for XRPL open-source components in isolated environments.
          Compares two <code className="text-cyan-300">xrpld</code> image tags via Docker — semver refs map to pre-built images; full commit builds require local compile.
        </p>
      </Panel>

      <Panel className="p-5 space-y-4">
        <div>
          <label className="text-[10px] font-mono text-slate-500 uppercase">Repository</label>
          <div className="mt-1 text-white font-semibold">{repo.label}</div>
          <div className="text-xs text-slate-500">{repo.url}</div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-mono text-slate-500 uppercase">Baseline ref / tag</label>
            <input value={baselineRef} onChange={(e) => setBaselineRef(e.target.value)}
              className="mt-1 w-full rounded-lg bg-[#0e0e2a] border border-indigo-500/30 px-3 py-2 text-sm text-white font-mono" />
          </div>
          <div>
            <label className="text-[10px] font-mono text-slate-500 uppercase">Candidate ref / tag</label>
            <input value={candidateRef} onChange={(e) => setCandidateRef(e.target.value)}
              className="mt-1 w-full rounded-lg bg-[#0e0e2a] border border-indigo-500/30 px-3 py-2 text-sm text-white font-mono" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-mono text-slate-500 uppercase">Test scenario</label>
            <select value={scenario} onChange={(e) => setScenario(e.target.value)}
              className="mt-1 w-full rounded-lg bg-[#0e0e2a] border border-indigo-500/30 px-3 py-2 text-sm text-white">
              {TEST_SCENARIOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-mono text-slate-500 uppercase">Tx mutation</label>
            <select value={mutation} onChange={(e) => setMutation(e.target.value)}
              className="mt-1 w-full rounded-lg bg-[#0e0e2a] border border-indigo-500/30 px-3 py-2 text-sm text-white">
              {TX_MUTATIONS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-[10px] font-mono text-slate-500 uppercase mb-2 block">Amendment flags</label>
          <div className="flex flex-wrap gap-3">
            {AMENDMENT_FLAGS.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={!!amendments[a.id]}
                  onChange={() => setAmendments((prev) => ({ ...prev, [a.id]: !prev[a.id] }))} />
                {a.label}
              </label>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => startJob("branch_diff")} disabled={polling || !apiOk}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 text-[#06121a] disabled:opacity-40">
          {polling ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Run differential test (requires Docker)
        </button>
        {!apiOk && <p className="text-[11px] text-amber-300 font-mono">Start API: pnpm run security-lab:api</p>}
      </Panel>
      {renderJobStatus()}
    </div>
  );

  const renderTestnetProof = () => (
    <div className="space-y-4">
      <Panel className="p-4 border-emerald-400/20 bg-emerald-400/5">
        <p className="text-sm text-emerald-100">
          Submits one <strong>real</strong> Payment on public Testnet via the faucet — proves the platform uses live JSON-RPC, not simulation.
          No Docker required.
        </p>
      </Panel>
      <Panel className="p-5">
        <button type="button" onClick={() => startJob("testnet_proof")} disabled={polling || !apiOk}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-cyan-500 text-white disabled:opacity-40">
          {polling ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          Run Testnet proof
        </button>
      </Panel>
      {renderJobStatus()}
    </div>
  );

  const renderReport = () => (
    <div className="space-y-4">
      <Panel className="p-5">
        <div className="text-[10px] font-mono text-cyan-300 uppercase tracking-widest mb-2">Responsible Disclosure Gate</div>
        <p className="text-xs text-slate-400 mb-3">Complete a real job, then check all items before exporting or earning the Security Researcher badge.</p>
        <div className="space-y-2">
          {DISCLOSURE_CHECKLIST.map((item, i) => (
            <label key={i} className="flex gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={!!disclosure[i]} onChange={() => setDisclosure((d) => ({ ...d, [i]: !d[i] }))} className="mt-1" />
              {item}
            </label>
          ))}
        </div>
      </Panel>
      {reportText && (
        <Panel className="p-5">
          <div className="text-[10px] font-mono text-cyan-300 uppercase tracking-widest mb-2">AI-assisted report draft (you review)</div>
          <textarea readOnly value={reportText} rows={14}
            className="w-full rounded-lg bg-[#0e0e2a] border border-indigo-500/30 px-3 py-2 text-xs font-mono text-slate-300" />
          {!questDone && job?.status === "complete" && (
            <button type="button" onClick={finishQuest} disabled={!allDisclosureChecked}
              className="mt-4 px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 text-[#06121a] disabled:opacity-40">
              Complete · earn Security Researcher badge
            </button>
          )}
          {questDone && (
            <div className="mt-4 flex items-center gap-2 text-emerald-300 text-sm font-bold">
              <CheckCircle2 size={18} /> Quest complete — +250 XP (verified real job)
            </div>
          )}
        </Panel>
      )}
      {!reportText && (
        <p className="text-sm text-slate-500">Run a Branch Differential Test or Testnet Proof first to generate a report draft.</p>
      )}
    </div>
  );

  const renderScaffold = (title, desc) => (
    <Panel className="p-6 text-center">
      <ShieldCheck size={28} className="mx-auto text-slate-500 mb-3" />
      <h4 className="font-bold text-white">{title}</h4>
      <p className="text-sm text-slate-400 mt-2">{desc}</p>
      <Chip tone="slate">Coming soon</Chip>
    </Panel>
  );

  const renderBounty = () => (
    <Panel className="p-6 space-y-4">
      <h4 className="font-black text-white text-lg">Official bug bounty access</h4>
      <p className="text-sm text-slate-400">{BOUNTY_INFO.note}</p>

      <div className="rounded-xl border border-indigo-500/25 bg-[#0e0e2a] p-4 space-y-2">
        <div className="text-[10px] font-mono text-slate-500 uppercase">XRPL program</div>
        <div className="text-white font-semibold">{BOUNTY_INFO.program}</div>
        <div className="text-xs text-slate-400">In scope: {BOUNTY_INFO.scope}</div>
        <Chip tone="amber">{BOUNTY_INFO.platform}</Chip>
      </div>

      <div className="rounded-xl border border-indigo-500/25 bg-[#0e0e2a] p-4">
        <div className="text-[10px] font-mono text-slate-500 uppercase mb-2">How to request access</div>
        <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
          {BOUNTY_INFO.accessSteps.map((step, i) => (
            <li key={i} className="mb-1">{step}</li>
          ))}
        </ol>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={`mailto:${BOUNTY_INFO.email}?subject=XRPL%20Bug%20Bounty%20Program%20Access%20Request`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-cyan-400/40 text-cyan-300 text-sm">
          Request access · {BOUNTY_INFO.email}
        </a>
        <a href={BOUNTY_INFO.policyUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-500/40 text-slate-300 text-sm">
          Ripple bug bounty policy <ExternalLink size={14} />
        </a>
        <a href={BOUNTY_INFO.securityPolicyUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-500/40 text-slate-300 text-sm">
          XRPLF SECURITY.md <ExternalLink size={14} />
        </a>
      </div>
    </Panel>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="text-[10px] font-mono tracking-[0.35em] text-emerald-300/80 uppercase">Authorized research · isolated only</div>
        <h2 className="text-3xl font-black text-white mt-1">Wave Security Lab</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl">
          Authorized XRPL vulnerability research platform — differential testing, invariant checks, and bounty-ready evidence bundles. Never Mainnet.
        </p>
      </div>

      {renderBanner()}
      {renderApiStatus()}

      <div className="flex flex-wrap gap-1">
        {LAB_SECTIONS.map((sec) => {
          const Icon = SECTION_ICONS[sec.id] || ShieldCheck;
          const on = section === sec.id;
          return (
            <button key={sec.id} type="button" onClick={() => setSection(sec.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider border transition ${on ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200" : "border-indigo-500/25 text-slate-500 hover:text-slate-300"}`}>
              <Icon size={12} /> {sec.label}
            </button>
          );
        })}
      </div>

      {error && <Panel className="p-3 border-rose-400/30 text-rose-200 text-sm">{error}</Panel>}

      {section === "learn" && renderLearn()}
      {section === "branch-diff" && renderBranchDiff()}
      {section === "testnet-proof" && renderTestnetProof()}
      {section === "compare" && renderScaffold("Compare Versions", "Extended differential tracks across xrpl.js, xrpl-py, and Clio.")}
      {section === "proposal" && renderScaffold("Inspect an Open Proposal", "Review amendment proposal metadata and voting status on Testnet.")}
      {section === "reproduce" && renderScaffold("Reproduce a Known Bug", "Guided tracks for published issues on isolated nodes.")}
      {section === "report" && renderReport()}
      {section === "bounty" && renderBounty()}

      {!wallet && (
        <p className="text-[11px] font-mono text-amber-300">Link wallet for Passport badge sync after completing a real job + disclosure gate.</p>
      )}
    </div>
  );
}
