import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { JOBS_DIR, RATE_LIMIT } from "./config.mjs";

const ipWindows = new Map();

export const JOB_STATUS = {
  QUEUED: "queued",
  BUILDING: "building",
  TESTING: "testing",
  ANALYZING: "analyzing",
  COMPLETE: "complete",
  FAILED: "failed",
};

async function ensureDir() {
  await mkdir(JOBS_DIR, { recursive: true });
}

function jobPath(id) {
  return join(JOBS_DIR, `${id}.json`);
}

export function checkRateLimit(ip) {
  const now = Date.now();
  const window = ipWindows.get(ip) || [];
  const recent = window.filter((t) => now - t < RATE_LIMIT.windowMs);
  if (recent.length >= RATE_LIMIT.maxJobsPerIp) {
    return { ok: false, retryAfterMs: RATE_LIMIT.windowMs - (now - recent[0]) };
  }
  ipWindows.set(ip, [...recent, now]);
  return { ok: true };
}

export async function createJob({ type, input, ip }) {
  await ensureDir();
  const id = randomUUID();
  const job = {
    id,
    type,
    status: JOB_STATUS.QUEUED,
    input,
    ip,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    logs: [],
    result: null,
    error: null,
  };
  await writeFile(jobPath(id), JSON.stringify(job, null, 2));
  return job;
}

export async function getJob(id) {
  try {
    const raw = await readFile(jobPath(id), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function updateJob(id, patch) {
  const job = await getJob(id);
  if (!job) return null;
  const next = { ...job, ...patch, updatedAt: new Date().toISOString() };
  await writeFile(jobPath(id), JSON.stringify(next, null, 2));
  return next;
}

export async function appendLog(id, line) {
  const job = await getJob(id);
  if (!job) return null;
  const logs = [...(job.logs || []), { at: new Date().toISOString(), line }];
  return updateJob(id, { logs });
}

export async function listJobs(limit = 20) {
  await ensureDir();
  const files = (await readdir(JOBS_DIR)).filter((f) => f.endsWith(".json"));
  const jobs = await Promise.all(
    files.slice(-limit).map(async (f) => JSON.parse(await readFile(join(JOBS_DIR, f), "utf8")))
  );
  return jobs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
