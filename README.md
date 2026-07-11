# XRPL Wave Machine

**The gamified discovery and activation layer for the XRP Ledger.**
Spin for a live XRPL app and a guided mission, complete a real on-chain
action, verify it against public mainnet history, and level up your
XRPL Passport.

Built for the XRPL Commons **Make Waves on XRPL** buildathon
(June 21 – September 21, 2026).

Read-only. Non-custodial. Your keys never touch this app.

---

## Quick start

```bash
npm install
cp .env.example .env      # add your Xaman API key (optional but recommended)
npm run dev               # http://localhost:5173
```

Works immediately with **manual r-address entry** (read-only) or **demo
mode** (simulated verification, clearly labeled). Add a Xaman key to
enable QR sign-in.

## Enable "Sign in with Xaman" (QR you scan with your iPhone)

1. Create a free app at https://apps.xumm.dev
2. In the app settings, whitelist origins:
   `http://localhost:5173` and your production domain.
3. Put the **API Key** in `.env` as `VITE_XAMAN_API_KEY`.
   (The API **Secret** never goes in frontend code or this file —
   Vercel server env vars only, and only if you later add server-side
   Xaman payloads.)
4. `npm run dev` — the wallet modal now shows the QR button. Scan with
   Xaman on your phone, approve the SignIn request, done. Ownership of
   the wallet is cryptographically proven, not just claimed.

## How verification works

Missions verify by **transaction type in the user's own public history**
after the mission start time — no designated destination address, nothing
custodial:

| Mission action        | Verified transaction type |
|-----------------------|---------------------------|
| Send a payment        | `Payment`                 |
| Open a trust line     | `TrustSet`                |
| DEX trade / swap      | `OfferCreate`             |
| Liquidity deposit     | `AMMDeposit`              |
| Mint an NFT           | `NFTokenMint`             |
| Buy / support an NFT  | `NFTokenAcceptOffer`      |
| Set account domain    | `AccountSet`              |

The check runs against `wss://xrplcluster.com` (configurable via
`VITE_XRPL_WS` — point it at your own rippled node when synced).

## Integrity rules (why judges should trust the numbers)

- Repeat completions of the same mission earn **0 XP** — anti-farming.
- Spins are **free and limited** (3/day, +1 per verified mission).
  This is a discovery interface, not a wagering system: no deposits,
  no random-value payouts, ever.
- Leaderboards rank **unique verified missions**, not transaction volume.
- Every app displays its trust status and risk information **before**
  the user starts; sponsored placement is always disclosed.

## Project layout

```
src/
  App.jsx              all views: Discover, Mission, Passport, Leaderboard, Apps, Developer portal
  data/ecosystem.js    categories, the 10-app directory + missions, badges
  lib/xrpl.js          read-only mainnet helpers (account_info, account_tx matcher)
  hooks/useXaman.js    QR sign-in (PKCE) with graceful fallback
.cursor/rules/         project invariants for AI-assisted development
```

## Roadmap to competition-grade

1. **Persistence** — Supabase tables: `users`, `apps`, `missions`,
   `mission_completions`, `spins` (columns already defined in the concept
   spec). Replace in-memory state; Passport survives refresh.
2. **Server-side verification** — move `lib/xrpl.js` checks into Vercel
   API routes with per-IP and per-wallet rate limits (same protective
   pattern as the Control Room AI proxy).
3. **Developer portal** — persist submissions, manual review dashboard,
   real funnel analytics (impressions → starts → completions → 7/30-day
   return).
4. **Shareable Wave cards** — OG-image endpoint for completed missions;
   shared Waves become referral funnels for participating apps.

## Deploy

Push to GitHub, import in Vercel, set `VITE_XAMAN_API_KEY`, add the
production domain to the Xaman app whitelist. `vercel.json` already
handles SPA rewrites.
