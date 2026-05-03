# Example Outputs: Endesa Sentiment Analysis Routine

This document shows what you can expect to see when running the routine successfully.

---

## Console Output Example

```
╔═══════════════════════════════════════════════════╗
║   🚀 ENDESA SENTIMENT ANALYSIS ROUTINE 🚀        ║
╚═══════════════════════════════════════════════════╝

Step 1: Validating Apify configuration...
✅ Apify authentication successful. User: john_doe_apify

Step 2: Starting Reddit data collection...
📡 Starting Reddit scrape via Apify actor...
✅ Actor run started with ID: l7h2q9m8kpvx

Step 3: Waiting for scraping to complete...
⏳ Poll #1 - Status: RUNNING | Items: 45
⏳ Poll #2 - Status: RUNNING | Items: 145
⏳ Poll #3 - Status: RUNNING | Items: 287
⏳ Poll #4 - Status: RUNNING | Items: 412
✅ Actor run completed successfully!

Step 4: Retrieving scraped data...
📊 Fetching actor results...
✅ Retrieved 500 items from actor

Step 5: Analyzing sentiment...
🧠 Analyzing sentiment on all posts...

📈 Sentiment Analysis Results:
   Total posts: 500
   Negative: 87
   Positive: 156
   Neutral: 257
   Average score: -0.32

Step 6: Exporting results...
💾 Exported 87 posts to results/endesa-sentiment-2024-01-15.csv

Step 7: Generating report...
📊 Report saved to results/report-2024-01-15.json

╔════════════════════════════════════════╗
║     ENDESA SENTIMENT ANALYSIS REPORT    ║
╚════════════════════════════════════════╝

Total Posts Analyzed:  500
Negative Posts Found:  87 (17.4%)
Average Sentiment:     -0.32

Top Topics:
  1. fatura (45 mentions)
  2. problema (38 mentions)
  3. cobrança (32 mentions)
  4. serviço (28 mentions)
  5. queixa (22 mentions)

✨ Routine completed in 127.3s
```

---

## CSV Export Sample

**File:** `results/endesa-sentiment-2024-01-15.csv`

| Author | Title | Content | URL | Subreddit | Post Date | Upvotes | Comments | Sentiment Score | Has Complaint | Collected At |
|--------|-------|---------|-----|-----------|-----------|---------|----------|-----------------|---------------|--------------|
| user_portugal | Endesa não funciona, fatura indevida! | Problema grave com cobrança. Já liguei 5 vezes ao serviço de cliente... | https://reddit.com/r/portugal/comments/xyz123 | portugal | 2024-01-14T15:32:00Z | 42 | 15 | -0.82 | Yes | 2024-01-15T10:45:22Z |
| lisboa_tech | EDP cobrança abusiva | A minha fatura subiu 300% sem justificação. Ridiculo! | https://reddit.com/r/portugal/comments/abc456 | portugal | 2024-01-13T09:12:00Z | 28 | 8 | -0.71 | Yes | 2024-01-15T10:45:22Z |
| frustrated_tenant | Mau atendimento Endesa | Péssimo serviço de atendimento ao cliente. Ninguém resolve nada... | https://reddit.com/r/legaladvice/comments/def789 | legaladvice | 2024-01-12T20:45:00Z | 15 | 4 | -0.65 | Yes | 2024-01-15T10:45:22Z |
| power_user | Problema instalação | Técnico não veio à hora marcada, sem aviso. Que falta de respeito! | https://reddit.com/r/portugal/comments/ghi012 | portugal | 2024-01-11T14:20:00Z | 9 | 2 | -0.58 | Yes | 2024-01-15T10:45:22Z |
| pdl_admin | Falhas no sistema | Sistema de atendimento online constantemente em erro... | https://reddit.com/r/technology/comments/jkl345 | technology | 2024-01-10T11:00:00Z | 5 | 1 | -0.54 | Yes | 2024-01-15T10:45:22Z |

**Format Notes:**
- One row per negative post found
- Content truncated to first 500 characters
- URLs clickable for verification
- Sentiment Score: -1.0 (very negative) to +1.0 (very positive)
- Has Complaint: "Yes" if Portuguese complaint pattern detected

---

## JSON Report Sample

**File:** `results/report-2024-01-15.json`

```json
{
  "generatedAt": "2024-01-15T10:45:22.000Z",
  "summary": {
    "totalPostsAnalyzed": 500,
    "negativePostsFound": 87,
    "positivePostsFound": 156,
    "neutralPostsFound": 257,
    "negativePercentage": "17.4",
    "averageSentimentScore": "-0.32"
  },
  "topTopics": [
    {
      "topic": "fatura",
      "mentions": 45
    },
    {
      "topic": "problema",
      "mentions": 38
    },
    {
      "topic": "cobrança",
      "mentions": 32
    },
    {
      "topic": "serviço",
      "mentions": 28
    },
    {
      "topic": "queixa",
      "mentions": 22
    },
    {
      "topic": "mau",
      "mentions": 18
    },
    {
      "topic": "péssimo",
      "mentions": 15
    },
    {
      "topic": "reclamação",
      "mentions": 12
    },
    {
      "topic": "abusivo",
      "mentions": 9
    },
    {
      "topic": "erro",
      "mentions": 8
    }
  ],
  "mostEngagedNegativePosts": [
    {
      "title": "Endesa não funciona, fatura indevida!",
      "upvotes": 42,
      "comments": 15,
      "score": "-0.82"
    },
    {
      "title": "EDP cobrança abusiva",
      "upvotes": 28,
      "comments": 8,
      "score": "-0.71"
    },
    {
      "title": "Mau atendimento Endesa",
      "upvotes": 15,
      "comments": 4,
      "score": "-0.65"
    },
    {
      "title": "Problema instalação",
      "upvotes": 9,
      "comments": 2,
      "score": "-0.58"
    },
    {
      "title": "Falhas no sistema",
      "upvotes": 5,
      "comments": 1,
      "score": "-0.54"
    }
  ],
  "configuration": {
    "searchQueries": [
      "Endesa Portugal problemas",
      "EDP eletricidade queixa",
      "Endesa fatura indevida",
      "Endesa mau serviço",
      "Endesa não funciona"
    ],
    "subreddits": [
      "portugal",
      "legaladvice",
      "personalfinance",
      "relationships"
    ],
    "timeRange": "month",
    "sentimentThreshold": -0.3
  }
}
```

---

## Directory Structure After First Run

```
endesa-sentiment-routine/
├── src/
│   ├── endesa-sentiment.js       (main routine)
│   └── scheduler.js              (optional: for scheduling)
├── results/                       (created automatically)
│   ├── endesa-sentiment-2024-01-15.csv
│   ├── report-2024-01-15.json
│   ├── endesa-sentiment-2024-01-14.csv
│   └── report-2024-01-14.json
├── logs/                          (created automatically)
│   ├── endesa-sentiment.log
│   └── scheduler.log
├── node_modules/                  (npm packages)
├── .env                           (your configuration)
├── .env.example                   (template)
├── .gitignore                     (excludes .env, node_modules)
├── package.json                   (dependencies)
├── README.md                      (documentation)
└── .git/                          (version control, optional)
```

---

## Error Output Examples

### Authentication Error

```
❌ Error: APIFY_API_KEY not set. Please configure it in .env file or environment variables.

Process exited with code 1
```

**Fix:** Add valid API key to `.env`

---

### No Posts Found

```
📡 Starting Reddit scrape via Apify actor...
✅ Actor run started with ID: l7h2q9m8kpvx
...
ℹ️  No posts found. Exiting.
```

**Fix:** Try broader search terms or longer time range

---

### API Rate Limit

```
⏳ Poll #45 - Status: RUNNING | Items: 234
⏳ Poll #46 - Status: FAILED
❌ Error: Actor failed: rate_limit_exceeded

Process exited with code 1
```

**Fix:** Wait a few minutes and try again, or reduce `MAX_RESULTS`

---

## Data Quality Indicators

### Good Run Indicators ✅

- 50+ negative posts found (17% of 500 results typical)
- Sentiment scores distributed (-0.9 to -0.1)
- Top topics make sense (fatura, cobrança, problema)
- CSV and JSON both export successfully
- Total run time < 5 minutes

### Warning Signs ⚠️

- Very few negative posts (< 5 from 500 posts)
- All sentiment scores identical (usually 0)
- No topics extracted (all posts truncated?)
- Runtime > 10 minutes (Apify queue delays)
- CSV file size < 10KB (truncation issue?)

### Check List

```
Verification Checklist:
☐ CSV file created and has data
☐ JSON report has > 5 topics
☐ Sentiment scores vary (not all same)
☐ Post dates are recent (within time range)
☐ URL links are valid reddit.com URLs
☐ Upvotes look reasonable (0-1000+)
☐ Authors are not all "[deleted]"
☐ Content text is meaningful (not empty)
```

---

## Sample Analysis Insights

Based on a typical run, you might observe:

### Topic Analysis
- **Most mentioned:** billing/payment issues (fatura, cobrança)
- **Common complaints:** service quality, response times
- **Frequency:** peaks on weekends (billing queries)
- **Trend:** increasing complaints over time

### Engagement Patterns
- **High engagement:** Posts about billing errors (30+ comments)
- **Lower engagement:** System/technical issues (2-5 comments)
- **Upvote correlation:** Relatable issues get more upvotes
- **Most shared:** Legal/consumer rights posts

### Sentiment Insights
- **Very negative:** Fraud allegations (-0.9), billing overcharges
- **Moderately negative:** Service complaints, wait times
- **Mixed:** Installation issues (technical vs service)
- **Outliers:** Long personal stories (can be neutral but sad)

---

## Next Steps After Getting Output

1. **Review CSV:** Open in Excel/Google Sheets, sort by upvotes
2. **Check Top Posts:** Visit URLs, verify sentiment matches reality
3. **Identify Patterns:** Group complaints by category
4. **Schedule:** Set up daily/weekly runs to track trends
5. **Alert:** Configure Slack/email if spike detected
6. **Visualize:** Import into Power BI/Tableau

---

**Example outputs generated:** 2024-01-15  
**Data shown:** Sample from routine run  
**Posts anonymized:** Where applicable
