# Xquik Apify Actors for X Research

Use this guide to extend the sentiment workflow with structured X post and
audience data. The runner is `scripts/xquik-x-research.js`.

## Actor Catalog

| Need | Actor | Apify API ID |
| --- | --- | --- |
| Posts and conversations | [X Tweet Scraper](https://apify.com/xquik/x-tweet-scraper) | `xquik~x-tweet-scraper` |
| Audiences and relationships | [X Follower Scraper](https://apify.com/xquik/x-follower-scraper) | `xquik~x-follower-scraper` |

X Tweet Scraper supports:

- post URLs and IDs;
- advanced search terms;
- account posts, replies, media, and best-effort likes;
- list timelines;
- articles, replies, quotes, and threads;
- retweeters and best-effort favoriters.

X Follower Scraper supports:

- followers and following;
- verified followers;
- list members and followers;
- community members;
- audience overlap across several targets.

## Safety Defaults

The runner uses these safeguards:

- dry-run mode is enabled by default;
- billable execution requires `X_ACTORS_APPROVED=true`;
- the Apify token only appears in an authorization header;
- every input has whole-run and per-target caps;
- failed runs are not retried automatically;
- results preserve diagnostic rows;
- no result file is committed or pushed automatically.

Review each Actor's live Apify pricing before execution. Never reuse a saved
price. Enabled Actors run sequentially and can create separate charges.

## Inspect the Live Schemas

The public build endpoint returns `inputSchema` as a JSON string:

```bash
curl --fail --silent --show-error \
  "https://api.apify.com/v2/acts/xquik~x-tweet-scraper/builds/default" |
  jq -r '.data.inputSchema' | jq .

curl --fail --silent --show-error \
  "https://api.apify.com/v2/acts/xquik~x-follower-scraper/builds/default" |
  jq -r '.data.inputSchema' | jq .
```

Inspect these schemas before adding or renaming input fields.

## Configure Tweet Collection

Enable the Actor and provide at least 1 target type:

```env
X_TWEET_ENABLED=true
X_SEARCH_TERMS=Endesa Portugal,EDP fatura
X_TWEET_URLS=
X_TWEET_IDS=
X_POST_HANDLES=
X_TWEET_LIST_IDS=

X_TWEET_MAX_ITEMS=100
X_TWEET_MAX_ITEMS_PER_TARGET=25
X_TWEET_OUTPUT_VARIANT=rich
X_TWEET_FIELD_STYLE=camelCase
X_TWEET_OUTPUT_PRESET=flat
```

`X_TWEET_MAX_ITEMS` caps the whole run across every search term and target.
`X_TWEET_MAX_ITEMS_PER_TARGET` limits any single target.

Supported tweet output variants are `legacy`, `rich`, and `raw`. Supported
field styles are `legacy`, `camelCase`, and `snake_case`. Output can be
`nested` or CSV-friendly `flat`.

## Configure Audience Collection

Enable the Actor and provide at least 1 target type:

```env
X_FOLLOWER_ENABLED=true
X_AUDIENCE_URLS=
X_AUDIENCE_HANDLES=endesa
X_AUDIENCE_LIST_IDS=
X_AUDIENCE_COMMUNITY_IDS=

X_AUDIENCE_RELATION=followers
X_FOLLOWER_MAX_ITEMS=100
X_FOLLOWER_MAX_ITEMS_PER_TARGET=25
X_FOLLOWER_OUTPUT_MODE=full
X_FOLLOWER_DEDUPE_MODE=none
```

Supported relations are:

- `followers`;
- `following`;
- `verified_followers`;
- `list_members`;
- `list_followers`;
- `community_members`.

Use `list_members` or `list_followers` with list IDs. Use `community_members`
with community IDs. Run different target families separately unless target
URLs already encode their relations.

Supported output modes are `compact`, `full`, and `raw`. Dedupe modes are
`none`, `first`, and `merge`. `merge` adds overlap metadata for comparison.

`X_FOLLOWER_MAX_ITEMS` caps the whole run. The per-target limit controls
fairness across several targets.

## Preview Without Spending

Dry-run mode is the default. It prints both bounded inputs without starting an
Actor:

```bash
X_TWEET_ENABLED=true \
X_SEARCH_TERMS="Endesa Portugal,EDP fatura" \
X_FOLLOWER_ENABLED=true \
X_AUDIENCE_HANDLES="endesa" \
node scripts/xquik-x-research.js
```

The preview never prints `APIFY_API_KEY`.

## Approve and Execute

Before execution:

1. Open every enabled Actor listing.
2. Record the current pricing model and billable events.
3. Review the exact dry-run input.
4. Calculate maximum exposure from current pricing and input caps.
5. Confirm the Apify account spend cap.
6. Get explicit user approval.

Then execute:

```bash
X_ACTOR_DRY_RUN=false \
X_ACTORS_APPROVED=true \
X_TWEET_ENABLED=true \
X_SEARCH_TERMS="Endesa Portugal,EDP fatura" \
node scripts/xquik-x-research.js
```

Keep `APIFY_API_KEY` in the environment or a secret manager. Never put it in a
URL, committed file, issue, pull request, or command output.

## Output Contract

Each enabled Actor writes a dated JSON file:

- `results/xquik-tweet-YYYY-MM-DD-RUN_ID.json`;
- `results/xquik-follower-YYYY-MM-DD-RUN_ID.json`.

Each file contains:

- Actor ID and listing;
- approved input;
- run and dataset IDs;
- collection timestamp;
- item and diagnostic counts;
- raw dataset items.

Preserve diagnostic rows for unavailable targets. Never invent missing posts
or profiles.

## Validation

Run local tests and a dry plan:

```bash
npm test

X_TWEET_ENABLED=true \
X_SEARCH_TERMS="Endesa Portugal" \
X_FOLLOWER_ENABLED=true \
X_AUDIENCE_HANDLES="endesa" \
node scripts/xquik-x-research.js
```

No live Actor run is required for these checks.

Xquik is an independent third-party service. Not affiliated with X Corp.
"Twitter" and "X" are trademarks of X Corp.
