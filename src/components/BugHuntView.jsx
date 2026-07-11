import React, { useState, useEffect, useCallback } from "react";
import {
  Search, Play, Loader2, ChevronRight, CheckCircle2, XCircle, AlertTriangle,
  FlaskConical, Microscope, Users, ShieldCheck, Eye, EyeOff, RefreshCw, Server,
} from "lucide-react";
import {
  BUG_HUNT_CARDS, BUG_HUNT_CATEGORIES, COMMUNITY_PIPELINE,
  translateEngineResult, matchExpected, getCardById,
} from "../data/bugHuntCards";
import { analyzeBugDescription } from "../lib/bugHuntCopilot";
import { checkApiHealth, createJob, pollJob } from "../lib/securityLabRunner";
import SecurityLabView from "./SecurityLabView";

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

const MODES = [
  { id: "explorer", label: "Explorer", icon: Search, desc: "Pick a card, run a test" },
  { id: "guided", label: "Guided Tester", icon: FlaskConical, desc: "Adjust safe inputs" },
  { id: "describe", label: "Describe a Bug", icon: Microscope, desc: "Plain English → safe test" },
  { id: "community", label: "Community", icon: Users, desc: "Pipeline & reproduction" },
  { id: "researcher", label: "Researcher", icon: ShieldCheck, desc: "Advanced tools" },
];

export default function BugHuntView({ wallet, onTestComplete, onQuestComplete }) {
  const [mode, setMode] = useState("explorer");
  const [apiOk, setApiOk] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [params, setParams] = useState({});
  const [job, setJob] = useState(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [describeText, setDescribeText] = useState("");
  const [copilotResult, setCopilotResult] = useState(null);
  const [pipelineStage, setPipelineStage] = useState(0);

  const refreshHealth = useCallback(async () => {
    const h = await checkApiHealth();
    setApiOk(h.ok);
    return h;
  }, []);

  useEffect(() => { refreshHealth(); }, [refreshHealth]);
  useEffect(() => { if (initialMode) setMode(initialMode); }, [initialMode]);

  const initParams = (card) => {
    const p = {};
    (card.guidedParams || []).forEach((gp) => { p[gp.id] = gp.default; });
    setParams(p);
  };

  const selectCard = (card) => {
    setSelectedCard(card);
    initParams(card);
    setJob(null);
    setError("");
  };

  const runCard = async (card, customParams) => {
    if (!apiOk) {
      setError("Security Lab API is offline. Run: pnpm run security-lab:api — we never fake results.");
      return;
    }
    setError("");
    setJob(null);
    setPolling(true);
    try {
      const created = await createJob({
        type: "template_run",
        cardId: card.id,
        testTemplate: card.testTemplate,
        expectedBehavior: card.expectedBehavior,
        params: customParams || params,
      });
      setJob(created);
      setPipelineStage(0);
      const final = await pollJob(created.id, { onUpdate: (j) => { setJob(j); if (j.status === "complete") setPipelineStage(2); } });
      if (final.status === "complete" && final.result?.real) {
        const match = matchExpected(final.result.engineResult || final.result.observed, card);
        onTestComplete?.({
          cardId: card.id,
          testTemplate: card.testTemplate,
          title: card.title,
          xp: card.rewardXp,
          badge: card.badge,
          match: match.match,
          jobId: final.id,
          category: card.category,
        });
      }
    } catch (e) {
      setError(e.message || "Test failed");
    } finally {
      setPolling(false);
    }
  };

  const handleDescribe = () => {
    const result = analyzeBugDescription(describeText);
    setCopilotResult(result);
  };

  const renderApiBanner = () => (
    <Panel className="p-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-xs font-mono">
        <Server size={14} className={apiOk ? "text-emerald-400" : "text-amber-400"} />
        {apiOk ? <Chip tone="green">Real Testnet jobs</Chip> : <Chip tone="amber">API offline — start security-lab:api</Chip>}
      </div>
      <button type="button" onClick={refreshHealth} className="text-[10px] font-mono text-cyan-300 flex items-center gap-1">
        <RefreshCw size={12} /> Refresh
      </button>
    </Panel>
  );

  const renderCardGrid = () => (
    <div className="grid sm:grid-cols-2 gap-3">
      {BUG_HUNT_CARDS.map((card) => {
        const cat = BUG_HUNT_CATEGORIES.find((c) => c.id === card.category);
        const on = selectedCard?.id === card.id;
        return (
          <button key={card.id} type="button" onClick={() => selectCard(card)}
            className={`text-left rounded-xl border p-4 transition ${on ? "border-cyan-400/50 bg-cyan-400/10" : "border-indigo-500/25 bg-[#0e0e2a] hover:border-indigo-400/40"}`}>
            <div className="flex justify-between gap-2">
              <span className="font-bold text-white text-sm">{card.title}</span>
              <Chip tone="slate">{card.difficulty}</Chip>
            </div>
            <div className="text-[10px] font-mono mt-1" style={{ color: cat?.color }}>{cat?.label}</div>
            <p className="text-xs text-slate-400 mt-2 line-clamp-2">{card.question}</p>
            <div className="text-[10px] text-slate-500 mt-2">~{card.estimatedMinutes} min · +{card.rewardXp} XP</div>
          </button>
        );
      })}
    </div>
  );

  const renderGuidedParams = (card) => (
    <div className="space-y-3">
      {(card.guidedParams || []).length === 0 ? (
        <p className="text-xs text-slate-500">This card has fixed parameters — run as-is.</p>
      ) : (
        card.guidedParams.map((gp) => (
          <div key={gp.id}>
            <label className="text-[10px] font-mono text-slate-500 uppercase">{gp.label}</label>
            <p className="text-[11px] text-slate-500 mb-1">{gp.explain}</p>
            {gp.type === "boolean" ? (
              <input type="checkbox" checked={!!params[gp.id]} onChange={(e) => setParams((p) => ({ ...p, [gp.id]: e.target.checked }))} />
            ) : gp.type === "text" ? (
              <input value={params[gp.id] ?? gp.default} onChange={(e) => setParams((p) => ({ ...p, [gp.id]: e.target.value }))}
                className="w-full rounded-lg bg-[#0e0e2a] border border-indigo-500/30 px-3 py-2 text-sm text-white font-mono" />
            ) : (
              <input type="number" min={gp.min} max={gp.max} value={params[gp.id] ?? gp.default}
                onChange={(e) => setParams((p) => ({ ...p, [gp.id]: Number(e.target.value) }))}
                className="w-full rounded-lg bg-[#0e0e2a] border border-indigo-500/30 px-3 py-2 text-sm text-white font-mono" />
            )}
          </div>
        ))
      )}
    </div>
  );

  const renderResults = () => {
    if (!job) return null;
    const card = selectedCard;
    const r = job.result;
    const observed = r?.observed || r?.engineResult;
    const match = card && observed ? matchExpected(observed, card) : null;

    return (
      <Panel className="p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Status: {job.status}</span>
          {polling && <Loader2 size={14} className="animate-spin text-cyan-400" />}
          {r?.real && <Chip tone="green">Real Testnet</Chip>}
          {match && <Chip tone={match.status === "expected" ? "green" : match.status === "unexpected" ? "amber" : "cyan"}>
            {match.status === "expected" ? "Expected" : match.status === "unexpected" ? "Unexpected" : "Info"}
          </Chip>}
        </div>

        {job.status === "complete" && card && (
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-indigo-500/20 p-3">
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-1">Expected</div>
              <div className="text-slate-300 text-xs">{card.expectedBehavior}</div>
            </div>
            <div className="rounded-lg border border-indigo-500/20 p-3">
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-1">Observed</div>
              <div className="text-white text-xs">{translateEngineResult(observed, card)}</div>
            </div>
            <div className="rounded-lg border border-indigo-500/20 p-3">
              <div className="text-[10px] font-mono text-slate-500 uppercase mb-1">Result</div>
              <div className="flex items-center gap-1 text-xs">
                {match?.match ? <CheckCircle2 size={14} className="text-emerald-400" /> : <XCircle size={14} className="text-amber-400" />}
                {match?.match ? "Matches expected" : match?.status === "info" ? "Read-only probe" : "Review — may be interesting"}
              </div>
            </div>
          </div>
        )}

        {advanced && r && (
          <pre className="text-[10px] font-mono text-slate-500 bg-[#0e0e2a] p-3 rounded-lg overflow-x-auto">{JSON.stringify(r, null, 2)}</pre>
        )}

        <button type="button" onClick={() => setAdvanced((a) => !a)} className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
          {advanced ? <EyeOff size={12} /> : <Eye size={12} />} {advanced ? "Hide" : "Show"} raw JSON
        </button>

        {job.error && <div className="text-sm text-rose-300">{job.error}</div>}
      </Panel>
    );
  };

  const renderExplorer = () => (
    <div className="space-y-4">
      {renderCardGrid()}
      {selectedCard && (
        <Panel className="p-5 space-y-3">
          <h4 className="font-bold text-white">{selectedCard.title}</h4>
          <p className="text-sm text-slate-300">{selectedCard.question}</p>
          <button type="button" onClick={() => runCard(selectedCard)} disabled={polling || !apiOk}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 text-[#06121a] disabled:opacity-40">
            {polling ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run Test
          </button>
        </Panel>
      )}
      {renderResults()}
    </div>
  );

  const renderGuided = () => (
    <div className="space-y-4">
      {!selectedCard ? renderCardGrid() : (
        <Panel className="p-5 space-y-4">
          <button type="button" onClick={() => setSelectedCard(null)} className="text-[10px] font-mono text-slate-500">← All cards</button>
          <h4 className="font-bold text-white">{selectedCard.title}</h4>
          {renderGuidedParams(selectedCard)}
          <button type="button" onClick={() => runCard(selectedCard, params)} disabled={polling || !apiOk}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-cyan-500 text-white disabled:opacity-40">
            {polling ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run with settings
          </button>
        </Panel>
      )}
      {selectedCard && !job && (
        <button type="button" onClick={() => selectCard(selectedCard)} className="text-xs text-cyan-300">Reset parameters</button>
      )}
      {renderResults()}
    </div>
  );

  const renderDescribe = () => (
    <div className="space-y-4">
      <Panel className="p-5">
        <label className="text-[10px] font-mono text-cyan-300 uppercase tracking-widest">Describe something that could go wrong</label>
        <textarea value={describeText} onChange={(e) => setDescribeText(e.target.value)} rows={4} placeholder="e.g. What if someone sends the same payment twice?"
          className="mt-2 w-full rounded-lg bg-[#0e0e2a] border border-indigo-500/30 px-3 py-2 text-sm text-white" />
        <button type="button" onClick={handleDescribe} className="mt-3 px-4 py-2 rounded-lg text-xs font-bold border border-cyan-400/40 text-cyan-300">
          Map to safe test
        </button>
      </Panel>
      {copilotResult && !copilotResult.ok && (
        <Panel className="p-4 border-rose-400/30 bg-rose-400/5">
          <div className="flex gap-2 text-rose-200 text-sm"><AlertTriangle size={16} />{copilotResult.reason}</div>
          {copilotResult.suggestions && <p className="text-xs text-slate-400 mt-2">Try: {copilotResult.suggestions.join(", ")}</p>}
        </Panel>
      )}
      {copilotResult?.ok && (
        <Panel className="p-5 space-y-3 border-emerald-400/20">
          <Chip tone="green">Safe test mapped</Chip>
          <p className="text-sm text-emerald-100"><strong>I will:</strong> {copilotResult.preview}</p>
          <p className="text-xs text-slate-400">Card: {copilotResult.card?.title} · confidence: {copilotResult.confidence}</p>
          <button type="button" onClick={() => { selectCard(copilotResult.card); runCard(copilotResult.card); }}
            disabled={polling || !apiOk}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 text-[#06121a] disabled:opacity-40">
            Run this test
          </button>
        </Panel>
      )}
      {renderResults()}
    </div>
  );

  const renderCommunity = () => (
    <div className="space-y-4">
      <Panel className="p-4 border-cyan-400/20">
        <p className="text-sm text-slate-300">Community pipeline — beginners never auto-export sensitive reports. Expert export requires the Responsible Disclosure Gate in Researcher mode.</p>
      </Panel>
      <div className="flex flex-wrap gap-1">
        {COMMUNITY_PIPELINE.map((stage, i) => (
          <div key={stage.id} className={`flex-1 min-w-[120px] rounded-lg border p-3 text-center ${i <= pipelineStage ? "border-emerald-400/40 bg-emerald-400/5" : "border-indigo-500/20 bg-[#0e0e2a]"}`}>
            <div className="text-[10px] font-mono text-slate-500">{i + 1}</div>
            <div className="text-xs font-bold text-white mt-1">{stage.label}</div>
            <div className="text-[10px] text-slate-500 mt-1">{stage.desc}</div>
          </div>
        ))}
      </div>
      <Panel className="p-5 text-center">
        <Chip tone="slate">Reproduce a Community Finding — coming soon</Chip>
        <p className="text-xs text-slate-500 mt-2">Queued findings from confirmed unexpected results will appear here for independent reproduction.</p>
      </Panel>
    </div>
  );

  const renderResearcher = () => (
    <SecurityLabView wallet={wallet} onQuestComplete={onQuestComplete} />
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <div className="text-[10px] font-mono tracking-[0.35em] text-emerald-300/80 uppercase">Citizen science · Testnet only</div>
        <h2 className="text-3xl font-black text-white mt-1">XRPL Bug Hunt</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-2xl">
          Help test the XRP Ledger through guided quests. The backend runs real Testnet jobs — not simulations. Never Mainnet.
        </p>
      </div>

      <Panel className="p-4 border-rose-400/30 bg-rose-400/5">
        <div className="flex gap-2 text-rose-200 text-sm">
          <AlertTriangle size={18} className="shrink-0" />
          <span>Authorized Testnet testing only. Official bounty: request access at <strong>bugs@ripple.com</strong> per <a href="https://ripple.com/legal/bug-bounty/" className="text-cyan-300 underline" target="_blank" rel="noopener noreferrer">Ripple policy</a>.</span>
        </div>
      </Panel>

      {renderApiBanner()}

      <div className="flex flex-wrap gap-1">
        {MODES.map((m) => {
          const Icon = m.icon;
          const on = mode === m.id;
          return (
            <button key={m.id} type="button" onClick={() => { setMode(m.id); setError(""); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase tracking-wider border transition ${on ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200" : "border-indigo-500/25 text-slate-500 hover:text-slate-300"}`}>
              <Icon size={12} /> {m.label}
            </button>
          );
        })}
      </div>

      {error && <Panel className="p-3 border-rose-400/30 text-rose-200 text-sm">{error}</Panel>}

      {mode === "explorer" && renderExplorer()}
      {mode === "guided" && renderGuided()}
      {mode === "describe" && renderDescribe()}
      {mode === "community" && renderCommunity()}
      {mode === "researcher" && renderResearcher()}

      {!wallet && mode !== "researcher" && (
        <p className="text-[11px] font-mono text-amber-300">Link wallet for Passport badge sync after completing tests.</p>
      )}
    </div>
  );
}
