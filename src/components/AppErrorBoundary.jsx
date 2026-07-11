import React from "react";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[Wave Machine] Uncaught render error:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="min-h-screen bg-[#060614] text-slate-100 px-6 py-16 font-sans">
        <div className="max-w-2xl mx-auto rounded-2xl border border-rose-400/30 bg-[#0b0b22] p-6 shadow-2xl">
          <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-rose-300">
            Startup error
          </div>
          <h1 className="mt-2 text-2xl font-black text-white">
            XRPL Wave Machine could not finish loading
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            The background loaded, but a React component crashed. This screen keeps the actual error visible instead of leaving a blank page.
          </p>
          <pre className="mt-4 overflow-auto rounded-xl border border-rose-400/20 bg-black/30 p-4 text-xs text-rose-200 whitespace-pre-wrap">
            {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-4 py-2 text-sm font-bold text-white"
          >
            Reload application
          </button>
        </div>
      </main>
    );
  }
}
