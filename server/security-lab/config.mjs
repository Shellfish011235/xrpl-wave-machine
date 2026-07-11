/** Security Lab job API configuration */
export const API_PORT = Number(process.env.SECURITY_LAB_PORT || 3001);
export const JOBS_DIR = process.env.SECURITY_LAB_JOBS_DIR || "tmp/security-lab/jobs";
export const COMPOSE_FILE = process.env.SECURITY_LAB_COMPOSE || "docker/security-lab/docker-compose.yml";

export const RATE_LIMIT = {
  windowMs: 60 * 60 * 1000,
  maxJobsPerIp: Number(process.env.SECURITY_LAB_MAX_JOBS_PER_HOUR || 6),
};

export const JOB_LIMITS = {
  maxDurationMs: Number(process.env.SECURITY_LAB_MAX_DURATION_MS || 20 * 60 * 1000),
  pollIntervalMs: 1500,
};

export const TESTNET = {
  rpc: "https://s.altnet.rippletest.net:51234",
  ws: "wss://s.altnet.rippletest.net:51233",
  faucet: "https://faucet.altnet.rippletest.net/accounts",
};

export const REPOSITORY = {
  owner: "XRPLF",
  name: "rippled",
  url: "https://github.com/XRPLF/rippled",
  defaultBaseline: "2.3.0",
  defaultCandidate: "2.4.0",
};

export const DEFAULT_AMENDMENTS = {
  fixTokenEscrowV1: false,
  fixAMMOverflowOffer: false,
  fixPreviousTxnID: false,
};
