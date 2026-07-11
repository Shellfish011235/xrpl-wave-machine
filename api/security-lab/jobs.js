/**
 * Vercel serverless handler — testnet_proof runs here; branch_diff requires Docker worker.
 * For full differential testing, run locally: pnpm run security-lab:api
 */
import { handleCreateJob, handleGetJob, handleListJobs } from "../../server/security-lab/handlers.mjs";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket?.remoteAddress || "vercel";

  try {
    const { url, method } = req;
    const path = url?.split("?")[0] || "";

    if (path.endsWith("/health") && method === "GET") {
      return res.status(200).json({ ok: true, dockerWorker: false, note: "branch_diff jobs require local Docker API" });
    }

    if (path.endsWith("/jobs") && method === "GET") {
      return res.status(200).json({ jobs: await handleListJobs() });
    }

    if (path.endsWith("/jobs") && method === "POST") {
      const body = req.body || {};
      if (body.type === "branch_diff") {
        return res.status(503).json({
          error: "Branch differential jobs require the local Security Lab API with Docker. Run: pnpm run security-lab:api",
          hint: "Use type=testnet_proof for a real Testnet transaction without Docker.",
        });
      }
      const job = await handleCreateJob(body, ip);
      return res.status(201).json({ job });
    }

    const idMatch = path.match(/\/jobs\/([^/]+)$/);
    if (idMatch && method === "GET") {
      const job = await handleGetJob(idMatch[1]);
      if (!job) return res.status(404).json({ error: "Job not found" });
      return res.status(200).json({ job });
    }

    return res.status(404).json({ error: "Not found" });
  } catch (e) {
    return res.status(e.status || 500).json({ error: e.message, retryAfterMs: e.retryAfterMs });
  }
}
