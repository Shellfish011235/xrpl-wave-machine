/**
 * Activation spaces — physical or virtual venues with time-bounded check-in.
 * QR codes at the space link here; check-ins only count while the window is open.
 * Each visit can unlock the XRPL Swag badge path (passport stamp + optional NFT claim).
 */

export const SPACES = [
  {
    id: "xrpl-commons-booth",
    name: "XRPL Commons Activation Space",
    location: "Buildathon venue · main floor",
    description:
      "Scan the QR posted at this space while it is live. Your visit is time-stamped in your Passport and counts toward the XRPL Swag badge program.",
    swagNote:
      "Eligible check-ins unlock the XRPL Swag stamp. Claim the companion NFT on xrp.cafe or onXRP — your keys, your wallet.",
    schedule: {
      // ISO 8601 with offset — edit per event
      start: "2026-07-10T09:00:00-04:00",
      end: "2026-07-10T20:00:00-04:00",
    },
    xp: 75,
    nftClaim: {
      app: "onXRP",
      url: "https://onxrp.com",
      hint: "After check-in, mint or accept the XRPL Swag drop in your wallet to pair physical swag with an on-chain badge NFT.",
      verify: "NFTokenAcceptOffer",
    },
  },
  {
    id: "wave-lounge",
    name: "Wave Machine Lounge",
    location: "Side stage · demo zone",
    description:
      "Drop in during active hours, scan the lounge QR, and log a timed visit for swag eligibility.",
    swagNote: "Lounge visitors earn the same XRPL Swag stamp — one per wallet per space.",
    schedule: {
      start: "2026-07-10T12:00:00-04:00",
      end: "2026-07-10T17:00:00-04:00",
    },
    xp: 50,
    nftClaim: {
      app: "xrp.cafe",
      url: "https://xrp.cafe",
      hint: "Look for the Wave Machine / XRPL Swag collection after your lounge check-in.",
      verify: "NFTokenAcceptOffer",
    },
  },
];
