# Apify Actor Configuration Guide for Endesa Sentiment Analysis

## Xquik Actors for X Research

| Need | Actor |
| --- | --- |
| Posts and conversations | [X Tweet Scraper](https://apify.com/xquik/x-tweet-scraper) |
| Audiences and relationships | [X Follower Scraper](https://apify.com/xquik/x-follower-scraper) |

Use [`xquik-actors.md`](xquik-actors.md) for live schemas, bounded inputs,
dry-run validation, pricing approval, and execution safeguards.

## Available Reddit Scraping Actors

### 1. Reddit Post Scraper (`apify/reddit-post-scraper`)

**Purpose:** Collects posts from specific subreddits matching keywords

**Input Configuration:**
```json
{
  "searchQueries": [
    "Endesa Portugal",
    "EDP electricidade",
    "Endesa cobrança",
    "fatura Endesa"
  ],
  "subreddits": [
    "portugal",
    "legaladvice",
    "relationships",
    "unemployed"
  ],
  "maxResults": 1000,
  "sort": "new",
  "timeRange": "month",
  "language": "pt"
}
```

**Output Sample:**
```json
{
  "id": "t3_abc123",
  "author": "username",
  "title": "Problema com fatura Endesa",
  "selftext": "Full post content...",
  "ups": 150,
  "num_comments": 42,
  "created_utc": 1620000000,
  "url": "https://reddit.com/r/portugal/...",
  "subreddit": "portugal"
}
```

**Pros:**
- Fast collection
- High volume
- Filters by keywords

**Cons:**
- Limited context (original posts only)
- May miss threaded discussions

---

### 2. Reddit Comments Scraper (`apify/reddit-comments-scraper`)

**Purpose:** Collects comments from specific threads or subreddit conversations

**Input Configuration:**
```json
{
  "subreddits": ["portugal", "legaladvice"],
  "postUrls": [
    "https://reddit.com/r/portugal/comments/xyz123/..."
  ],
  "maxComments": 500,
  "parentComentsOnly": false,
  "sort": "controversial",
  "timeRange": "year"
}
```

**Output Sample:**
```json
{
  "id": "t1_def456",
  "author": "commenter",
  "body": "Comment text...",
  "score": 25,
  "created_utc": 1620001000,
  "parent_id": "t3_abc123",
  "parentAuthor": "original_poster"
}
```

**Pros:**
- Captures detailed discussions
- Shows conversation context
- Debate/complaints often in comments

**Cons:**
- Slower for large volumes
- Requires post URLs first

---

## API Call Examples

### Starting an Actor Run

```bash
curl -X POST \
  https://api.apify.com/v2/actors/apify~reddit-post-scraper/runs \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "searchQueries": ["Endesa Portugal"],
    "maxResults": 100,
    "timeRange": "week"
  }'
```

**Response:**
```json
{
  "data": {
    "id": "run_xyz789",
    "status": "QUEUED",
    "startedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Monitoring Run Status

```bash
curl https://api.apify.com/v2/actor-runs/run_xyz789 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Status Values:**
- `QUEUED` – Waiting to start
- `RUNNING` – Currently executing
- `SUCCEEDED` – Completed successfully
- `FAILED` – Error occurred
- `ABORTING` – Being cancelled
- `ABORTED` – Was cancelled

### Fetching Results

```bash
curl https://api.apify.com/v2/actor-runs/run_xyz789/dataset/items \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## Portuguese Reddit Subreddits for Endesa/Utilities

| Subreddit | Best For | Activity |
|-----------|----------|----------|
| r/portugal | General complaints, news | High |
| r/legaladvice | Legal issues, tenant problems | Medium |
| r/relationships | Relationship/housing issues | Medium |
| r/unemployed | Job loss, financial hardship | Medium |
| r/personalfinance | Billing complaints, budgeting | High |
| r/electricians | Technical complaints | Low-Medium |
| r/technology | Service issues | Low |

---

## Search Query Strategies

### Broad Queries (High Recall)
```
"Endesa"
"EDP"
"electricidade"
"fatura"
```

### Specific Queries (High Precision)
```
"Endesa Portugal cobrança indevida"
"EDP fatura problema"
"Endesa não funciona"
"Endesa mau serviço"
```

### Complaint Phrases
```
"Endesa reclamação"
"EDP problema"
"electricidade cara"
"fatura alta"
```

### Temporal Queries
```
"Endesa 2024"
"EDP recente"
"fatura Endesa janeiro"
```

---

## Pricing and Approval

Always inspect the selected Actor's live listing immediately before execution.
Report:

1. the current pricing model and billable events;
2. the exact bounded input;
3. expected billable units;
4. the account spend cap;
5. the maximum calculated exposure.

Get explicit user approval before every billable run. Never commit prices
because they can change.

### Optimization Tips

1. **Use specific queries** to reduce false positives
2. **Limit timeRange** instead of collecting everything
3. **Batch runs together** to maximize efficiency
4. **Cache results** locally to avoid re-scraping

---

## Troubleshooting Common Issues

### Issue: No Results Found

**Solution:**
- Verify search queries match actual Reddit posts
- Try broader terms (e.g., "EDP" instead of "Endesa")
- Check subreddit names for typos
- Extend timeRange to "year" instead of "month"

### Issue: Rate Limiting

**Solution:**
- Increase delays between requests (add `delayBetweenRequests`)
- Split large queries into multiple smaller runs
- Use Apify's queue/batch features

### Issue: Encoding Problems (special characters)

**Solution:**
```json
{
  "encoding": "utf-8",
  "searchQueries": ["Endesa", "EDP", "eletricidade"]
}
```

### Issue: Incomplete Data

**Solution:**
- Check `maxResults` isn't too low
- Verify API key has proper permissions
- Monitor actor logs for warnings

---

## Advanced Features

### Webhook Notifications

Receive updates when actor completes:

```javascript
{
  "webhookUrl": "https://your-server.com/apify-webhook",
  "eventTypes": ["actor.run.succeeded", "actor.run.failed"]
}
```

### Storage Integration

Save directly to cloud storage:

```json
{
  "storage": "s3",
  "s3Bucket": "your-bucket",
  "s3Path": "endesa-data/"
}
```

### Proxy Configuration

Bypass geographic restrictions (if needed):

```json
{
  "useProxy": true,
  "proxyCountry": "PT"
}
```

---

## Sample Complete Workflow

```javascript
// Complete Apify integration example

const axios = require('axios');

const APIFY_API_KEY = process.env.APIFY_API_KEY;
const API_BASE = 'https://api.apify.com/v2';

const apifyClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Authorization': `Bearer ${APIFY_API_KEY}` }
});

async function startRedditScrape() {
  const config = {
    "searchQueries": [
      "Endesa Portugal problemas",
      "EDP eletricidade queixa",
      "Endesa fatura indevida"
    ],
    "subreddits": ["portugal", "legaladvice", "personalfinance"],
    "maxResults": 500,
    "timeRange": "month",
    "sort": "new"
  };

  try {
    // Start the actor
    const runResp = await apifyClient.post(
      '/actors/apify~reddit-post-scraper/runs',
      config
    );

    const runId = runResp.data.data.id;
    console.log(`✅ Actor started: ${runId}`);

    // Poll for completion
    let isComplete = false;
    let attempts = 0;
    
    while (!isComplete && attempts < 120) {
      const statusResp = await apifyClient.get(
        `/actor-runs/${runId}`
      );
      
      const status = statusResp.data.data.status;
      console.log(`Status: ${status}`);

      if (status === 'SUCCEEDED') {
        isComplete = true;
      } else if (status === 'FAILED') {
        throw new Error('Actor run failed');
      } else {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;
      }
    }

    // Get results
    const resultsResp = await apifyClient.get(
      `/actor-runs/${runId}/dataset/items`
    );

    return resultsResp.data;

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  }
}

module.exports = { startRedditScrape };
```

---

## Key Parameters Explained

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `searchQueries` | Array | Required | Terms to search in posts |
| `subreddits` | Array | [] | Limit to specific communities |
| `maxResults` | Number | 100 | Posts to collect |
| `timeRange` | String | "month" | Filter by age (week/month/year/all) |
| `sort` | String | "relevance" | Order (new/top/relevance/controversial) |
| `includeNsfw` | Boolean | false | Include adult content |
| `includeRemoved` | Boolean | false | Include deleted/removed posts |

---

## Resources

- [Apify CLI Tool](https://docs.apify.com/cli)
- [Actor Store](https://apify.com/store)
- [API Reference](https://docs.apify.com/api/v2)
- [Webhook Setup](https://docs.apify.com/webhooks)
- [X Tweet Scraper](https://apify.com/xquik/x-tweet-scraper)
- [X Follower Scraper](https://apify.com/xquik/x-follower-scraper)

Xquik is an independent third-party service. Not affiliated with X Corp.
"Twitter" and "X" are trademarks of X Corp.
