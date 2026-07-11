import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, "../src/App.jsx");
let s = fs.readFileSync(appPath, "utf8");

if (s.includes("recordSpaceCheckIn")) {
  console.log("App.jsx already has Spaces — skipping merge");
  process.exit(0);
}
if (!s.includes("swagWins")) {
  console.error("App.jsx missing swag system — abort");
  process.exit(1);
}

s = s.replace(
  /Loader2, BadgeCheck, CircleDollarSign, Layers, Search, X, QrCode, Gift\n\} from "lucide-react";/,
  `Loader2, BadgeCheck, CircleDollarSign, Layers, Search, X, QrCode, Gift,
  MapPin, Timer, Radio
} from "lucide-react";`
);

s = s.replace(
  `import { CATEGORIES, APPS, BADGE_DEFS, MOCK_LEADERS } from "./data/ecosystem";
import { xrplRequest, isValidAddress, shortAddr, fetchAccountInfo, findMatchingTx } from "./lib/xrpl";
import { useXaman } from "./hooks/useXaman";`,
  `import { CATEGORIES, APPS, BADGE_DEFS, MOCK_LEADERS } from "./data/ecosystem";
import { SPACES } from "./data/spaces";
import { xrplRequest, isValidAddress, shortAddr, fetchAccountInfo, findMatchingTx } from "./lib/xrpl";
import {
  getSpace, isSpaceActive, spaceStatus, formatWindow, buildCheckInUrl,
  parseCheckInFromLocation, clearCheckInFromUrl, loadSpaceLog, saveSpaceLog, hasCheckedIn,
} from "./lib/spaces";
import { useXaman } from "./hooks/useXaman";
import { SpaceQR } from "./components/SpaceQR";`
);

s = s.replace(
  `const [toast, setToast] = useState(null);

  const timeouts = useRef([]);`,
  `const [toast, setToast] = useState(null);

  const [spaceLog, setSpaceLog] = useState(() => loadSpaceLog());
  const [selectedSpaceId, setSelectedSpaceId] = useState(SPACES[0]?.id || "");
  const [pendingCheckIn, setPendingCheckIn] = useState(null);
  const [checkInUi, setCheckInUi] = useState({ status: "idle", msg: "" });
  const [clock, setClock] = useState(Date.now());

  const timeouts = useRef([]);`
);

s = s.replace(
  `useEffect(() => () => timeouts.current.forEach(clearTimeout), []);

  const level = 1 + Math.floor(xp / 150);`,
  `useEffect(() => () => timeouts.current.forEach(clearTimeout), []);
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const parsed = parseCheckInFromLocation();
    if (parsed) { setPendingCheckIn(parsed); setView("spaces"); }
  }, []);

  const level = 1 + Math.floor(xp / 150);`
);

s = s.replace(
  "const verifiedUniqueMissions = completed.filter((c) => c.xp > 0 && !c.simulated).length;",
  "const verifiedUniqueMissions = completed.filter((c) => c.xp > 0 && !c.simulated && !c.spaceCheckIn).length;"
);

const spaceBlock = `
  const recordSpaceCheckIn = useCallback((space, address, demo = false) => {
    const active = isSpaceActive(space, Date.now());
    const prev = loadSpaceLog();
    const already = hasCheckedIn(prev, space.id, address);
    const entry = { spaceId: space.id, spaceName: space.name, wallet: address, at: Date.now(), activeAtCheckIn: active, credited: active && !already, demo };
    if (!active) return { ok: false, reason: "inactive", entry };
    const next = [entry, ...prev]; setSpaceLog(next); saveSpaceLog(next);
    if (already) return { ok: false, reason: "repeat", entry };
    setXp((x) => x + space.xp); setBadges((b) => awardBadge("xrpswag", b));
    setCompleted((c) => [{ appId: \`space:\${space.id}\`, appName: space.name, title: \`Space check-in · \${space.name}\`, xp: space.xp, when: Date.now(), hash: \`space-\${space.id}\`, category: "nfts", simulated: demo, spaceCheckIn: true }, ...c]);
    return { ok: true, entry };
  }, []);
  const checkInHandled = useRef(null);
  useEffect(() => {
    if (!pendingCheckIn?.spaceId) return;
    const space = getSpace(pendingCheckIn.spaceId);
    if (!space) { setCheckInUi({ status: "error", msg: "Unknown space — check the QR code." }); return; }
    if (!isSpaceActive(space, clock)) {
      const st = spaceStatus(space, clock);
      setCheckInUi({ status: "inactive", msg: st === "upcoming" ? \`This space opens \${formatWindow(space)}.\` : \`This space closed. Window was \${formatWindow(space)}.\` });
      return;
    }
    if (!wallet) { setCheckInUi({ status: "need-wallet", msg: "Link your wallet to log this visit and earn the XRPL Swag stamp." }); return; }
    const key = \`\${pendingCheckIn.spaceId}:\${wallet.address}\`;
    if (checkInHandled.current === key) return;
    checkInHandled.current = key;
    const result = recordSpaceCheckIn(space, wallet.address, wallet.demo);
    if (result.ok) { setCheckInUi({ status: "done", msg: \`Checked in at \${space.name} — +\${space.xp} XP & XRPL Swag badge unlocked.\` }); notify("Space check-in logged — XRPL Swag badge earned", "green"); clearCheckInFromUrl(); }
    else if (result.reason === "repeat") { setCheckInUi({ status: "repeat", msg: "You already logged this space on this wallet." }); clearCheckInFromUrl(); }
  }, [pendingCheckIn, wallet, clock, recordSpaceCheckIn]);
`;

s = s.replace(
  `const awardBadge = (id, list) => (list.includes(id) ? list : [...list, id]);

  /* ----- Wallet connect (read-only) ----- */`,
  `const awardBadge = (id, list) => (list.includes(id) ? list : [...list, id]);${spaceBlock}

  /* ----- Wallet connect (read-only) ----- */`
);

s = s.replace(
  `All five categories stamped`,
  `All {CATEGORIES.length} categories stamped`
);

const spaceLogPanel = `      <Panel className="p-6">
        <div className="text-[10px] font-mono tracking-[0.3em] text-slate-500 uppercase mb-3">Space time log</div>
        {spaceLog.length === 0 ? (
          <p className="text-sm text-slate-500">Scan a space QR while the venue is <span className="text-emerald-300">active</span> to log a timed visit.</p>
        ) : (
          <div className="space-y-2">
            {spaceLog.slice(0, 10).map((e, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-[#0e0e2a] px-3 py-2.5">
                <MapPin size={16} className={e.credited ? "text-fuchsia-300" : "text-slate-500"} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200 font-semibold truncate">{e.spaceName}</div>
                  <div className="text-[10px] font-mono text-slate-500">{new Date(e.at).toLocaleString()} · {e.credited ? "credited" : "logged"}</div>
                </div>
                {e.credited && <Chip tone="purple">+swag</Chip>}
              </div>
            ))}
          </div>
        )}
      </Panel>

`;

s = s.replace(
  `      <Panel className="p-6">
        <div className="text-[10px] font-mono tracking-[0.3em] text-slate-500 uppercase mb-3">Badges</div>`,
  spaceLogPanel + `      <Panel className="p-6">
        <div className="text-[10px] font-mono tracking-[0.3em] text-slate-500 uppercase mb-3">Badges</div>`
);

const spacesView = `
  const selectedSpace = getSpace(selectedSpaceId) || SPACES[0];
  const selectedStatus = selectedSpace ? spaceStatus(selectedSpace, clock) : "unknown";
  const checkInUrl = selectedSpace ? buildCheckInUrl(selectedSpace.id) : "";

  const SpacesView = (
    <div className="max-w-4xl mx-auto space-y-6">
      {pendingCheckIn && checkInUi.status !== "idle" && (
        <Panel className="p-5 border-fuchsia-400/30 wave-reveal">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="text-[10px] font-mono tracking-[0.3em] text-fuchsia-300 uppercase mb-1">Space check-in</div>
              <p className="text-sm text-slate-200">{checkInUi.msg}</p>
              {checkInUi.status === "need-wallet" && (
                <button onClick={() => setWalletModal(true)} className="mt-3 px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-cyan-500 text-white">Link wallet</button>
              )}
            </div>
            <button onClick={() => { setPendingCheckIn(null); setCheckInUi({ status: "idle", msg: "" }); clearCheckInFromUrl(); }} className="text-slate-500 hover:text-slate-300"><X size={16} /></button>
          </div>
        </Panel>
      )}
      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6">
        <Panel className="p-6">
          <div className="text-[10px] font-mono tracking-[0.3em] text-slate-500 uppercase mb-1">Activation spaces</div>
          <h3 className="text-xl font-black text-white mb-2">Post a QR · log visits while live</h3>
          <div className="space-y-2">
            {SPACES.map((sp) => {
              const st = spaceStatus(sp, clock);
              const on = selectedSpaceId === sp.id;
              return (
                <button key={sp.id} onClick={() => setSelectedSpaceId(sp.id)} className={\`w-full text-left rounded-xl border px-4 py-3 transition \${on ? "border-cyan-400/50 bg-cyan-400/10" : "border-indigo-500/25 bg-[#0e0e2a]"}\`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-100 text-sm">{sp.name}</span>
                    <Chip tone={st === "active" ? "green" : st === "upcoming" ? "amber" : "slate"}>{st === "active" ? "live" : st}</Chip>
                  </div>
                  <div className="text-[10px] font-mono text-slate-600 mt-0.5">{formatWindow(sp)}</div>
                </button>
              );
            })}
          </div>
        </Panel>
        {selectedSpace && (
          <Panel className="p-6 flex flex-col items-center">
            <SpaceQR url={checkInUrl} size={200} label="Scan to check in" />
            <p className="mt-4 text-[11px] font-mono text-slate-500 text-center break-all max-w-xs">{checkInUrl}</p>
          </Panel>
        )}
      </div>
    </div>
  );

`;

s = s.replace(
  `  const [devForm, setDevForm] = useState({ name: "", url: "", category: "payments", desc: "", mission: "", verify: "Payment", contact: "" });`,
  spacesView + `  const [devForm, setDevForm] = useState({ name: "", url: "", category: "payments", desc: "", mission: "", verify: "Payment", contact: "" });`
);

s = s.replace(
  `<NavBtn id="apps" label="Apps" />\n            <NavBtn id="developers" label="Developers" />`,
  `<NavBtn id="apps" label="Apps" />\n            <NavBtn id="spaces" label="Spaces" />\n            <NavBtn id="developers" label="Developers" />`
);

s = s.replace(
  `<NavBtn id="home" label="Discover" /><NavBtn id="passport" label="Passport" /><NavBtn id="leaderboard" label="Ranks" /><NavBtn id="apps" label="Apps" /><NavBtn id="developers" label="Devs" />`,
  `<NavBtn id="home" label="Discover" /><NavBtn id="passport" label="Passport" /><NavBtn id="leaderboard" label="Ranks" /><NavBtn id="apps" label="Apps" /><NavBtn id="spaces" label="Spaces" /><NavBtn id="developers" label="Devs" />`
);

s = s.replace(
  `{view === "apps" && AppsView}\n        {view === "developers" && DevView}`,
  `{view === "apps" && AppsView}\n        {view === "spaces" && SpacesView}\n        {view === "developers" && DevView}`
);

fs.writeFileSync(appPath, s);
console.log("Merged Spaces into App.jsx");
