#!/bin/bash
SERVER_PID=$1
LOG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && cd ".." && pwd)"
LOG_FILE="$LOG_DIR/logs/ram-history.csv"

# Record is generated every 30 seconds, Twice a minute = 2880 records/day
# 7 days = 20160 records
# 30 days = 86400 records

MAX_RECORDS=86400  

# If file doesn't exist, create header
if [ ! -f "$LOG_FILE" ]; then
  echo "timestamp,cpu_usage,ram_used,ram_total" > "$LOG_FILE"
fi

while true; do
    # Check if server PID is still alive
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        echo "Server PID $SERVER_PID exited. Monitor stopping."
        break
    fi

    timestamp=$(date +%s)

    # CPU stats
    idle=$(top -bn1 | awk '/Cpu\(s\)/ {print $8}')
    cpu_usage=$(echo "100 - $idle" | bc)

    # RAM stats
    used=$(free -m | awk '/Mem:/ {print $3}')
    total=$(free -m | awk '/Mem:/ {print $2}')
    echo "$timestamp,$cpu_usage,$used,$total" >> "$LOG_FILE"

    # Trim file to last $MAX_RECORDS lines + header
    total_lines=$(wc -l < "$LOG_FILE")
    if [ "$total_lines" -gt $((MAX_RECORDS + 1)) ]; then
        tail -n $((MAX_RECORDS + 1)) "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
    fi

    sleep 30
done
