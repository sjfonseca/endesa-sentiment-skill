# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Claude Code skill for automated sentiment analysis of Endesa (energy company) mentions on Reddit in Portugal. It scrapes Reddit via the Apify actor platform, runs sentiment analysis, filters negative posts, and exports results to CSV/JSON.

The project is a **skill package** (not a standalone app). It provides documentation (SKILL.md), a ready-to-use script, reference configs, and assets that users copy into their own Claude Code projects.

## Running the Script

```bash
# Install dependencies (from assets/package.json)
npm install axios dotenv sentiment csv-writer

# Run the routine (requires APIFY_API_KEY in .env)
node scripts/endesa-sentiment.js

# Debug mode
VERBOSE=true node scripts/endesa-sentiment.js
```

The only required env var is `APIFY_API_KEY`. See `assets/.env.example` for all configuration options.

## Architecture

**Single-file pipeline** in `scripts/endesa-sentiment.js` with sequential steps:

1. **Validate** Apify API key → 2. **Start** Reddit scraper actor (`apify~reddit-post-scraper`) → 3. **Poll** actor run status (5s intervals, 10min timeout) → 4. **Fetch** scraped posts → 5. **Analyze** sentiment (score + Portuguese complaint pattern matching) → 6. **Export** CSV → 7. **Generate** JSON report

Key design decisions:
- Sentiment uses the `sentiment` npm library augmented with Portuguese complaint regex patterns (`COMPLAINT_PATTERNS_PT`). A post is negative if its score < threshold OR it matches a complaint pattern.
- Output goes to `results/` directory with date-stamped filenames (`endesa-sentiment-YYYY-MM-DD.csv`, `report-YYYY-MM-DD.json`).
- The script uses CommonJS (`require`) — not ES modules.

## File Structure

- `SKILL.md` — 11-part technical guide (the main skill documentation)
- `scripts/endesa-sentiment.js` — The production routine script
- `references/` — Setup guide (QUICKSTART.md), Apify config details, test cases, example outputs
- `assets/` — `package.json` and `.env.example` template

## Tech Stack

Node.js 18+ | axios (HTTP) | sentiment (NLP) | csv-writer (export) | dotenv (config) | Optional: node-cron (scheduling), pg (PostgreSQL)
