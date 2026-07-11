/** App lifecycle status — only verified-live apps enter the public spin pool. */
export const APP_LIFECYCLE = {
  VERIFIED_LIVE: "verified-live",
  MANUAL_REVIEW: "manual-review",
  TESTNET: "testnet",
  DEVELOPER_TOOL: "developer-tool",
  COMING_SOON: "coming-soon",
  INACTIVE: "inactive",
};

export const APP_LIFECYCLE_LABELS = {
  "verified-live": "Verified Live",
  "manual-review": "Manual Review",
  testnet: "Testnet",
  "developer-tool": "Developer Tool",
  "coming-soon": "Coming Soon",
  inactive: "Inactive",
};

export const APP_LIFECYCLE_TONES = {
  "verified-live": "green",
  "manual-review": "amber",
  testnet: "purple",
  "developer-tool": "cyan",
  "coming-soon": "slate",
  inactive: "red",
};

export const TRUST_TONES = {
  "Mainnet Activity Verified": "green",
  "Developer Verified": "cyan",
  "Community Submitted": "slate",
  "Sponsored Placement": "amber",
};

export function isSpinEligible(app) {
  return app?.status === APP_LIFECYCLE.VERIFIED_LIVE;
}

export function lifecycleLabel(status) {
  return APP_LIFECYCLE_LABELS[status] || status;
}

export function lifecycleTone(status) {
  return APP_LIFECYCLE_TONES[status] || "slate";
}

export function trustTone(signal) {
  return TRUST_TONES[signal] || "slate";
}
