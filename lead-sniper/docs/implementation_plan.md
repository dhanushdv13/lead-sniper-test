# Lead Sniper: Multi-Phase Implementation Plan

## Phase Overview

| Phase | Title | Scope & Deliverables | Verification Gates |
|---|---|---|---|
| **Phase 0** | **Architecture, Requirements & Setup** | System specs, environment template, directory structure, implementation roadmap. | User approval on plan & specs. |
| **Phase 1** | **GitHub Ingestion & State Management** | Stargazers polling (`Accept: application/vnd.github.star+json`), state tracking (`$getWorkflowStaticData` & file persistence), delta detection. | Unit test with simulated stargazer payload; delta extraction verified. |
| **Phase 2** | **Enrichment & Qualification Engine** | Profile retrieval (`GET /users/:username`), exact qualification filter (`followers > 100 OR public_repos > 50`), early termination branch. | Synthetic test cases: pass followers, pass repos, pass both, fail both. |
| **Phase 3** | **Google Gemini AI Lead Analysis** | Gemini prompt design, API integration, output sanitizer enforcing single-sentence pitch requirement. | Prompt validation against diverse profiles (corporate, indie dev, sparse bio). |
| **Phase 4** | **Discord Dispatch & Resilience** | Rich Discord embed payload generator, webhook transmission, persistent state commit, retry & rate limit handlers. | Discord webhook dry-run test with mock webhook payload; retry verification on simulated 429. |
| **Phase 5** | **End-to-End Assembly & Validation** | Complete importable n8n workflow JSON, documentation, setup guide, testing harness. | Successful workflow validation, import test, and run demonstration. |

---

## Detailed Phase Breakdown

### Phase 0: Architecture, Requirements & Setup (Current Phase)
- **Deliverables:**
  - `docs/architecture.md`: Comprehensive technical specifications and data flow.
  - `docs/implementation_plan.md`: Phased execution roadmap.
  - `.env.example`: Safe configuration template with credential placeholders.
  - Project directory structure (`workflows/`, `tests/`, `docs/`, `data/`, `scripts/`).
- **Sign-off Criteria:** User review and approval of the architectural design and phase plan.

### Phase 1: GitHub Ingestion & State Management
- **Goal:** Ingest repository stargazers and isolate newly added stargazers without duplicates.
- **Components:**
  - `Schedule Trigger` & `Manual Trigger` (for flexible testing).
  - Configuration node to set repository parameters (`owner`, `repo`).
  - Stargazers HTTP Request node with `Accept: application/vnd.github.star+json` and authorization headers.
  - State Deduplication Code Node using `$getWorkflowStaticData('global')` and cursor timestamp comparison.
- **Testing:**
  - Mock test fixture in `tests/mock_stargazers.json`.
  - Delta filtering test script to ensure only unseen stars pass through.

### Phase 2: User Enrichment & Qualification Logic
- **Goal:** Fetch comprehensive GitHub profiles and enforce strict qualification gates.
- **Components:**
  - User Profile HTTP Request node (`GET https://api.github.com/users/{{ $json.user.login }}`).
  - IF Node: Condition `{{ $json.followers }} > 100 || {{ $json.public_repos }} > 50`.
  - Disqualified route: Terminal node ensuring zero further compute or token consumption.
- **Testing:**
  - Comprehensive test suite covering boundary cases (followers=100, repos=50, followers=101, repos=51, both failing).

### Phase 3: Gemini AI Lead Analysis
- **Goal:** Synthesize profile data into an actionable single-sentence commercial rationale.
- **Components:**
  - Gemini prompt construction node.
  - Google Gemini HTTP / LLM Node using `gemini-3.8-flash`.
  - Sentence validation & sanitization node ensuring strict 1-sentence compliance without bullet points or preambles.
- **Testing:**
  - Prompt behavior tests checking sentence count and insight quality on varying profile densities.

### Phase 4: Discord Dispatch & Resilience
- **Goal:** Deliver rich, actionable alerts to Discord and finalize state updates.
- **Components:**
  - Discord webhook payload formatter (color-coded embed with profile links and stats).
  - Webhook POST node with retry on 429 / 5xx errors.
  - State Commit node: saves processed user ID and updates `lastProcessedStarredAt`.
  - Global Error Handling strategy.
- **Testing:**
  - Discord embed payload schema verification.

### Phase 5: End-to-End Workflow Assembly & Validation
- **Goal:** Package, test, and export the unified n8n workflow.
- **Components:**
  - `workflows/lead_sniper_workflow.json`: Valid, importable n8n workflow.
  - `README.md`: Complete operator manual and setup instructions.
  - Local n8n import validation check.

