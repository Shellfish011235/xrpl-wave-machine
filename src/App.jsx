import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Waves, Zap, Wallet, Trophy, ShieldCheck, CheckCircle2, XCircle, Clock,
  AlertTriangle, ChevronRight, Star, Flame, RefreshCw, ExternalLink, Users,
  BarChart3, Send, Sparkles, Award, Lock, Globe, Code2, ArrowRight, Eye,
  Loader2, BadgeCheck, CircleDollarSign, Layers, Search, X, QrCode, Gift,
  MapPin, Timer, Radio
} from "lucide-react";

/* ============================================================
   XRPL WAVE MACHINE — Discovery & Activation Layer for the XRP Ledger
   Read-only, non-custodial. Verification via public mainnet
   WebSocket (account_tx). No keys ever touch this app.
   ============================================================ */

import { CATEGORIES, APPS, SPIN_APPS, BADGE_DEFS, MOCK_LEADERS, WAVE_MACHINE, SECURITY_LAB_ENTRY } from "./data/ecosystem";
import { SPACES } from "./data/spaces";
import { xrplRequest, isValidAddress, shortAddr, fetchAccountInfo, fetchAccountLines, findMatchingTx, findAnyRecentTx } from "./lib/xrpl";
import {
  getSpace, isSpaceActive, spaceStatus, formatWindow, buildCheckInUrl,
  parseCheckInFromLocation, clearCheckInFromUrl, loadSpaceLog, saveSpaceLog, hasCheckedIn,
} from "./lib/spaces";
import { useXaman } from "./hooks/useXaman";
import { SpaceQR } from "./components/SpaceQR";
import BugHuntView from "./components/BugHuntView";
import SecurityLabView from "./components/SecurityLabView";


/* ---------- Reel ---------- */
function Reel({ label, items, spinning, result, delayIdx, renderItem }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-[10px] font-mono tracking-[0.25em] text-cyan-300/80 uppercase">{label}</div>
      <div className="relative w-28 h-32 sm:w-32 sm:h-36 rounded-xl overflow-hidden border border-indigo-500/40 bg-[#0a0a1f] shadow-[inset_0_0_30px_rgba(80,60,180,0.35)]">
        <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-[#060614] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#060614] to-transparent z-10 pointer-events-none" />
        {spinning ? (
          <div className="wave-reel-strip absolute inset-x-0" style={{ animationDelay: `${delayIdx * 0.08}s` }}>
            {[...items, ...items, ...items].map((it, i) => (
              <div key={i} className="h-32 sm:h-36 flex items-center justify-center">{renderItem(it, true)}</div>
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center wave-reel-settle">
            {result ? renderItem(result, false) : <div className="text-indigo-400/50 text-3xl font-bold">?</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Small UI atoms ---------- */
const Chip = ({ children, tone = "cyan" }) => {
  const tones = {
    cyan: "border-cyan-400/40 text-cyan-300 bg-cyan-400/10",
    purple: "border-purple-400/40 text-purple-300 bg-purple-400/10",
    green: "border-emerald-400/40 text-emerald-300 bg-emerald-400/10",
    amber: "border-amber-400/40 text-amber-300 bg-amber-400/10",
    red: "border-rose-400/40 text-rose-300 bg-rose-400/10",
    slate: "border-slate-500/40 text-slate-300 bg-slate-500/10",
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono tracking-wide uppercase ${tones[tone]}`}>{children}</span>;
};

const Panel = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-indigo-500/25 bg-[#0b0b22]/90 shadow-[0_0_40px_rgba(60,40,160,0.12)] ${className}`}>{children}</div>
);

const statusTone = (s) =>
  s === "Mainnet Activity Verified" ? "green" : s === "Developer Verified" ? "cyan" : s === "Sponsored Placement" ? "amber" : "slate";

/* ---------- Swag eligibility helpers ---------- */
const monthKey = (date = new Date()) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const addCalendarMonths = (timestamp, months) => {
  const date = new Date(timestamp);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.getTime();
};

/* ---------- Main App ---------- */
export default function XRPLWaveMachine() {
  const [view, setView] = useState("home");
  const [bugHuntMode, setBugHuntMode] = useState("explorer");
  const [wallet, setWallet] = useState(null); // { address, demo, viaXaman }
  const [walletInput, setWalletInput] = useState("");
  const [walletModal, setWalletModal] = useState(false);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletErr, setWalletErr] = useState("");

  // Xaman QR sign-in (scan with the iPhone app). Falls back to manual
  // r-address entry when VITE_XAMAN_API_KEY isn't configured.
  const xaman = useXaman(import.meta.env.VITE_XAMAN_API_KEY);
  useEffect(() => {
    if (xaman.account && wallet?.address !== xaman.account) {
      setWallet({ address: xaman.account, demo: false, viaXaman: true });
      setWalletModal(false);
      notify("Signed in with Xaman — wallet ownership verified", "green");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xaman.account]);

  const [xp, setXp] = useState(0);
  const [completed, setCompleted] = useState([]); // {appId, title, xp, when, hash, category, simulated}
  const [badges, setBadges] = useState([]);
  const [streak, setStreak] = useState(0);
  const unlimitedSpins = import.meta.env.VITE_UNLIMITED_SPINS !== "false";
  const [spinsLeft, setSpinsLeft] = useState(3);
  const [spinCount, setSpinCount] = useState(0);
  const [profileHydrated, setProfileHydrated] = useState(false);

  const monthlySwagLimit = Math.max(1, Number(import.meta.env.VITE_MONTHLY_SWAG_WINNER_LIMIT || 10));
  const swagCooldownMonths = Math.max(1, Number(import.meta.env.VITE_SWAG_COOLDOWN_MONTHS || 3));
  const swagMinUniqueMissions = Math.max(1, Number(import.meta.env.VITE_SWAG_MIN_UNIQUE_MISSIONS || 3));
  const [swagWins, setSwagWins] = useState([]); // {wallet, wonAt, month}
  const [swagHydrated, setSwagHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("wave-machine:swag-wins:v1") || "[]");
      setSwagWins(Array.isArray(saved) ? saved : []);
    } catch {
      setSwagWins([]);
    } finally {
      setSwagHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!swagHydrated) return;
    localStorage.setItem("wave-machine:swag-wins:v1", JSON.stringify(swagWins));
  }, [swagWins, swagHydrated]);

  // Refresh-safe MVP persistence. Data is isolated per wallet and can later
  // be migrated to Supabase without changing the UI state shape.
  const profileKey = wallet?.address ? `wave-machine:v1:${wallet.address}` : null;

  useEffect(() => {
    setProfileHydrated(false);
    if (!profileKey) {
      setXp(0);
      setCompleted([]);
      setBadges([]);
      setStreak(0);
      setSpinsLeft(3);
      setSpinCount(0);
      return;
    }

    try {
      const saved = JSON.parse(localStorage.getItem(profileKey) || "null");
      setXp(Number.isFinite(saved?.xp) ? saved.xp : 0);
      setCompleted(Array.isArray(saved?.completed) ? saved.completed : []);
      setBadges(Array.isArray(saved?.badges) ? saved.badges : []);
      setStreak(Number.isFinite(saved?.streak) ? saved.streak : 0);
      setSpinsLeft(Number.isFinite(saved?.spinsLeft) ? saved.spinsLeft : 3);
      setSpinCount(Number.isFinite(saved?.spinCount) ? saved.spinCount : 0);
    } catch {
      setXp(0);
      setCompleted([]);
      setBadges([]);
      setStreak(0);
      setSpinsLeft(3);
      setSpinCount(0);
    } finally {
      setProfileHydrated(true);
    }
  }, [profileKey]);

  useEffect(() => {
    if (!profileKey || !profileHydrated) return;
    localStorage.setItem(profileKey, JSON.stringify({
      xp, completed, badges, streak, spinsLeft, spinCount, updatedAt: Date.now(),
    }));
  }, [profileKey, profileHydrated, xp, completed, badges, streak, spinsLeft, spinCount]);

  const [goal, setGoal] = useState(null); // category id or null
  const [spinning, setSpinning] = useState(false);
  const [reelStop, setReelStop] = useState([false, false, false]);
  const [result, setResult] = useState(null); // { category, app } — final, all reels stopped
  const [pending, setPending] = useState(null); // chosen at spin start, revealed per reel
  const [activeMission, setActiveMission] = useState(null); // { app, startedAt }
  const [verifyState, setVerifyState] = useState({ status: "idle", msg: "", hash: "" });
  const [guidedChecks, setGuidedChecks] = useState({});
  const [toast, setToast] = useState(null);

  const [spaceLog, setSpaceLog] = useState(() => loadSpaceLog());
  const [selectedSpaceId, setSelectedSpaceId] = useState(SPACES[0]?.id || "");
  const [pendingCheckIn, setPendingCheckIn] = useState(null);
  const [checkInUi, setCheckInUi] = useState({ status: "idle", msg: "" });
  const [clock, setClock] = useState(Date.now());

  const timeouts = useRef([]);
  useEffect(() => () => timeouts.current.forEach(clearTimeout), []);
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const parsed = parseCheckInFromLocation();
    if (parsed) { setPendingCheckIn(parsed); setView("spaces"); }
  }, []);

  const level = 1 + Math.floor(xp / 150);
  const levelFloor = (level - 1) * 150;
  const levelPct = Math.min(100, Math.round(((xp - levelFloor) / 150) * 100));
  const appsDiscovered = [...new Set(completed.map((c) => c.appId))];
  const currentSwagMonth = monthKey();
  const monthlySwagWinners = swagWins.filter((win) => win.month === currentSwagMonth);
  const walletSwagWins = wallet ? swagWins.filter((win) => win.wallet === wallet.address) : [];
  const latestWalletWin = walletSwagWins.sort((a, b) => b.wonAt - a.wonAt)[0] || null;
  const swagEligibleAgainAt = latestWalletWin ? addCalendarMonths(latestWalletWin.wonAt, swagCooldownMonths) : 0;
  const swagCooldownActive = Boolean(latestWalletWin && Date.now() < swagEligibleAgainAt);
  const verifiedUniqueMissions = completed.filter((c) => c.xp > 0 && !c.simulated && !c.spaceCheckIn).length;
  const swagRequirementsMet = verifiedUniqueMissions >= swagMinUniqueMissions;
  const swagSlotsLeft = Math.max(0, monthlySwagLimit - monthlySwagWinners.length);
  const canClaimSwag = Boolean(wallet && !wallet.demo && swagRequirementsMet && !swagCooldownActive && swagSlotsLeft > 0);

  const notify = (msg, tone = "cyan") => {
    setToast({ msg, tone });
    const t = setTimeout(() => setToast(null), 3500);
    timeouts.current.push(t);
  };

  const awardBadge = (id, list) => (list.includes(id) ? list : [...list, id]);
  const recordSpaceCheckIn = useCallback((space, address, demo = false) => {
    const active = isSpaceActive(space, Date.now());
    const prev = loadSpaceLog();
    const already = hasCheckedIn(prev, space.id, address);
    const entry = { spaceId: space.id, spaceName: space.name, wallet: address, at: Date.now(), activeAtCheckIn: active, credited: active && !already, demo };
    if (!active) return { ok: false, reason: "inactive", entry };
    const next = [entry, ...prev]; setSpaceLog(next); saveSpaceLog(next);
    if (already) return { ok: false, reason: "repeat", entry };
    setXp((x) => x + space.xp); setBadges((b) => awardBadge("xrpswag", b));
    setCompleted((c) => [{ appId: `space:${space.id}`, appName: space.name, title: `Space check-in · ${space.name}`, xp: space.xp, when: Date.now(), hash: `space-${space.id}`, category: "nfts", simulated: demo, spaceCheckIn: true }, ...c]);
    return { ok: true, entry };
  }, []);
  const checkInHandled = useRef(null);
  useEffect(() => {
    if (!pendingCheckIn?.spaceId) return;
    const space = getSpace(pendingCheckIn.spaceId);
    if (!space) { setCheckInUi({ status: "error", msg: "Unknown space — check the QR code." }); return; }
    if (!isSpaceActive(space, clock)) {
      const st = spaceStatus(space, clock);
      setCheckInUi({ status: "inactive", msg: st === "upcoming" ? `This space opens ${formatWindow(space)}.` : `This space closed. Window was ${formatWindow(space)}.` });
      return;
    }
    if (!wallet) { setCheckInUi({ status: "need-wallet", msg: "Link your wallet to log this visit and earn the XRPL Swag stamp." }); return; }
    const key = `${pendingCheckIn.spaceId}:${wallet.address}`;
    if (checkInHandled.current === key) return;
    checkInHandled.current = key;
    const result = recordSpaceCheckIn(space, wallet.address, wallet.demo);
    if (result.ok) { setCheckInUi({ status: "done", msg: `Checked in at ${space.name} — +${space.xp} XP & XRPL Swag badge unlocked.` }); notify("Space check-in logged — XRPL Swag badge earned", "green"); clearCheckInFromUrl(); }
    else if (result.reason === "repeat") { setCheckInUi({ status: "repeat", msg: "You already logged this space on this wallet." }); clearCheckInFromUrl(); }
  }, [pendingCheckIn, wallet, clock, recordSpaceCheckIn]);


  /* ----- Wallet connect (read-only) ----- */
  const connectWallet = async () => {
    setWalletErr("");
    const addr = walletInput.trim();
    if (!isValidAddress(addr)) { setWalletErr("That doesn't look like an XRPL r-address."); return; }
    setWalletBusy(true);
    try {
      await fetchAccountInfo(addr);
      setWallet({ address: addr, demo: false });
      setWalletModal(false);
      notify("Wallet linked — read-only, mainnet verified", "green");
    } catch (e) {
      setWalletErr(e.message || "Could not verify account on mainnet.");
    } finally {
      setWalletBusy(false);
    }
  };

  const connectDemo = () => {
    setWallet({ address: "rDemoWaveMachineExplorer0000", demo: true });
    setWalletModal(false);
    notify("Demo mode — verifications will be simulated", "amber");
  };

  /* ----- Spin ----- */
  const spin = () => {
    if (spinning) return;
    if (!unlimitedSpins && spinsLeft <= 0) { notify("No spins left today — complete a mission to earn one", "amber"); return; }
    if (!unlimitedSpins) setSpinsLeft((s) => s - 1);
    setSpinCount((count) => count + 1);
    setResult(null);
    setVerifyState({ status: "idle", msg: "", hash: "" });
    setSpinning(true);
    setReelStop([false, false, false]);

    const cat = goal ? CATEGORIES.find((c) => c.id === goal) : CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const pool = SPIN_APPS.filter((a) => a.category === cat.id);
    const app = pool[Math.floor(Math.random() * pool.length)];
    const res = { category: cat, app };
    setPending(res);

    const stops = [1100, 1900, 2700];
    stops.forEach((ms, i) => {
      const t = setTimeout(() => {
        setReelStop((prev) => { const n = [...prev]; n[i] = true; return n; });
        if (i === 2) {
          setSpinning(false);
          setResult(res);
        }
      }, ms);
      timeouts.current.push(t);
    });
  };

  
  const startBuiltInMission = (app, mission) => {
    setActiveMission({ app, mission, startedAt: Date.now() });
    setGuidedChecks({});
    setVerifyState({ status: "idle", msg: "", hash: "" });
    setView("mission");
  };

  const handleBugHuntTest = ({ cardId, testTemplate, title, xp, badge, match, jobId, category }) => {
    const dupTemplate = completed.some((c) => c.appId === "bug-hunt" && c.testTemplate === testTemplate);
    const dupCard = completed.some((c) => c.appId === "bug-hunt" && c.title === title);
    const gained = dupTemplate ? 0 : (dupCard ? Math.floor(xp / 2) : xp);
    setCompleted((prev) => [{
      appId: "bug-hunt", appName: "XRPL Bug Hunt", title, testTemplate, cardId, xp: gained,
      when: Date.now(), hash: jobId || "bug-hunt", category: category || "cybersecurity",
      sandbox: true, real: true, match,
    }, ...prev]);
    if (gained > 0) {
      setXp((x) => x + gained);
      setBadges((b) => {
        let n = awardBadge("ledgerExplorer", b);
        n = awardBadge("cybersecurity", n);
        if (badge) n = awardBadge(badge, n);
        const huntCards = [...completed.filter((c) => c.appId === "bug-hunt"), { category }].map((c) => c.cardId || c.title);
        const paymentDone = new Set(huntCards).size;
        if (paymentDone >= 3) n = awardBadge("transactionTester", n);
        const expectedCount = completed.filter((c) => c.appId === "bug-hunt" && c.match).length + (match ? 1 : 0);
        if (expectedCount >= 5) n = awardBadge("invariantGuardian", n);
        return n;
      });
      notify(`+${gained} XP — Bug Hunt: ${title}`, "green");
    } else {
      notify("Same test template already run — no repeat XP (anti-farming)", "amber");
    }
  };

  const handleSecurityLabQuest = ({ xp, badge, title, real, jobId }) => {
    const already = completed.some((c) => c.appId === "security-lab" && c.title === title);
    const gained = already ? 0 : xp;
    setCompleted((prev) => [{
      appId: "security-lab", appName: "Wave Security Lab", title, xp: gained, when: Date.now(),
      hash: jobId || "security-lab-job", category: "cybersecurity", simulated: !real, sandbox: true, real: !!real,
    }, ...prev]);
    if (!already) {
      setXp((x) => x + gained);
      setBadges((b) => { let n = awardBadge("cybersecurity", b); if (badge) n = awardBadge(badge, n); return n; });
      notify(`+${gained} XP — Security Lab job verified (real execution)`, "green");
    } else notify("Quest already completed — no repeat XP", "amber");
  };

const startMission = () => {
    if (!result) return;
    setActiveMission({ app: result.app, startedAt: Date.now() });
    setVerifyState({ status: "idle", msg: "", hash: "" });
    setView("mission");
  };

  /* ----- Verify ----- */
  const verifyMission = async () => {
    if (!activeMission || !wallet) return;
    const m = activeMission.mission || activeMission.app.mission;
    const verifyType = m.verify;
    setVerifyState({ status: "checking", msg: "Verifying…", hash: "" });

    if (verifyType === "guided" || verifyType === "simulation") {
      const required = m.steps?.length || 1;
      const done = Object.values(guidedChecks).filter(Boolean).length;
      if (done < required) {
        setVerifyState({ status: "notfound", msg: `Complete all ${required} checklist items before verifying.`, hash: "" });
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
          msg: `No successful ${verifyType} from your wallet since the mission started. Complete the action, wait for the ledger to close (~4s), then verify again.`,
          hash: "",
        });
      }
    } catch (e) {
      setVerifyState({ status: "error", msg: e.message || "Verification failed — connection issue.", hash: "" });
    }
  };

  const completeMission = (mission, hash, simulated) => {
    const app = mission.app;
    const m = activeMission.mission || app.mission;
    const missionKey = m.id || m.title;
    const already = completed.some((c) => c.appId === app.id && (c.missionId === missionKey || c.title === m.title));
    const gained = already ? 0 : m.xp;

    setCompleted((prev) => [{ appId: app.id, appName: app.name, missionId: missionKey, title: m.title, xp: gained, when: Date.now(), hash, category: m.category || app.category, simulated, sandbox: m.verify === "simulation" }, ...prev]);
    if (!already) {
      setXp((x) => x + gained);
      setSpinsLeft((s) => s + 1);
      setStreak((s) => s + 1);
      setBadges((prev) => {
        let next = awardBadge("firstwave", prev);
        next = awardBadge(m.category || app.category, next);
        if (streak + 1 >= 3) next = awardBadge("streak3", next);
        const uniqueApps = new Set([...completed.map((c) => c.appId), app.id]);
        if (uniqueApps.size >= 5) next = awardBadge("explorer5", next);
        return next;
      });
    }
    setVerifyState({ status: "done", msg: simulated ? "Simulated completion (demo mode)" : "Verified on the XRP Ledger", hash });
    notify(already ? "Mission verified again — no repeat XP (anti-farming)" : `+${gained} XP — mission verified${simulated ? " (simulated)" : " on-chain"}`, already ? "amber" : "green");
  };

  const claimSwag = () => {
    if (!wallet) { setWalletModal(true); return; }
    if (wallet.demo) { notify("Demo wallets cannot claim physical swag", "amber"); return; }
    if (!swagRequirementsMet) { notify(`Complete ${swagMinUniqueMissions} unique verified missions to qualify`, "amber"); return; }
    if (swagCooldownActive) { notify(`This wallet can win again after ${new Date(swagEligibleAgainAt).toLocaleDateString()}`, "amber"); return; }
    if (swagSlotsLeft <= 0) { notify("This month's swag winner limit has been reached", "amber"); return; }

    const win = { wallet: wallet.address, wonAt: Date.now(), month: currentSwagMonth };
    setSwagWins((prev) => [...prev, win]);
    notify("Swag spot secured — fulfillment details can be collected privately", "green");
  };

  /* ----- Derived: next best wave ----- */
  const nextBest = (() => {
    const done = new Set(completed.map((c) => c.category));
    const missing = CATEGORIES.find((c) => !done.has(c.id));
    return missing || null;
  })();

  /* ---------- Render helpers ---------- */
  const renderCatItem = (c) => {
    const Icon = c.icon;
    return (
      <div className="flex flex-col items-center gap-1">
        <Icon size={30} style={{ color: c.color }} />
        <span className="text-xs font-semibold text-slate-200">{c.label}</span>
      </div>
    );
  };
  const renderAppItem = (a) => (
    <div className="flex flex-col items-center gap-1">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg bg-gradient-to-br from-purple-600 to-cyan-500 text-white shadow-[0_0_18px_rgba(120,80,255,0.5)]">{a.glyph}</div>
      <span className="text-xs font-semibold text-slate-200">{a.name}</span>
    </div>
  );
  const renderMissionItem = (a) => (
    <div className="px-2 text-center">
      <Trophy size={22} className="mx-auto mb-1 text-amber-300" />
      <span className="text-[11px] leading-tight text-slate-200 font-medium block">{a.mission.title}</span>
    </div>
  );

  const NavBtn = ({ id, label }) => (
    <button
      onClick={() => setView(id)}
      className={`px-3 py-1.5 rounded-lg text-xs font-mono tracking-wider uppercase transition-colors ${view === id ? "bg-cyan-400/15 text-cyan-300 border border-cyan-400/40" : "text-slate-400 hover:text-slate-200 border border-transparent"}`}
    >{label}</button>
  );

  /* ================= VIEWS ================= */

  const HomeView = (
    <div className="space-y-8">
      {/* HERO + MACHINE */}
      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 items-center">
        <div>
          <div className="text-[10px] font-mono tracking-[0.35em] text-cyan-300/70 uppercase mb-3">XRPL Discovery Console · Mainnet</div>
          <h1 className="text-5xl sm:text-6xl font-black leading-[0.95] tracking-tight">
            <span className="text-white">MAKE A</span><br />
            <span className="bg-gradient-to-r from-cyan-300 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">WAVE</span>
          </h1>
          <p className="mt-4 text-slate-400 max-w-sm">Discover. Explore. Complete. Spin for a live XRPL app and a guided mission, verify it on-chain, and level up your Passport.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={spin}
              disabled={spinning}
              className="px-6 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 shadow-[0_0_30px_rgba(100,60,255,0.45)] disabled:opacity-50 flex items-center gap-2"
            >
              {spinning ? <Loader2 size={18} className="animate-spin" /> : <Waves size={18} />} MAKE A WAVE
            </button>
            <button onClick={() => setView("passport")} className="px-6 py-3 rounded-xl font-semibold text-slate-300 border border-indigo-500/40 hover:border-cyan-400/50 hover:text-cyan-200">
              VIEW MY PASSPORT
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-mono text-slate-500">
            <Eye size={13} /> Read-only · non-custodial · your keys never touch this app
          </div>
          <div className="mt-5">
            <div className="text-[10px] font-mono tracking-[0.25em] text-slate-500 uppercase mb-2">Set a goal (optional)</div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const on = goal === c.id;
                return (
                  <button key={c.id} onClick={() => setGoal(on ? null : c.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition ${on ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-200" : "border-indigo-500/30 text-slate-400 hover:text-slate-200"}`}>
                    <Icon size={13} style={{ color: c.color }} /> {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* SLOT MACHINE */}
        <Panel className="p-6 relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-30" style={{ background: "radial-gradient(ellipse at 50% -10%, rgba(120,80,255,0.35), transparent 60%)" }} />
          <div className="text-center mb-4">
            <div className="inline-block px-5 py-1.5 rounded-full border border-purple-400/40 bg-purple-500/10">
              <span className="font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-fuchsia-400">XRPL WAVE MACHINE</span>
            </div>
          </div>
          <div className="flex justify-center gap-3 sm:gap-5">
            <Reel label="Category" items={CATEGORIES} spinning={spinning && !reelStop[0]} result={reelStop[0] ? pending?.category : result?.category} delayIdx={0} renderItem={renderCatItem} />
            <Reel label="App" items={SPIN_APPS} spinning={spinning && !reelStop[1]} result={reelStop[1] ? pending?.app : result?.app} delayIdx={1} renderItem={renderAppItem} />
            <Reel label="Mission" items={SPIN_APPS} spinning={spinning && !reelStop[2]} result={reelStop[2] ? pending?.app : result?.app} delayIdx={2} renderItem={renderMissionItem} />
          </div>
          <div className="mt-5 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-cyan-400/30 bg-cyan-400/5 text-cyan-300 text-xs font-mono tracking-[0.2em] uppercase">
              <Waves size={14} /> Spin to discover XRPL experiences <Waves size={14} />
            </div>
            <div className="mt-2 text-[11px] font-mono text-slate-500">{unlimitedSpins ? <><span className="text-emerald-300 font-bold">Unlimited spins</span> · development mode</> : <>Spins left today: <span className="text-amber-300 font-bold">{spinsLeft}</span> · earn +1 per verified mission</>}</div>
          </div>

          {result && !spinning && (
            <div className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 wave-reveal">
              <div className="flex-1">
                <div className="text-[10px] font-mono tracking-[0.25em] text-emerald-300 uppercase mb-1">Your Wave</div>
                <div className="text-sm text-slate-200 font-semibold">{result.category.label} → {result.app.name} → {result.app.mission.title}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">{result.app.status.map((s) => <Chip key={s} tone={statusTone(s)}>{s}</Chip>)}</div>
              </div>
              <button onClick={startMission} className="px-4 py-2 rounded-lg font-bold text-sm text-[#06121a] bg-gradient-to-r from-emerald-300 to-cyan-300 flex items-center gap-1.5 shrink-0">
                View mission <ChevronRight size={15} />
              </button>
            </div>
          )}
        </Panel>
      </div>

      
      <Panel className="p-5 border-cyan-500/20">
        <div className="text-[10px] font-mono tracking-[0.3em] text-cyan-300 uppercase mb-3">Help Test the XRP Ledger</div>
        <p className="text-xs text-slate-400 mb-4">XRPL Bug Hunt — citizen science for ledger security. Real Testnet jobs, plain-language results. Not &quot;hack the ledger.&quot;</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setBugHuntMode("explorer"); setView("bug-hunt"); }} className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 text-[#06121a]">
            Run a Beginner Test
          </button>
          <button onClick={() => { setBugHuntMode("describe"); setView("bug-hunt"); }} className="px-4 py-2 rounded-lg text-xs font-bold border border-purple-400/40 text-purple-200">
            Describe Something That Could Go Wrong
          </button>
          <button onClick={() => { setBugHuntMode("community"); setView("bug-hunt"); }} className="px-4 py-2 rounded-lg text-xs font-bold border border-indigo-500/40 text-slate-300">
            Reproduce a Community Finding
          </button>
          <button onClick={() => { setBugHuntMode("researcher"); setView("bug-hunt"); }} className="px-4 py-2 rounded-lg text-xs font-bold border border-emerald-400/40 text-emerald-300">
            Advanced Researcher Mode
          </button>
        </div>
      </Panel>

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
            <div className="text-sm font-bold text-white mb-2">Wave Security Lab</div>
            <p className="text-xs text-slate-400 mb-3">Researcher tools inside Bug Hunt → Advanced mode.</p>
            <button onClick={() => setView("bug-hunt")} className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 text-white">
              Open Bug Hunt
            </button>
          </div>
        </div>
      </Panel>

{/* HOW IT WORKS + NEXT BEST */}
      <div className="grid md:grid-cols-[1.5fr_1fr] gap-6">
        <Panel className="p-5">
          <div className="text-[10px] font-mono tracking-[0.3em] text-slate-500 uppercase mb-4">How it works</div>
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { icon: Zap, t: "Spin", d: "Get a category, app, and mission" },
              { icon: Search, t: "Discover", d: "Learn what the app does" },
              { icon: ArrowRight, t: "Complete", d: "Finish the action in the app" },
              { icon: ShieldCheck, t: "Verify", d: "We check on-chain activity" },
              { icon: Star, t: "Earn", d: "XP, badges, Passport progress" },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className="w-10 h-10 rounded-full border border-indigo-500/40 flex items-center justify-center bg-[#0e0e2a]"><Icon size={16} className="text-cyan-300" /></div>
                  <div className="text-xs font-bold text-slate-200">{s.t}</div>
                  <div className="text-[10px] text-slate-500 leading-tight">{s.d}</div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="text-[10px] font-mono tracking-[0.3em] text-slate-500 uppercase mb-3">Next best wave</div>
          {nextBest ? (
            <div>
              <p className="text-sm text-slate-300">You haven't completed a <span className="font-bold" style={{ color: nextBest.color }}>{nextBest.label}</span> mission yet. Set it as your goal and spin.</p>
              <button onClick={() => { setGoal(nextBest.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="mt-3 px-4 py-2 rounded-lg text-xs font-bold border border-cyan-400/40 text-cyan-300 hover:bg-cyan-400/10">
                Target {nextBest.label}
              </button>
            </div>
          ) : (
            <p className="text-sm text-emerald-300">All {CATEGORIES.length} categories stamped. You're a full-spectrum XRPL explorer.</p>
          )}
          <div className="mt-4 pt-4 border-t border-indigo-500/20">
            <div className="text-[10px] font-mono tracking-[0.3em] text-slate-500 uppercase mb-2">Trust & safety</div>
            <p className="text-[11px] text-slate-500 leading-relaxed">Every app shows its verification status before you start. Spins are free and limited — XRPL Wave Machine is a discovery interface, not a wagering system. Rewards come from verified actions, never random outcomes.</p>
          </div>
        </Panel>
      </div>
    </div>
  );

  const MissionView = activeMission && (() => {
    const app = activeMission.app;
    const m = app.mission;
    const cat = CATEGORIES.find((c) => c.id === app.category);
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <button onClick={() => setView("home")} className="text-xs font-mono text-slate-500 hover:text-cyan-300 flex items-center gap-1"><ChevronRight size={12} className="rotate-180" /> Back to console</button>
        <Panel className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl bg-gradient-to-br from-purple-600 to-cyan-500 text-white shrink-0">{app.glyph}</div>
            <div className="flex-1">
              <div className="text-[10px] font-mono tracking-[0.25em] uppercase" style={{ color: cat.color }}>{cat.label} mission</div>
              <h2 className="text-2xl font-black text-white">{m.title}</h2>
              <p className="text-sm text-slate-400 mt-1">{app.desc}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{app.status.map((s) => <Chip key={s} tone={statusTone(s)}>{s}</Chip>)}{!app.status.includes("Mainnet Activity Verified") && <Chip tone="amber">Not independently audited</Chip>}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { icon: Clock, l: "Est. time", v: m.time },
              { icon: CircleDollarSign, l: "Est. cost", v: m.cost },
              { icon: AlertTriangle, l: "Risk", v: m.risk },
              { icon: Zap, l: "Reward", v: `+${m.xp} XP` },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className="rounded-xl border border-indigo-500/25 bg-[#0e0e2a] p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500"><Icon size={12} /> {f.l}</div>
                  <div className="text-sm font-bold text-slate-200 mt-1">{f.v}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3 text-xs text-amber-200/90 flex gap-2">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" /> <span><span className="font-bold">Before you start:</span> {m.riskNote} XRPL Wave Machine never asks for your keys and never signs anything for you.</span>
          </div>

          <div className="mt-5">
            <div className="text-[10px] font-mono tracking-[0.3em] text-slate-500 uppercase mb-2">Steps</div>
            <ol className="space-y-2">
              {m.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-300">
                  <span className="w-5 h-5 rounded-full border border-cyan-400/40 text-cyan-300 text-[10px] font-mono flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>{s}
                </li>
              ))}
            </ol>
          </div>

          { (m.verify === "guided" || m.verify === "simulation") ? (
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
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {app.url ? (
            <a href={app.url} target="_blank" rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-fuchsia-500 flex items-center gap-2">
              Open {app.name} <ExternalLink size={15} />
            </a>
          ) : (
            <span className="px-5 py-2.5 rounded-xl font-bold text-slate-400 border border-indigo-500/30 text-sm">Built-in utility — no external app</span>
          )}
            <button onClick={verifyMission} disabled={!wallet || verifyState.status === "checking"}
              className="px-5 py-2.5 rounded-xl font-bold text-[#06121a] bg-gradient-to-r from-cyan-300 to-emerald-300 disabled:opacity-40 flex items-center gap-2">
              {verifyState.status === "checking" ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
              {m.verify === "guided" || m.verify === "simulation" ? "Complete mission" : "Verify on-chain"}
            </button>
            {!wallet && <button onClick={() => setWalletModal(true)} className="px-5 py-2.5 rounded-xl font-semibold text-slate-300 border border-indigo-500/40 flex items-center gap-2"><Wallet size={15} /> Link wallet first</button>}
          </div>

          {verifyState.status === "checking" && <div className="mt-4 text-xs font-mono text-cyan-300 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> {verifyState.msg}</div>}
          {verifyState.status === "notfound" && <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-xs text-rose-200 flex gap-2"><XCircle size={15} className="shrink-0 mt-0.5" /> {verifyState.msg}</div>}
          {verifyState.status === "error" && <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-xs text-rose-200 flex gap-2"><XCircle size={15} className="shrink-0 mt-0.5" /> {verifyState.msg}</div>}
          {verifyState.status === "done" && (
            <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-4 wave-reveal">
              <div className="flex items-center gap-2 text-emerald-300 font-bold"><CheckCircle2 size={18} /> You made a wave!</div>
              <div className="text-xs text-slate-300 mt-1">{verifyState.msg}{verifyState.hash && verifyState.hash !== "SIMULATED" ? ` · tx ${String(verifyState.hash).slice(0, 10)}…` : ""}</div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setView("passport")} className="px-4 py-2 rounded-lg text-xs font-bold border border-emerald-400/40 text-emerald-300">View Passport</button>
                <button onClick={() => { setView("home"); setResult(null); }} className="px-4 py-2 rounded-lg text-xs font-bold border border-cyan-400/40 text-cyan-300">Spin again</button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    );
  })();

  const PassportView = (
    <div className="max-w-3xl mx-auto space-y-5">
      <Panel className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="relative w-24 h-24 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#1e1e46" strokeWidth="8" />
              <circle cx="50" cy="50" r="44" fill="none" stroke="url(#lvlgrad)" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${(levelPct / 100) * 276} 276`} />
              <defs><linearGradient id="lvlgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#a855f7" /></linearGradient></defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white">{level}</span>
              <span className="text-[8px] font-mono tracking-widest text-slate-500 uppercase">Level</span>
            </div>
          </div>
          <div className="flex-1 w-full">
            <div className="text-[10px] font-mono tracking-[0.3em] text-cyan-300/70 uppercase">XRPL Passport</div>
            <div className="text-xl font-black text-white">{wallet ? shortAddr(wallet.address) : "No wallet linked"} {wallet?.demo && <Chip tone="amber">Demo</Chip>}</div>
            <div className="mt-2 h-2 rounded-full bg-[#15153a] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all" style={{ width: `${levelPct}%` }} />
            </div>
            <div className="text-[11px] font-mono text-slate-500 mt-1">{xp} XP · {150 - (xp - levelFloor)} to level {level + 1}</div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3 mt-5 text-center">
          {[
            { l: "Missions", v: completed.filter(c => c.xp > 0).length },
            { l: "Apps", v: appsDiscovered.length },
            { l: "Categories", v: new Set(completed.map(c => c.category)).size },
            { l: "Streak", v: streak, flame: true },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border border-indigo-500/25 bg-[#0e0e2a] py-3">
              <div className="text-xl font-black text-white flex items-center justify-center gap-1">{s.v}{s.flame && s.v > 0 && <Flame size={15} className="text-orange-400" />}</div>
              <div className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">{s.l}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl border border-amber-400/40 bg-amber-400/10 flex items-center justify-center shrink-0">
            <Gift size={22} className="text-amber-300" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-mono tracking-[0.3em] text-amber-300/80 uppercase">Monthly swag</div>
            <div className="text-lg font-black text-white">{swagSlotsLeft} of {monthlySwagLimit} winner spots remaining</div>
            <p className="text-xs text-slate-400 mt-1">Complete {swagMinUniqueMissions} unique, non-demo verified missions. A winning wallet cannot win again for {swagCooldownMonths} months.</p>
            {swagCooldownActive && (
              <div className="mt-2 text-[11px] font-mono text-amber-300">This wallet is on cooldown until {new Date(swagEligibleAgainAt).toLocaleDateString()}.</div>
            )}
            {!swagRequirementsMet && (
              <div className="mt-2 text-[11px] font-mono text-cyan-300">Progress: {verifiedUniqueMissions}/{swagMinUniqueMissions} qualifying missions.</div>
            )}
          </div>
          <button
            onClick={claimSwag}
            disabled={!canClaimSwag}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-300 to-orange-400 text-[#1a0c03] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {swagCooldownActive ? "Cooldown active" : swagSlotsLeft <= 0 ? "Month full" : "Claim swag spot"}
          </button>
        </div>
        <p className="text-[10px] font-mono text-slate-600 mt-3">Development storage only. Production enforcement must run server-side so users cannot reset or alter winner records.</p>
      </Panel>

      <Panel className="p-6">
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

      <Panel className="p-6">
        <div className="text-[10px] font-mono tracking-[0.3em] text-slate-500 uppercase mb-3">Badges</div>
        {badges.length === 0 ? (
          <p className="text-sm text-slate-500">No badges yet. Complete your first mission to earn the <span className="text-cyan-300 font-semibold">First Wave</span> badge.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {badges.map((b) => {
              const def = BADGE_DEFS[b]; if (!def) return null; const Icon = def.icon;
              return (
                <div key={b} className="flex flex-col items-center gap-1.5 w-20">
                  <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center" style={{ borderColor: def.color, boxShadow: `0 0 16px ${def.color}55` }}>
                    <Icon size={18} style={{ color: def.color }} />
                  </div>
                  <span className="text-[9px] font-mono text-slate-400 text-center leading-tight">{def.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel className="p-6">
        <div className="text-[10px] font-mono tracking-[0.3em] text-slate-500 uppercase mb-3">Recent waves</div>
        {completed.length === 0 ? <p className="text-sm text-slate-500">Your verified activity will appear here.</p> : (
          <div className="space-y-2">
            {completed.slice(0, 8).map((c, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-indigo-500/20 bg-[#0e0e2a] px-3 py-2.5">
                <CheckCircle2 size={16} className={c.simulated ? "text-amber-300" : "text-emerald-300"} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200 font-semibold truncate">{c.title}</div>
                  <div className="text-[10px] font-mono text-slate-500">{c.appName} · {new Date(c.when).toLocaleTimeString()} {c.simulated && "· simulated"}</div>
                </div>
                <span className="text-xs font-bold text-amber-300 shrink-0">{c.xp > 0 ? `+${c.xp} XP` : "repeat"}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );

  const LeaderboardView = (() => {
    const you = wallet ? { addr: shortAddr(wallet.address) + (wallet.demo ? " (you·demo)" : " (you)"), xp, missions: completed.filter(c=>c.xp>0).length, apps: appsDiscovered.length, you: true } : null;
    const rows = [...MOCK_LEADERS, ...(you ? [you] : [])].sort((a, b) => b.xp - a.xp);
    return (
      <div className="max-w-2xl mx-auto">
        <Panel className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] font-mono tracking-[0.3em] text-slate-500 uppercase">Weekly leaderboard</div>
            <Chip tone="slate">Ranked by unique verified missions — not volume</Chip>
          </div>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${r.you ? "border-cyan-400/50 bg-cyan-400/10" : "border-indigo-500/20 bg-[#0e0e2a]"}`}>
                <span className={`w-7 text-center font-black ${i === 0 ? "text-amber-300" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-400" : "text-slate-600"}`}>{i + 1}</span>
                <span className="flex-1 font-mono text-sm text-slate-200">{r.addr}</span>
                <span className="text-[11px] font-mono text-slate-500 hidden sm:block">{r.missions} missions · {r.apps} apps</span>
                <span className="font-bold text-cyan-300 text-sm">{r.xp} XP</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] font-mono text-slate-600 mt-4">Repeat completions of the same mission earn no XP. Wallet-level rate limits apply. Sybil patterns are flagged and excluded.</p>
        </Panel>
      </div>
    );
  })();

  const AppsView = (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] font-mono tracking-[0.3em] text-slate-500 uppercase">Live apps · {SPIN_APPS.length}</div>
        <div className="flex gap-1.5 flex-wrap">{["Mainnet Activity Verified","Developer Verified","Community Submitted"].map(s => <Chip key={s} tone={statusTone(s)}>{s}</Chip>)}</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {SPIN_APPS.map((a) => {
          const cat = CATEGORIES.find((c) => c.id === a.category);
          return (
            <Panel key={a.id} className="p-4 hover:border-cyan-400/40 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg bg-gradient-to-br from-purple-600 to-cyan-500 text-white shrink-0">{a.glyph}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="font-bold text-white">{a.name}</span><span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: cat.color }}>{cat.label}</span></div>
                  <p className="text-xs text-slate-400 mt-0.5">{a.desc}</p>
                  <div className="mt-2 flex flex-wrap gap-1">{a.status.map((s) => <Chip key={s} tone={statusTone(s)}>{s}</Chip>)}</div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">Mission: {a.mission.title} · +{a.mission.xp} XP</span>
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:text-cyan-200"><ExternalLink size={14} /></a>
                  </div>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );


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
                <button key={sp.id} onClick={() => setSelectedSpaceId(sp.id)} className={`w-full text-left rounded-xl border px-4 py-3 transition ${on ? "border-cyan-400/50 bg-cyan-400/10" : "border-indigo-500/25 bg-[#0e0e2a]"}`}>
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

  const [devForm, setDevForm] = useState({ name: "", url: "", category: "payments", desc: "", mission: "", verify: "Payment", contact: "" });
  const [devSubmitted, setDevSubmitted] = useState([]);
  const submitDevApp = () => {
    if (!devForm.name || !devForm.url) { notify("App name and URL are required", "red"); return; }
    setDevSubmitted((p) => [{ ...devForm, when: Date.now() }, ...p]);
    setDevForm({ name: "", url: "", category: "payments", desc: "", mission: "", verify: "Payment", contact: "" });
    notify("Submitted for manual review — Community Submitted status pending", "green");
  };

  const DevView = (
    <div className="max-w-4xl mx-auto grid lg:grid-cols-2 gap-6">
      <Panel className="p-6">
        <div className="text-[10px] font-mono tracking-[0.3em] text-slate-500 uppercase mb-1">Developer portal</div>
        <h3 className="text-xl font-black text-white mb-1">Build on XRPL. Get discovered.</h3>
        <p className="text-xs text-slate-400 mb-4">Submit your app and a beginner mission. Submissions are manually reviewed and launch with Community Submitted status until verified.</p>
        <div className="space-y-3">
          <input value={devForm.name} onChange={(e) => setDevForm({ ...devForm, name: e.target.value })} placeholder="App name"
            className="w-full rounded-lg bg-[#0e0e2a] border border-indigo-500/30 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-400/60 outline-none" />
          <input value={devForm.url} onChange={(e) => setDevForm({ ...devForm, url: e.target.value })} placeholder="https://your-app.example"
            className="w-full rounded-lg bg-[#0e0e2a] border border-indigo-500/30 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-400/60 outline-none" />
          <div className="grid grid-cols-2 gap-3">
            <select value={devForm.category} onChange={(e) => setDevForm({ ...devForm, category: e.target.value })}
              className="rounded-lg bg-[#0e0e2a] border border-indigo-500/30 px-3 py-2 text-sm text-slate-300 outline-none">
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select value={devForm.verify} onChange={(e) => setDevForm({ ...devForm, verify: e.target.value })}
              className="rounded-lg bg-[#0e0e2a] border border-indigo-500/30 px-3 py-2 text-sm text-slate-300 outline-none">
              {["Payment", "TrustSet", "OfferCreate", "AMMDeposit", "NFTokenMint", "NFTokenAcceptOffer", "AccountSet"].map((v) => <option key={v}>{v}</option>)}
            </select>
          </div>
          <textarea value={devForm.desc} onChange={(e) => setDevForm({ ...devForm, desc: e.target.value })} placeholder="What does your app do? (one or two sentences)" rows={2}
            className="w-full rounded-lg bg-[#0e0e2a] border border-indigo-500/30 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-400/60 outline-none" />
          <textarea value={devForm.mission} onChange={(e) => setDevForm({ ...devForm, mission: e.target.value })} placeholder="Beginner mission idea (what should a new user do?)" rows={2}
            className="w-full rounded-lg bg-[#0e0e2a] border border-indigo-500/30 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-400/60 outline-none" />
          <input value={devForm.contact} onChange={(e) => setDevForm({ ...devForm, contact: e.target.value })} placeholder="Contact email"
            className="w-full rounded-lg bg-[#0e0e2a] border border-indigo-500/30 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:border-cyan-400/60 outline-none" />
          <button onClick={submitDevApp} className="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-cyan-500">Submit your app</button>
          {devSubmitted.length > 0 && <div className="text-[11px] font-mono text-emerald-300">{devSubmitted.length} submission{devSubmitted.length > 1 ? "s" : ""} in review queue</div>}
        </div>
      </Panel>
      <Panel className="p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-mono tracking-[0.3em] text-slate-500 uppercase">Live session analytics</div>
          <Chip tone="cyan">This browser session</Chip>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { l: "Spins", v: spinCount },
            { l: "Missions started", v: activeMission ? 1 : 0 },
            { l: "Missions verified", v: completed.length },
            { l: "Completion rate", v: completed.length ? "100%" : "—" },
            { l: "Apps reached", v: appsDiscovered.length },
            { l: "Repeat attempts", v: completed.filter(c => c.xp === 0).length },
          ].map((s, i) => (
            <div key={i} className="rounded-xl border border-indigo-500/25 bg-[#0e0e2a] p-3">
              <div className="text-lg font-black text-white">{s.v}</div>
              <div className="text-[9px] font-mono tracking-widest text-slate-500 uppercase">{s.l}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] font-mono text-slate-600 mt-4 leading-relaxed">Production analytics track impressions, funnel conversion, 7/30-day return rates, and drop-off points per mission — the metrics that prove real adoption, not raw transaction counts.</p>
      </Panel>
    </div>
  );

  /* ================= LAYOUT ================= */
  return (
    <div className="min-h-screen text-slate-100" style={{ background: "radial-gradient(ellipse at 20% -10%, #131338 0%, #060614 45%), #060614", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        @keyframes wave-reel { from { transform: translateY(0); } to { transform: translateY(-33.33%); } }
        .wave-reel-strip { animation: wave-reel 0.35s linear infinite; }
        @keyframes wave-settle { 0% { transform: translateY(-14px); opacity: 0.4; } 60% { transform: translateY(4px); } 100% { transform: translateY(0); opacity: 1; } }
        .wave-reel-settle { animation: wave-settle 0.4s ease-out; }
        @keyframes wave-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .wave-reveal { animation: wave-in 0.35s ease-out; }
        @media (prefers-reduced-motion: reduce) { .wave-reel-strip, .wave-reel-settle, .wave-reveal { animation: none !important; } }
      `}</style>

      {/* NAV */}
      <header className="sticky top-0 z-40 border-b border-indigo-500/20 bg-[#060614]/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setView("home")} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center shadow-[0_0_16px_rgba(80,160,255,0.5)]"><Waves size={16} className="text-white" /></div>
            <div className="leading-none text-left">
              <div className="font-black tracking-wider text-white text-sm">XRPL WAVE</div>
              <div className="text-[8px] font-mono tracking-[0.4em] text-slate-500">MACHINE</div>
            </div>
          </button>
          <nav className="hidden md:flex gap-1 ml-4">
            <NavBtn id="home" label="Discover" />
            <NavBtn id="passport" label="Passport" />
            <NavBtn id="leaderboard" label="Leaderboard" />
            <NavBtn id="apps" label="Apps" />
            <NavBtn id="spaces" label="Spaces" />
            <NavBtn id="bug-hunt" label="Bug Hunt" />
            <NavBtn id="developers" label="Developers" />
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-400/30 bg-amber-400/5 text-amber-300 text-xs font-bold"><Zap size={13} /> {xp} XP</span>
            {wallet ? (
              <button onClick={() => setWalletModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-400/40 bg-purple-500/10 text-purple-200 text-xs font-mono">
                <Wallet size={13} /> {shortAddr(wallet.address)}{wallet.demo && " ·demo"}
              </button>
            ) : (
              <button onClick={() => setWalletModal(true)} className="px-3 py-1.5 rounded-lg font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-cyan-500">Link wallet</button>
            )}
          </div>
        </div>
        <div className="md:hidden max-w-6xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          <NavBtn id="home" label="Discover" /><NavBtn id="passport" label="Passport" /><NavBtn id="leaderboard" label="Ranks" /><NavBtn id="apps" label="Apps" /><NavBtn id="spaces" label="Spaces" /><NavBtn id="bug-hunt" label="Hunt" /><NavBtn id="developers" label="Devs" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {view === "home" && HomeView}
        {view === "mission" && (MissionView || HomeView)}
        {view === "passport" && PassportView}
        {view === "leaderboard" && LeaderboardView}
        {view === "apps" && AppsView}
        {view === "spaces" && SpacesView}
        {view === "bug-hunt" && (
          <BugHuntView wallet={wallet} initialMode={bugHuntMode} onTestComplete={handleBugHuntTest} onQuestComplete={handleSecurityLabQuest} />
        )}
        {view === "security-lab" && (
          <SecurityLabView wallet={wallet} onQuestComplete={handleSecurityLabQuest} />
        )}
        {view === "developers" && DevView}
      </main>

      <footer className="border-t border-indigo-500/20 py-6 mt-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
          <div className="text-[10px] font-mono tracking-[0.25em] text-slate-600 uppercase flex items-center gap-2"><Lock size={11} /> Read-only · non-custodial · powered by the XRP Ledger</div>
          <div className="text-[10px] font-mono text-slate-600">Not a wagering system. Spins are free and limited. Rewards require verified actions.</div>
        </div>
      </footer>

      {/* WALLET MODAL */}
      {walletModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setWalletModal(false)}>
          <Panel className="p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-black text-white text-lg">Link your XRPL wallet</h3>
                <button onClick={() => setWalletModal(false)} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
              </div>
              <p className="text-xs text-slate-400 mb-4">XRPL Wave Machine reads only your public mainnet history to verify missions — it can never move funds or sign anything.</p>

              {xaman.available ? (
                <button onClick={xaman.signIn} disabled={xaman.connecting}
                  className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-500 disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(40,120,255,0.35)]">
                  {xaman.connecting
                    ? <><Loader2 size={16} className="animate-spin" /> Waiting for Xaman — approve on your phone…</>
                    : <><QrCode size={16} /> Sign in with Xaman (scan QR)</>}
                </button>
              ) : (
                <div className="w-full py-3 rounded-xl border border-indigo-500/30 bg-[#0e0e2a] text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <QrCode size={14} /> Xaman QR sign-in — add VITE_XAMAN_API_KEY to .env to enable
                </div>
              )}
              {xaman.error && <div className="mt-2 text-xs text-rose-300 flex items-center gap-1.5"><XCircle size={13} /> {xaman.error}</div>}

              <div className="flex items-center gap-3 my-4"><div className="flex-1 h-px bg-indigo-500/20" /><span className="text-[10px] font-mono text-slate-600 uppercase">or enter an r-address (read-only)</span><div className="flex-1 h-px bg-indigo-500/20" /></div>
              <input
                value={walletInput} onChange={(e) => setWalletInput(e.target.value)}
                placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="w-full rounded-lg bg-[#0e0e2a] border border-indigo-500/30 px-3 py-2.5 text-sm font-mono text-slate-200 placeholder-slate-600 focus:border-cyan-400/60 outline-none"
              />
              {walletErr && <div className="mt-2 text-xs text-rose-300 flex items-center gap-1.5"><XCircle size={13} /> {walletErr}</div>}
              <button onClick={connectWallet} disabled={walletBusy}
                className="mt-4 w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-cyan-500 disabled:opacity-50 flex items-center justify-center gap-2">
                {walletBusy ? <><Loader2 size={15} className="animate-spin" /> Verifying on mainnet…</> : <><BadgeCheck size={15} /> Verify & link</>}
              </button>
              <div className="flex items-center gap-3 my-4"><div className="flex-1 h-px bg-indigo-500/20" /><span className="text-[10px] font-mono text-slate-600 uppercase">or</span><div className="flex-1 h-px bg-indigo-500/20" /></div>
              <button onClick={connectDemo} className="w-full py-2.5 rounded-xl font-semibold text-sm text-slate-300 border border-indigo-500/40 hover:border-amber-400/50 hover:text-amber-200">
                Explore in demo mode (simulated verification)
              </button>
              {wallet && (
                <button onClick={() => { if (wallet.viaXaman) xaman.signOut(); setWallet(null); setWalletModal(false); notify("Wallet unlinked", "slate"); }} className="mt-3 w-full py-2 rounded-xl text-xs text-rose-300/80 hover:text-rose-300 border border-rose-400/20">
                  Unlink current wallet
                </button>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 wave-reveal">
          <div className={`px-4 py-2.5 rounded-xl border text-sm font-semibold shadow-xl ${
            toast.tone === "green" ? "border-emerald-400/50 bg-[#06231a] text-emerald-200" :
            toast.tone === "amber" ? "border-amber-400/50 bg-[#231c06] text-amber-200" :
            toast.tone === "red" ? "border-rose-400/50 bg-[#230a10] text-rose-200" :
            "border-cyan-400/50 bg-[#062026] text-cyan-200"}`}>{toast.msg}</div>
        </div>
      )}
    </div>
  );
}
