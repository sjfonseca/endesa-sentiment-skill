#!/usr/bin/env node

/**
 * Endesa Sentiment Analysis Routine
 * Collects and analyzes negative sentiment about Endesa from Reddit via Apify
 *
 * Usage: node endesa-sentiment.js
 * Requirements: npm install axios dotenv sentiment csv-writer exceljs
 */

const axios = require('axios');
const Sentiment = require('sentiment');
const { createObjectCsvWriter } = require('csv-writer');
const ExcelJS = require('exceljs');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  apiKey: process.env.APIFY_API_KEY || '',
  sentimentThreshold: parseFloat(process.env.SENTIMENT_THRESHOLD || '-0.3'),
  maxResults: parseInt(process.env.MAX_RESULTS || '500'),
  outputDir: process.env.OUTPUT_DIR || './results'
};

const APIFY_API_BASE = 'https://api.apify.com/v2';

const REDDIT_CONFIG = {
  searchTerms: [
    'Endesa Portugal problemas',
    'EDP eletricidade queixa',
    'Endesa fatura indevida',
    'Endesa mau serviço',
    'Endesa reclamação'
  ],
  searchPosts: true,
  searchComments: false,
  searchCommunities: false,
  withinCommunity: 'r/portugal',
  maxPostsCount: Math.min(CONFIG.maxResults, 900),
  searchTime: 'month',
  searchSort: 'new'
};

// ============================================================================
// SENTIMENT ANALYSIS
// ============================================================================

const sentiment = new Sentiment();

// Portuguese-specific complaint patterns for enhanced detection
const COMPLAINT_PATTERNS_PT = [
  /problema|erro|defeito|falha/gi,
  /queixa|reclamação|reclamar|denúncia/gi,
  /não funciona|inoperante/gi,
  /fatura alta|cobrança indevida|erro na cobrança|fatura errada/gi,
  /cobrou-me|cobrou.*indevid|fatura.*estimativa|estimativa.*fatura|acerto.*fatura|fatura.*acerto/gi,
  /mau serviço|péssimo serviço|atendimento ruim|péssimo atendimento/gi,
  /abusivo|predador|exploração/gi,
  /fraude|enganado|trapaceiro/gi,
  /ineficiente|ineficácia/gi
];

function analyzeSentiment(text) {
  if (!text) return { score: 0, comparative: 0, isNegative: false, hasComplaint: false };

  const result = sentiment.analyze(text);
  const hasComplaint = COMPLAINT_PATTERNS_PT.some(pattern => pattern.test(text));

  return {
    score: result.score,
    comparative: result.comparative,
    isNegative: result.score < CONFIG.sentimentThreshold || hasComplaint,
    hasComplaint: hasComplaint,
    rawScore: result.score
  };
}

// ============================================================================
// APIFY INTEGRATION
// ============================================================================

const apifyClient = axios.create({
  baseURL: APIFY_API_BASE,
  headers: {
    'Authorization': `Bearer ${CONFIG.apiKey}`,
    'Content-Type': 'application/json'
  }
});

async function validateApiKey() {
  if (!CONFIG.apiKey) {
    throw new Error(
      'APIFY_API_KEY not set. Please configure it in .env file or environment variables.'
    );
  }

  try {
    const response = await apifyClient.get('/users/me');
    console.log(`✅ Apify authentication successful. User: ${response.data.data.username}`);
    return true;
  } catch (error) {
    throw new Error(`❌ Apify authentication failed: ${error.message}`);
  }
}

async function startRedditScrape() {
  console.log('\n📡 Starting Reddit scrape via Apify actor...');

  const payload = {
    ...REDDIT_CONFIG
  };

  try {
    const response = await apifyClient.post(
      '/acts/3XedXIRBcjfKrnsDJ/runs',
      payload
    );

    const runId = response.data.data.id;
    console.log(`✅ Actor run started with ID: ${runId}`);

    return runId;
  } catch (error) {
    throw new Error(`Failed to start actor: ${error.response?.data?.message || error.message}`);
  }
}

async function pollActorRun(runId, maxWaitTime = 600000) {
  // 10 minutes max
  const startTime = Date.now();
  let pollCount = 0;

  while (Date.now() - startTime < maxWaitTime) {
    pollCount++;

    try {
      const response = await apifyClient.get(`/actor-runs/${runId}`);
      const status = response.data.data.status;
      const stats = response.data.data.stats;

      console.log(
        `⏳ Poll #${pollCount} - Status: ${status} | Items: ${stats?.itemsCount || 0}`
      );

      if (status === 'SUCCEEDED') {
        console.log('✅ Actor run completed successfully!');
        return true;
      }

      if (status === 'FAILED') {
        throw new Error(`Actor failed: ${response.data.data.exitCode}`);
      }

      // Wait 5 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      throw new Error(`Error polling actor status: ${error.message}`);
    }
  }

  throw new Error('Actor run timeout');
}

async function getActorResults(runId) {
  console.log('\n📊 Fetching actor results...');

  try {
    const response = await apifyClient.get(`/actor-runs/${runId}/dataset/items`);

    const items = response.data;
    console.log(`✅ Retrieved ${items.length} items from actor`);

    return items;
  } catch (error) {
    throw new Error(`Failed to fetch results: ${error.message}`);
  }
}

// ============================================================================
// DATA PROCESSING
// ============================================================================

const RELEVANCE_KEYWORDS = /endesa|edp|eletricidade|electricidade/i;

function isRelevantPost(post) {
  const fullText = `${post.title || ''} ${post.body || ''}`;
  return RELEVANCE_KEYWORDS.test(fullText);
}

async function filterAndAnalyzePosts(redditPosts) {
  console.log('\n🧠 Analyzing sentiment on all posts...');

  const relevantPosts = redditPosts.filter(isRelevantPost);
  console.log(`   Relevant posts: ${relevantPosts.length}/${redditPosts.length} (filtered out ${redditPosts.length - relevantPosts.length} irrelevant)`);

  const negativePosts = [];
  const stats = {
    total: relevantPosts.length,
    totalScraped: redditPosts.length,
    negative: 0,
    positive: 0,
    neutral: 0,
    avgSentiment: 0
  };

  let totalScore = 0;

  for (const post of relevantPosts) {
    const fullText = `${post.title || ''} ${post.body || ''}`;
    const analysis = analyzeSentiment(fullText);

    totalScore += analysis.score;

    if (analysis.isNegative) {
      stats.negative++;
      negativePosts.push({
        source: 'reddit',
        author: post.authorName || '[deleted]',
        title: post.title || '',
        content: (post.body || '').substring(0, 500),
        url: post.postUrl || '',
        timestamp: post.createdAt || '',
        upvotes: post.upVotes || 0,
        comments: post.commentsCount || 0,
        subreddit: post.parsedCommunityName || '',
        sentimentScore: analysis.score.toFixed(3),
        hasComplaint: analysis.hasComplaint ? 'Yes' : 'No',
        collectedAt: new Date().toISOString()
      });
    } else if (analysis.score > 0) {
      stats.positive++;
    } else {
      stats.neutral++;
    }
  }

  stats.avgSentiment = relevantPosts.length > 0
    ? (totalScore / relevantPosts.length).toFixed(3)
    : '0';

  console.log(`\n📈 Sentiment Analysis Results:`);
  console.log(`   Total posts: ${stats.total}`);
  console.log(`   Negative: ${stats.negative}`);
  console.log(`   Positive: ${stats.positive}`);
  console.log(`   Neutral: ${stats.neutral}`);
  console.log(`   Average score: ${stats.avgSentiment}`);

  return { posts: negativePosts, stats: stats };
}

// ============================================================================
// DATA EXPORT
// ============================================================================

function ensureOutputDir() {
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
}

async function exportToCsv(negativePosts) {
  ensureOutputDir();

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = path.join(CONFIG.outputDir, `endesa-sentiment-${timestamp}.csv`);

  const csvWriter = createObjectCsvWriter({
    path: filename,
    header: [
      { id: 'author', title: 'Author' },
      { id: 'title', title: 'Title' },
      { id: 'content', title: 'Content' },
      { id: 'url', title: 'URL' },
      { id: 'subreddit', title: 'Subreddit' },
      { id: 'timestamp', title: 'Post Date' },
      { id: 'upvotes', title: 'Upvotes' },
      { id: 'comments', title: 'Comments Count' },
      { id: 'sentimentScore', title: 'Sentiment Score' },
      { id: 'hasComplaint', title: 'Has Complaint' },
      { id: 'collectedAt', title: 'Collected At' }
    ]
  });

  await csvWriter.writeRecords(negativePosts);
  console.log(`\n💾 Exported ${negativePosts.length} posts to ${filename}`);

  return filename;
}

async function exportToExcel(negativePosts, stats) {
  ensureOutputDir();

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = path.join(CONFIG.outputDir, `endesa-sentiment-${timestamp}.xlsx`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Endesa Sentiment Routine';
  workbook.created = new Date();

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('Summary');

  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Value', key: 'value', width: 20 }
  ];

  const headerRow = summarySheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
  headerRow.alignment = { horizontal: 'center' };

  summarySheet.addRows([
    { metric: 'Run Date', value: timestamp },
    { metric: 'Total Posts Analyzed', value: stats.total },
    { metric: 'Total Posts Scraped', value: stats.totalScraped },
    { metric: 'Negative Posts', value: stats.negative },
    { metric: 'Positive Posts', value: stats.positive },
    { metric: 'Neutral Posts', value: stats.neutral },
    {
      metric: 'Negative %',
      value: stats.total > 0 ? `${((stats.negative / stats.total) * 100).toFixed(1)}%` : '0%'
    },
    { metric: 'Average Sentiment Score', value: parseFloat(stats.avgSentiment) },
    { metric: 'Sentiment Threshold', value: CONFIG.sentimentThreshold },
    { metric: 'Search Community', value: REDDIT_CONFIG.withinCommunity },
    { metric: 'Time Range', value: REDDIT_CONFIG.searchTime }
  ]);

  // Zebra striping on summary rows
  summarySheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      const fill = rowNumber % 2 === 0
        ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
        : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      row.eachCell(cell => { cell.fill = fill; });
    }
  });

  // ── Sheet 2: Negative Posts ───────────────────────────────────────────────
  const postsSheet = workbook.addWorksheet('Negative Posts');

  postsSheet.columns = [
    { header: 'Author', key: 'author', width: 18 },
    { header: 'Title', key: 'title', width: 45 },
    { header: 'Content', key: 'content', width: 60 },
    { header: 'URL', key: 'url', width: 50 },
    { header: 'Subreddit', key: 'subreddit', width: 14 },
    { header: 'Post Date', key: 'timestamp', width: 20 },
    { header: 'Upvotes', key: 'upvotes', width: 10 },
    { header: 'Comments', key: 'comments', width: 10 },
    { header: 'Sentiment Score', key: 'sentimentScore', width: 16 },
    { header: 'Has Complaint', key: 'hasComplaint', width: 14 },
    { header: 'Collected At', key: 'collectedAt', width: 22 }
  ];

  const postsHeader = postsSheet.getRow(1);
  postsHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  postsHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC0392B' } };
  postsHeader.alignment = { horizontal: 'center', wrapText: true };
  postsSheet.getRow(1).height = 30;

  negativePosts.forEach((post, i) => {
    const row = postsSheet.addRow(post);
    const fill = i % 2 === 0
      ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF5F5' } }
      : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    row.eachCell(cell => {
      cell.fill = fill;
      cell.alignment = { wrapText: true, vertical: 'top' };
    });

    // Colour sentiment score red if very negative
    const scoreCell = row.getCell('sentimentScore');
    if (parseFloat(post.sentimentScore) < -2) {
      scoreCell.font = { color: { argb: 'FFCC0000' }, bold: true };
    }

    // Clickable URL
    const urlCell = row.getCell('url');
    if (post.url) {
      urlCell.value = { text: post.url, hyperlink: post.url };
      urlCell.font = { color: { argb: 'FF0563C1' }, underline: true };
    }
  });

  postsSheet.autoFilter = { from: 'A1', to: 'K1' };

  await workbook.xlsx.writeFile(filename);
  console.log(`\n📊 Exported ${negativePosts.length} posts to ${filename}`);

  return filename;
}

function commitAndPushResults() {
  try {
    execSync('git config user.email || git config user.email "routine@claude.ai"', { stdio: 'pipe' });
    execSync('git config user.name || git config user.name "Endesa Routine"', { stdio: 'pipe' });

    const status = execSync('git status --porcelain results/', { stdio: 'pipe' }).toString().trim();
    if (!status) {
      console.log('\nℹ️  No new result files to commit.');
      return false;
    }

    const timestamp = new Date().toISOString().split('T')[0];
    execSync('git add results/', { stdio: 'pipe' });
    execSync(`git commit -m "chore: sentiment results ${timestamp}"`, { stdio: 'pipe' });
    execSync('git push', { stdio: 'pipe' });
    console.log(`\n✅ Results committed and pushed to GitHub (results/ — ${timestamp})`);
    return true;
  } catch (err) {
    console.log(`\n⚠️  Git push skipped: ${err.message.split('\n')[0]}`);
    return false;
  }
}

function generateReport(negativePosts, stats) {
  ensureOutputDir();

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = path.join(CONFIG.outputDir, `report-${timestamp}.json`);

  // Extract top topics
  const topicFreq = {};
  negativePosts.forEach(post => {
    const words = (post.title + ' ' + post.content).toLowerCase().split(/\s+/);
    words.forEach(word => {
      if (word.length > 4) {
        topicFreq[word] = (topicFreq[word] || 0) + 1;
      }
    });
  });

  const topTopics = Object.entries(topicFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([topic, count]) => ({ topic, mentions: count }));

  // Most engaged posts
  const mostEngaged = negativePosts
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 5)
    .map(p => ({
      title: p.title,
      upvotes: p.upvotes,
      comments: p.comments,
      score: p.sentimentScore
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalPostsAnalyzed: stats.total,
      negativePostsFound: stats.negative,
      positivePostsFound: stats.positive,
      neutralPostsFound: stats.neutral,
      negativePercentage: stats.total > 0 ? ((stats.negative / stats.total) * 100).toFixed(1) : '0',
      averageSentimentScore: stats.avgSentiment
    },
    topTopics: topTopics,
    mostEngagedNegativePosts: mostEngaged,
    configuration: {
      searchTerms: REDDIT_CONFIG.searchTerms,
      community: REDDIT_CONFIG.withinCommunity,
      timeRange: REDDIT_CONFIG.searchTime,
      sentimentThreshold: CONFIG.sentimentThreshold
    }
  };

  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
  console.log(`\n📊 Report saved to ${filename}`);

  // Print summary
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     ENDESA SENTIMENT ANALYSIS REPORT    ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log(`Total Posts Analyzed:  ${stats.total}`);
  console.log(`Negative Posts Found:  ${stats.negative} (${report.summary.negativePercentage}%)`);
  console.log(`Average Sentiment:     ${stats.avgSentiment}`);
  console.log(`\nTop Topics:`);
  topTopics.forEach((topic, idx) => {
    console.log(`  ${idx + 1}. ${topic.topic} (${topic.mentions} mentions)`);
  });

  return report;
}

// ============================================================================
// MAIN ORCHESTRATION
// ============================================================================

async function runEndesaSentimentRoutine() {
  console.log('\n╔═══════════════════════════════════════════════════╗');
  console.log('║   🚀 ENDESA SENTIMENT ANALYSIS ROUTINE 🚀        ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  const startTime = Date.now();

  try {
    // Step 1: Validate Apify configuration
    console.log('Step 1: Validating Apify configuration...');
    await validateApiKey();

    // Step 2: Start Reddit scrape
    console.log('\nStep 2: Starting Reddit data collection...');
    const runId = await startRedditScrape();

    // Step 3: Wait for completion
    console.log('\nStep 3: Waiting for scraping to complete...');
    await pollActorRun(runId);

    // Step 4: Fetch results
    console.log('\nStep 4: Retrieving scraped data...');
    const redditPosts = await getActorResults(runId);

    if (redditPosts.length === 0) {
      console.warn('⚠️  No posts found. Exiting.');
      return;
    }

    // Step 5: Analyze sentiment
    console.log('\nStep 5: Analyzing sentiment...');
    const { posts: negativePosts, stats } = await filterAndAnalyzePosts(redditPosts);

    if (negativePosts.length === 0) {
      console.log('ℹ️  No negative sentiment posts found.');
    }

    // Step 6: Export results
    console.log('\nStep 6: Exporting results...');
    const csvFile = await exportToCsv(negativePosts);
    const excelFile = await exportToExcel(negativePosts, stats);

    // Step 7: Generate report
    console.log('\nStep 7: Generating report...');
    const report = generateReport(negativePosts, stats);

    // Step 8: Commit and push results to GitHub
    console.log('\nStep 8: Pushing results to GitHub...');
    commitAndPushResults();

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✨ Routine completed in ${duration}s`);
    console.log(`   CSV:   ${csvFile}`);
    console.log(`   Excel: ${excelFile}\n`);

    return {
      status: 'success',
      postsCollected: redditPosts.length,
      negativePostsFound: negativePosts.length,
      stats: stats,
      report: report,
      files: { csv: csvFile, excel: excelFile }
    };
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

// ============================================================================
// EXECUTION
// ============================================================================

if (require.main === module) {
  runEndesaSentimentRoutine();
}

module.exports = { runEndesaSentimentRoutine };
