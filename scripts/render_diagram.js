// Regenerates the README flow diagram from telemetry/state_snapshot.json
import { readFileSync, writeFileSync } from "fs";

const snap = JSON.parse(readFileSync("telemetry/state_snapshot.json", "utf8"));
const path = new Set(snap.last_path || []);

const active = new Set(["A", "B"]);
if (path.has("user_message")) active.add("C");
if (path.has("self_prompt")) active.add("D");
if (path.has("reason")) { active.add("E"); active.add("G"); if (!snap.thinking_was_empty) active.add("F"); }
if (path.has("state_update")) active.add("H");
if (path.has("whatsapp_reply")) { active.add("I"); active.add("J"); }
if (path.has("silent")) { active.add("I"); active.add("K"); }

const ageH = snap.generated_at ? (Date.now() - Date.parse(snap.generated_at)) / 3.6e6 : 99;
const stamp = (snap.generated_at || "").replace("T", " ").replace("Z", " UTC");
const caption = ageH > 2
  ? `*⚠ last seen ${stamp} — agent may be dormant*`
  : `*Live: loop #${snap.loop_count} · confidence ${snap.confidence}% · thinking ${snap.thinking_was_empty ? "was empty (chose not to think)" : "captured"} · updated ${stamp}*`;

const diagram = `<!-- FLOW:BEGIN (auto-generated — do not edit by hand) -->
\`\`\`mermaid
flowchart TD
    A[Loop iteration] --> B{Poll every 3s:<br/>incoming WhatsApp?}
    B -- yes --> C[User message<br/>= reflection input]
    B -- "no (after LOOP_INTERVAL_MS)" --> D[Next contemplation prompt]
    C --> E[Claude API call<br/>adaptive thinking]
    D --> E
    E --> F[Thinking blocks<br/>--> chain_of_thought.log]
    E --> G[JSON identity output<br/>--> agent_state.json]
    G --> H[Pi display + TTS<br/>if PI_ENDPOINT set]
    G --> I{Was it a<br/>user message?}
    I -- yes --> J[WhatsApp reply via Twilio]
    I -- no --> K[Stay silent]
    J --> A
    K --> A
    H --> A
    classDef active fill:#22c55e,stroke:#15803d,color:#fff
    classDef dormant opacity:0.4
    class ${[...active].sort().join(",")} active
    class ${["A","B","C","D","E","F","G","H","I","J","K"].filter(n => !active.has(n)).join(",")} dormant
\`\`\`

${caption}
<!-- FLOW:END -->`;

const readme = readFileSync("README.md", "utf8");
const out = readme.replace(/<!-- FLOW:BEGIN[\s\S]*?<!-- FLOW:END -->/, diagram);
if (out === readme) throw new Error("FLOW markers not found in README");
writeFileSync("README.md", out);
console.log(`rendered: active nodes ${[...active].sort().join(",")}`);
