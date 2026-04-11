#!/bin/bash
cd /root/.openclaw/workspace/openclaw-session-client/backend

# Start backend
echo "Starting backend..."
bun run src/index.ts > /tmp/backend.log 2>&1 &
BACKEND_PID=$!

# Wait for backend to start
sleep 6

# Test health
echo "Testing health..."
curl -s http://localhost:4000/health

echo ""
echo "Testing chat..."
curl -s -X POST http://localhost:4000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Selam!"}'

echo ""
echo "Done"

# Keep backend running for a bit
sleep 2
kill $BACKEND_PID 2>/dev/null