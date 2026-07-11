/**
 * Wave Security Lab — authorized XRPL vulnerability research platform.
 * NEVER targets Mainnet or third-party production systems.
 */

export const LAB_SECTIONS = [
  { id: "learn", label: "Learn", desc: "Policy, Testnet vs Mainnet, XRPLF scope" },
  { id: "branch-diff", label: "Branch Differential Tester", desc: "Compare rippled commits in isolated Docker", available: true },
  { id: "testnet-proof", label: "Testnet Proof", desc: "Real authorized Testnet transaction (no Docker)", available: true },
  { id: "compare", label: "Compare Versions", desc: "Differential testing tracks", scaffold: true },
  { id: "proposal", label: "Inspect an Open Proposal", desc: "Amendment proposal review", scaffold: true },
  { id: "reproduce", label: "Reproduce a Known Bug", desc: "Guided reproduction tracks", scaffold: true },
  { id: "report", label: "Build a Report", desc: "Responsible Disclosure Gate", available: true },
  { id: "bounty", label: "Bug Bounty Access", desc: "Official channels — no payment promises", available: true },
];

export const REPOSITORY_OPTIONS = [
  {
    id: "XRPLF/rippled",
    label: "XRPLF/rippled",
    url: "https://github.com/XRPLF/rippled",
    available: true,
    defaultBaseline: "2.3.0",
    defaultCandidate: "2.4.0",
  },
  {
    id: "XRPLF/clio",
    label: "XRPLF/clio",
    url: "https://github.com/XRPLF/clio",
    available: false,
    note: "Clio differential testing — Docker scaffold coming soon",
  },
  {
    id: "XRPLF/xrpl.js",
    label: "XRPLF/xrpl.js",
    url: "https://github.com/XRPLF/xrpl.js",
    available: false,
    note: "Library fuzz tracks — coming soon",
  },
];

export const JOB_TYPES = {
  branch_diff: {
    id: "branch_diff",
    label: "Branch Differential Test",
    requiresDocker: true,
    description: "Build two isolated standalone xrpld instances and compare engine results + ledger behavior.",
  },
  testnet_proof: {
    id: "testnet_proof",
    label: "Testnet Proof",
    requiresDocker: false,
    description: "Fund via public Testnet faucet and submit one real Payment — proves non-simulation JSON-RPC path.",
  },
};

export const TEST_SCENARIOS = [
  { id: "payment_edge_cases", label: "Payment edge cases", desc: "RPC probes + malformed account lookups" },
  { id: "amendment_flags", label: "Amendment flag matrix", desc: "Compare behavior with amendment toggles (future)" },
  { id: "invariant_suite", label: "Invariant suite", desc: "Ledger monotonicity + engine class checks" },
];

export const TX_MUTATIONS = [
  { id: "none", label: "None (baseline probes)" },
  { id: "high_fee", label: "High fee context" },
  { id: "bad_sequence", label: "Bad sequence (future)" },
  { id: "invalid_dest", label: "Invalid destination (future)" },
];

export const AMENDMENT_FLAGS = [
  { id: "fixTokenEscrowV1", label: "fixTokenEscrowV1", default: false },
  { id: "fixAMMOverflowOffer", label: "fixAMMOverflowOffer", default: false },
  { id: "fixPreviousTxnID", label: "fixPreviousTxnID", default: false },
];

export const DISCLOSURE_CHECKLIST = [
  "I tested only on Testnet, Devnet, or isolated Docker standalone — never Mainnet.",
  "I did not test third-party production systems without written authorization.",
  "I did not perform disruptive testing, DDoS, spam, or social engineering.",
  "I will report validated issues through Ripple's private bug bounty program (request access via bugs@ripple.com).",
  "I understand Wave Machine makes no payment guarantee and will not auto-submit reports.",
  "I reviewed AI-assisted report drafts before sharing — no autonomous disclosure.",
];

export const REPORT_TEMPLATE = `## XRPL Security Test Report (Draft)

**Target:** {{target}}
**Environment:** Docker standalone / Testnet (never Mainnet)
**Date:** {{date}}

### Summary
{{summary}}

### Steps to reproduce
1. {{step1}}
2. {{step2}}

### Expected behavior
{{expected}}

### Observed behavior
{{observed}}

### Impact assessment
{{impact}}

### Responsible disclosure
Request access via bugs@ripple.com, then submit through the private Bugcrowd program once invited — not public until coordinated.
`;

export const SKILL_TRACKS = [
  { id: "beginner", label: "Beginner", desc: "Learn policy + run Testnet proof" },
  { id: "intermediate", label: "Intermediate", desc: "Branch differential tests in Docker" },
  { id: "advanced", label: "Advanced", desc: "Stateful fuzzing + invariant suites (future)" },
];

export const BOUNTY_INFO = {
  program: "Ripple XRP Ledger Managed Bug Bounty Program",
  scope: "xrpld, Clio, xrpl.js, xrpl-py, xrpl4j",
  email: "bugs@ripple.com",
  policyUrl: "https://ripple.com/legal/bug-bounty/",
  securityPolicyUrl: "https://github.com/XRPLF/rippled/blob/develop/SECURITY.md",
  platform: "Bugcrowd (private, invitation only)",
  note: "Private invitation-only programs managed via Bugcrowd. There is no public Bugcrowd signup page — request access by emailing bugs@ripple.com with your Bugcrowd handle. Wave Machine does not promise payment per quest and never auto-submits reports.",
  accessSteps: [
    "Create a Bugcrowd account if you do not already have one.",
    "Email bugs@ripple.com with your Bugcrowd handle or registered email.",
    "Request the Ripple XRP Ledger Managed Bug Bounty Program (xrpld, Clio, xrpl.js, xrpl-py, xrpl4j).",
    "After invitation, submit vulnerability reports through Bugcrowd — not by email.",
  ],
};

export const LEARN_CONTENT = {
  policy: [
    "Wave Security Lab is an authorized vulnerability research platform — not a hacking game or training demo.",
    "Builds and tests XRPL open-source components in disposable isolated environments only.",
    "Never test Mainnet, public rippled clusters, or third-party production apps without permission.",
  ],
  xrplf: [
    "No disruptive testing, DDoS, spam, or social engineering.",
    "Follow coordinated disclosure — do not publish vulnerabilities before fix.",
    "AI assists with diff analysis, test suggestions, and report drafts — you review; no auto-disclose.",
  ],
  testnetVsMainnet: [
    "Mainnet = real value. Wave Machine mission verification reads Mainnet history only for live app missions.",
    "Security Lab jobs hit Testnet or isolated Docker standalone nodes — never Mainnet.",
    "Branch differential tester requires Docker locally; Testnet proof works without Docker via the job API.",
  ],
  components: [
    "xrpld — C++ ledger node (primary differential target)",
    "Clio — read API (future Docker target)",
    "xrpl.js / xrpl-py / xrpl4j — client libraries (future fuzz tracks)",
  ],
};

/** Offline preview only — NOT used for quest completion */
export const OFFLINE_PREVIEW_NOTE =
  "Offline preview removed as primary path. All quest completion requires real job results from the Security Lab API.";
