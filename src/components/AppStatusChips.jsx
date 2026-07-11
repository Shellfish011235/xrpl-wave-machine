import { lifecycleLabel, lifecycleTone, trustTone } from "../data/appStatus";

const Chip = ({ children, tone = "cyan" }) => {
  const tones = {
    cyan: "border-cyan-400/40 text-cyan-300 bg-cyan-400/10",
    purple: "border-purple-400/40 text-purple-300 bg-purple-400/10",
    green: "border-emerald-400/40 text-emerald-300 bg-emerald-400/10",
    amber: "border-amber-400/40 text-amber-300 bg-amber-400/10",
    red: "border-rose-400/40 text-rose-300 bg-rose-400/10",
    slate: "border-slate-500/40 text-slate-300 bg-slate-500/10",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono tracking-wide uppercase ${tones[tone]}`}>
      {children}
    </span>
  );
};

/** Lifecycle status chip + optional trust signals for an app record. */
export function AppStatusChips({ app, showAuditWarning = false, className = "" }) {
  const trust = app.trust || [];
  const showWarning = showAuditWarning && !trust.includes("Mainnet Activity Verified");

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      <Chip tone={lifecycleTone(app.status)}>{lifecycleLabel(app.status)}</Chip>
      {trust.map((signal) => (
        <Chip key={signal} tone={trustTone(signal)}>{signal}</Chip>
      ))}
      {showWarning && <Chip tone="amber">Not independently audited</Chip>}
    </div>
  );
}

export { Chip };
