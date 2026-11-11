# Lead Sniper 🎯
### AI-Powered GitHub Lead Generation System for n8n

Lead Sniper is an intelligent automated lead qualification pipeline engineered for **n8n**. It monitors GitHub stargazers in real time, enriches user profiles, evaluates strict developer qualification rules, generates high-impact commercial lead pitches using **Google Gemini**, and delivers structured alerts to **Discord** with persistent state deduplication.

---

## 📌 Compliance with Assignment Requirements

| # | Requirement | Implementation & Verification |
|---|---|---|
| **1** | Monitor GitHub repository stargazers using GitHub REST API | `Fetch Stargazers` node queries `GET /repos/{owner}/{repo}/stargazers` with `Accept: application/vnd.github.star+json`. |
| **2** | Detect newly added stargazers | Dynamic pagination formula $\max(1, \lceil \text{count}/100 \rceil)$ + delta detection against persistent state. |
| **3** | Fetch each user's GitHub profile | `Fetch User Profile` node calls `GET /users/{login}` to retrieve `bio`, `company`, `followers`, `public_repos`. |
| **4** | Apply exact qualification: `followers > 100 OR public_repos > 50` | Dedicated `IF` node with `combinator: "or"`. Verified across 8 boundary cases in `scripts/test_qualification.js`. |
| **5** | Stop processing users who do not qualify | False branch routes to a terminal `Stop - Unqualified Lead` (No-Op) node. Zero downstream API or token spend. |
| **6** | Use Google Gemini to analyze user's bio and company | `Generate AI Lead Pitch` node calls `gemini-3.8-flash` with structured sales intelligence system instructions. |
| **7** | Generate exactly one sentence explaining why user is a valuable lead | Strict prompt constraint + `Sanitize & Enforce Single Sentence` Code node extracting strictly the first sentence. |
| **8** | Send qualified lead information and AI pitch to Discord | Formats Discord Rich Embed with author, bio, stats, and AI angle; posts to webhook with retries. |
| **9** | Prevent duplicate notifications using persistent storage | n8n `$getWorkflowStaticData('global')` tracks `lastProcessedStarredAt` and `processedUserIds` across runs. |
| **10** | Handle API rate limits, retries and errors | All HTTP Request nodes feature `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 2000`. Plus `Error Trigger` handler. |

---

## 📁 Repository Structure

```
lead-sniper/
├── package.json                          # Test runner & scripts
├── README.md                             # Project overview & compliance
├── .env.example                          # Environment configuration template
├── workflows/
│   ├── lead_sniper_workflow.json         # Production n8n workflow (18 nodes) — IMPORT THIS FILE ONLY
│   ├── phase1_github_ingestion.json      # Intermediate Phase 1 milestone (included in main workflow)
│   ├── phase2_enrichment_qualification.json # Intermediate Phase 2 milestone (included in main workflow)
│   ├── phase3_gemini_analysis.json       # Intermediate Phase 3 milestone (included in main workflow)
│   └── phase4_discord_resilience.json    # Intermediate Phase 4 milestone (included in main workflow)
├── docs/
│   ├── architecture.md                   # Full system architecture & Mermaid diagrams
│   ├── implementation_plan.md            # Multi-phase execution plan
│   ├── phase1_ingestion.md               # Phase 1 documentation
│   ├── phase2_qualification.md           # Phase 2 documentation
│   ├── phase3_gemini.md                  # Phase 3 documentation
│   ├── phase4_discord.md                 # Phase 4 documentation
│   └── operator_guide.md                 # Deployment, credentials & testing guide
├── tests/
│   ├── mock_stargazers.json              # Realistic stargazer API fixture
│   └── mock_profiles.json                # User profiles covering all boundary cases
└── scripts/
    ├── test_delta_detection.js           # Delta & persistent state unit tests
    ├── test_qualification.js             # Exact qualification boundary tests
    ├── test_gemini_sanitizer.js          # Gemini pitch single-sentence sanitizer tests
    ├── test_discord_payload.js           # Discord embed payload schema validator
    └── validate_and_simulate_e2e.js      # End-to-end VM simulation & JSON auditor
```

---

## 🧪 Automated Testing & Verification

Run the entire automated test suite with a single command:
```bash
npm test
```

### Verified Test Gates:
1. **Delta Detection & Deduplication:** Tested cold-start bootstrap, repeat runs (zero duplicates), new stars detection, and restarred user ID deduplication.
2. **Exact Qualification Condition:** Tested 8 profile variations including boundary values ($100$ followers / $50$ repos $\rightarrow$ Disqualified, $101$ followers $\rightarrow$ Qualified, $51$ repos $\rightarrow$ Qualified).
3. **Gemini Pitch Sanitizer:** Enforces strict single-sentence output, removes quotes, bolding, and conversational preambles (`"Here is why this user is a valuable lead:"`).
4. **Discord Webhook Schema:** Validates complete Rich Embed payload format (colors, fields, author avatar, thumbnail, footer).
5. **End-to-End Simulation:** Runs all workflow nodes inside an isolated Node VM runtime to simulate execution from GitHub ingestion to Discord dispatch and audit logging.

---

## 🚀 How to Run in n8n

Follow the step-by-step instructions in the [Operator Guide](file:///Users/dhanush/Desktop/lead-sniper/docs/operator_guide.md):
1. Import **only** [`workflows/lead_sniper_workflow.json`](file:///Users/dhanush/Desktop/lead-sniper/workflows/lead_sniper_workflow.json) into n8n.
2. Connect your **GitHub API** and **Google Gemini(PaLM) API** credentials inside n8n.
3. Set your target repository (`githubOwner`, `githubRepo`), `geminiModel` (`gemini-3.8-flash`), and `discordWebhookUrl` in the `Config` node.
4. Click **Test workflow** to run manually, then switch to **Active** for 15-minute scheduled polling.
