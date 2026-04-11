#!/bin/bash
MSG="$1"
AGENT="${2:-main}"
SESSION="$3"
TIMEOUT="${4:-120}"

CMD="openclaw agent --agent $AGENT --message \"$MSG\" --json"
if [ -n "$SESSION" ]; then
  CMD="$CMD --session-id $SESSION"
fi

echo "Running: $CMD" >> /tmp/agent.log
eval $CMD >> /tmp/agent.log 2>&1
echo "Done at $(date)" >> /tmp/agent.log
