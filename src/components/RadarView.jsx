import { ExternalLink, Radio, AlertTriangle } from "lucide-react";
import { CATEGORIES, RADAR_APPS } from "../data/ecosystem";
import { APP_LIFECYCLE_LABELS } from "../data/appStatus";
import { AppStatusChips } from "./AppStatusChips";

const Panel = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-indigo-500/25 bg-[#0b0b22]/90 shadow-[0_0_40px_rgba(60,40,160,0.12)] ${className}`}>
    {children}
  </div>
);

export default function RadarView() {
  const byStatus = Object.keys(APP_LIFECYCLE_LABELS).reduce((acc, key) => {
    acc[key] = RADAR_APPS.filter((a) => a.status === key);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Panel className="p-6 border-fuchsia-400/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-500/15 border border-fuchsia-400/30 flex items-center justify-center shrink-0">
            <Radio size={18} className="text-fuchsia-300" />
          </div>
          <div>
            <div className="text-[10px] font-mono tracking-[0.3em] text-fuchsia-300 uppercase">XRPL Radar</div>
            <h2 className="text-xl font-black text-white mt-0.5">Apps outside the spin pool</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-2xl">
              Radar tracks buildathon projects, testnet tools, and apps awaiting review. These entries are clearly labeled and
              <span className="text-fuchsia-200 font-semibold"> never appear in the public spinner</span> — only
              <span className="text-emerald-300 font-semibold"> Verified Live</span> apps spin.
            </p>
          </div>
        </div>
      </Panel>

      <div className="flex flex-wrap gap-1.5">
        {Object.entries(APP_LIFECYCLE_LABELS)
          .filter(([key]) => key !== "verified-live")
          .map(([key, label]) => (
            <span key={key} className="text-[10px] font-mono tracking-wide uppercase text-slate-500 border border-indigo-500/25 rounded-full px-2 py-0.5">
              {label} · {byStatus[key]?.length || 0}
            </span>
          ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {RADAR_APPS.map((app) => {
          const cat = CATEGORIES.find((c) => c.id === app.category);
          const isStub = app.radarStub || !app.mission;

          return (
            <Panel key={app.id} className="p-4 border-fuchsia-500/15 hover:border-fuchsia-400/35 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg bg-gradient-to-br from-fuchsia-700/80 to-indigo-600/80 text-white shrink-0 border border-fuchsia-400/20">
                  {app.glyph}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">{app.name}</span>
                    {cat && (
                      <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: cat.color }}>
                        {cat.label}
                      </span>
                    )}
                    {app.buildathon && (
                      <span className="text-[9px] font-mono uppercase tracking-wider text-fuchsia-300 border border-fuchsia-400/30 rounded px-1.5 py-0.5">
                        Buildathon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{app.desc}</p>
                  <AppStatusChips app={app} className="mt-2" />
                  {app.radarNote && (
                    <p className="mt-2 text-[10px] font-mono text-slate-500 flex items-start gap-1.5">
                      <AlertTriangle size={11} className="shrink-0 mt-0.5 text-amber-400" />
                      {app.radarNote}
                    </p>
                  )}
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {isStub ? "Not in spin pool · preview only" : app.mission ? `Mission: ${app.mission.title}` : "No mission yet"}
                    </span>
                    {app.url ? (
                      <a href={app.url} target="_blank" rel="noopener noreferrer" className="text-fuchsia-300 hover:text-fuchsia-200 shrink-0">
                        <ExternalLink size={14} />
                      </a>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-600 uppercase">No URL</span>
                    )}
                  </div>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      {RADAR_APPS.length === 0 && (
        <Panel className="p-8 text-center">
          <p className="text-sm text-slate-500">No radar entries yet. Developer submissions awaiting review will appear here.</p>
        </Panel>
      )}
    </div>
  );
}
