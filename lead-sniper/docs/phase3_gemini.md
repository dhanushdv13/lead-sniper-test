# Phase 3: Google Gemini AI Lead Analysis

## Overview
Phase 3 integrates Google Gemini (`gemini-3.8-flash`) to generate commercially valuable sales intelligence for qualified leads. It takes the enriched user profile (bio, company, name, follower count, and public repos) and prompts Gemini to synthesize why this user could be a valuable lead, enforcing the strict constraint that the output must be **exactly one single sentence**.

---

## Nodes Breakdown

1. **Generate AI Lead Pitch (`n8n-nodes-base.httpRequest`):**
   - **Method:** `POST`
   - **URL:** `=https://generativelanguage.googleapis.com/v1beta/models/{{ $env.GEMINI_MODEL || 'gemini-3.8-flash' }}:generateContent`
   - **Headers:** `Content-Type: application/json` (Auth via `x-goog-api-key` Header Auth or `Google Gemini(PaLM) API` predefined credential)
   - **System Instruction:** Explicitly directs the model to act as a B2B sales intelligence analyst and produce exactly one sentence without formatting, preambles, or markdown quotes.
   - **Generation Config:** `temperature: 0.2` (minimizes hallucination), `maxOutputTokens: 1024` (accommodates reasoning/thinking tokens).
   - **Resilience:** Built-in 3 retries with 2000 ms backoff for 429 rate limit tolerance.
2. **Sanitize & Enforce Single Sentence (`n8n-nodes-base.code`):**
   - Strips conversational preambles (e.g., `"Here is why this user is a lead:"`, `"Lead analysis:"`).
   - Removes wrapping quotes (`"` or `'`) and markdown bold tags (`**`).
   - Isolates strictly the first sentence ending in `.`, `!`, or `?`.
   - Appends a period if terminal punctuation is missing.
   - Provides a guaranteed non-empty fallback if API returns empty text.

---

## Verification
- Unit tested via `scripts/test_gemini_sanitizer.js`.
- Passed 5/5 boundary test scenarios including conversational prefixes, multi-sentence outputs, missing punctuation, and empty responses.

