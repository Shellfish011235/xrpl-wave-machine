import { readFileSync, writeFileSync } from "node:fs";

const appPath = "c:/Users/anamb/Downloads/xrpl-wave-machine-run/src/App.jsx";
let s = readFileSync(appPath, "utf8");

s = s.replace(
  `  const handleSecurityLabQuest = ({ xp, badge, title }) => {
    const missionKey = "security-lab:amendment-test-quest";
    const already = completed.some((c) => c.appId === "security-lab" && c.title === title);
    const gained = already ? 0 : xp;
    setCompleted((prev) => [{ appId: "security-lab", appName: "XRPL Security Lab", title, xp: gained, when: Date.now(), hash: "sandbox-quest", category: "cybersecurity", simulated: true, sandbox: true }, ...prev]);
    if (!already) {
      setXp((x) => x + gained);
      setBadges((b) => { let n = awardBadge("cybersecurity", b); if (badge) n = awardBadge(badge, n); return n; });
      notify(\`+\${gained} XP — Security Researcher quest complete (sandbox)\`, "green");
    } else notify("Quest already completed — no repeat XP", "amber");
  };`,
  `  const handleSecurityLabQuest = ({ xp, badge, title, real, jobId }) => {
    const already = completed.some((c) => c.appId === "security-lab" && c.title === title);
    const gained = already ? 0 : xp;
    setCompleted((prev) => [{
      appId: "security-lab", appName: "Wave Security Lab", title, xp: gained, when: Date.now(),
      hash: jobId || "security-lab-job", category: "cybersecurity", simulated: !real, sandbox: true, real: !!real,
    }, ...prev]);
    if (!already) {
      setXp((x) => x + gained);
      setBadges((b) => { let n = awardBadge("cybersecurity", b); if (badge) n = awardBadge(badge, n); return n; });
      notify(\`+\${gained} XP — Security Lab job verified (real execution)\`, "green");
    } else notify("Quest already completed — no repeat XP", "amber");
  };`
);

s = s.replace(
  `<div className="text-sm font-bold text-white mb-2">XRPL Security Lab</div>`,
  `<div className="text-sm font-bold text-white mb-2">Wave Security Lab</div>
            <p className="text-xs text-slate-400 mb-3">Authorized differential testing on isolated xrpld — real jobs, never Mainnet.</p>`
);

writeFileSync(appPath, s);
console.log("patched App.jsx");
