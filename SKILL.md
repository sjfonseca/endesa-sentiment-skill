---
name: endesa-sentiment-reddit-skill
description: "Create a Claude Code routine to collect and analyze negative sentiment about Endesa in Portugal from Reddit using the Apify actor for web scraping. Use this skill whenever the user wants to set up sentiment analysis workflows, scrape Reddit for brand/company mentions, collect data from social media for analysis, or integrate Apify actors with Claude Code. Covers environment setup, Apify actor configuration, Reddit data collection, sentiment analysis pipeline, and integration with MCP servers like Apify."
compatibility: "Requires Claude Code, Node.js 18+, npm, Apify API key, and access to the Apify MCP server"
---

# Endesa Sentiment Analysis from Reddit – Claude Code Routine

This skill guides you through creating a complete Claude Code routine that:
- **Scrapes Reddit** for mentions of Endesa in Portuguese communities
- **Filters negative sentiment** automatically
- **Stores results** in structured format
- **Integrates with Apify** via MCP server for scalable data collection
- **Provides reporting** on sentiment trends

---

## Part 1: Prerequisites & Setup

### 1.1 Environment Requirements

Before starting, ensure you have:

- **Claude Code** installed (Node.js 18+ required)
- **npm** or **yarn** for dependency management
- **Apify API Key** (get from https://apify.com)
- **Apify MCP Server** connected in your Claude.ai settings

**To install Claude Code:**
```bash
npm install -g @anthropic-ai/claude-code
```

### 1.2 Core Dependencies

Your routine will use:

- `axios` – HTTP requests to Apify API
- `dotenv` – Environment variable management
- `sentiment` or `natural` – Portuguese sentiment analysis
- `csv-writer` – Export results to CSV

---

## Part 2: Architecture Overview

### Data Flow

```
Reddit Posts (Endesa mentions)
    ↓
Apify Actor (web scraping)
    ↓
Claude Code Routine (orchestration)
    ↓
Sentiment Analysis (filter negatives)
    ↓
CSV Export + Reporting
```

### Key Components

| Component | Purpose |
|-----------|---------|
| **Apify Actor** | Scrapes Reddit threads/comments about Endesa |
| **Sentiment Analyzer** | Classifies posts as positive/neutral/negative |
| **Data Aggregator** | Combines results with metadata (date, author, thread) |
| **Report Generator** | Creates summary statistics and trends |

---

## Part 3: Creating the Claude Code Routine

### 3.1 Project Initialization

```bash
claude-code init endesa-sentiment-routine
cd endesa-sentiment-routine
npm install axios dotenv sentiment
```

### 3.2 Environment Configuration

Create a `.env` file:

```env
APIFY_API_KEY=your_apify_api_key_here
REDDIT_KEYWORDS=Endesa,EDP,electricidade,fatura
REDDIT_SUBREDDITS=portugal,Portuguese,legaladvice
SENTIMENT_THRESHOLD=-0.3
```

**Note on Keywords:** Include variations like:
- `Endesa` – official name
- `EDP` – parent company (Portugal)
- `electricidade` – electricity complaints
- `fatura` – billing complaints

### 3.3 Core Routine Structure

Your Claude Code routine should have this structure:

```javascript
// Main routine file: src/endesa-sentiment.js

const axios = require('axios');
const Sentiment = require('sentiment');
const { readFileSync } = require('fs');
require('dotenv').config();

const apifyClient = axios.create({
  baseURL: 'https://api.apify.com/v2',
  headers: {
    'Authorization': `Bearer ${process.env.APIFY_API_KEY}`
  }
});

const sentiment = new Sentiment();

// Core flow:
// 1. Trigger Apify actor for Reddit scraping
// 2. Poll actor run status
// 3. Fetch results when complete
// 4. Analyze sentiment
// 5. Filter negative posts
// 6. Generate report
```

---

## Part 4: Apify Actor Selection & Configuration

### 4.1 Recommended Apify Actors

**Option A: Reddit Post Scraper**
- Actor ID: `apify/reddit-post-scraper`
- Collects posts from subreddits matching keywords
- **Best for:** Broad sentiment collection

**Option B: Reddit Comment Scraper**
- Actor ID: `apify/reddit-comments-scraper`
- Targets comments on specific threads
- **Best for:** Detailed conversation analysis

### 4.2 Actor Input Configuration

```json
{
  "searchQueries": ["Endesa Portugal", "EDP eletricidade"],
  "subreddits": ["portugal", "legaladvice", "relationships"],
  "language": "pt",
  "maxResults": 1000,
  "sort": "new",
  "timeRange": "month"
}
```

### 4.3 Running the Actor in Your Routine

```javascript
async function scrapeRedditData() {
  console.log('Starting Reddit scrape via Apify...');
  
  const runResponse = await apifyClient.post('/actors/apify~reddit-post-scraper/runs', {
    "searchQueries": [
      "Endesa Portugal problemas",
      "EDP fatura queixa"
    ],
    "subreddits": ["portugal", "legaladvice"],
    "maxResults": 500,
    "timeRange": "month"
  });
  
  const runId = runResponse.data.data.id;
  console.log(`Actor run started: ${runId}`);
  
  // Poll for completion
  return pollActorRun(runId);
}

async function pollActorRun(runId) {
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes with 5s intervals
  
  while (attempts < maxAttempts) {
    const status = await apifyClient.get(`/actor-runs/${runId}`);
    
    if (status.data.data.status === 'SUCCEEDED') {
      console.log('Scraping complete!');
      return await getActorResults(runId);
    }
    
    if (status.data.data.status === 'FAILED') {
      throw new Error(`Actor run failed: ${status.data.data.exitCode}`);
    }
    
    console.log(`Waiting... (${status.data.data.status})`);
    await new Promise(r => setTimeout(r, 5000));
    attempts++;
  }
  
  throw new Error('Actor run timeout');
}

async function getActorResults(runId) {
  const results = await apifyClient.get(`/actor-runs/${runId}/dataset/items`);
  return results.data;
}
```

---

## Part 5: Sentiment Analysis Pipeline

### 5.1 Portuguese Sentiment Analysis

```javascript
function analyzeSentiment(text) {
  // Use natural language processing for Portuguese
  const result = sentiment.analyze(text);
  
  return {
    score: result.score,
    comparative: result.comparative,
    isNegative: result.score < parseFloat(process.env.SENTIMENT_THRESHOLD),
    rawScore: result.score
  };
}

async function filterAndProcessResults(redditPosts) {
  const negativePosts = [];
  
  for (const post of redditPosts) {
    const analysis = analyzeSentiment(post.title + ' ' + post.text);
    
    if (analysis.isNegative) {
      negativePosts.push({
        source: 'reddit',
        author: post.author,
        title: post.title,
        content: post.text || post.selftext,
        url: post.url,
        timestamp: post.created_utc,
        upvotes: post.ups,
        comments: post.num_comments,
        sentimentScore: analysis.score,
        sentimentComparative: analysis.comparative,
        collectedAt: new Date().toISOString()
      });
    }
  }
  
  return negativePosts;
}
```

### 5.2 Enhanced Sentiment with Context

For better accuracy, detect Portuguese-specific complaint patterns:

```javascript
const COMPLAINT_PATTERNS_PT = [
  /não funciona|não funciona|quebrado|bug/i,
  /problema|erro|defeito/i,
  /queixa|reclamação/i,
  /fatura alta|cobrança indevida|erro na cobrança/i,
  /mau serviço|péssimo serviço/i,
  /atendimento ruim|péssimo atendimento/i
];

function hasComplaintPattern(text) {
  return COMPLAINT_PATTERNS_PT.some(pattern => pattern.test(text));
}
```

---

## Part 6: Data Storage & Reporting

### 6.1 CSV Export

```javascript
const { createObjectCsvWriter } = require('csv-writer');

async function exportToCsv(negativePosts, filename = 'endesa-sentiment.csv') {
  const csvWriter = createObjectCsvWriter({
    path: filename,
    header: [
      { id: 'author', title: 'Author' },
      { id: 'title', title: 'Title' },
      { id: 'content', title: 'Content' },
      { id: 'url', title: 'URL' },
      { id: 'timestamp', title: 'Date' },
      { id: 'upvotes', title: 'Upvotes' },
      { id: 'sentimentScore', title: 'Sentiment Score' },
      { id: 'collectedAt', title: 'Collected At' }
    ]
  });
  
  await csvWriter.writeRecords(negativePosts);
  console.log(`Exported ${negativePosts.length} negative posts to ${filename}`);
}
```

### 6.2 Summary Report

```javascript
function generateReport(negativePosts) {
  const report = {
    collectionDate: new Date().toISOString(),
    totalNegativePosts: negativePosts.length,
    averageSentimentScore: (
      negativePosts.reduce((sum, p) => sum + p.sentimentScore, 0) / 
      negativePosts.length
    ).toFixed(2),
    topTopics: extractTopics(negativePosts).slice(0, 5),
    mostEngaged: negativePosts
      .sort((a, b) => b.upvotes - a.upvotes)
      .slice(0, 5)
      .map(p => ({
        title: p.title,
        upvotes: p.upvotes,
        score: p.sentimentScore
      }))
  };
  
  console.log('\n=== ENDESA SENTIMENT REPORT ===');
  console.log(JSON.stringify(report, null, 2));
  
  return report;
}

function extractTopics(posts) {
  // Simple keyword extraction from titles
  const topicFreq = {};
  posts.forEach(post => {
    const words = post.title.toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 4) {
        topicFreq[word] = (topicFreq[word] || 0) + 1;
      }
    });
  });
  
  return Object.entries(topicFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([topic, count]) => ({ topic, count }));
}
```

---

## Part 7: Main Orchestration Function

### 7.1 Complete Workflow

```javascript
async function runEndesaSentimentRoutine() {
  try {
    console.log('🚀 Starting Endesa Sentiment Analysis Routine\n');
    
    // Step 1: Scrape Reddit via Apify
    console.log('📡 Step 1: Scraping Reddit...');
    const redditPosts = await scrapeRedditData();
    console.log(`✅ Collected ${redditPosts.length} posts\n`);
    
    // Step 2: Analyze sentiment
    console.log('🧠 Step 2: Analyzing sentiment...');
    const negativePosts = await filterAndProcessResults(redditPosts);
    console.log(`✅ Found ${negativePosts.length} negative posts\n`);
    
    // Step 3: Export results
    console.log('💾 Step 3: Exporting results...');
    await exportToCsv(negativePosts);
    console.log('✅ CSV exported\n');
    
    // Step 4: Generate report
    console.log('📊 Step 4: Generating report...');
    const report = generateReport(negativePosts);
    
    console.log('\n✨ Routine completed successfully!');
    return {
      status: 'success',
      postsCollected: redditPosts.length,
      negativePostsFound: negativePosts.length,
      report: report
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Execute
runEndesaSentimentRoutine();
```

---

## Part 8: Schedule & Automation

### 8.1 Running with Node-cron

To run the routine periodically:

```bash
npm install node-cron
```

```javascript
const cron = require('node-cron');

// Run every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('⏰ Scheduled routine triggered');
  await runEndesaSentimentRoutine();
});

console.log('✅ Scheduler active. Routine will run daily at 2 AM');
```

### 8.2 Using Claude Code's Native Scheduling

If available in your Claude Code environment, use the built-in scheduling:

```javascript
// In claude-code.config.js
module.exports = {
  routine: {
    name: 'endesa-sentiment',
    schedule: '0 2 * * *', // cron format
    entrypoint: 'src/endesa-sentiment.js'
  }
};
```

---

## Part 9: Integration with MCP Servers

### 9.1 Apify MCP Server Integration

If you want Claude to automatically manage Apify runs, configure the MCP server:

```javascript
// Using MCP client within Claude Code
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');

async function createApifyMcpClient() {
  const client = new Client({
    name: 'apify-mcp-integration'
  });
  
  // Connect to Apify MCP server
  await client.connect({
    command: 'sse',
    url: 'https://mcp.apify.com/sse' // Replace with actual MCP server URL
  });
  
  return client;
}
```

---

## Part 10: Testing & Debugging

### 10.1 Test with Sample Data

Before running against Reddit, test with mock data:

```javascript
const MOCK_POSTS = [
  {
    author: 'user123',
    title: 'Endesa não funciona, fatura indevida!',
    text: 'Problema grave com cobrança',
    url: 'https://reddit.com/r/portugal/...',
    created_utc: Date.now() / 1000,
    ups: 42,
    num_comments: 5
  }
];

async function testSentimentAnalysis() {
  console.log('Testing sentiment analysis...');
  const results = await filterAndProcessResults(MOCK_POSTS);
  console.log(results);
}
```

### 10.2 Error Handling

```javascript
async function robustActorRun(config) {
  const maxRetries = 3;
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}`);
      return await scrapeRedditData();
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt} failed: ${error.message}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 2000 * attempt)); // Exponential backoff
      }
    }
  }
  
  throw lastError;
}
```

---

## Part 11: Deliverables & Next Steps

### Output Files

- `endesa-sentiment.csv` – Negative posts dataset
- `sentiment-report.json` – Statistics and analysis
- `logs/routine-{timestamp}.log` – Execution logs

### Recommended Enhancements

1. **Store in Database** – Use PostgreSQL/MongoDB instead of CSV for larger datasets
2. **Webhook Notifications** – Alert you when negative sentiment spikes
3. **Dashboard** – Build a real-time dashboard with Grafana or Metabase
4. **NLP Enhancement** – Use a Portuguese-trained model (BERT-pt) for better accuracy
5. **Multi-source** – Extend to Twitter (X), Facebook, Google Reviews

---

## References

- [Apify API Documentation](https://docs.apify.com/api/v2)
- [Apify Actor Library](https://apify.com/store)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code/overview)
- [Node.js Sentiment Analysis](https://github.com/thisandagain/sentiment)
- [Portuguese NLP Resources](https://github.com/ruilopes/portuguese-nlp-resources)

---

## Quick Command Reference

| Task | Command |
|------|---------|
| Initialize project | `claude-code init endesa-sentiment-routine` |
| Install dependencies | `npm install axios dotenv sentiment` |
| Run routine once | `node src/endesa-sentiment.js` |
| Run with scheduler | `node src/scheduler.js` |
| Test sentiment | `node test/sentiment.test.js` |
| Export logs | `cat logs/* > full-logs.txt` |

---

**Skill created:** Use this whenever you need to set up sentiment analysis workflows on social media, scrape data via Apify, integrate Claude Code with external APIs, or build automated data collection routines.
