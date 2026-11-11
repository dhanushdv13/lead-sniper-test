# Phase 2: User Profile Enrichment & Qualification Engine

## Overview
Phase 2 enriches newly identified stargazers with full GitHub user profiles, normalizes profile fields, and evaluates the strict business qualification rule:
$$\text{followers} > 100 \quad \lor \quad \text{public\_repos} > 50$$

If a lead satisfies this condition, they are routed forward to AI analysis. If they do not, they are immediately routed to a terminal Stop node, preventing further API calls or token usage.

---

## Nodes Breakdown

1. **Fetch User Profile (`n8n-nodes-base.httpRequest`):**
   - Endpoint: `GET https://api.github.com/users/{{ $json.login }}`
   - Headers: `Accept: application/vnd.github+json`, `Authorization: Bearer {{ $env.GITHUB_TOKEN }}`
   - Automatic retries: 3 attempts with 2000 ms backoff.
2. **Normalize Profile Data (`n8n-nodes-base.set`):**
   - Casts `followers` and `public_repos` to numbers (`Number($json.followers) || 0`).
   - Handles fallback values for optional profile attributes (`bio`, `company`, `location`, `name`).
3. **Qualification Filter (`n8n-nodes-base.if`):**
   - Condition 1: `followers > 100`
   - Condition 2: `public_repos > 50`
   - Combinator: `or` (OR logic)
   - **True Output (Index 0):** Advances qualified leads to Phase 3 (Gemini AI Analysis).
   - **False Output (Index 1):** Routes to Stop node.
4. **Stop - Unqualified Lead (`n8n-nodes-base.noOp`):**
   - Terminal node. No downstream connections, guaranteeing zero AI token usage or Discord notifications for disqualified stargazers.

---

## Boundary Test Results
Verified via `scripts/test_qualification.js`:
- Follower count > 100: **QUALIFIED**
- Public repository count > 50: **QUALIFIED**
- Both > thresholds: **QUALIFIED**
- Strict boundary check: 100 followers & 50 repos: **DISQUALIFIED** (condition is strictly `>`)
- Strict boundary check: 101 followers & 10 repos: **QUALIFIED**
- Strict boundary check: 10 followers & 51 repos: **QUALIFIED**
- Zero / low activity users: **DISQUALIFIED**

