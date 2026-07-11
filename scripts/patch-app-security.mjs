import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const appPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/App.jsx");
let s = fs.readFileSync(appPath, "utf8");

if (s.includes("SecurityLabView")) {
  console.log("App.jsx already patched for Security Lab");
  process.exit(0);
}

// imports
s = s.replace(
  'import { CATEGORIES, APPS, BADGE_DEFS, MOCK_LEADERS } from "./data/ecosystem";',
  `import { CATEGORIES, APPS, SPIN_APPS, BADGE_DEFS, MOCK_LEADERS, WAVE_MACHINE, SECURITY_LAB_ENTRY } from "./data/ecosystem";`
);
s = s.replace(
  'import { xrplRequest, isValidAddress, shortAddr, fetchAccountInfo, findMatchingTx } from "./lib/xrpl";',
  `import { xrplRequest, isValidAddress, shortAddr, fetchAccountInfo, fetchAccountLines, findMatchingTx, findAnyRecentTx } from "./lib/xrpl";`
);
if (!s.includes("SecurityLabView")) {
  s = s.replace(
    'import { SpaceQR } from "./components/SpaceQR";',
    `import { SpaceQR } from "./components/SpaceQR";
import SecurityLabView from "./components/SecurityLabView";`
  );
}

// guided checklist state
s = s.replace(
  'const [verifyState, setVerifyState] = useState({ status: "idle", msg: "", hash: "" });',
  `const [verifyState, setVerifyState] = useState({ status: "idle", msg: "", hash: "" });
  const [guidedChecks, setGuidedChecks] = useState({});`
);

// spin uses SPIN_APPS
s = s.replace(
  "const pool = APPS.filter((a) => a.category === cat.id);",
  "const pool = SPIN_APPS.filter((a) => a.category === cat.id);"
);
s = s.replace(
  '<Reel label="App" items={APPS}',
  '<Reel label="App" items={SPIN_APPS}'
);
s = s.replace(
  '<Reel label="Mission" items={APPS}',
  '<Reel label="Mission" items={SPIN_APPS}'
);

// startBuiltInMission + security lab callback
const helpers = `
  const startBuiltInMission = (app, mission) => {
    setActiveMission({ app, mission, startedAt: Date.now() });
    setGuidedChecks({});
    setVerifyState({ status: "idle", msg: "", hash: "" });
    setView("mission");
  };

  const handleSecurityLabQuest = ({ xp, badge, title }) => {
    const missionKey = "security-lab:amendment-test-quest";
    const already = completed.some((c) => c.appId === "security-lab" && c.title === title);
    const gained = already ? 0 : xp;
    setCompleted((prev) => [{ appId: "security-lab", appName: "XRPL Security Lab", title, xp: gained, when: Date.now(), hash: "sandbox-quest", category: "cybersecurity", simulated: true, sandbox: true }, ...prev]);
    if (!already) {
      setXp((x) => x + gained);
      setBadges((b) => { let n = awardBadge("cybersecurity", b); if (badge) n = awardBadge(badge, n); return n; });
      notify(\`+\${gained} XP — Security Researcher quest complete (sandbox)\`, "green");
    } else notify("Quest already completed — no repeat XP", "amber");
  };

`;

s = s.replace(
  "const startMission = () => {",
  helpers + "const startMission = () => {"
);

// verifyMission replacement
const newVerify = `const verifyMission = async () => {
    if (!activeMission || !wallet) return;
    const m = activeMission.mission || activeMission.app.mission;
    const verifyType = m.verify;
    setVerifyState({ status: "checking", msg: "Verifying…", hash: "" });

    if (verifyType === "guided" || verifyType === "simulation") {
      const required = m.steps?.length || 1;
      const done = Object.values(guidedChecks).filter(Boolean).length;
      if (done < required) {
        setVerifyState({ status: "notfound", msg: \`Complete all \${required} checklist items before verifying.\`, hash: "" });
        return;
      }
      const sim = verifyType === "simulation" || wallet.demo;
      completeMission(activeMission, sim ? "SANDBOX" : "GUIDED", sim);
      return;
    }

    if (wallet.demo) {
      const t = setTimeout(() => completeMission(activeMission, "SIMULATED", true), 1600);
      timeouts.current.push(t);
      return;
    }
    try {
      if (verifyType === "account_lines_review") {
        await fetchAccountLines(wallet.address);
        completeMission(activeMission, "lines-reviewed", false);
        return;
      }
      if (verifyType === "account_info_review") {
        await fetchAccountInfo(wallet.address);
        completeMission(activeMission, "account-reviewed", false);
        return;
      }
      if (verifyType === "transaction_lookup") {
        const match = await findAnyRecentTx(wallet.address, activeMission.startedAt);
        if (match) completeMission(activeMission, match.hash, false);
        else setVerifyState({ status: "notfound", msg: "No recent successful transaction found. Complete a mainnet action first, then verify.", hash: "" });
        return;
      }
      const match = await findMatchingTx(wallet.address, verifyType, activeMission.startedAt);
      if (match) {
        completeMission(activeMission, match.hash || "verified", false);
      } else {
        setVerifyState({
          status: "notfound",
          msg: \`No successful \${verifyType} from your wallet since the mission started. Complete the action, wait for the ledger to close (~4s), then verify again.\`,
          hash: "",
        });
      }
    } catch (e) {
      setVerifyState({ status: "error", msg: e.message || "Verification failed — connection issue.", hash: "" });
    }
  };`;

s = s.replace(/const verifyMission = async \(\) => \{[\s\S]*?\n  \};\n\n  const completeMission/, newVerify + "\n\n  const completeMission");

// completeMission - use mission id for built-in
s = s.replace(
  "const already = completed.some((c) => c.appId === app.id && c.title === m.title);",
  `const missionKey = m.id || m.title;
    const already = completed.some((c) => c.appId === app.id && (c.missionId === missionKey || c.title === m.title));`
);
s = s.replace(
  "setCompleted((prev) => [{ appId: app.id, appName: app.name, title: m.title, xp: gained, when: Date.now(), hash, category: app.category, simulated }, ...prev]);",
  `setCompleted((prev) => [{ appId: app.id, appName: app.name, missionId: missionKey, title: m.title, xp: gained, when: Date.now(), hash, category: m.category || app.category, simulated, sandbox: m.verify === "simulation" }, ...prev]);`
);
s = s.replace(
  "next = awardBadge(app.category, next);",
  "next = awardBadge(m.category || app.category, next);"
);

// Mission view - use activeMission.mission
s = s.replace(
  "const m = app.mission;",
  "const m = activeMission.mission || app.mission;"
);
s = s.replace(
  `<a href={app.url} target="_blank" rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-fuchsia-500 flex items-center gap-2">
              Open {app.name} <ExternalLink size={15} />
            </a>`,
  `{app.url ? (
            <a href={app.url} target="_blank" rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-fuchsia-500 flex items-center gap-2">
              Open {app.name} <ExternalLink size={15} />
            </a>
          ) : (
            <span className="px-5 py-2.5 rounded-xl font-bold text-slate-400 border border-indigo-500/30 text-sm">Built-in utility — no external app</span>
          )}`
);

// guided checklist in mission view before verify button
s = s.replace(
  `<div className="mt-5 rounded-xl border border-indigo-500/25 bg-[#0e0e2a] p-3 text-[11px] font-mono text-slate-400">
            <span className="text-cyan-300">VERIFICATION:</span> {m.verifyLabel}, found in your wallet's public mainnet history after the mission start time.
          </div>`,
  `{ (m.verify === "guided" || m.verify === "simulation") ? (
            <div className="mt-5 rounded-xl border border-cyan-400/25 bg-cyan-400/5 p-4">
              <div className="text-[10px] font-mono text-cyan-300 uppercase mb-2">Checklist {m.verify === "simulation" ? "(sandbox)" : ""}</div>
              {m.steps.map((step, i) => (
                <label key={i} className="flex gap-2 text-sm text-slate-300 mt-2 cursor-pointer">
                  <input type="checkbox" checked={!!guidedChecks[i]} onChange={() => setGuidedChecks((g) => ({ ...g, [i]: !g[i] }))} />
                  {step}
                </label>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-indigo-500/25 bg-[#0e0e2a] p-3 text-[11px] font-mono text-slate-400">
              <span className="text-cyan-300">VERIFICATION:</span> {m.verifyLabel}{m.verify === "account_lines_review" || m.verify === "account_info_review" || m.verify === "transaction_lookup" ? " (read-only mainnet)." : ", found in your wallet's public mainnet history after the mission start time."}
            </div>
          )}`
);

s = s.replace(
  'Verify on-chain',
  '{m.verify === "guided" || m.verify === "simulation" ? "Complete mission" : "Verify on-chain"}'
);

// Home Safety section before HOW IT WORKS
const safetySection = `
      <Panel className="p-5 border-emerald-500/20">
        <div className="text-[10px] font-mono tracking-[0.3em] text-emerald-300 uppercase mb-3">Safety & Intelligence</div>
        <p className="text-xs text-slate-400 mb-4">Built-in utilities — not in the public spinner. External AI/security apps withheld until mainnet-verifiable.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="text-sm font-bold text-white mb-2">Wave Machine utilities</div>
            <div className="flex flex-wrap gap-2">
              {WAVE_MACHINE.missions.slice(0, 4).map((mis) => (
                <button key={mis.id} onClick={() => startBuiltInMission(WAVE_MACHINE, mis)}
                  className="text-[10px] font-mono px-2 py-1 rounded-lg border border-indigo-500/30 text-slate-300 hover:border-cyan-400/50">{mis.title}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-sm font-bold text-white mb-2">XRPL Security Lab</div>
            <p className="text-xs text-slate-500 mb-2">Sandbox only · Testnet/Devnet · never Mainnet</p>
            <button onClick={() => setView("security-lab")} className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 text-white">
              Open Security Lab
            </button>
            <button onClick={() => startBuiltInMission(SECURITY_LAB_ENTRY, SECURITY_LAB_ENTRY.mission)} className="ml-2 px-4 py-2 rounded-lg text-xs font-bold border border-emerald-400/40 text-emerald-300">
              Test an Amendment
            </button>
          </div>
        </div>
      </Panel>

`;

s = s.replace(
  `{/* HOW IT WORKS + NEXT BEST */}`,
  safetySection + `{/* HOW IT WORKS + NEXT BEST */}`
);

// Nav + view
s = s.replace(
  '<NavBtn id="spaces" label="Spaces" />\n            <NavBtn id="developers" label="Developers" />',
  '<NavBtn id="spaces" label="Spaces" />\n            <NavBtn id="security-lab" label="Security Lab" />\n            <NavBtn id="developers" label="Developers" />'
);
s = s.replace(
  '<NavBtn id="spaces" label="Spaces" /><NavBtn id="developers" label="Devs" />',
  '<NavBtn id="spaces" label="Spaces" /><NavBtn id="security-lab" label="Lab" /><NavBtn id="developers" label="Devs" />'
);
s = s.replace(
  '{view === "spaces" && SpacesView}\n        {view === "developers" && DevView}',
  `{view === "spaces" && SpacesView}
        {view === "security-lab" && (
          <SecurityLabView wallet={wallet} onQuestComplete={handleSecurityLabQuest} />
        )}
        {view === "developers" && DevView}`
);

// Apps view uses SPIN_APPS
s = s.replace(
  "Participating apps · {APPS.length}",
  "Live apps · {SPIN_APPS.length}"
);
s = s.replace(
  "{APPS.map((a) => {",
  "{SPIN_APPS.map((a) => {"
);

fs.writeFileSync(appPath, s);
console.log("App.jsx patched for Security Lab");
