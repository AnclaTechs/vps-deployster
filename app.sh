#!/bin/bash

COMMAND=${1:-dev}

echo "Starting server..."
yarn $COMMAND &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"

cleanup() {
# Kill child processes when server exits
  echo "Server exited. Killing monitor and worker..." >&2
  kill $MONITOR_PID $WORKER_PID 2>/dev/null
  wait $MONITOR_PID $WORKER_PID 2>/dev/null
  echo "Server stopped. Cleanup function called." >&2
}

trap cleanup EXIT

# Start resource monitor
./bin/monitor.sh $SERVER_PID &
MONITOR_PID=$!

# Start cron worker
yarn worker &
WORKER_PID=$!

echo "Monitor PID: $MONITOR_PID"
echo "Worker PID: $WORKER_PID"

# Wait for server to exit
wait $SERVER_PID
SERVER_EXIT_CODE=$?

exit $SERVER_EXIT_CODE