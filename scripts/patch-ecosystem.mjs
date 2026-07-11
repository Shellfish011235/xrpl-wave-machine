import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "src/data/ecosystem.js");
const expanded = "c:/Users/anamb/Downloads/xrpl-expanded-extract/xrpl-wave-machine/src/data/ecosystem.js";

let s = fs.readFileSync(expanded, "utf8");

s = s.replace(
  /Building2,\n\} from "lucide-react";/,
  `Building2,
  Gift,
  Bot,
  ShieldCheck,
} from "lucide-react";

// External AI / security vendor apps are withheld from APPS until mainnet-verifiable.
// Built-in utilities: waveMachine.js + Security Lab — never in the public spinner.`
);

s = s.replace(
  `  { id: "enterprise", label: "Enterprise", icon: Building2, color: "#94a3b8" },
];`,
  `  { id: "enterprise", label: "Enterprise", icon: Building2, color: "#94a3b8" },
  { id: "ai", label: "AI & Agents", icon: Bot, color: "#c084fc" },
  { id: "cybersecurity", label: "Security & Trust", icon: ShieldCheck, color: "#34d399" },
];`
);

if (!s.includes("export const SPIN_APPS")) {
  s = s.replace(
    "];\n\nexport const BADGE_DEFS",
    `];

/** Live external apps for the discovery spinner only */
export const SPIN_APPS = APPS;

export { WAVE_MACHINE, SECURITY_LAB_ENTRY } from "./waveMachine.js";

export const BADGE_DEFS`
  );
}

s = s.replace(
  `  enterprise: { label: "Enterprise Stamp", icon: Building2, color: "#94a3b8" },
  streak3:`,
  `  enterprise: { label: "Enterprise Stamp", icon: Building2, color: "#94a3b8" },
  ai: { label: "AI & Agents Stamp", icon: Bot, color: "#c084fc" },
  cybersecurity: { label: "Security Stamp", icon: ShieldCheck, color: "#34d399" },
  securityResearcher: { label: "Security Researcher", icon: ShieldCheck, color: "#4ade80" },
  streak3:`
);

if (!s.includes("xrpswag")) {
  s = s.replace(
    `  explorer5: { label: "5 Apps Explored", icon: Globe, color: "#60a5fa" },
};`,
    `  explorer5: { label: "5 Apps Explored", icon: Globe, color: "#60a5fa" },
  xrpswag: { label: "XRPL Swag", icon: Gift, color: "#f472b6" },
};`
  );
}

fs.writeFileSync(src, s);
console.log("ecosystem.js patched:", (s.match(/id: "/g) || []).length, "ids");
