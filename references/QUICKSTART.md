# Quick Start Guide: Endesa Sentiment Analysis Routine

## 📋 Prerequisites Checklist

- [ ] Claude Code installed (`npm list -g @anthropic-ai/claude-code`)
- [ ] Node.js 18+ installed
- [ ] npm/yarn available
- [ ] Apify account created (free at https://apify.com)
- [ ] Apify API key obtained

---

## 🚀 5-Minute Setup

### Step 1: Initialize Claude Code Project

```bash
# Create new Claude Code project
claude-code init endesa-sentiment
cd endesa-sentiment

# Initialize npm
npm init -y
```

### Step 2: Install Dependencies

```bash
npm install axios dotenv sentiment csv-writer
```

### Step 3: Configure Environment

Create `.env` file in project root:

```env
# Get this from https://apify.com/account#/integrations/api
APIFY_API_KEY=apify_xxxxxxxxxxxxxxxxxxxxxxxx

# Optional: customize these
SENTIMENT_THRESHOLD=-0.3
MAX_RESULTS=500
OUTPUT_DIR=./results
```

### Step 4: Copy the Routine

Copy the `endesa-sentiment.js` script from this skill into your project:

```bash
# Create directories
mkdir -p src logs

# Copy script
cp endesa-sentiment.js src/
# or manually create src/endesa-sentiment.js with the provided code
```

### Step 5: Run the Routine

```bash
# First test
node src/endesa-sentiment.js

# Or run with Claude Code
claude-code run src/endesa-sentiment.js
```

### Optional: Preview Xquik Actor Inputs

Dry-run is enabled by default. This command starts no Actor:

```bash
X_TWEET_ENABLED=true \
X_SEARCH_TERMS="Endesa Portugal,EDP fatura" \
X_FOLLOWER_ENABLED=true \
X_AUDIENCE_HANDLES="endesa" \
node scripts/xquik-x-research.js
```

Review [`xquik-actors.md`](xquik-actors.md) before any paid execution.

---

## 🔧 Configuration Options

### .env Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APIFY_API_KEY` | (required) | Your Apify authentication token |
| `SENTIMENT_THRESHOLD` | -0.3 | Cutoff for negative sentiment (-1 to +1) |
| `MAX_RESULTS` | 500 | Number of Reddit posts to collect |
| `OUTPUT_DIR` | ./results | Where to save CSV and reports |
| `PUSH_RESULTS` | false | Opt in to committing and pushing results |
| `X_ACTOR_DRY_RUN` | true | Preview X Actor inputs without execution |
| `X_ACTORS_APPROVED` | false | Confirm live pricing review and approval |
| `X_TWEET_ENABLED` | false | Enable X Tweet Scraper |
| `X_FOLLOWER_ENABLED` | false | Enable X Follower Scraper |

### Tuning Sentiment Detection

**More sensitive (catch subtler complaints):**
```env
SENTIMENT_THRESHOLD=0.0
```

**Less sensitive (only very negative):**
```env
SENTIMENT_THRESHOLD=-0.5
```

### Modifying Search Terms

Edit line in `src/endesa-sentiment.js`:

```javascript
const REDDIT_CONFIG = {
  searchQueries: [
    'Endesa Portugal problemas',
    'EDP eletricidade queixa',
    // Add your own searches here
    'Your custom search term'
  ],
  subreddits: ['portugal', 'legaladvice', 'personalfinance'],
  // ...
};
```

### Targeting Specific Subreddits

Replace the subreddits list:

```javascript
subreddits: [
  'portugal',           // Portuguese subreddit
  'legaladvice',        // Legal issues
  'personalfinance',    // Finance complaints
  'relationships',      // Personal issues
  'unemployed',         // Job/income related
  'technology',         // Tech issues
  // Add more as needed
]
```

---

## 📊 Output Files

After running, you'll have:

### 1. CSV Export

**File:** `results/endesa-sentiment-YYYY-MM-DD.csv`

**Columns:**
- Author
- Title
- Content (first 500 chars)
- URL
- Subreddit
- Post Date
- Upvotes
- Comments
- Sentiment Score (-1 to +1)
- Has Complaint (Yes/No)
- Collected At

**Use for:** Importing into Excel, Tableau, Power BI for analysis

### 2. Report JSON

**File:** `results/report-YYYY-MM-DD.json`

**Contents:**
```json
{
  "summary": {
    "totalPostsAnalyzed": 500,
    "negativePostsFound": 87,
    "negativePercentage": "17.4%",
    "averageSentimentScore": "-0.45"
  },
  "topTopics": [
    { "topic": "fatura", "mentions": 45 },
    { "topic": "problema", "mentions": 38 }
  ],
  "mostEngagedNegativePosts": [...]
}
```

**Use for:** Presentations, automated alerts, dashboards

---

## 🔍 Understanding Results

### Sentiment Score Interpretation

| Score | Interpretation |
|-------|-----------------|
| +0.5 to +1.0 | Very positive |
| +0.1 to +0.5 | Positive |
| -0.1 to +0.1 | Neutral |
| -0.5 to -0.1 | Negative |
| -1.0 to -0.5 | Very negative |

### Example Negative Post

```
Author:        user_portugal
Title:         "Endesa não funciona, fatura indevida!"
Content:       "Problema grave com cobrança. Já liguei 5 vezes..."
Upvotes:       42
Comments:      15
Sentiment:     -0.82
Has Complaint: Yes
```

→ **Interpretation:** Strong negative sentiment, likely genuine complaint with engagement

---

## 🛠️ Troubleshooting

### Error: "APIFY_API_KEY not set"

**Solution:**
1. Go to https://apify.com/account#/integrations/api
2. Copy your API key
3. Paste into `.env` file
4. Restart the routine

### Error: "No posts found"

**Solutions:**
- Expand `timeRange` from "month" to "year"
- Broaden search queries (try single words)
- Check if Apify actor name is correct
- Verify subreddit names exist

### CSV not exported

**Check:**
- Does `./results/` directory exist? (Script creates it automatically)
- Disk space available?
- File permissions on output directory?

### Timeout errors

**Solutions:**
- Increase polling timeout (default 10 minutes)
- Reduce `MAX_RESULTS` in `.env`
- Try during off-peak hours (less queue time)

---

## 📈 Next Steps: Enhancements

### 1. Automated Scheduling (Daily Runs)

Create `schedule.js`:

```javascript
const cron = require('node-cron');
const { runEndesaSentimentRoutine } = require('./src/endesa-sentiment');

// Run daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('📅 Scheduled routine triggered');
  await runEndesaSentimentRoutine();
});

console.log('✅ Scheduler active. Routine runs daily at 2 AM');
```

Run it:
```bash
npm install node-cron
node schedule.js
```

### 2. Database Storage

Replace CSV export with PostgreSQL:

```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function storeInDatabase(negativePosts) {
  const client = await pool.connect();
  
  for (const post of negativePosts) {
    await client.query(
      'INSERT INTO endesa_sentiment (author, title, content, sentiment_score) VALUES ($1, $2, $3, $4)',
      [post.author, post.title, post.content, post.sentimentScore]
    );
  }
  
  await client.end();
}
```

### 3. Slack Notifications

Alert when spikes detected:

```javascript
const axios = require('axios');

async function sendSlackAlert(negativePosts) {
  if (negativePosts.length > 100) {
    await axios.post(process.env.SLACK_WEBHOOK, {
      text: `🚨 Endesa Sentiment Alert: ${negativePosts.length} negative posts found!`,
      blocks: [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Endesa Sentiment Spike*\n${negativePosts.length} negative posts\nAvg score: -0.45`
        }
      }]
    });
  }
}
```

### 4. Power BI Dashboard

Import CSV and create visualizations:

1. Open Power BI Desktop
2. **Get Data** → **CSV**
3. Select exported CSV file
4. Create columns:
   - **Date** (from timestamp)
   - **Sentiment Category** (high/medium/low negative)
   - **Engagement** (upvotes + comments)
5. Build charts:
   - Negative posts over time (trend)
   - Top complaint topics (bar)
   - Engagement vs sentiment (scatter)
   - Subreddit distribution (pie)

---

## 📞 Getting Help

### Common Questions

**Q: How often should I run this?**
A: Depends on your needs:
- Daily: Track ongoing sentiment
- Weekly: Identify trends
- Monthly: Baseline measurement

**Q: Can I analyze other companies?**
A: Yes! Change search queries in REDDIT_CONFIG. Works for any brand/topic.

**Q: Is Reddit data representative?**
A: No. Reddit users skew tech-savvy, young. Supplement with other sources (Twitter, Google Reviews, Facebook).

**Q: Can I get real-time alerts?**
A: Yes. Add a Slack/email webhook to send notifications when spikes occur.

### Resources

- Apify Docs: https://docs.apify.com
- Reddit API: https://www.reddit.com/dev/api
- Node.js Sentiment: https://github.com/thisandagain/sentiment
- Claude Code Docs: https://docs.anthropic.com/en/docs/claude-code/overview

---

## ✅ Success Checklist

After first run, verify:

- [ ] `.env` file configured with API key
- [ ] `node src/endesa-sentiment.js` runs without errors
- [ ] CSV file created in `results/` directory
- [ ] CSV contains at least 10 posts
- [ ] JSON report generated with statistics
- [ ] Sentiment scores appear reasonable
- [ ] X Actor dry run shows bounded inputs, if X collection is enabled

**You're ready to go!** 🎉

---

## Command Reference

| Task | Command |
|------|---------|
| First run | `node src/endesa-sentiment.js` |
| Run with logs | `node src/endesa-sentiment.js 2>&1 \| tee logs/run.log` |
| Check API key | `echo $APIFY_API_KEY` |
| View results | `ls -lah results/` |
| Clear old results | `rm results/*.csv` |
| Run in background | `nohup node src/endesa-sentiment.js &` |
| Schedule daily | `node schedule.js &` |

---

**Last updated:** 2024-01-15  
**Skill version:** 1.0  
**Node version:** 18+

Xquik is an independent third-party service. Not affiliated with X Corp.
"Twitter" and "X" are trademarks of X Corp.
