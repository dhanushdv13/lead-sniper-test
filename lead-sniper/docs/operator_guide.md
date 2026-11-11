# Lead Sniper: Operator & Deployment Guide

This guide walks you through importing, configuring, testing, and running **Lead Sniper** in any n8n environment (Cloud or Self-Hosted Docker).

---

## 1. Quick Import into n8n

1. Open your n8n workspace in your browser (`http://localhost:5678` or your Cloud instance).
2. Click **Workflows** in the sidebar.
3. Click the **three dots menu (`...`)** at the top right -> **Import from File**.
4. Select [`workflows/lead_sniper_workflow.json`](file:///Users/dhanush/Desktop/lead-sniper/workflows/lead_sniper_workflow.json). *(Import **only** this unified file—do not import `phase1_...` through `phase4_...`, which are intermediate development snapshots already merged into `lead_sniper_workflow.json`.)*
5. The complete 18-node workflow canvas will open immediately.

---

## 2. Credentials & Environment Setup

Lead Sniper strictly avoids hardcoded secrets. Follow these steps to attach your credentials:

### 2.1 GitHub Credential (GitHub API or Header Auth)
Choose either option:
- **Option A — Built-in GitHub API Credential (Matches imported JSON directly):**
  - In n8n, navigate to **Credentials** -> **New Credential** -> **GitHub API**.
  - **Github Server:** `https://api.github.com`
  - **User:** Your GitHub username (handle, not email)
  - **Access Token:** Your GitHub Personal Access Token (`ghp_...` or `github_pat_...`, without `Bearer`)
  - **Save** and attach to the three GitHub nodes:
    - `Get Repo Info`
    - `Fetch Stargazers`
    - `Fetch User Profile`
- **Option B — Header Auth Alternative:**
  - Create a **Header Auth** credential (`Authorization: Bearer YOUR_GITHUB_PAT`) and switch the three GitHub nodes to `Generic Credential Type` -> `Header Auth`.

### 2.2 Google Gemini Credential (Google Gemini(PaLM) API or Header Auth)
Choose either option:
- **Option A — Built-in Google Gemini(PaLM) API Credential (Matches imported JSON directly):**
  - In n8n, navigate to **Credentials** -> **New Credential** -> **Google Gemini(PaLM) Api**.
  - **Host:** `https://generativelanguage.googleapis.com`
  - **API Key:** `YOUR_GEMINI_API_KEY` *(Obtained from [Google AI Studio](https://aistudio.google.com/apikey))*
  - **Save** and attach to the `Generate AI Lead Pitch` node.
- **Option B — Header Auth Alternative:**
  - Create a **Header Auth** credential (`x-goog-api-key: YOUR_GEMINI_API_KEY`) and switch `Generate AI Lead Pitch` to `Generic Credential Type` -> `Header Auth`.

### 2.3 Discord Webhook URL & Target Repository
Double-click the **Config** node on the n8n canvas:
- `githubOwner`: Set to your target repository owner (e.g., `facebook`, `vercel`, or your username).
- `githubRepo`: Set to the repository name (e.g., `react`, `next.js`).
- `discordWebhookUrl`: Paste your Discord channel webhook URL.
- `bootstrapBatchSize`: Number of recent stargazers to evaluate on the first run (default: `5`).
- `maxHistory`: Maximum stargazer IDs to keep in persistent memory to prevent duplicate alerts (default: `1000`).

---

## 3. Testing the Workflow in n8n

### Manual Test Run
1. Click the **"Test workflow"** button at the bottom of the canvas.
2. The `Manual Trigger` activates the sequence:
   - Queries repository information.
   - Computes latest stargazer page.
   - Ingests stars and extracts new stargazers.
   - Enriches profiles with `bio`, `company`, `followers`, `public_repos`.
   - Filters:
     - Unqualified leads (`followers <= 100 AND public_repos <= 50`) route to `Stop - Unqualified Lead`.
     - Qualified leads (`followers > 100 OR public_repos > 50`) route to Gemini.
   - Gemini produces a single-sentence commercial rationale.
   - Formats a Discord embed and sends it to your Discord channel.
   - Commits persistent state.
3. Check your Discord channel for rich incoming lead cards!

### Verifying Deduplication (Active Scheduled Runs)
> **Important n8n Behavior:** n8n persists `$getWorkflowStaticData('global')` across **Active** trigger runs (such as `Schedule Trigger`), whereas manual editor runs (`Test workflow`) are sandboxed and do not save static data updates back to the database.

To verify deduplication live in n8n:
1. Temporarily set `Schedule Trigger` to `1 minute` (or keep `15 minutes`) and toggle the workflow **Active**.
2. Let two consecutive scheduled executions run (check the **Executions** tab):
   - **Run 1:** Processes new leads and commits `lastProcessedStarredAt` and `processedUserIds` into static data.
   - **Run 2:** Recognizes all previously processed stars, emits **0 items**, and sends zero duplicate Discord notifications.
3. Restore the schedule interval to `15 minutes` when finished.

---

## 4. Production Scheduling

1. Toggle the workflow switch in the top right corner from **Inactive** to **Active**.
2. The `Schedule Trigger (Every 15m)` will now run autonomously every 15 minutes.
3. If an unhandled network error occurs, the `Error Trigger` captures the execution context and logs failure diagnostics without interrupting future cron executions.

---

## 5. Automated Verification Harness (CLI)

You can run the full automated verification test suite locally anytime:
```bash
npm test
```
This runs all 5 testing modules:
1. `scripts/test_delta_detection.js`: Delta isolation & cold start.
2. `scripts/test_qualification.js`: Strict boundary condition verification.
3. `scripts/test_gemini_sanitizer.js`: Regex enforcement of single-sentence pitch.
4. `scripts/test_discord_payload.js`: Discord Embed schema validation.
5. `scripts/validate_and_simulate_e2e.js`: Structural JSON audit & complete Node VM simulation.

