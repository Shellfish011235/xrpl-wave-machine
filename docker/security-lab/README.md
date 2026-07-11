# XRPL Security Lab — Docker differential testing

Authorized isolated environments only. **Never Mainnet.**

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/macOS/Linux)
- Node 18+ and `pnpm`

## Quick start

```bash
# Terminal 1 — Security Lab job API
pnpm run security-lab:api

# Terminal 2 — Vite frontend (proxies /api → :3001)
pnpm run dev

# Optional — manual Docker smoke test
docker compose -f docker/security-lab/docker-compose.yml up -d
curl -s http://127.0.0.1:51234 -d '{"method":"server_info"}' -H "Content-Type: application/json"
docker compose -f docker/security-lab/docker-compose.yml down -v
```

## What runs where

| Capability | Without Docker | With Docker + local API |
|---|---|---|
| Testnet proof (real faucet + Payment) | Yes (via API) | Yes |
| Branch differential tester | No — job fails with instructions | Yes — two isolated standalone nodes |
| Image tags from commit refs | N/A | Semver refs map to `xrpllab/xrpld:TAG`; SHA refs use `latest` until custom build |

## Commit builds (future)

Full `XRPLF/rippled` clone + compile at two commits is documented but not automated in MVP.
Pre-built images prove the pipeline; replace tags or extend `runners/branchDiff.mjs` with local build steps.

## Official disclosure

Official disclosure: private Bugcrowd programs (invitation only). Request access at [bugs@ripple.com](mailto:bugs@ripple.com) per [Ripple's bug bounty policy](https://ripple.com/legal/bug-bounty/). No auto-submit from Wave Machine.
