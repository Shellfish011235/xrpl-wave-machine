import http from "node:http";
import { API_PORT } from "./config.mjs";
import { handleCreateJob, handleGetJob, handleListJobs } from "./handlers.mjs";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 1e6) reject(new Error("Body too large")); });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error("Invalid JSON")); }
    });
  });
}

function clientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const send = (code, data) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };

  try {
    if (url.pathname === "/api/security-lab/health" && req.method === "GET") {
      return send(200, { ok: true, service: "security-lab" });
    }

    if (url.pathname === "/api/security-lab/jobs" && req.method === "GET") {
      return send(200, { jobs: await handleListJobs() });
    }

    if (url.pathname === "/api/security-lab/jobs" && req.method === "POST") {
      const body = await readBody(req);
      const job = await handleCreateJob(body, clientIp(req));
      return send(201, { job });
    }

    const match = url.pathname.match(/^\/api\/security-lab\/jobs\/([^/]+)$/);
    if (match && req.method === "GET") {
      const job = await handleGetJob(match[1]);
      if (!job) return send(404, { error: "Job not found" });
      return send(200, { job });
    }

    send(404, { error: "Not found" });
  } catch (e) {
    send(e.status || 500, { error: e.message, retryAfterMs: e.retryAfterMs });
  }
});

server.listen(API_PORT, () => {
  console.log(`Security Lab API listening on http://localhost:${API_PORT}`);
});
