#!/bin/bash

COMMAND=${1:-dev}

echo "Starting server..."
yarn $COMMAND &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"

# Start RAM monitor in background
./bin/monitor.sh $SERVER_PID &

# Wait for server to exit
wait $SERVER_PID
SERVER_EXIT_CODE=$?

echo "Server stopped. Monitor should exit automatically."
exit $SERVER_EXIT_CODE