#!/usr/bin/env python3
"""Read agent_state.json, emit sanitized snapshot: shape, never content."""
import json, sys
from datetime import datetime, timezone

src, dst = sys.argv[1], sys.argv[2]
state = json.load(open(src))  # malformed JSON -> exception -> nonzero exit -> no commit

form = state.get("form")
snap = {
    "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "loop_count": state.get("version", 0),
    "confidence": state.get("confidence", 0),
    "last_path": state.get("last_path", []),
    "last_thought_at": state.get("last_thought_at"),
    "thinking_was_empty": bool(state.get("thinking_was_empty", False)),
    "form": {k: form[k] for k in ("shape", "palette", "density", "symmetry", "motion") if k in form} if isinstance(form, dict) else None,
}
json.dump(snap, open(dst, "w"), indent=2)
print(f"snapshot: loop {snap['loop_count']}, conf {snap['confidence']}")
