/**
 * Rule-based Bug Hunt copilot — maps plain English to safe test cards.
 * No API key required. Rejects prohibited requests.
 */

import { BUG_HUNT_CARDS, getCardById } from "../data/bugHuntCards";

const REJECT_PATTERNS = [
  { pattern: /\bmainnet\b/i, reason: "Mainnet testing is not allowed. Use Testnet or Bug Hunt cards only." },
  { pattern: /\bddos\b|denial.of.service|flood\s+the\s+network/i, reason: "Disruptive testing (DDoS/spam) violates XRPLF policy." },
  { pattern: /\bsteal\b|\bhack\b.*\bwallet\b|seed\s*phrase|private\s*key|credential/i, reason: "Credential theft and social engineering are prohibited." },
  { pattern: /\bthird.?party\b.*\bproduction\b|\battack\b.*\b(live|prod)/i, reason: "Testing third-party production systems without authorization is not allowed." },
  { pattern: /\breal\s+(user\s+)?funds\b|\bdrain\b|\bexploit\b.*\blive/i, reason: "Never target real user funds. Bug Hunt uses Testnet only." },
];

const INTENT_MAP = [
  { keywords: ["duplicate", "twice", "same payment", "double spend", "replay"], cardId: "duplicate-payment", preview: "I will fund a Testnet account and attempt two payments with the same sequence number." },
  { keywords: ["insufficient", "not enough", "more than balance", "unfunded", "broke"], cardId: "insufficient-funds", preview: "I will try to send more XRP than the Testnet account can spend." },
  { keywords: ["expired", "last ledger", "too old", "timeout"], cardId: "expired-tx", preview: "I will submit a payment with a LastLedgerSequence already in the past." },
  { keywords: ["wrong sequence", "future sequence", "skip sequence", "bad sequence"], cardId: "wrong-sequence", preview: "I will use a sequence number far ahead of the account's current sequence." },
  { keywords: ["wrong signer", "bad signature", "unauthorized", "wrong key"], cardId: "unauthorized-signer", preview: "I will sign a payment with a different account's key to test rejection." },
  { keywords: ["trust line", "trustline", "limit zero", "remove trust"], cardId: "trustline-boundary", preview: "I will set a trust line limit boundary on Testnet." },
  { keywords: ["cancel offer", "missing offer", "fake offer"], cardId: "offer-cancel-order", preview: "I will try to cancel an offer that does not exist." },
  { keywords: ["nft", "token transfer", "don't own", "not owner"], cardId: "nft-transfer", preview: "I will attempt an NFT transfer without owning the token." },
  { keywords: ["amm", "deposit", "zero deposit", "liquidity"], cardId: "amm-deposit-boundary", preview: "I will submit an AMM deposit with a zero amount boundary." },
  { keywords: ["amendment", "enabled", "feature flag", "protocol change"], cardId: "amendment-status", preview: "I will read which amendments are enabled on Testnet (no state change)." },
];

export function analyzeBugDescription(text) {
  const input = (text || "").trim();
  if (input.length < 8) {
    return { ok: false, reason: "Describe what you think could go wrong in a few words." };
  }

  for (const rule of REJECT_PATTERNS) {
    if (rule.pattern.test(input)) {
      return { ok: false, reason: rule.reason, rejected: true };
    }
  }

  const lower = input.toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const intent of INTENT_MAP) {
    let score = 0;
    for (const kw of intent.keywords) {
      if (lower.includes(kw)) score += kw.split(" ").length;
    }
    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  }

  if (!best || bestScore === 0) {
    return {
      ok: false,
      reason: "I couldn't map that to a safe Testnet test. Try: duplicate payment, insufficient funds, expired transaction, wrong sequence, or amendment status.",
      suggestions: BUG_HUNT_CARDS.slice(0, 4).map((c) => c.title),
    };
  }

  const card = getCardById(best.cardId);
  return {
    ok: true,
    cardId: best.cardId,
    card,
    preview: best.preview,
    confidence: bestScore >= 2 ? "high" : "medium",
  };
}
