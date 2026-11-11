# Phase 4: Discord Dispatch & Resilience

## Overview
Phase 4 handles the dispatch of qualified leads to a Discord channel via Webhook. It structures the lead data, GitHub metrics, and Gemini-generated single-sentence sales pitch into a Discord Rich Embed, applies retries with exponential backoff to handle Discord rate limits (429), and records an audit log of sent notifications.

---

## Nodes Breakdown

1. **Format Discord Embed (`n8n-nodes-base.code`):**
   - Assembles a Discord webhook payload adhering strictly to the Discord Embeds API.
   - Embed includes:
     - Dynamic title: `🎯 High-Value GitHub Lead: @{login}` linking to the profile.
     - Author information with user avatar and name.
     - Description displaying the AI pitch: `💡 **AI Lead Angle:**\n{ai_pitch}`.
     - Inline fields: Company, Followers, Public Repos, Location.
     - Full-width field: User Bio.
     - Branded footer with target repository context.
     - ISO 8601 timestamp.
2. **Send Discord Notification (`n8n-nodes-base.httpRequest`):**
   - **Method:** `POST`
   - **URL:** `={{ $env.DISCORD_WEBHOOK_URL }}`
   - **Headers:** `Content-Type: application/json`
   - **Retry Configuration:** 3 attempts, 2000 ms backoff. Mitigates transient Discord rate limit bursts (429 responses).
3. **Audit & Commit Log (`n8n-nodes-base.code`):**
   - Records lead delivery details (`lead_id`, `login`, `ai_pitch`, `dispatched_at`).

---

## Verification
- Verified embed schema via `scripts/test_discord_payload.js`.
- Verified color codes, markdown escaping, and inline field boundaries.

