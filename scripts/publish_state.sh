#!/usr/bin/env bash
set -e
[ "${PUBLISH_ENABLED:-1}" = "0" ] && exit 0
REPO="$HOME/identity-gate"
SRC="/mnt/user2_home/user2/projects/ai-identity-agent/agent_state.json"
cd "$REPO"
git pull -q --no-rebase
python3 scripts/sanitize_state.py "$SRC" telemetry/state_snapshot.json
git add telemetry/state_snapshot.json
git diff --cached --quiet && exit 0   # nothing changed -> no commit noise
LOOP=$(python3 -c "import json;print(json.load(open('telemetry/state_snapshot.json'))['loop_count'])")
CONF=$(python3 -c "import json;print(json.load(open('telemetry/state_snapshot.json'))['confidence'])")
git commit -q -m "telemetry: loop $LOOP, conf $CONF"
git push -q
