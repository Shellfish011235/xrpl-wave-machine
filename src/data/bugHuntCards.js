/**
 * XRPL Bug Hunt — citizen science test cards.
 * All cards run on Testnet or isolated Docker — never Mainnet.
 */

export const BUG_HUNT_CATEGORIES = [
  { id: "payments", label: "Payments", color: "#22d3ee" },
  { id: "sequence", label: "Sequence & Timing", color: "#a855f7" },
  { id: "trust", label: "Trust Lines", color: "#34d399" },
  { id: "dex", label: "DEX & Offers", color: "#fbbf24" },
  { id: "nft", label: "NFTs", color: "#e879f9" },
  { id: "defi", label: "AMM / DeFi", color: "#60a5fa" },
  { id: "amendments", label: "Amendments", color: "#4ade80" },
];

export const COMMUNITY_PIPELINE = [
  { id: "test-run", label: "Test Run", desc: "You run a guided card on authorized Testnet" },
  { id: "unexpected", label: "Unexpected Result", desc: "Observed differs from expected — flagged for review" },
  { id: "reproduction", label: "Auto Reproduction", desc: "Backend reruns 3× to confirm (when API available)" },
  { id: "confirmation", label: "Community Confirmation", desc: "Other testers reproduce independently (coming soon)" },
  { id: "triage", label: "Expert Triage", desc: "Researchers validate impact and scope" },
  { id: "disclosure", label: "Private Disclosure", desc: "Validated issues → bugs@ripple.com / private Bugcrowd" },
];

export const BUG_HUNT_CARDS = [
  {
    id: "duplicate-payment",
    title: "Duplicate Payment",
    category: "payments",
    difficulty: "beginner",
    question: "What happens if you try to send the same payment twice with the same sequence number?",
    expectedBehavior: "The second attempt should be rejected — the sequence was already used.",
    target: "Payment",
    environment: "testnet",
    testTemplate: "duplicate_sequence_payment",
    estimatedMinutes: 3,
    riskLevel: "low",
    rewardXp: 40,
    badge: "transactionTester",
    guidedParams: [
      { id: "amount", label: "Amount (drops)", type: "number", default: 1000000, min: 1, max: 10000000, explain: "How much XRP to send in the first payment attempt." },
      { id: "retrySameSeq", label: "Retry with same sequence", type: "boolean", default: true, explain: "When on, the second payment reuses the consumed sequence — should fail." },
    ],
    plainResults: { success: "Payment went through", duplicate: "Rejected — sequence already used", unfunded: "Rejected — not enough XRP" },
  },
  {
    id: "insufficient-funds",
    title: "Insufficient Funds",
    category: "payments",
    difficulty: "beginner",
    question: "What happens when you try to pay more XRP than your account can spend?",
    expectedBehavior: "The ledger should reject the payment without changing balances (tecUNFUNDED_PAYMENT).",
    target: "Payment",
    environment: "testnet",
    testTemplate: "insufficient_funds_payment",
    estimatedMinutes: 3,
    riskLevel: "low",
    rewardXp: 40,
    guidedParams: [
      { id: "amount", label: "Amount (drops)", type: "number", default: 999999999999, min: 1000000, max: 999999999999, explain: "Set very high to exceed spendable balance after reserve." },
    ],
    plainResults: { success: "Unexpected — payment succeeded", unfunded: "Rejected — not enough spendable XRP", malformed: "Rejected — invalid transaction" },
  },
  {
    id: "expired-tx",
    title: "Expired Transaction",
    category: "sequence",
    difficulty: "beginner",
    question: "What happens if a transaction's last-valid ledger has already passed?",
    expectedBehavior: "The transaction should expire (tecEXPIRED) and never affect balances.",
    target: "Payment",
    environment: "testnet",
    testTemplate: "expired_last_ledger",
    estimatedMinutes: 4,
    riskLevel: "low",
    rewardXp: 45,
    guidedParams: [
      { id: "lastLedgerOffset", label: "Ledgers behind current", type: "number", default: 10, min: 1, max: 100, explain: "How far in the past to set LastLedgerSequence." },
    ],
    plainResults: { success: "Unexpected — expired tx succeeded", expired: "Rejected — ledger window passed", malformed: "Rejected — invalid fields" },
  },
  {
    id: "wrong-sequence",
    title: "Wrong Sequence Number",
    category: "sequence",
    difficulty: "beginner",
    question: "What happens if you skip ahead and use a sequence number far in the future?",
    expectedBehavior: "The ledger should reject it — sequence is too high (tefMAX_LEDGER or similar).",
    target: "Payment",
    environment: "testnet",
    testTemplate: "future_sequence_payment",
    estimatedMinutes: 3,
    riskLevel: "low",
    rewardXp: 45,
    guidedParams: [
      { id: "sequenceSkip", label: "Skip ahead by", type: "number", default: 100, min: 10, max: 1000, explain: "Add this to your current sequence for the test payment." },
    ],
    plainResults: { success: "Unexpected — future sequence accepted", rejected: "Rejected — sequence not ready", malformed: "Rejected — invalid transaction" },
  },
  {
    id: "unauthorized-signer",
    title: "Unauthorized Signer",
    category: "payments",
    difficulty: "beginner",
    question: "What happens if a payment is signed with the wrong secret key?",
    expectedBehavior: "The transaction should be rejected — signature does not match the sending account.",
    target: "Payment",
    environment: "testnet",
    testTemplate: "wrong_signer_payment",
    estimatedMinutes: 3,
    riskLevel: "low",
    rewardXp: 50,
    guidedParams: [],
    plainResults: { success: "Unexpected — bad signature accepted", rejected: "Rejected — signature invalid", malformed: "Rejected — signing failed" },
  },
  {
    id: "trustline-boundary",
    title: "Trust Line Boundary",
    category: "trust",
    difficulty: "beginner",
    question: "What happens when you set a trust line limit to zero?",
    expectedBehavior: "A zero limit should remove or freeze the trust line per ledger rules.",
    target: "TrustSet",
    environment: "testnet",
    testTemplate: "trustline_zero_limit",
    estimatedMinutes: 5,
    riskLevel: "low",
    rewardXp: 50,
    guidedParams: [
      { id: "limit", label: "Trust limit", type: "number", default: 0, min: 0, max: 1000000, explain: "0 removes the line; positive values set a cap." },
    ],
    plainResults: { success: "Trust line updated", removed: "Trust line removed or zeroed", rejected: "Rejected by ledger rules" },
  },
  {
    id: "offer-cancel-order",
    title: "Cancel Missing Offer",
    category: "dex",
    difficulty: "beginner",
    question: "What happens if you try to cancel an offer that does not exist?",
    expectedBehavior: "Should fail with tecNO_ENTRY — nothing to cancel.",
    target: "OfferCancel",
    environment: "testnet",
    testTemplate: "cancel_missing_offer",
    estimatedMinutes: 4,
    riskLevel: "low",
    rewardXp: 45,
    guidedParams: [
      { id: "offerSequence", label: "Fake offer sequence", type: "number", default: 99999, min: 1, max: 999999, explain: "Sequence of an offer that was never created." },
    ],
    plainResults: { success: "Unexpected — cancel succeeded", noEntry: "Rejected — offer not found", malformed: "Rejected — invalid cancel" },
  },
  {
    id: "nft-transfer",
    title: "NFT Transfer Without Ownership",
    category: "nft",
    difficulty: "beginner",
    question: "What happens if you try to transfer an NFT you do not own?",
    expectedBehavior: "Should fail — you cannot transfer tokens you do not hold.",
    target: "NFTokenCreateOffer",
    environment: "testnet",
    testTemplate: "nft_transfer_without_token",
    estimatedMinutes: 5,
    riskLevel: "low",
    rewardXp: 50,
    guidedParams: [],
    plainResults: { success: "Unexpected — transfer succeeded", noEntry: "Rejected — token not found", rejected: "Rejected — not owner" },
  },
  {
    id: "amm-deposit-boundary",
    title: "AMM Deposit Boundary",
    category: "defi",
    difficulty: "beginner",
    question: "What happens if you submit an AMM deposit with zero assets?",
    expectedBehavior: "Should be rejected — zero-amount deposit is invalid.",
    target: "AMMDeposit",
    environment: "testnet",
    testTemplate: "amm_zero_deposit",
    estimatedMinutes: 5,
    riskLevel: "low",
    rewardXp: 55,
    guidedParams: [
      { id: "assetAmount", label: "Asset amount", type: "number", default: 0, min: 0, max: 1000000, explain: "0 should trigger a boundary rejection." },
    ],
    plainResults: { success: "Unexpected — zero deposit accepted", rejected: "Rejected — invalid amount", malformed: "Rejected — malformed deposit" },
  },
  {
    id: "amendment-status",
    title: "Amendment On / Off",
    category: "amendments",
    difficulty: "beginner",
    question: "Which amendments are enabled on the Testnet server right now?",
    expectedBehavior: "Read-only probe — lists enabled amendments without changing ledger state.",
    target: "server_info",
    environment: "testnet",
    testTemplate: "amendment_status_probe",
    estimatedMinutes: 2,
    riskLevel: "low",
    rewardXp: 35,
    badge: "amendmentScout",
    guidedParams: [
      { id: "amendmentName", label: "Amendment to check", type: "text", default: "fixTokenEscrowV1", explain: "Name of amendment to look for in server state." },
    ],
    plainResults: { enabled: "Amendment is enabled", disabled: "Amendment is not enabled", unknown: "Amendment not found in server response" },
  },
];

export function getCardById(id) {
  return BUG_HUNT_CARDS.find((c) => c.id === id);
}

export function cardsByCategory(categoryId) {
  return BUG_HUNT_CARDS.filter((c) => c.category === categoryId);
}

export function translateEngineResult(code, card) {
  const map = {
    tesSUCCESS: card.plainResults?.success || "Transaction succeeded",
    tecUNFUNDED_PAYMENT: card.plainResults?.unfunded || "Not enough spendable XRP",
    tecEXPIRED: card.plainResults?.expired || "Transaction expired",
    tefPAST_SEQ: card.plainResults?.duplicate || "Sequence already used",
    tefMAX_LEDGER: card.plainResults?.rejected || "Sequence too far ahead",
    tefBAD_AUTH: card.plainResults?.rejected || "Unauthorized signer",
    temBAD_SIGNATURE: card.plainResults?.rejected || "Invalid signature",
    temBAD_AMOUNT: card.plainResults?.malformed || "Invalid amount",
    temMALFORMED: card.plainResults?.malformed || "Malformed transaction",
    tecNO_ENTRY: card.plainResults?.noEntry || "Object not found on ledger",
    tecPATH_DRY: card.plainResults?.rejected || "Path could not deliver",
  };
  return map[code] || `Ledger returned: ${code}`;
}

export function matchExpected(observedCode, card) {
  const expectedCodes = {
    duplicate_sequence_payment: ["tefPAST_SEQ", "tefBAD_SEQ"],
    insufficient_funds_payment: ["tecUNFUNDED_PAYMENT"],
    expired_last_ledger: ["tecEXPIRED"],
    future_sequence_payment: ["tefMAX_LEDGER", "terPRE_SEQ"],
    wrong_signer_payment: ["temBAD_SIGNATURE", "tefBAD_AUTH"],
    trustline_zero_limit: ["tesSUCCESS", "tecNO_LINE"],
    cancel_missing_offer: ["tecNO_ENTRY"],
    nft_transfer_without_token: ["tecNO_ENTRY", "tecNO_PERMISSION"],
    amm_zero_deposit: ["temBAD_AMOUNT", "temMALFORMED"],
    amendment_status_probe: ["tesSUCCESS"],
  };
  const codes = expectedCodes[card.testTemplate] || [];
  if (card.testTemplate === "amendment_status_probe") return { match: true, status: "info" };
  const match = codes.includes(observedCode);
  return { match, status: match ? "expected" : "unexpected" };
}
