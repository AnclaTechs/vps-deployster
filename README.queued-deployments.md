# 📦 Queued Deployments Guide

This document explains the new Redis-backed queuing behavior for deployments in `vps-deployster`, and how to use it from CI (e.g., GitHub Actions) or any client.

## What changed?

Previously, when a deployment was already running for a project, a new request to `POST /deploy` returned HTTP 409:

```
Project has another deployment activity in progress.
```

Now, deployment requests are queued per project:

- If a project’s deployment lock is available, the deployment starts immediately and you get `{ job_id }`.
- If a project’s deployment lock is held by another job, your request still returns HTTP 200 with:

```json
{ "job_id": "<id>", "queued": true, "message": "Another deployment is running; this job is queued." }
```

The server internally waits until the lock is free, then starts your deployment. No restart or re-run is required.

## How it works

- A Redis lock key `lock:deploy:<projectId>` serializes deployments per project.
- When the lock is not available, the server:
  - Returns `{ job_id, queued: true }` immediately.
  - Polls for the lock in the background (every ~3s).
  - Starts the queued job automatically once the lock is acquired.
- Logs and status are streamed to Redis during execution.
- On completion (success or failure), the deployment is recorded in the DB and the lock is released.

> Default lock TTL is 600 seconds. If your builds routinely exceed this, consider increasing the TTL or adding a lock “watchdog” to refresh expirations during long runs.

## API usage

### POST /deploy

Headers:

```
x-deployster-token: <your-secret>
Content-Type: application/json
```

Body:

```json
{
  "cd": "/var/www/my-app",
  "commands": [
    "yarn install --frozen-lockfile",
    "yarn build",
    "supervisorctl restart my-app--main"
  ],
  "commit_hash": "<sha>",
  "ref_name": "main"
}
```

Responses:

```
200 { "job_id": "<id>" }
200 { "job_id": "<id>", "queued": true, "message": "Another deployment is running; this job is queued." }
403 { "error": "Unauthorized" }
```

Important rules:

- The last command in `commands` must be `supervisorctl start|restart <program>` — otherwise the server fails the job early for safety.
- If your project uses pipeline stages configured in `pipeline_json`, the server will inject a `.env` file based on the stage’s environment variables before running your commands.

### GET /status/:job_id

```
200 { "status": "queued|running|complete|failed|not_found", "logs": "..." }
404 { "status": "not_found" }
```

Notes:

- Logs are appended as the job runs.
- Each call clears the returned chunk of logs from Redis. Keep polling to stream logs in near real-time.

## GitHub Actions example

Use GitHub’s `concurrency` to limit overlapping runs (optional), and poll `/status/:job_id` until completion.

```yaml
name: Deploy

on:
  push:
    branches: ["main"]

# Queue workflows at the GitHub level (optional but recommended)
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Trigger deploy
        id: trigger
        run: |
          RESPONSE=$(curl -sS -X POST \
            -H "x-deployster-token: ${{ secrets.DEPLOYSTER_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d @- "${{ secrets.DEPLOYSTER_URL }}/deploy" <<'JSON'
          {
            "cd": "/var/www/my-app",
            "commands": [
              "yarn install --frozen-lockfile",
              "yarn build",
              "supervisorctl restart my-app--main"
            ],
            "commit_hash": "${{ github.sha }}",
            "ref_name": "${{ github.ref_name }}"
          }
          JSON
          )
          echo "$RESPONSE"
          JOB_ID=$(echo "$RESPONSE" | jq -r '.job_id')
          if [ -z "$JOB_ID" ] || [ "$JOB_ID" = "null" ]; then
            echo "Failed to obtain job_id" >&2
            exit 1
          fi
          echo "job_id=$JOB_ID" >> "$GITHUB_OUTPUT"

      - name: Stream deploy status
        run: |
          JOB_ID="${{ steps.trigger.outputs.job_id }}"
          echo "Waiting on job: $JOB_ID"
          while true; do
            RESP=$(curl -sS -H "x-deployster-token: ${{ secrets.DEPLOYSTER_TOKEN }}" \
              "${{ secrets.DEPLOYSTER_URL }}/status/$JOB_ID") || true
            STATUS=$(echo "$RESP" | jq -r '.status // "not_found"')
            LOGS=$(echo "$RESP" | jq -r '.logs // ""')
            echo -n "$LOGS"
            if [ "$STATUS" = "complete" ]; then
              echo "\nDeployment complete"
              break
            elif [ "$STATUS" = "failed" ]; then
              echo "\nDeployment failed" >&2
              exit 1
            elif [ "$STATUS" = "not_found" ]; then
              echo "\nJob not found" >&2
              exit 1
            fi
            sleep 3
          done
```

## Local curl example

```bash
# Trigger deploy
curl -sS -X POST \
  -H "x-deployster-token: $DEPLOYSTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d @- "$DEPLOYSTER_URL/deploy" <<'JSON' | tee /tmp/deploy-response.json
{
  "cd": "/var/www/my-app",
  "commands": [
    "yarn install --frozen-lockfile",
    "yarn build",
    "supervisorctl restart my-app--main"
  ],
  "commit_hash": "$(git rev-parse HEAD)",
  "ref_name": "main"
}
JSON

# Extract job_id
JOB_ID=$(jq -r '.job_id' /tmp/deploy-response.json)

# Poll status
while true; do
  RESP=$(curl -sS -H "x-deployster-token: $DEPLOYSTER_TOKEN" "$DEPLOYSTER_URL/status/$JOB_ID") || true
  STATUS=$(echo "$RESP" | jq -r '.status // "not_found"')
  LOGS=$(echo "$RESP" | jq -r '.logs // ""')
  echo -n "$LOGS"
  if [ "$STATUS" = "complete" ]; then
    echo "\nDeployment complete"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "\nDeployment failed" >&2
    exit 1
  elif [ "$STATUS" = "not_found" ]; then
    echo "\nJob not found" >&2
    exit 1
  fi
  sleep 3
done
```

## Tips

- Ensure your supervisor program name in the final command matches your configuration (e.g., `my-app--main`).
- Keep `DEPLOYSTER_TOKEN` secret and send it via the `x-deployster-token` header.
- If your builds are long, consider increasing the lock TTL beyond 600s or implementing a lock extension watchdog.
