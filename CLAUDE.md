# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Claude Code skill for automated sentiment analysis of Endesa (energy company) mentions on Reddit in Portugal. It also provides an optional X research runner for Xquik Apify Actors. The package exports Reddit sentiment results and structured X post or audience datasets.

The project is a **skill package** (not a standalone app). It provides documentation (SKILL.md), a ready-to-use script, reference configs, and assets that users copy into their own Claude Code projects.

## Running the Script

```bash
# Install dependencies (from assets/package.json)
npm install axios dotenv sentiment csv-writer

# Run the routine (requires APIFY_API_KEY in .env)
node scripts/endesa-sentiment.js

# Debug mode
VERBOSE=true node scripts/endesa-sentiment.js

# Validate the Xquik Actor runner without starting an Actor
npm test
X_TWEET_ENABLED=true X_SEARCH_TERMS="Endesa Portugal" \
  node scripts/xquik-x-research.js
```

`APIFY_API_KEY` is required for billable Actor execution. The Xquik runner is a
dry run by default. See `assets/.env.example` for all configuration options.

## Architecture

The Reddit sentiment pipeline lives in `scripts/endesa-sentiment.js`:

1. **Validate** the configured Apify key → 2. **Collect** Reddit posts through
   Arctic Shift → 3. **Analyze** sentiment → 4. **Export** CSV and Excel →
   5. **Generate** JSON → 6. **Optionally push** results.

The X research pipeline lives in `scripts/xquik-x-research.js`:

1. **Build** bounded inputs → 2. **Preview** them in dry-run mode →
   3. **Require** pricing approval → 4. **Run** enabled Xquik Actors →
   5. **Poll** without automatic charge retries → 6. **Export** raw JSON.

Key design decisions:
- Sentiment uses the `sentiment` npm library augmented with Portuguese complaint regex patterns (`COMPLAINT_PATTERNS_PT`). A post is negative if its score < threshold OR it matches a complaint pattern.
- Output goes to `results/`. Xquik filenames also include the Actor run ID.
- Result commits and pushes require `PUSH_RESULTS=true`.
- The script uses CommonJS (`require`) — not ES modules.

## File Structure

- `SKILL.md` — 11-part technical guide (the main skill documentation)
- `scripts/endesa-sentiment.js` — The production routine script
- `scripts/xquik-x-research.js`: Dry-run-first X post and audience runner
- `tests/endesa-sentiment.test.js`: Sentiment regression tests
- `tests/xquik-x-research.test.js`: Deterministic Actor input and safety tests
- `references/` — Setup guide (QUICKSTART.md), Apify config details, test cases, example outputs
- `assets/` — `package.json` and `.env.example` template

## Tech Stack

Node.js 18+ | axios (HTTP) | sentiment (NLP) | csv-writer (export) | dotenv (config) | Optional: node-cron (scheduling), pg (PostgreSQL)
