# Phase 1: GitHub Ingestion & State Management

## Overview
Phase 1 implements the ingestion layer of Lead Sniper. It monitors stargazers on a specified repository via the GitHub REST API, calculates the most recent stargazer pagination window, extracts stargazers with chronological star timestamps, and runs an intelligent delta-detection algorithm backed by persistent n8n workflow static data.

---

## Workflow Nodes Breakdown

```
[Manual Trigger] ──┐
                   ├──> [Config] ──> [Get Repo Info] ──> [Calc Stargazer Page] ──> [Fetch Stargazers] ──> [Filter New Stargazers]
[Schedule Trigger] ┘
```

1. **Manual Trigger (`n8n-nodes-base.manualTrigger`):**
   Allows on-demand execution when testing inside the n8n canvas editor.
2. **Schedule Trigger (`n8n-nodes-base.scheduleTrigger`):**
   Configured to trigger every 15 minutes for automated background polling.
3. **Config (`n8n-nodes-base.set`):**
   Defines `owner`, `repo`, `bootstrapBatchSize` (default: 5), and `maxHistory` (default: 1000). Resolves values from environment variables (`$env.GITHUB_OWNER`, `$env.GITHUB_REPO`) or sensible defaults.
4. **Get Repo Info (`n8n-nodes-base.httpRequest`):**
   - Calls `GET https://api.github.com/repos/{owner}/{repo}`
   - Header: `Accept: application/vnd.github+json`
   - Retrieves repository metadata, specifically `stargazers_count`.
   - Includes retry policy: 3 attempts, 2000 ms backoff.
5. **Calculate Stargazer Page (`n8n-nodes-base.code`):**
   - Calculates the target page where the latest stargazers reside:
     $$\text{targetPage} = \max\left(1, \left\lceil \frac{\text{stargazers\_count}}{100} \right\rceil\right)$$
   - Avoids paginating from page 1 across thousands of older historical stars, conserving rate limits.
6. **Fetch Stargazers (`n8n-nodes-base.httpRequest`):**
   - Calls `GET https://api.github.com/repos/{owner}/{repo}/stargazers?per_page=100&page={targetPage}`
   - Crucial Header: `Accept: application/vnd.github.star+json` (required by GitHub API to include the `starred_at` ISO timestamp).
   - Retry policy: 3 attempts, 2000 ms backoff.
7. **Filter New Stargazers (`n8n-nodes-base.code`):**
   - Interacts with `$getWorkflowStaticData('global')`.
   - Compares each stargazer's `starred_at` timestamp against `lastProcessedStarredAt`.
   - Checks `user.id` against `processedUserIds` to prevent duplicate alerts.
   - Emits an array of genuinely new stargazers. If no new stargazers exist, emits an empty list `[]`, gracefully concluding execution.

---

## Verification & Testing
The delta detection and deduplication algorithms were validated using automated tests in `scripts/test_delta_detection.js`:
- **Cold start test:** Successfully bootstraps initial batch.
- **Repeat execution test:** Zero duplicates emitted when no new stars exist.
- **New stargazer arrival test:** Accurately isolates new star and updates cursor timestamp.
- **Unstar & restar edge case:** Prevents re-notification using persistent ID tracking.

